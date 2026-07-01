const GeneticReport = require('../models/GeneticReport.model');
const ChildProfile = require('../models/ChildProfile.model');
const axios = require('axios');
const { randomUUID } = require('crypto');

// Helper: Verify user access to patient file (IDOR prevention)
const checkAccess = (patient, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'Child') {
    return patient._id.toString() === user._id.toString();
  }
  if (user.role === 'parent') {
    return patient.parentId.toString() === user._id.toString();
  }
  const isAssigned =
    (patient.assignedDoctor && patient.assignedDoctor.toString() === user._id.toString()) ||
    (Array.isArray(patient.assignedTherapists) &&
      patient.assignedTherapists.some((t) => t.toString() === user._id.toString()));
  return !!isAssigned;
};

// ─── Confirmed MIME table (mirrors magic-byte check in genetic.routes.js) ────
const SIGNATURE_MIME_MAP = [
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2D], mime: 'application/pdf', ext: 'pdf' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D], mime: 'image/png', ext: 'png' },
  { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', ext: 'jpg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', ext: 'gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', ext: 'webp' },
];

const getMimeFromBuffer = (buf) => {
  for (const sig of SIGNATURE_MIME_MAP) {
    if (sig.bytes.every((b, i) => buf[i] === b)) return sig;
  }
  return null;
};

// @desc Upload a child saliva/DNA screening report or save manual markers
// @route POST /api/genetic/upload
const uploadReport = async (req, res, next) => {
  try {
    const { childId, manualMarkers, notes, laboratory } = req.body;
    const uploadedBy = req.user._id;

    if (!childId) {
      return res.status(400).json({ error: 'Parameter childId is required.' });
    }

    // IDOR verification
    const child = await ChildProfile.findById(childId);
    if (!child) return res.status(404).json({ error: 'Child profile not found' });
    if (!checkAccess(child, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    let reportFileName = 'Manual Case Alignment';
    if (req.file) {
      const sigInfo = getMimeFromBuffer(req.file.buffer);
      const safeExt = sigInfo ? sigInfo.ext : 'bin';
      reportFileName = `${randomUUID()}.${safeExt}`;
    }

    const report = await GeneticReport.create({
      childId,
      reportFileName,
      notes,
      uploadedBy,
      ocrStatus: req.file ? 'processing' : 'completed',
      isProcessed: !req.file,
      laboratory: laboratory || 'Unknown'
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

      const MAX_AI_BUFFER_BYTES = 9 * 1024 * 1024;
      if (req.file.buffer.length > MAX_AI_BUFFER_BYTES) {
        report.ocrStatus = 'failed';
        await report.save();
        return res.status(413).json({ error: 'File exceeds the maximum size allowed for AI processing (9 MB).' });
      }

      const sigInfo = getMimeFromBuffer(req.file.buffer);
      const safeMime = sigInfo ? sigInfo.mime : 'application/octet-stream';

      // ─── PDF Layout-Aware Extraction Integration (FastAPI /parse-pdf) ───
      let extractedText = '';
      if (safeMime === 'application/pdf') {
        try {
          const formData = new FormData();
          const blob = new Blob([req.file.buffer], { type: 'application/pdf' });
          formData.append('file', blob, 'report.pdf');

          const aiServiceUrl = process.env.AI_SERVICE_URL;
          const parseRes = await axios.post(`${aiServiceUrl}/parse-pdf`, formData, {
            timeout: 20000
          });

          if (parseRes.data && parseRes.data.text) {
            extractedText = parseRes.data.text;
          } else if (parseRes.data && parseRes.data.error) {
            throw new Error(parseRes.data.error);
          }
        } catch (pdfErr) {
          console.error("Layout-aware PDF extraction error (FastAPI):", pdfErr.message);
        }
      }

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
        let response;
        if (extractedText) {
          response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: `Here is the layout-aware text parsed from the lab report:\n\n${extractedText}` }
                ]
              }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.15
              }
            },
            { timeout: 25000 }
          );
        } else {
          response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              contents: [{
                parts: [
                  { text: systemPrompt },
                  {
                    inlineData: {
                      mimeType: safeMime,
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
            { timeout: 25000 }
          );
        }

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
    const child = await ChildProfile.findById(req.params.childId);
    if (!child) return res.status(404).json({ error: 'Child profile not found' });
    if (!checkAccess(child, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

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

    const child = await ChildProfile.findById(report.childId);
    if (!child || !checkAccess(child, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc Doctor-approved direct correction payload mapping override
// @route PUT /api/genetic/report/:id/markers
const updateMarkers = async (req, res, next) => {
  try {
    const report = await GeneticReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report reference not found' });

    const child = await ChildProfile.findById(report.childId);
    if (!child || !checkAccess(child, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    report.parsedMarkers = req.body.markers;
    report.isProcessed = true;
    report.ocrStatus = 'completed';
    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadReport, getReports, getReport, updateMarkers };