const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validate.middleware');
const { getReports, getReport, updateMarkers } = require('../controllers/genetic.controller');
const NutritionPlan = require('../models/NutritionPlan.model');
const { generateGeneticNutritionPlan } = require('../services/aiGatewayService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ─── Magic-Byte File Type Validator ───
const ALLOWED_SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2D] }, // %PDF-
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D] }, // PNG
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] }, // JPEG/JPG
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WebP)
];

const validateFileMagicBytes = (req, res, next) => {
  if (!req.file) return next();
  if (req.file.buffer.length < 5) return res.status(400).json({ error: 'File is empty.' });
  const buf = req.file.buffer;
  const isAllowed = ALLOWED_SIGNATURES.some(({ bytes }) => bytes.every((b, i) => buf[i] === b));
  if (!isAllowed) return res.status(400).json({ error: 'Invalid file type signature. PDF/Images only.' });
  next();
};

router.use(protect);

/**
 * @route POST /api/genetic/upload
 * @desc Completely re-routed to bypass Gemini and query your secure self-hosted RAG Node
 */
router.post('/upload', authorize('doctor', 'admin'), upload.single('reportFile'), validateFileMagicBytes, async (req, res) => {
  try {
    const { childId } = req.body;
    if (!req.file || !childId) return res.status(400).json({ error: 'Missing required parameters.' });

    // 1. Dispatch file buffer to your persistent local RAG docker service container
    const ragResponse = await generateGeneticNutritionPlan(req.file.buffer, req.file.originalname, req.file.mimetype, childId);

    // 2. Synthesize flat macro integers cleanly into descriptive markdown format blocks
    let planText = `${ragResponse.nutrition_plan.summary}\n\n`;
    if (ragResponse.nutrition_plan.daily_targets) {
      const targets = ragResponse.nutrition_plan.daily_targets;
      planText += `### 📊 Daily Nutritional Targets:\n`;
      if (targets.calories) planText += `- **Calories:** ${targets.calories} kcal\n`;
      if (targets.protein_g) planText += `- **Protein:** ${targets.protein_g}g\n`;
    }

    // 3. Hydrate your custom database sub-schema structures natively
    const newPlan = new NutritionPlan({
      childId: childId,
      status: ragResponse.requires_doctor_review ? 'pending_review' : 'approved',
      approved: !ragResponse.requires_doctor_review,
      aiRecommendation: {
        nutritionPlan: planText.trim(),
        foodRestrictions: ragResponse.nutrition_plan.foods_to_avoid || [],
        supplements: (ragResponse.nutrition_plan.supplements || []).map(s => ({
          name: s.name,
          dosage: s.dose,
          frequency: s.frequency,
          notes: s.reason
        })),
        mealSuggestions: [{
          mealType: 'Recommended Focus Foods',
          suggestions: ragResponse.nutrition_plan.recommended_foods || [],
          restrictions: ragResponse.nutrition_plan.foods_to_avoid || []
        }],
        reasoning: ragResponse.nutrition_plan.notes || '',
        markersAnalyzed: ragResponse.genetic_markers_detected || [],
        generatedAt: new Date()
      }
    });

    const savedRecord = await newPlan.save();
    return res.status(201).json({ success: true, data: savedRecord });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:childId', getReports);
router.get('/report/:id', getReport);
router.put('/report/:id/markers', authorize('doctor', 'admin'), updateMarkers);

module.exports = router;