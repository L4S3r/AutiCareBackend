const GeneticReport = require('../models/GeneticReport.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// @route POST /api/genetic/upload
const uploadReport = async (req, res, next) => {
  try {
    const { childId, manualMarkers, notes } = req.body;
    let reportFileUrl = req.body.reportFileUrl;

    if (req.file) {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const fileName = `${Date.now()}-${req.file.originalname}`;
      fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
      reportFileUrl = `/uploads/${fileName}`;
    }

    let parsedMarkers = [];
    let ocrStatus = 'completed';
    let isProcessed = true;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (req.file && geminiApiKey) {
      try {
        console.log('🔮 Running Gemini Multimodal OCR on genetic report file...');
        const base64Data = req.file.buffer.toString('base64');
        const prompt = `You are a clinical laboratory OCR parser. Examine the attached DNA/genetic screening report. 
Extract genetic markers, result status (e.g., homozygous, heterozygous, normal, positive, negative), values, and notes.
Focus on identifying major ASD-linked nutritional markers like MTHFR, VDR, HLA-DQ2, HLA-DQ8, COMT, FUT2, FADS1, FADS2.
Provide your response strictly in JSON format matching the schema:
{
  "parsedMarkers": [
    {
      "marker": "string (name of gene/marker, e.g. MTHFR)",
      "result": "string (homozygous, heterozygous, positive, negative, normal)",
      "value": "string (exact mutation, e.g. C677T/A1298C, or value)",
      "notes": "string (brief clinical extraction summary of this marker)"
    }
  ]
}`;

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: req.file.mimetype,
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  parsedMarkers: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        marker: { type: 'STRING' },
                        result: { type: 'STRING', enum: ['homozygous', 'heterozygous', 'positive', 'negative', 'normal'] },
                        value: { type: 'STRING' },
                        notes: { type: 'STRING' }
                      },
                      required: ['marker', 'result', 'value', 'notes']
                    }
                  }
                },
                required: ['parsedMarkers']
              }
            }
          },
          { timeout: 35000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.parsedMarkers)) {
            parsedMarkers = parsed.parsedMarkers;
            console.log(`✅ Gemini parsed ${parsedMarkers.length} genetic markers successfully.`);
          }
        }
      } catch (err) {
        const errMessage = err.response?.data?.error?.message || err.message;
        console.error('⚠️ Gemini Multimodal OCR failed:', errMessage);
        ocrStatus = 'failed';
        isProcessed = false;
      }
    } else if (manualMarkers) {
      try {
        parsedMarkers = JSON.parse(manualMarkers);
      } catch (_) {
        parsedMarkers = [];
      }
    }

    const report = await GeneticReport.create({
      childId,
      reportFileUrl,
      reportFileName: req.file?.originalname,
      parsedMarkers,
      uploadedBy: req.user._id,
      notes,
      ocrStatus,
      isProcessed,
    });

    res.status(201).json({ success: true, data: report });
  } catch (err) { next(err); }
};

// @route GET /api/genetic/:childId
const getReports = async (req, res, next) => {
  try {
    const reports = await GeneticReport.find({ childId: req.params.childId })
      .populate('uploadedBy', 'name role').sort('-createdAt');
    res.json({ success: true, data: reports });
  } catch (err) { next(err); }
};

// @route GET /api/genetic/report/:id
const getReport = async (req, res, next) => {
  try {
    const report = await GeneticReport.findById(req.params.id).populate('uploadedBy', 'name role');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

// @route PUT /api/genetic/report/:id/markers
const updateMarkers = async (req, res, next) => {
  try {
    const report = await GeneticReport.findByIdAndUpdate(
      req.params.id, { parsedMarkers: req.body.markers, isProcessed: true, ocrStatus: 'completed' },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = { uploadReport, getReports, getReport, updateMarkers };
