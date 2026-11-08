import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

import { app } from './app.js';
import { connectDB, disconnectDB } from './config/database.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Ensure MongoDB connection is established before accepting requests
    await connectDB();

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] IoT RFID Door Lock backend running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handling
    const shutdown = (signal) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await disconnectDB();
          console.log('[Server] Graceful shutdown completed.');
          process.exit(0);
        } catch (err) {
          console.error(`[Server Error] Error during shutdown: ${err.message}`);
          process.exit(1);
        }
      });

      // Force process termination if graceful shutdown times out
      setTimeout(() => {
        console.error('[Server Error] Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error(`[Server Error] Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();
