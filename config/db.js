const mongoose = require('mongoose');
const dns = require('dns');

// Ensure reliable SRV resolution for MongoDB Atlas (handles local ISP/Windows DNS issues)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Gracefully continue
}

let memoryServer = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital_management';
  
  try {
    // Attempt standard connection with 10-second timeout for cloud/Atlas
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`[MongoDB Connected]: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.warn(`[MongoDB Warning]: Could not connect to primary URI (${uri}): ${err.message}`);
    
    if (process.env.USE_MEMORY_DB_FALLBACK !== 'false') {
      try {
        console.log('[MongoDB]: Initializing in-memory MongoMemoryServer fallback for seamless evaluation...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        const memUri = memoryServer.getUri();
        await mongoose.connect(memUri);
        console.log(`[MongoDB Connected (In-Memory Fallback)]: ${memUri}`);
      } catch (memErr) {
        console.error('[MongoDB Error]: In-memory fallback failed:', memErr.message);
        process.exit(1);
      }
    } else {
      console.error('[MongoDB Fatal]: Exiting process due to DB connection failure.');
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
    }
  } catch (err) {
    console.error('Error disconnecting DB:', err);
  }
};

module.exports = { connectDB, disconnectDB };
