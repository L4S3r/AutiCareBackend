const express = require('express');
const router = express.Router();
const { register, login, refreshToken, getMe, logout, firebaseLogin, checkEmail, handleForgotPasswordRequest } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/firebase-login', firebaseLogin);
router.post('/check-email', checkEmail);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/forgot-password', handleForgotPasswordRequest);
module.exports = router;
