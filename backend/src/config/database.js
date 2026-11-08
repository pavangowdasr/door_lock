import mongoose from 'mongoose';

/**
 * Connect to MongoDB using Mongoose.
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const error = new Error('MONGODB_URI environment variable is not defined.');
    console.error(`[Database Error] ${error.message}`);
    throw error;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("[Database] MongoDB connected");
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from MongoDB cleanly.
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected cleanly.');
  } catch (error) {
    console.error(`[Database Error] Error during MongoDB disconnection: ${error.message}`);
    throw error;
  }
}

/**
 * Check if the MongoDB connection is active.
 * @returns {boolean}
 */
export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get human-readable connection status string.
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected'}
 */
export function getDBStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'disconnected';
}
