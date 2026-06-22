const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildProfile', required: true },
  gameName: {
    type: String,
    enum: ['memory_game', 'attention_game', 'shape_matching', 'emotion_recognition', 'cognitive_puzzle'],
    required: true,
  },
  score: { type: Number, required: true, min: 0 },
  maxScore: { type: Number },
  reactionTime: { type: Number }, // ms
  attentionScore: { type: Number, min: 0, max: 100 },
  memoryScore: { type: Number, min: 0, max: 100 },
  accuracyPercent: { type: Number, min: 0, max: 100 },
  completionTime: { type: Number }, // seconds
  level: { type: Number, default: 1 },
  attempts: { type: Number, default: 1 },
  sessionData: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

gameScoreSchema.index({ childId: 1, gameName: 1, createdAt: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
