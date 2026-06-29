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
// Local fallback rule engine
const localRuleEngine = (markers) => {
  const supplements = [];
  const foodRestrictions = [];
  const lifestyleGuidance = [];
  const markersAnalyzed = [];
  const guidelines = [];

  const mealMap = {
    Breakfast: new Set(),
    Lunch: new Set(),
    Dinner: new Set()
  };

  markers.forEach(m => {
    const marker = m.marker?.toUpperCase() || '';
    const result = m.result?.toLowerCase() || '';
    const value = m.value?.toUpperCase() || '';
    
    if (!marker || result === 'negative' || result === 'normal') return;
    markersAnalyzed.push(marker);

    // 1 & 2. MTHFR (C677T / A1298C)
    if (marker.includes('MTHFR')) {
      if (value.includes('C677T') || marker.includes('C677T')) {
        supplements.push({ name: 'L-Methylfolate (Metafolin)', dosage: '400mcg', frequency: 'Daily morning', notes: 'Bypasses severe MTHFR C677T methylation block' });
      } else if (value.includes('A1298C') || marker.includes('A1298C')) {
        supplements.push({ name: 'L-Methylfolate + Methyl-B12', dosage: '400mcg / 500mcg', frequency: 'Daily morning', notes: 'Supports milder MTHFR A1298C methylation pathway' });
      } else {
        supplements.push({ name: 'Methyl Folate (5-MTHF)', dosage: '400mcg', frequency: 'Daily', notes: 'Active form bypasses MTHFR mutation' });
      }
      supplements.push({ name: 'Methylcobalamin (B12)', dosage: '1000mcg', frequency: 'Daily', notes: 'Active B12 form supports MTHFR cofactors' });
      foodRestrictions.push('Avoid synthetic folic acid (fortified wheat/cereals)');
      lifestyleGuidance.push('Monitor homocysteine levels every 6 months');
      guidelines.push('Requires folate-dense green vegetables and methylated B-vitamin cofactors to bypass the MTHFR block.');
      
      mealMap.Breakfast.add('Spinach and pasture-raised egg scramble');
      mealMap.Lunch.add('Clean Lentil Soup with local sprouted wheat flatbread');
      mealMap.Dinner.add('Grilled chicken breast with Molokhia and sprouted local grains');
    }
    
    // 3, 4 & 5. VDR (Taq1 / Bsm1 / Fok1)
    if (marker.includes('VDR')) {
      if (value.includes('TAQ') || marker.includes('TAQ')) {
        supplements.push({ name: 'Vitamin D3 + K2 (High Dose)', dosage: '4000 IU', frequency: 'Daily with fat', notes: 'Compensates for sluggish VDR Taq1 receptor expression' });
      } else if (value.includes('BSM') || marker.includes('BSM')) {
        supplements.push({ name: 'Vitamin D3 + K2', dosage: '2000 IU', frequency: 'Daily', notes: 'Supports VDR Bsm1 receptor expression' });
      } else if (value.includes('FOK') || marker.includes('FOK')) {
        supplements.push({ name: 'Vitamin D3 + K2 (Sublingual)', dosage: '3000 IU', frequency: 'Daily', notes: 'Optimized sublingual absorption for VDR Fok1' });
      } else {
        supplements.push({ name: 'Vitamin D3 + K2', dosage: '2000-4000 IU', frequency: 'Daily with fat', notes: 'Monitor serum 25-OH-D levels' });
      }
      lifestyleGuidance.push('20–30 minutes of safe sun exposure daily');
      guidelines.push('Requires high calcium and Vitamin D absorption optimization to support VDR expression.');
      
      mealMap.Breakfast.add('Ful Medames cooked with pure olive oil');
      mealMap.Lunch.add('Mushroom and pasture-raised egg omelet');
      mealMap.Dinner.add('Clean local baked fish cooked in olive oil with sweet potato mash');
    }
    
    // 6. COMT (Val158Met)
    if (marker.includes('COMT')) {
      foodRestrictions.push('Low tyramine diet (aged cheeses, fermented foods, excessive cacao)');
      supplements.push({ name: 'Magnesium Glycinate', dosage: '200-400mg', frequency: 'Daily evening', notes: 'Supports COMT catecholamine pathway and relaxation' });
      lifestyleGuidance.push('Implement scheduled sensory decompression windows to prevent high-stress overload');
      guidelines.push('Requires low-catechol and low-tyramine foods to avoid overloading slow COMT clearance.');
      
      mealMap.Breakfast.add('Warm clean Lentil Soup with local sprouted wheat flatbread');
      mealMap.Lunch.add('Fresh pasture-raised chicken breast with zucchini ribbons');
      mealMap.Dinner.add('Oven-roasted turkey breast with fresh green beans');
    }
    
    // 7 & 8. HLA-DQ2 / HLA-DQ8
    if (marker.includes('HLA-DQ2') || marker.includes('HLA-DQ8') || marker.includes('HLA-DQ')) {
      foodRestrictions.push('Strict gluten-free diet (wheat, barley, rye)');
      lifestyleGuidance.push('Test for celiac disease antibodies');
      guidelines.push('Requires strict gluten elimination due to HLA-DQ2/8 celiac genetic predisposition.');
      
      mealMap.Breakfast.add('Warm quinoa porridge with wild blueberries');
      mealMap.Lunch.add('Brown rice bowl with steamed vegetables and tahini');
      mealMap.Dinner.add('Grilled chicken with roasted butternut squash');
    }
    
    // 9. FADS1 / FADS2
    if (marker.includes('FADS')) {
      supplements.push({ name: 'Omega-3 (EPA/DHA)', dosage: '1000-2000mg', frequency: 'Daily with meals', notes: 'Compensates for reduced FADS conversion of plant ALA' });
      guidelines.push('Requires pre-formed long-chain omega-3 fatty acids (EPA/DHA) due to poor plant ALA conversion.');
      
      mealMap.Breakfast.add('Ful Medames cooked with pure olive oil and clean local flatbread');
      mealMap.Lunch.add('Local white cheese with sliced cucumber and sprouted grains');
      mealMap.Dinner.add('Clean local baked fish with steamed veggies and herbs');
    }
    
    // 10. FUT2
    if (marker.includes('FUT2') || marker.includes('FUT')) {
      supplements.push({ name: 'Spore-Based Probiotics (Bifidobacterium)', dosage: '10-25 billion CFU', frequency: 'Daily', notes: 'FUT2 non-secretor status limits gut microbiome diversity' });
      guidelines.push('Requires prebiotic-rich foods to feed beneficial gut flora for FUT2 non-secretor status.');
      
      mealMap.Breakfast.add('Warm certified gluten-free oatmeal with dandelion greens');
      mealMap.Lunch.add('Steamed asparagus salad with artichoke hearts');
      mealMap.Dinner.add('Baked chicken breast with roasted chicory root blend');
    }
    
    // 11. TNF-alpha (G308A)
    if (marker.includes('TNF')) {
      lifestyleGuidance.push('Anti-inflammatory diet (Mediterranean and local Egyptian pattern)');
      foodRestrictions.push('Minimize processed foods, refined sugars, and trans fats');
      guidelines.push('Requires antioxidant-rich, anti-inflammatory dietary patterns to suppress TNF-alpha levels.');
      
      mealMap.Breakfast.add('Mixed berry fruit bowl with organic walnuts');
      mealMap.Lunch.add('Turmeric-spiced grilled chicken salad');
      mealMap.Dinner.add('Baked local fish with olive oil and steamed spinach');
    }
  });

  // Safe defaults if list is empty or small
  if (mealMap.Breakfast.size === 0) mealMap.Breakfast.add('Ful Medames cooked with olive oil');
  if (mealMap.Lunch.size === 0) mealMap.Lunch.add('Clean Lentil Soup with local sprouted wheat flatbread');
  if (mealMap.Dinner.size === 0) mealMap.Dinner.add('Molokhia with chicken breast and sprouted local grains');

  return {
    supplements,
    nutritionPlan: `Personalized nutrition plan based on ${markersAnalyzed.length} genetic markers. Core guidelines: ${guidelines.join(' ')} Focus on clean whole foods, adequate hydration, and consistent meal timing.`,
    foodRestrictions: Array.from(new Set(foodRestrictions)),
    mealSuggestions: [
      { mealType: 'Breakfast', suggestions: Array.from(mealMap.Breakfast) },
      { mealType: 'Lunch', suggestions: Array.from(mealMap.Lunch) },
      { mealType: 'Dinner', suggestions: Array.from(mealMap.Dinner) },
    ],
    lifestyleGuidance,
    markersAnalyzed,
    reasoning: `Plan generated dynamically via local rule engine based on ${markersAnalyzed.length} positive genetic markers: ${markersAnalyzed.join(', ')}. All recommendations require physician review before implementation.`,
  };
};

module.exports = { generatePlan, approvePlan, getPlans, getPlan };
