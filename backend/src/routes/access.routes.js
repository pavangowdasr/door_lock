import { Router } from 'express';
import { verifyAccess, getAccessLogs } from '../controllers/access.controller.js';
import {
  requireDeviceApiKey,
  requireAdminApiKey,
} from '../middleware/auth.middleware.js';

const router = Router();

// Device endpoint for verifying card access
router.post('/access/verify', requireDeviceApiKey, verifyAccess);

// Admin endpoint for viewing access logs
router.get('/access-logs', requireAdminApiKey, getAccessLogs);

export default router;
