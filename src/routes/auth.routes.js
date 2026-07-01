const express = require('express');
const router = express.Router();
const { register, login, refreshToken, getMe, logout, firebaseLogin, checkEmail, handleForgotPasswordRequest, verifyEmailCallback, syncVerificationStatus } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validate.middleware');
const { upload, validateFileMagicBytes } = require('../middleware/file.middleware');

router.post('/register', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'birthCertificate', maxCount: 1 },
  { name: 'nationalIdDoc', maxCount: 1 },
  { name: 'nationalIdFront', maxCount: 1 },
  { name: 'nationalIdBack', maxCount: 1 },
  { name: 'certificates', maxCount: 5 }
]), validateFileMagicBytes, validate(schemas.registerSchema), register);

router.post('/login', login);
router.post('/firebase-login', validate(schemas.firebaseLoginSchema), firebaseLogin);
router.post('/check-email', checkEmail);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/forgot-password', handleForgotPasswordRequest);
router.get('/verify-email', verifyEmailCallback);

// sync-verification-status: authenticated but must bypass the isVerified gate
// so unverified users can actually call it to unlock their account.
router.post(
  '/sync-verification-status',
  (req, _res, next) => { req.bypassVerificationGate = true; next(); },
  protect,
  syncVerificationStatus,
);

module.exports = router;
