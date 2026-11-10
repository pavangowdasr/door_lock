import { Router } from 'express';
import {
  unlockDoor,
  lockDoor,
  getNextDeviceCommand,
  acknowledgeCommand,
  getDoorStatus,
} from '../controllers/door.controller.js';
import {
  requireAdminAuth,
  requireDeviceApiKey,
} from '../middleware/auth.middleware.js';

const router = Router();

// Device endpoints (Protected by DEVICE_API_KEY)
router.get('/commands/next', requireDeviceApiKey, getNextDeviceCommand);
router.post('/commands/:commandId/ack', requireDeviceApiKey, acknowledgeCommand);

// Administrator endpoints (Protected by Admin Cookie Session or ADMIN_API_KEY)
router.post('/unlock', requireAdminAuth, unlockDoor);
router.post('/lock', requireAdminAuth, lockDoor);
router.get('/status', requireAdminAuth, getDoorStatus);

export default router;
