import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cardRoutes from './routes/card.routes.js';
import accessRoutes from './routes/access.routes.js';
import authRoutes from './routes/auth.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import doorRoutes from './routes/door.routes.js';
import { getDBStatus, isDBConnected } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const app = express();

// Trust reverse proxy (Render, Cloudflare, AWS ELB) for correct IP forwarding and rate-limiting
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cross-Origin Resource Sharing (CORS)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (ESP8266, cURL, server-to-server)
      if (!origin) return callback(null, true);

      // Allow configured frontend origin, Vercel deployments, or local dev
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-admin-api-key',
      'x-device-api-key',
    ],
  })
);

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Never rate-limit health checks or authorized hardware polling
    if (req.path === '/api/health') return true;
    if (req.headers['x-device-api-key'] || req.headers['x-api-key']) return true;
    if (
      req.path.startsWith('/api/door/commands') ||
      req.path.startsWith('/api/enrollment/device')
    ) {
      return true;
    }
    return false;
  },
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

app.use(generalLimiter);

// Parse cookies and JSON request bodies
app.use(cookieParser());
app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
  const dbConnected = isDBConnected();
  const dbStatus = getDBStatus();

  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api', accessRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/door', doorRoutes);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export { app };
export default app;
