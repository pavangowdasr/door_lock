import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, getMe, logout } from '../controllers/auth.controller.js';
import { requireAdminApiKey } from '../middleware/auth.middleware.js';

const router = Router();

// Dedicated rate limiting for login attempts to mitigate brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
});

router.post('/login', loginLimiter, login);
router.get('/me', requireAdminApiKey, getMe);
router.post('/logout', logout);

export default router;
