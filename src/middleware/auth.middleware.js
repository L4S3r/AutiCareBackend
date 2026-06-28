const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { AppError } = require('./error.middleware');

// ─── Boot-time Cryptographic Key Guard ────────────────────────────────────────
// Throws immediately if the signing secrets are absent so the process fails
// loudly at startup rather than silently signing tokens with trivial fallbacks.
// A server missing these env vars must never reach a running state.
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new AppError(
    'Cryptographic Integrity Failure: JWT_SECRET and JWT_REFRESH_SECRET must be set. ' +
    'Insecure fallback signing keys are blocked in production environments.',
    500
  );
}

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ error: 'Not authorized. No token.' });

    // JWT_SECRET is guaranteed non-empty by the boot guard above
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive.' });

    // Email verification gate — blocks dashboard access until the user clicks
    // the verification link sent at registration. Firebase/Google users are
    // pre-verified and will have isVerified === true already.
    // The /sync-verification-status route sets bypassVerificationGate = true
    // so that unverified users can call it to unlock their account.
    if (!user.isVerified && !req.bypassVerificationGate) {
      return res.status(403).json({
        error: 'Email not verified. Please check your inbox and click the verification link before accessing the dashboard.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired.' });
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Role '${req.user.role}' is not authorized for this action.` });
  }
  next();
};

// No fallback strings — secrets are validated at module load time above.
const generateToken        = (id) => jwt.sign({ id }, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN         || '15m' });
const generateRefreshToken = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'  });

module.exports = { protect, authorize, generateToken, generateRefreshToken };
