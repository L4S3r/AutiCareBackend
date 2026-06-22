const NutritionPlan = require('../models/NutritionPlan.model');
const GeneticReport = require('../models/GeneticReport.model');
const ChildProfile = require('../models/ChildProfile.model');
const axios = require('axios');

// @route POST /api/nutrition/generate
const generatePlan = async (req, res, next) => {
  try {
    const { childId, geneticReportId } = req.body;
    const report = await GeneticReport.findById(geneticReportId);
    if (!report) return res.status(404).json({ error: 'Genetic report not found' });

    const child = await ChildProfile.findById(childId);
    if (!child) return res.status(404).json({ error: 'Child profile not found' });

    let aiRecommendation;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && report.parsedMarkers && report.parsedMarkers.length > 0) {
      try {
        console.log('🔮 Querying Gemini for AI Nutrition Plan generation...');
        const prompt = `You are AutiCare AI, an expert pediatric nutrigenomics planner.
Analyze the following positive genetic markers extracted for patient ${child.name} (Age: ${child.calculatedAge || child.age || 'Unknown'}, ASD Level: ${child.asdLevel}):

Positive Genetic Markers:
${report.parsedMarkers.map(m => `  - ${m.marker}: ${m.result} (${m.value || ''}) - ${m.notes || ''}`).join('\n')}

Generate a comprehensive clinical nutrigenomics recommendation. Identify:
1. Supplements: Target active cofactors bypassing genetic blockages (e.g. Metafolin for MTHFR C677T/A1298C, active D3+K2 for VDR, etc.). Include dosage, frequency, and scientific reasoning.
2. Nutrition Plan: Detailed summary guidelines of dietary recommendations (e.g., GFCF, anti-inflammatory).
3. Food Restrictions: Concrete food items to eliminate.
4. Meal Suggestions: Provide 3 concrete suggestions for Breakfast, Lunch, and Dinner.
5. Lifestyle Guidance: Outdoor sunlight, sensory decompression windows, sleep pacing.
6. Scientific Reasoning: Explanation of why this plan fits their genotype.

Reply strictly in JSON format matching the schema:
{
  "supplements": [
    { "name": "string", "dosage": "string", "frequency": "string", "notes": "string" }
  ],
  "nutritionPlan": "string",
  "foodRestrictions": ["string"],
  "mealSuggestions": [
    { "mealType": "Breakfast" | "Lunch" | "Dinner", "suggestions": ["string"] }
  ],
  "lifestyleGuidance": ["string"],
  "reasoning": "string"
}`;

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  supplements: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING' },
                        dosage: { type: 'STRING' },
                        frequency: { type: 'STRING' },
                        notes: { type: 'STRING' }
                      },
                      required: ['name', 'dosage', 'frequency', 'notes']
                    }
                  },
                  nutritionPlan: { type: 'STRING' },
                  foodRestrictions: { type: 'ARRAY', items: { type: 'STRING' } },
                  mealSuggestions: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        mealType: { type: 'STRING', enum: ['Breakfast', 'Lunch', 'Dinner'] },
                        suggestions: { type: 'ARRAY', items: { type: 'STRING' } }
                      },
                      required: ['mealType', 'suggestions']
                    }
                  },
                  lifestyleGuidance: { type: 'ARRAY', items: { type: 'STRING' } },
                  reasoning: { type: 'STRING' }
                },
                required: ['supplements', 'nutritionPlan', 'foodRestrictions', 'mealSuggestions', 'lifestyleGuidance', 'reasoning']
              }
            }
          },
          { timeout: 35000 }
        );

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) {
          const parsedRec = JSON.parse(resultText);
          aiRecommendation = {
            ...parsedRec,
            markersAnalyzed: report.parsedMarkers.map(m => m.marker)
          };
          console.log('✅ Gemini Nutrition Plan generated successfully.');
        }
      } catch (err) {
        console.error('⚠️ Gemini Nutrition Plan generation failed:', err.response?.data?.error?.message || err.message);
      }
    }

    if (!aiRecommendation) {
      // Fallback local rule engine
      console.log('⚡ Running fallback local rule engine for nutrition plan...');
      aiRecommendation = localRuleEngine(report.parsedMarkers);
    }

    const plan = await NutritionPlan.create({
      childId, geneticReportId,
      aiRecommendation: { ...aiRecommendation, generatedAt: new Date() },
      status: 'pending_review',
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) { next(err); }
};

// @route PUT /api/nutrition/:id/approve
const approvePlan = async (req, res, next) => {
  try {
    const { doctorNotes, doctorEdits } = req.body;
    const plan = await NutritionPlan.findByIdAndUpdate(req.params.id, {
      doctorNotes, doctorEdits, approved: true, approvedBy: req.user._id,
      approvedAt: new Date(), status: 'approved',
    }, { new: true }).populate('approvedBy', 'name');
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
};

// @route GET /api/nutrition/:childId
const getPlans = async (req, res, next) => {
  try {
    const plans = await NutritionPlan.find({ childId: req.params.childId })
      .populate('approvedBy', 'name').sort('-createdAt');
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
};

// @route GET /api/nutrition/plan/:id
const getPlan = async (req, res, next) => {
  try {
    const plan = await NutritionPlan.findById(req.params.id).populate('approvedBy', 'name specialization');
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
};

// Local fallback rule engine
const localRuleEngine = (markers) => {
  const supplements = [];
  const foodRestrictions = [];
  const lifestyleGuidance = [];
  const markersAnalyzed = [];

  markers.forEach(m => {
    const marker = m.marker?.toUpperCase();
    const result = m.result;
    if (!marker || result === 'negative') return;
    markersAnalyzed.push(marker);

    if (marker.includes('MTHFR')) {
      supplements.push({ name: 'Methyl Folate (5-MTHF)', dosage: '400-800mcg', frequency: 'Daily', notes: 'Active form bypasses MTHFR mutation' });
      supplements.push({ name: 'Methylcobalamin (B12)', dosage: '1000mcg', frequency: 'Daily', notes: 'Active B12 form' });
      foodRestrictions.push('Avoid synthetic folic acid (fortified foods)');
      lifestyleGuidance.push('Monitor homocysteine levels every 6 months');
    }
    if (marker === 'VDR') {
      supplements.push({ name: 'Vitamin D3 + K2', dosage: '2000-4000 IU', frequency: 'Daily with fat', notes: 'Monitor serum 25-OH-D levels' });
      lifestyleGuidance.push('20–30 minutes of safe sun exposure daily');
    }
    if (marker === 'COMT') {
      foodRestrictions.push('Low tyramine diet (aged cheeses, fermented foods)');
      supplements.push({ name: 'Magnesium Glycinate', dosage: '200mg', frequency: 'Daily evening', notes: 'Supports COMT pathway' });
    }
    if (marker === 'HLA-DQ2' || marker === 'HLA-DQ8') {
      foodRestrictions.push('Strict gluten-free diet (wheat, barley, rye)');
      lifestyleGuidance.push('Test for celiac disease antibodies');
    }
    if (marker === 'FADS1' || marker === 'FADS2') {
      supplements.push({ name: 'Omega-3 (EPA/DHA)', dosage: '1000-2000mg', frequency: 'Daily with meals', notes: 'Compensates for reduced FADS conversion' });
    }
    if (marker === 'FUT2') {
      supplements.push({ name: 'Bifidobacterium Probiotic', dosage: '10-25 billion CFU', frequency: 'Daily', notes: 'FUT2 variants reduce gut microbiome diversity' });
    }
    if (marker === 'TNF-ALPHA') {
      lifestyleGuidance.push('Anti-inflammatory diet (Mediterranean pattern)');
      foodRestrictions.push('Minimize processed foods, refined sugars, trans fats');
    }
  });

  return {
    supplements,
    nutritionPlan: 'Personalized nutrition plan based on genetic analysis. Focus on whole foods, adequate hydration, and consistent meal timing.',
    foodRestrictions,
    mealSuggestions: [
      { mealType: 'Breakfast', suggestions: ['Eggs with leafy greens', 'Gluten-free oats with berries', 'Smoothie with nut butter'], restrictions: [] },
      { mealType: 'Lunch', suggestions: ['Grilled protein with colorful vegetables', 'Quinoa bowl', 'Legume soup'], restrictions: [] },
      { mealType: 'Dinner', suggestions: ['Fatty fish with sweet potato', 'Chicken with roasted vegetables', 'Rice with beans and greens'], restrictions: [] },
    ],
    lifestyleGuidance,
    markersAnalyzed,
    reasoning: `Plan generated based on ${markersAnalyzed.length} positive genetic markers. All recommendations require physician review before implementation.`,
  };
};

module.exports = { generatePlan, approvePlan, getPlans, getPlan };
