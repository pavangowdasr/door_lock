import { Router } from 'express';
import {
  startEnrollment,
  getDeviceEnrollmentStatus,
  recordDeviceScan,
  getEnrollmentById,
  cancelEnrollment,
} from '../controllers/enrollment.controller.js';
import {
  requireAdminAuth,
  requireDeviceApiKey,
} from '../middleware/auth.middleware.js';

const router = Router();

// Device endpoints (Protected by DEVICE_API_KEY)
router.get('/device/status', requireDeviceApiKey, getDeviceEnrollmentStatus);
router.post('/device/scan', requireDeviceApiKey, recordDeviceScan);

// Administrator endpoints (Protected by Admin Cookie Session or ADMIN_API_KEY)
router.post('/start', requireAdminAuth, startEnrollment);
router.get('/:enrollmentId', requireAdminAuth, getEnrollmentById);
router.post('/:enrollmentId/cancel', requireAdminAuth, cancelEnrollment);

export default router;
