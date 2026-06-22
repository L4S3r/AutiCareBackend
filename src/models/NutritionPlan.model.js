const mongoose = require('mongoose');

const supplementSchema = new mongoose.Schema({
  name: String,
  dosage: String,
  frequency: String,
  notes: String,
});

const mealSchema = new mongoose.Schema({
  mealType: String,
  suggestions: [String],
  restrictions: [String],
});

const nutritionPlanSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildProfile', required: true },
  geneticReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneticReport' },
  aiRecommendation: {
    supplements: [supplementSchema],
    nutritionPlan: { type: String },
    foodRestrictions: [String],
    mealSuggestions: [mealSchema],
    lifestyleGuidance: [String],
    reasoning: { type: String },
    markersAnalyzed: [String],
    generatedAt: { type: Date, default: Date.now },
  },
  doctorNotes: { type: String },
  doctorEdits: { type: mongoose.Schema.Types.Mixed },
  approved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  status: { type: String, enum: ['draft', 'pending_review', 'approved', 'rejected'], default: 'draft' },
  disclaimer: { type: String, default: 'This AI-generated plan requires physician approval before implementation.' },
}, { timestamps: true });

module.exports = mongoose.model('NutritionPlan', nutritionPlanSchema);
