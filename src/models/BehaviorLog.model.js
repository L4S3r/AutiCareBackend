const mongoose = require('mongoose');

const behaviorLogSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildProfile', required: true },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now, required: true },
  mood: { type: String, enum: ['very_happy', 'happy', 'neutral', 'sad', 'very_sad', 'anxious', 'angry'], required: true },
  sleepHours: { type: Number, min: 0, max: 24 },
  sleepQuality: { type: String, enum: ['excellent', 'good', 'fair', 'poor'] },
  meals: [{
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    quality: { type: String, enum: ['excellent', 'good', 'fair', 'poor'] },
    notes: String,
  }],
  mealQualityScore: { type: Number, min: 0, max: 10 },
  medication: [{
    name: String,
    taken: Boolean,
    time: String,
  }],
  meltdowns: { type: Number, default: 0, min: 0 },
  meltdownSeverity: { type: String, enum: ['mild', 'moderate', 'severe', 'none'] },
  meltdownTriggers: [String],
  therapyAttended: { type: Boolean },
  therapyType: { type: String },
  socialInteractions: { type: Number, min: 0 },
  notes: { type: String, maxlength: 2000 },
  aiRiskScore: { type: Number, min: 0, max: 100 },
  aiAlerts: [String],
}, { timestamps: true });

behaviorLogSchema.index({ childId: 1, date: -1 });

module.exports = mongoose.model('BehaviorLog', behaviorLogSchema);
