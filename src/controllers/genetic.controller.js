const GeneticReport = require('../models/GeneticReport.model');
const axios = require('axios');

// @desc Upload a child saliva/DNA screening report or save manual markers
// @route POST /api/genetic/upload
const uploadReport = async (req, res, next) => {
  try {
    const { childId, manualMarkers, notes } = req.body;
    const uploadedBy = req.user._id;

    if (!childId) {
      return res.status(400).json({ error: 'Parameter childId is required.' });
    }

    const reportFileName = req.file ? req.file.originalname : 'Manual Case Alignment';

    // 1. Persist the tracking doc instance in MongoDB (default state is 'pending')
    const report = await GeneticReport.create({
      childId,
      reportFileName,
      notes,
      uploadedBy,
      ocrStatus: req.file ? 'processing' : 'completed',
      isProcessed: !req.file
    });

    // ─── Case A: Manual Multi-Marker Input Override ───
    if (!req.file && manualMarkers) {
      let markersArray = [];
      try {
        markersArray = typeof manualMarkers === 'string' ? JSON.parse(manualMarkers) : manualMarkers;
      } catch (e) {
        markersArray = [];
      }

      report.parsedMarkers = markersArray;
      await report.save();
      return res.status(201).json({
        success: true,
        data: report,
        message: 'Manual genomic markers recorded successfully.'
      });
    }

    // ─── Case B: Multimodal OCR PDF/Image Analysis Loop ───
    if (req.file) {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        report.ocrStatus = 'failed';
        await report.save();
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not defined.' });
      }

      // Convert buffer stream directly into a base64 string container
      const base64Data = req.file.buffer.toString('base64');

      const systemPrompt = `Extract genetic markers, result status (homozygous, heterozygous, positive, negative, normal), variant values, and clinical notes from this autism-specific lab screening. 
      Isolate high-impact genomic variations linked to neurodevelopmental or methylation cofactors: MTHFR (C677T/A1298C), VDR, COMT, HLA-DQ2, HLA-DQ8, FUT2, FADS1, FADS2, TNF-alpha.
      Bypass formatting anomalies or minor typos. Return your evaluation strictly in a JSON array matching this strict schema:
      {
        "parsedMarkers": [
          {
            "marker": "string (e.g., MTHFR)",
            "result": "string (homozygous, heterozygous, positive, negative, normal)",
            "value": "string (exact location mutation text, e.g., C677T, or leave empty)",
            "notes": "string (one concise sentence outlining functional metabolic impact)"
          }
        ]
      }`;

      try {
        // Direct REST pipeline execution safely below Vercel's standard lambda execution limit thresholds
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            contents: [{
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: req.file.mimetype || 'application/pdf',
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.15
            }
          },
          { timeout: 25000 } // Fails safely inside standard serverless route cycles
        );

        const aiResponseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiResponseText) {
          const cleanStructuredData = JSON.parse(aiResponseText.trim());

          if (cleanStructuredData.parsedMarkers) {
            report.parsedMarkers = cleanStructuredData.parsedMarkers;
            report.ocrStatus = 'completed';
            report.isProcessed = true;
            report.rawText = aiResponseText;
            await report.save();
          } else {
            throw new Error("Target parent node 'parsedMarkers' was missing in structural JSON generation.");
          }
        } else {
          throw new Error("Received an empty content payload candidate array from the Gemini gateway.");
        }

      } catch (aiProcessingErr) {
        console.error("✖ Multimodal Medical Core Processing Error:", aiProcessingErr.message);
        report.ocrStatus = 'failed';
        await report.save();

        // Return 200 with clear flags so the Doctor UI doesn't freeze or crash out completely
        return res.status(200).json({
          success: false,
          error: 'AI parsing temporarily timed out or mismatched. Please verify markers manually.',
          data: report
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: report,
      message: 'Medical report document loaded and evaluated safely.'
    });
  } catch (err) {
    next(err);
  }
};

// @desc Retrieve all genetic report records linked to a specific child
// @route GET /api/genetic/:childId
const getReports = async (req, res, next) => {
  try {
    const reports = await GeneticReport.find({ childId: req.params.childId })
      .populate('uploadedBy', 'name role')
      .sort('-createdAt');
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
};

// @desc Fetch data records for an explicit single report ID instance
// @route GET /api/genetic/report/:id
const getReport = async (req, res, next) => {
  try {
    const report = await GeneticReport.findById(req.params.id).populate('uploadedBy', 'name role');
    if (!report) return res.status(404).json({ error: 'Report reference not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc Doctor-approved direct correction payload mapping override
// @route PUT /api/genetic/report/:id/markers
const updateMarkers = async (req, res, next) => {
  try {
    const report = await GeneticReport.findByIdAndUpdate(
      req.params.id,
      {
        parsedMarkers: req.body.markers,
        isProcessed: true,
        ocrStatus: 'completed'
      },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report reference not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadReport, getReports, getReport, updateMarkers };