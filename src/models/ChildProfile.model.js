const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const childProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Child name is required'],
    trim: true,
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    unique: true,
  },
  password: {
    type: String,
    select: false,
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
  },
  age: {
    type: Number,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  diagnosisDate: {
    type: Date,
  },
  asdLevel: {
    type: String,
    enum: ['level1', 'level2', 'level3', 'not_specified'],
    default: 'not_specified',
  },
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
  },
  allergies: [{ type: String }],
  currentMedications: [{ type: String }],
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedTherapists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  avatar: {
    type: String,
  },
  fcmToken: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for age calculation
childProfileSchema.virtual('calculatedAge').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

// Hash password before saving
childProfileSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
childProfileSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('ChildProfile', childProfileSchema);
