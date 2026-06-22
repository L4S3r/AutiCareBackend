const User = require('../models/User.model');
const { generateToken, generateRefreshToken } = require('../middleware/auth.middleware');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, clinic } = req.body;
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

module.exports = { register, login, refreshToken, getMe, logout };
