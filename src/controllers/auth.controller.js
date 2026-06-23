const User = require('../models/User.model');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, clinic } = req.body;
    
    // Enforce password complexity check for legacy registrations
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    // Enforce username (email prefix) check
    const emailPrefix = email ? email.split('@')[0].toLowerCase().trim() : '';
    if (emailPrefix && emailPrefix.length >= 3 && password.toLowerCase().includes(emailPrefix)) {
      return res.status(400).json({
        error: 'Password cannot contain your username or email prefix.'
      });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, password, phone, role: role || 'parent', clinic });
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, token, refreshToken, user });
  } catch (err) { next(err); }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const userData = user.toJSON();
    res.status(200).json({ success: true, token, refreshToken, user: userData });
  } catch (err) { next(err); }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: rToken } = req.body;
    if (!rToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== rToken) return res.status(401).json({ error: 'Invalid refresh token' });

    const token = generateToken(user._id);
    const newRefresh = generateRefreshToken(user._id);
    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, token, refreshToken: newRefresh });
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Refresh token expired, please login again' });
    next(err);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @desc    Logout
// @route   POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

const admin = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { sendWelcomeEmail } = require('../services/email.service');
const Notification = require('../models/Notification.model');

// @desc    Verify Firebase ID Token & Login / Register user session
// @route   POST /api/auth/firebase-login
const firebaseLogin = async (req, res, next) => {
  try {
    const { idToken, name, role, clinic } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Firebase ID Token is required' });

    // Verify the Firebase ID Token using Firebase Admin SDK
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (verifyErr) {
      return res.status(401).json({ error: 'Invalid Firebase ID Token: ' + verifyErr.message });
    }

    const { email, uid } = decodedToken;

    // Look up user in local MongoDB
    let user = await User.findOne({ email });
    let isNew = false;

    if (!user) {
      // If user does not exist in local MongoDB, create their profile now
      const dummyPassword = `fb_${uid.slice(0, 10)}`;
      user = await User.create({
        name: name || decodedToken.name || email.split('@')[0],
        email,
        password: dummyPassword,
        role: role || 'parent',
        clinic,
        isActive: true,
      });
      isNew = true;

      // Handle child profile creation for new parents if child info is provided
      if (user.role === 'parent' && req.body.childName) {
        const ChildProfile = require('../models/ChildProfile.model');
        try {
          await ChildProfile.create({
            name: req.body.childName,
            dateOfBirth: new Date(new Date().getFullYear() - parseInt(req.body.childAge || '6'), 0, 1),
            gender: (req.body.childGender || 'male').toLowerCase(),
            asdLevel: (req.body.diagnosisLevel || 'level1').replace(/\s+/g, '').toLowerCase(),
            parentId: user._id
          });
        } catch (childErr) {
          console.error('Failed to create child profile in firebaseLogin:', childErr.message);
        }
      }
    }

    // Generate our JWT tokens for local API session
    const token = generateToken(user._id);
    const rToken = generateRefreshToken(user._id);

    user.refreshToken = rToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Send welcome email and in-app notification if new signup
    if (isNew) {
      try {
        await sendWelcomeEmail(user.email, user.name);
        await Notification.create({
          userId: user._id,
          title: 'Welcome to AutiCare!',
          message: `Hello ${user.name}, your account has been successfully verified!`,
          type: 'success',
          relatedTo: 'system',
        });
      } catch (notifyErr) {
        console.error('Failed to trigger welcome notifications:', notifyErr.message);
      }
    }

    const userData = user.toJSON();
    res.status(200).json({ success: true, token, refreshToken: rToken, user: userData, isNew });
  } catch (err) { next(err); }
};

// @desc    Check if email is registered
// @route   POST /api/auth/check-email
const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      return res.status(200).json({ exists: true, role: user.role });
    }
    res.status(200).json({ exists: false });
  } catch (err) { next(err); }
};

module.exports = { register, login, refreshToken, getMe, logout, firebaseLogin, checkEmail };
