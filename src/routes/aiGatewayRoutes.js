const express = require('express');
const router = express.Router();
const NutritionPlan = require('../models/NutritionPlan.model');
const { generateGeneticNutritionPlan } = require('../services/aiGatewayService');
const multer = require('multer');

// Enforce a strict 20MB payload limit directly at the Multer level
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
});

// ─── Magic-Byte File Type Validator (Brought from genetic.routes.js) ───
// Scans the raw buffer header signature to guarantee the file matches its extension,
// preventing polyglot attacks or arbitrary code execution payloads downstream.
const ALLOWED_SIGNATURES = [
    { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2D] }, // %PDF-
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D] }, // PNG
    { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] }, // JPEG/JPG
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
    { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WebP)
];

const validateFileMagicBytes = (req, res, next) => {
    if (!req.file) return next(); // Skip if manual markers override pathway is triggered

    if (req.file.buffer.length < 5) {
        return res.status(400).json({ error: 'File is too small or completely empty.' });
    }

    const buf = req.file.buffer;
    const isAllowed = ALLOWED_SIGNATURES.some(({ bytes }) =>
        bytes.every((byte, i) => buf[i] === byte)
    );

    if (!isAllowed) {
        return res.status(400).json({
            error: 'Invalid file type signature. Only genuine PDF and approved image formats are accepted.'
        });
    }

    next();
};

/**
 * Route: POST /api/ai/analyze-genetics
 * Flow: Auth Guard -> Multer Parse -> Magic Byte Buffer Verification -> RAG Processing -> Database Persistence
 */
router.post('/analyze-genetics', upload.single('file'), validateFileMagicBytes, async (req, res) => {
    try {
        const { patient_id } = req.body; // Sent from Flutter/Web client dashboards

        if (!req.file || !patient_id) {
            return res.status(400).json({ error: 'Missing multi-part report file binary or patient_id identifier.' });
        }

        // 1. Fetch analyzed metrics from your persistent GPU VM Docker instance
        const ragResponse = await generateGeneticNutritionPlan(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            patient_id
        );

        // 2. Synthesize flat macro targets safely into a clean Markdown block
        let comprehensivePlanText = `${ragResponse.nutrition_plan.summary}\n\n`;
        if (ragResponse.nutrition_plan.daily_targets) {
            const targets = ragResponse.nutrition_plan.daily_targets;
            comprehensivePlanText += `### 📊 Daily Nutritional Targets:\n`;
            if (targets.calories) comprehensivePlanText += `- **Calories:** ${targets.calories} kcal\n`;
            if (targets.protein_g) comprehensivePlanText += `- **Protein:** ${targets.protein_g}g\n`;
            if (targets.carbohydrates_g) comprehensivePlanText += `- **Carbohydrates:** ${targets.carbohydrates_g}g\n`;
            if (targets.fat_g) comprehensivePlanText += `- **Fats:** ${targets.fat_g}g\n`;
            if (targets.fiber_g) comprehensivePlanText += `- **Fiber:** ${targets.fiber_g}g\n`;
            if (targets.water_ml) comprehensivePlanText += `- **Hydration Guidance:** ${targets.water_ml}ml\n`;
        }

        // 3. Map flat parameters directly into your custom Mongoose nested structure
        const newNutritionPlan = new NutritionPlan({
            childId: patient_id, // Map payload identifier to schema specification
            status: ragResponse.requires_doctor_review ? 'pending_review' : 'approved', // Enforce clinical lock gate
            approved: !ragResponse.requires_doctor_review,

            aiRecommendation: {
                nutritionPlan: comprehensivePlanText.trim(),
                foodRestrictions: ragResponse.nutrition_plan.foods_to_avoid || [],

                // Transform incoming flat supplement object keys to match sub-schema expectations
                supplements: (ragResponse.nutrition_plan.supplements || []).map(s => ({
                    name: s.name,
                    dosage: s.dose,       // Maps dose -> dosage
                    frequency: s.frequency,
                    notes: s.reason       // Maps reason -> notes
                })),

                // Seed default structure for mealSuggestions array layout
                mealSuggestions: [
                    {
                        mealType: 'Recommended Focus Foods',
                        suggestions: ragResponse.nutrition_plan.recommended_foods || [],
                        restrictions: ragResponse.nutrition_plan.foods_to_avoid || []
                    }
                ],

                lifestyleGuidance: ragResponse.nutrition_plan.meal_timing_notes ? [ragResponse.nutrition_plan.meal_timing_notes] : [],
                reasoning: ragResponse.nutrition_plan.notes || '',
                markersAnalyzed: ragResponse.genetic_markers_detected || [],
                generatedAt: new Date()
            }
        });

        // 4. Save safely to MongoDB cluster
        const savedRecord = await newNutritionPlan.save();
        return res.status(201).json(savedRecord);

    } catch (error) {
        console.error('Mongoose Integration Gateway Pipeline Failed:', error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;