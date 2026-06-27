const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const Notification = require('../models/Notification.model');
const jwt = require('jsonwebtoken');
require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const { sendWelcomeEmail, sendPasswordResetEmail, sendChildCredentialsEmail } = require('../services/email.service');
const normalizeAsdLevel = (level) => (level || 'level1').replace(/\s+/g, '').toLowerCase();
const normalizeGender = (gender) => (gender || 'male').toLowerCase();

const maybeCreateParentChild = async ({
  user,
  childName,
  childAge,
  childGender,
  diagnosisLevel,
  childUsername,
  childPassword,
}) => {
  if (user.role !== 'parent' || !childName) return;

  const existingChild = await ChildProfile.findOne({
    parentId: user._id,
    name: childName,
  });

  let createdChild = false;
  if (!existingChild) {
    await ChildProfile.create({
      name: childName,
      username: childUsername,
      password: childPassword,
      dateOfBirth: new Date(
        new Date().getFullYear() - parseInt(childAge || '6', 10),
        0,
        1
      ),
      gender: normalizeGender(childGender),
      asdLevel: normalizeAsdLevel(diagnosisLevel),
      parentId: user._id,
    });
    createdChild = true;
  }

  if (createdChild && childUsername && childPassword) {
    await sendChildCredentialsEmail(
      user.email,
      user.name,
      childName,
      childUsername,
      childPassword
    );
  }
};

// @route POST /api/auth/forgot-password
const handleForgotPasswordRequest = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email query field parameter is required.' });
    }

    // 1. Instruct the Firebase Admin SDK to compile a raw cryptographic link token string
    const targetLink = await getAuth().generatePasswordResetLink(email, {
      url: process.env.FRONTEND_URL || 'http://localhost:3000/app/login',
    });

    // 2. Dispatch your custom styled HTML email layout using Nodemailer
    await sendPasswordResetEmail(email, "AutiCare User", targetLink);

    return res.status(200).json({
      success: true,
      message: 'Styled recovery card sent successfully to email inbox.'
    });
  } catch (err) {
    console.error("✖ Admin SDK failed to generate verification payload strings:", err.message);
    return res.status(500).json({ error: 'Failed to process identity token assignment.' });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      clinic,
      childName,
      childAge,
      childGender,
      diagnosisLevel,
      childUsername,
      childPassword,
    } = req.body;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }

    const emailPrefix = email ? email.split('@')[0].toLowerCase().trim() : '';
    if (emailPrefix && emailPrefix.length >= 3 && password.toLowerCase().includes(emailPrefix)) {
      return res.status(400).json({
        error: 'Password cannot contain your username or email prefix.',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'parent',
      clinic,
    });

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    try {
      const verificationLink = await getAuth().generateEmailVerificationLink(user.email, {
        url: process.env.FRONTEND_URL || 'http://localhost:3000/app/login',
      });
      await sendWelcomeEmail(user.email, user.name, verificationLink);
      await Notification.create({
        userId: user._id,
        title: 'Welcome to AutiCare!',
        message: `Hello ${user.name}, your account has been created successfully!`,
        type: 'success',
        relatedTo: 'system',
      });
    } catch (notifyErr) {
      console.error('Welcome notification failed:', notifyErr.message);
    }

    try {
      await maybeCreateParentChild({
        user,
        childName,
        childAge,
        childGender,
        diagnosisLevel,
        childUsername,
        childPassword,
      });
    } catch (childErr) {
      console.error('Parent child setup failed:', childErr.message);
    }

    res.status(201).json({ success: true, token, refreshToken, user });
  } catch (err) {
    next(err);
  }
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

    res.status(200).json({ success: true, token, refreshToken, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
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
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired, please login again' });
    }
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
  } catch (err) {
    next(err);
  }
};

// @desc    Verify Firebase ID Token & Login / Register user session
// @route   POST /api/auth/firebase-login
const firebaseLogin = async (req, res, next) => {
  try {
    const { idToken, name, role, clinic } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Firebase ID Token is required' });

    let decodedToken;
    if (process.env.NODE_ENV === 'development' && idToken.startsWith('mock_token_')) {
      const email = idToken.replace('mock_token_', '').trim().toLowerCase();
      decodedToken = {
        email,
        uid: `mock_uid_${email.split('@')[0]}`,
        name: name || email.split('@')[0],
      };
      console.log(`Dev mock Firebase login bypass active for: ${email}`);
    } else {
      try {
        decodedToken = await getAuth().verifyIdToken(idToken);
      } catch (verifyErr) {
        return res.status(401).json({ error: 'Invalid Firebase ID Token: ' + verifyErr.message });
      }
    }

    const { email, uid } = decodedToken;
    let user = await User.findOne({ email });
    let isNew = false;

    if (!user) {
      user = await User.create({
        name: name || decodedToken.name || email.split('@')[0],
        email,
        password: `fb_${uid.slice(0, 10)}`,
        role: role || 'parent',
        clinic,
        isActive: true,
      });
      isNew = true;
    }

    try {
      await maybeCreateParentChild({
        user,
        childName: req.body.childName,
        childAge: req.body.childAge,
        childGender: req.body.childGender,
        diagnosisLevel: req.body.diagnosisLevel,
        childUsername: req.body.childUsername,
        childPassword: req.body.childPassword,
      });
    } catch (childErr) {
      console.error('Failed to create child profile in firebaseLogin:', childErr.message);
    }

    const token = generateToken(user._id);
    const rToken = generateRefreshToken(user._id);

    user.refreshToken = rToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    if (isNew) {
      try {
        const verificationLink = await getAuth().generateEmailVerificationLink(user.email, {
          url: process.env.FRONTEND_URL || 'http://localhost:3000/app/login',
        });
        await sendWelcomeEmail(user.email, user.name, verificationLink);
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

    res.status(200).json({
      success: true,
      token,
      refreshToken: rToken,
      user: user.toJSON(),
      isNew,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check if email is registered
// @route   POST /api/auth/check-email
const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      if (user.role === 'parent') {
        const childCount = await ChildProfile.countDocuments({ parentId: user._id });
        return res.status(200).json({ exists: true, role: user.role, hasChild: childCount > 0 });
      }
      return res.status(200).json({ exists: true, role: user.role, hasChild: true });
    }

    res.status(200).json({ exists: false });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  firebaseLogin,
  checkEmail,
  handleForgotPasswordRequest,
};
