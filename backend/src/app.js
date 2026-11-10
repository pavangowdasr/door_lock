import express from 'express';
import helmet from 'helmet';
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

// Security middleware
app.use(helmet());

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
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
