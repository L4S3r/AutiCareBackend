require('dotenv').config();
const app = require('../src/app');
const connectDB = require('../src/config/database');

let isConnected = false;

module.exports = async (req, res) => {
  // ✅ Short-circuit preflight immediately — CORS is handled by Express middleware,
  //    no DB connection needed whatsoever for OPTIONS.
  if (req.method === 'OPTIONS') {
    return app(req, res);
  }

  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('❌ DB connection failed:', err.message);
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again shortly.',
      });
    }
  }

  return app(req, res);
};