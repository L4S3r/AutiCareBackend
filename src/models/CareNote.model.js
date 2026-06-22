const mongoose = require('mongoose');

const careNoteSchema = new mongoose.Schema({
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChildProfile',
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  authorName: {
    type: String,
    required: true,
    trim: true,
  },
  authorRole: {
    type: String,
    enum: ['Doctor', 'Therapist', 'Parent', 'Clinician'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters'],
  },
  category: {
    type: String,
    enum: ['Medical', 'Therapy', 'Dietary', 'Security'],
    required: true,
  },
  approvedByDoctor: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: String, // Keep string for UI match or let it be generated
  }
}, {
  timestamps: true,
});

// Index for child and sorting by date
careNoteSchema.index({ childId: 1, createdAt: -1 });

module.exports = mongoose.model('CareNote', careNoteSchema);
