const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  phone: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'therapist', 'parent'],
    default: 'parent',
    required: true,
  },

  fcmToken: {
    type: String,
    default: null
  },

  clinic: {
    type: String,
    trim: true,
  },
  specialization: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
    required: true,
    index: true,   // rapid-lookup for auth gates
  },
  lastLogin: {
    type: Date,
  },
  refreshToken: {
    type: String,
    select: false,
  },
  language: {
    type: String,
    enum: ['en', 'ar'],
    default: 'en',
  },
  avatar: {
    type: String,
  },
  birthCertificateUrl: {
    type: String,
  },
  nationalIdUrl: {
    type: String,
  },
  medicalLicenseUrl: {
    type: String,
  },
  cvUrl: {
    type: String,
  },
  nationalIdFrontUrl: {
    type: String,
  },
  nationalIdBackUrl: {
    type: String,
  },
  certificate1Url: {
    type: String,
  },
  certificate2Url: {
    type: String,
  },
  // New string tracking keys for professional credentials
  nationalIdFront: {
    type: String,
  },
  nationalIdBack: {
    type: String,
  },
  certificates: [{
    type: String,
  }],
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
