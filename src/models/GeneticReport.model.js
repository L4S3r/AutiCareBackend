const mongoose = require('mongoose');

const geneticMarkerSchema = new mongoose.Schema({
  marker: { type: String, required: true },
  result: { type: String, enum: ['positive', 'negative', 'heterozygous', 'homozygous', 'unknown'], default: 'unknown' },
  value: { type: String },
  notes: { type: String },
});

const geneticReportSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildProfile', required: true },
  reportFileUrl: { type: String },
  reportFileName: { type: String },
  laboratory: { type: String, enum: ['Al-Borg', 'Alfa', 'GASC', 'Unknown'], default: 'Unknown' },
  parsedMarkers: [geneticMarkerSchema],
  rawText: { type: String },
  ocrStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String },
  isProcessed: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('GeneticReport', geneticReportSchema);
