require('dotenv').config();
const app = require('../src/app');
const connectDB = require('../src/config/database');

/**
 * Vercel Serverless Handler for Express
 *
 * Vercel spins functions up/down on demand — calling app.listen() won't work.
 * Instead, we export a handler that:
 *   1. Connects to MongoDB once per function instance (cached)
 *   2. Forwards every request to the Express app
 */

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return app(req, res);
};
