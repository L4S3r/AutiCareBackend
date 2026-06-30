const mongoose = require('mongoose');
const User = require('../models/User.model');

// Cache the connection across serverless invocations.
let cachedConn = null;

const cleanupStaleData = async () => {
  try {
    console.log('🧹 Running database cleanup for unhashed or stale accounts...');
    
    // 1. Delete users matching joker_364 in username, name, or email
    const deletedStale = await User.deleteMany({
      $or: [
        { username: 'joker_364' },
        { name: 'joker_364' },
        { email: /joker_364/i }
      ]
    });
    if (deletedStale.deletedCount > 0) {
      console.log(`🧹 Dropped ${deletedStale.deletedCount} stale joker_364 accounts.`);
    }

    // 2. Delete users with unhashed/plain text passwords
    const users = await User.find({}).select('+password');
    let deletedUnhashedCount = 0;
    
    for (const user of users) {
      const isHashed = user.password && user.password.startsWith('$2') && user.password.length === 60;
      if (!isHashed) {
        await User.deleteOne({ _id: user._id });
        deletedUnhashedCount++;
      }
    }
    
    if (deletedUnhashedCount > 0) {
      console.log(`🧹 Dropped ${deletedUnhashedCount} users with unhashed passwords.`);
    }
  } catch (err) {
    console.error('❌ Database cleanup error:', err.message);
  }
};

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

  // --- Production / Atlas ---
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

  // Run database cleanup to drop stale unhashed accounts
  await cleanupStaleData();

  cachedConn = conn;
  return conn;
};

module.exports = connectDB;
