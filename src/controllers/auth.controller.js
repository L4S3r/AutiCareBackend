const axios = require('axios');
const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const Notification = require('../models/Notification.model');
const jwt = require('jsonwebtoken');
require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const { sendWelcomeEmail, sendPasswordResetEmail, sendChildCredentialsEmail } = require('../services/email.service');
const { uploadStream } = require('../services/storage.service');

const normalizeAsdLevel = (level) => (level || 'level1').replace(/\s+/g, '').toLowerCase();
const normalizeGender = (gender) => (gender || 'male').toLowerCase();

// ─── Helper: Create child profile for parent ──────────────────────────────────
const maybeCreateParentChild = async ({
  user, childName, childAge, childGender,
  diagnosisLevel, childUsername, childPassword,
  avatar, birthCertificateUrl,
  skipEmail = false,
}) => {
  if (user.role !== 'parent' || !childName) return;

  const existingChild = await ChildProfile.findOne({ parentId: user._id, name: childName });
  if (existingChild) return;

  const child = await ChildProfile.create({
    name: childName,
    username: childUsername,
    password: childPassword,
    dateOfBirth: new Date(new Date().getFullYear() - parseInt(childAge || '6', 10), 0, 1),
    gender: normalizeGender(childGender),
    asdLevel: normalizeAsdLevel(diagnosisLevel),
    parentId: user._id,
    avatar,
    birthCertificateUrl,
  });

  if (!skipEmail && childUsername && childPassword) {
    await sendChildCredentialsEmail(user.email, user.name, childName, childUsername, childPassword);
  }

  return child;
};

// ─── Helper: Sync Firebase user (create or clean orphan) ─────────────────────

const syncFirebaseUser = async (email, password, displayName) => {
  // Check if orphaned Firebase account exists and remove it
  try {
    const existing = await getAuth().getUserByEmail(email);
    await getAuth().deleteUser(existing.uid);
    console.log(`🗑️ Removed orphaned Firebase account for: ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      console.error('Firebase pre-check error:', err.message);
    }
    // auth/user-not-found is expected — no orphan, continue
  }

  // Create fresh Firebase user
  const firebaseUser = await getAuth().createUser({ email, password, displayName });
  return firebaseUser.uid;
};

// ─── Helper: Send verification email via Nodemailer ──────────────────────────

const sendVerificationEmail = async (email, name) => {
  const verificationLink = await getAuth().generateEmailVerificationLink(email, {
    url: process.env.FRONTEND_URL || 'https://auti-care-frontend.vercel.app/app/login',
  });
  await sendWelcomeEmail(email, name, verificationLink);
  console.log(`✉️ Custom verification email sent to: ${email}`);
};

// ─── @route POST /api/auth/register ──────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const {
      name, email, password, phone, role, clinic,
      childName, childAge, childGender, diagnosisLevel,
      childUsername, childPassword,
    } = req.body;

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.',
      });
    }

    // Password must not contain email prefix
    const emailPrefix = email ? email.split('@')[0].toLowerCase().trim() : '';
    if (emailPrefix.length >= 3 && password.toLowerCase().includes(emailPrefix)) {
      return res.status(400).json({ error: 'Password cannot contain your email prefix.' });
    }

    const emailStr = email.toLowerCase().trim();
    const allowedRoles = ['parent', 'doctor', 'therapist'];
    const resolvedRole = allowedRoles.includes(role) ? role : 'parent';

    let avatarUrl = undefined;
    let birthCertificateUrl = undefined;

    if (req.files) {
      const avatarFile = req.files['avatar']?.[0];
      const bcFile = req.files['birthCertificate']?.[0];

      if (avatarFile) {
        try {
          const uploadRes = await uploadStream(avatarFile.buffer, {
            folder: 'auticare/avatars',
            resource_type: 'image',
          });
          avatarUrl = uploadRes.secure_url;
        } catch (uploadErr) {
          console.error('Failed to upload avatar:', uploadErr.message);
        }
      }

      if (bcFile) {
        try {
          const uploadRes = await uploadStream(bcFile.buffer, {
            folder: 'auticare/birth_certificates',
            resource_type: 'auto',
          });
          birthCertificateUrl = uploadRes.secure_url;
        } catch (uploadErr) {
          console.error('Failed to upload birth certificate:', uploadErr.message);
        }
      }
    }

    // 1. Validate parent email against User early
    const existing = await User.findOne({ email: emailStr });
    if (existing) {
      return res.status(400).json({
        error: "Email address is already registered inside our healthcare registry.",
      });
    }

    // 2. Validate proposed childUsername early
    if (resolvedRole === 'parent' && childUsername) {
      const existingChild = await ChildProfile.findOne({ username: childUsername.toLowerCase().trim() });
      if (existingChild) {
        return res.status(400).json({
          error: "Child username is already taken. Please try another combination.",
        });
      }
    }

    // 3. Only after both local database validation steps evaluate as clean and unique, sync Firebase
    let firebaseUid;
    try {
      firebaseUid = await syncFirebaseUser(emailStr, password, name);
    } catch (fbErr) {
      if (fbErr.code === 'auth/email-already-exists') {
        return res.status(400).json({
          error: "Email address is already registered inside our healthcare registry.",
        });
      }
      // Log but don't block registration if Firebase fails
      console.error('Firebase user creation failed:', fbErr.message);
    }

    // 4. Write Mongoose documents sequentially
    const user = await User.create({
      name: (name || '').trim(),
      email: emailStr,
      password,
      phone: phone || undefined,
      role: resolvedRole,
      clinic: clinic || undefined,
      avatar: resolvedRole !== 'parent' ? avatarUrl : undefined,
    });

    // Generate JWT tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    let childProfile = null;
    try {
      childProfile = await maybeCreateParentChild({
        user,
        childName,
        childAge,
        childGender,
        diagnosisLevel,
        childUsername,
        childPassword,
        avatar: avatarUrl,
        birthCertificateUrl,
        skipEmail: true,
      });
    } catch (childErr) {
      console.error('Parent child setup failed:', childErr.message);
    }

    // 5. Execute asynchronous email notification systems at the absolute end
    try {
      if (firebaseUid) {
        await sendVerificationEmail(user.email, user.name);
      }
      if (childProfile && childUsername && childPassword) {
        await sendChildCredentialsEmail(user.email, user.name, childName, childUsername, childPassword);
      }
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

    res.status(201).json({ success: true, token, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// ─── @route POST /api/auth/login ─────────────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const emailStr = email.toLowerCase().trim();

    // Step A: Attempt a standard query on the User collection
    let account = await User.findOne({ email: emailStr }).select('+password');
    let isChild = false;

    // Step B: Secondary fallback lookup inside ChildProfile collection
    if (!account) {
      account = await ChildProfile.findOne({ username: emailStr }).select('+password');
      if (account) {
        isChild = true;
      }
    }

    // Step C: Combined validation check
    if (!account) {
      return res.status(401).json({ error: 'Invalid email address, username, or password.' });
    }

    let isMatch = await account.comparePassword(password);

    // Admin Firebase Auth fallback check
    if (!isMatch && !isChild && account.role === 'admin') {
      try {
        const apiKey = process.env.FIREBASE_API_KEY;
        const response = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
          email: account.email,
          password: password,
          returnSecureToken: true
        });
        if (response.data && response.data.localId) {
          isMatch = true;
          // Synchronize password to MongoDB
          account.password = password;
          await account.save();
          console.log(`🔒 Synchronized admin password for ${account.email} in MongoDB.`);
        }
      } catch (fbErr) {
        console.error('Firebase Auth fallback verification failed for admin:', fbErr.message);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email address, username, or password.' });
    }

    if (!account.isActive) {
      return res.status(403).json({
        error: 'Account suspended. Contact your clinical administrator.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Step D: Session payload signs JWT matching _id and returns normalized role: 'Child' for child profiles
    const token = generateToken(account._id);
    const refreshToken = generateRefreshToken(account._id);

    if (isChild) {
      const childObj = account.toObject();
      delete childObj.password;
      childObj.role = 'Child';

      res.status(200).json({
        success: true,
        token,
        refreshToken,
        user: childObj,
      });
    } else {
      account.refreshToken = refreshToken;
      account.lastLogin = new Date();
      await account.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        token,
        refreshToken,
        user: account.toJSON(),
      });
    }
  } catch (err) {
    next(err);
  }
};

// ─── @route POST /api/auth/refresh ───────────────────────────────────────────

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: rToken } = req.body;
    if (!rToken) return res.status(401).json({ error: 'Refresh token required' });

    // JWT_REFRESH_SECRET guaranteed non-empty by boot guard in auth.middleware.js
    const decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET);
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

// ─── @route GET /api/auth/me ──────────────────────────────────────────────────

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─── @route POST /api/auth/logout ────────────────────────────────────────────

const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── @route POST /api/auth/firebase-login ────────────────────────────────────

const firebaseLogin = async (req, res, next) => {
  try {
    const { idToken, name, role, clinic } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Firebase ID Token is required' });

    // Strictly validate every token through firebase-admin — no dev bypass allowed
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (verifyErr) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Firebase ID Token.' });
    }

    const { email, uid, email_verified: firebaseEmailVerified } = decodedToken;
    let user = await User.findOne({ email });
    
    if (user && !user.isActive) {
      return res.status(403).json({
        error: 'Account suspended. Contact your clinical administrator.',
        code: 'ACCOUNT_DISABLED',
      });
    }
    
    let isNew = false;

    if (!user) {
      // Mass-assignment guard: only whitelisted fields allowed
      const allowedRoles = ['parent', 'doctor', 'therapist'];
      const resolvedRole = allowedRoles.includes(role) ? role : 'parent';

      // Enforce complete child details only during new parent signup
      if (resolvedRole === 'parent') {
        const { childName, childAge, childGender, diagnosisLevel, childUsername, childPassword } = req.body;
        if (!childName || !childAge || !childGender || !diagnosisLevel || !childUsername || !childPassword) {
          return res.status(400).json({ error: 'Parent registration requires complete child profile details (childName, childAge, childGender, diagnosisLevel, childUsername, childPassword).' });
        }
      }

      user = await User.create({
        name: (name || decodedToken.name || email.split('@')[0]).trim(),
        email,
        password: `fb_${uid.slice(0, 10)}`,
        role: resolvedRole,
        clinic: clinic || undefined,
        isActive: true,
        isVerified: firebaseEmailVerified === true,
      });
      isNew = true;
    } else if (firebaseEmailVerified === true && !user.isVerified) {
      // Sync verification status for returning users who clicked the link
      user.isVerified = true;
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
        // Google users are already verified via Google — just send a welcome (no verify link needed)
        await sendWelcomeEmail(user.email, user.name, process.env.FRONTEND_URL || 'https://auti-care-frontend.vercel.app/app/login');
        await Notification.create({
          userId: user._id,
          title: 'Welcome to AutiCare!',
          message: `Hello ${user.name}, your account has been successfully created!`,
          type: 'success',
          relatedTo: 'system',
        });
      } catch (notifyErr) {
        console.error('Failed to trigger welcome notifications:', notifyErr.message);
      }
    }

    res.status(200).json({ success: true, token, refreshToken: rToken, user: user.toJSON(), isNew });
  } catch (err) {
    next(err);
  }
};

// ─── @route POST /api/auth/check-email ───────────────────────────────────────

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

// ─── @route POST /api/auth/forgot-password ───────────────────────────────────

const handleForgotPasswordRequest = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const resetLink = await getAuth().generatePasswordResetLink(email, {
      url: process.env.FRONTEND_URL || 'https://auti-care-frontend.vercel.app/app/login',
    });

    await sendPasswordResetEmail(email, 'AutiCare User', resetLink);

    return res.status(200).json({ success: true, message: 'Password reset email sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    return res.status(500).json({ error: 'Failed to send password reset email.' });
  }
};

// ─── @route GET /api/auth/verify-email ───────────────────────────────────────
// Firebase redirects here after the user clicks the email-verification link.
// We sync isVerified → true and redirect the browser to the login page.

const verifyEmailCallback = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email query parameter is required.' });

    // Confirm with Firebase that the account is now verified
    let firebaseUser;
    try {
      firebaseUser = await getAuth().getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: 'Firebase account not found for this email.' });
    }

    if (!firebaseUser.emailVerified) {
      return res.status(400).json({ error: 'Email has not been verified yet. Please click the link in your inbox.' });
    }

    // Stamp local DB record
    await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { isVerified: true },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://auti-care-frontend.vercel.app/app/login';
    return res.redirect(`${frontendUrl}?verified=true`);
  } catch (err) {
    next(err);
  }
};

// ─── @route POST /api/auth/sync-verification-status ──────────────────────────
// Called by the unverified overlay / VerifyEmailScreen "I Have Verified" button.
// Requires the protect middleware so only authenticated (but unverified) users
// can reach it. Checks Firebase, stamps the DB, returns a fresh user snapshot.

const syncVerificationStatus = async (req, res, next) => {
  try {
    const user = req.user; // injected by protect — token is valid but isVerified may be false

    // Re-confirm with Firebase
    let firebaseUser;
    try {
      firebaseUser = await getAuth().getUserByEmail(user.email);
    } catch {
      return res.status(404).json({ error: 'Firebase account not found.' });
    }

    if (!firebaseUser.emailVerified) {
      return res.status(200).json({ verified: false });
    }

    // Stamp the DB if not already done
    if (!user.isVerified) {
      await User.findByIdAndUpdate(user._id, { isVerified: true });
    }

    // Return a fresh user snapshot so clients can update local state
    const refreshed = await User.findById(user._id).select('-password -refreshToken');
    return res.status(200).json({ verified: true, user: refreshed });
  } catch (err) {
    next(err);
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  firebaseLogin,
  checkEmail,
  handleForgotPasswordRequest,
  verifyEmailCallback,
  syncVerificationStatus,
};