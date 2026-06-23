const mongoose = require('mongoose');

// Cache the connection across serverless invocations.
// Vercel keeps the function container alive for a while after each request,
// so subsequent requests reuse this connection instead of opening a new one.
let cachedConn = null;

const connectDB = async () => {
  // Reuse existing live connection
  if (cachedConn && mongoose.connection.readyState === 1) {
    console.log('♻️  Reusing cached MongoDB connection');
    return cachedConn;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
  let isMemoryDb = false;

  // --- Development / Local ---
  // Fall back to in-memory DB only when not in production and no Atlas URI supplied
  if (!isProduction && !process.env.MONGO_URI) {
    try {
      console.log('🔄 Attempting connection to local MongoDB...');
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2000,
      });
      console.log(`✅ MongoDB connected (local): ${conn.connection.host}`);
      cachedConn = conn;
      return conn;
    } catch (err) {
      console.log('⚠️  Local MongoDB not active. Starting mongodb-memory-server...');
      await mongoose.disconnect();

      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      isMemoryDb = true;
      console.log(`🚀 In-memory MongoDB started at: ${mongoUri}`);

      // Keep a reference so it can be shut down gracefully if needed
      mongoose.mongoServerInstance = mongoServer;
    }
  }

  // --- Production / Atlas (or in-memory fallback above) ---
  if (isProduction && !process.env.MONGO_URI) {
    throw new Error(
      '❌ MONGO_URI environment variable is not set. ' +
      'Add it in Vercel → Project Settings → Environment Variables.'
    );
  }

  const conn = await mongoose.connect(mongoUri);
  console.log(`✅ MongoDB connected: ${conn.connection.host} (in-memory: ${isMemoryDb})`);

  // Run seeder after first connection
  const seedData = require('./seeder');
  await seedData();

  cachedConn = conn;
  return conn;
};

module.exports = connectDB;
