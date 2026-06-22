const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
    let isMemoryDb = false;

    // Check if we should fall back to memory server
    if (process.env.NODE_ENV === 'development' || !process.env.MONGO_URI) {
      try {
        console.log('🔄 Attempting connection to local MongoDB...');
        // Try quick connection with short timeout to see if local mongod is running
        const conn = await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 2000,
        });
        console.log(`✅ MongoDB connected (local): ${conn.connection.host}`);
        return conn;
      } catch (err) {
        console.log('⚠️ Local MongoDB service not active. Initializing mongodb-memory-server...');
        await mongoose.disconnect();
        
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        isMemoryDb = true;
        console.log(`🚀 Programmatic In-memory MongoDB Server launched at: ${mongoUri}`);
        
        // Cache server instance so we can shut it down later if needed
        mongoose.mongoServerInstance = mongoServer;
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB connected: ${conn.connection.host} (In-Memory: ${isMemoryDb})`);
    
    // Trigger seeder
    const seedData = require('./seeder');
    await seedData();

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
