import Card from '../models/Card.js';
import AccessLog from '../models/AccessLog.js';
import { normalizeUID } from '../utils/normalizeUID.js';

/**
 * Verify card access for an IoT door lock device.
 * POST /api/access/verify
 * Protected by DEVICE_API_KEY.
 */
export async function verifyAccess(req, res, next) {
  try {
    const { uid, deviceId } = req.body || {};

    // Validate presence of required fields
    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required',
      });
    }

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required and must be a non-empty string',
      });
    }

    // 1. Normalize and validate UID
    let normalizedUID;
    try {
      normalizedUID = normalizeUID(uid);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    const cleanDeviceId = deviceId.trim();

    // 2 & 3. Find card in MongoDB
    const card = await Card.findOne({ uid: normalizedUID });

    let authorized = false;
    let result = 'denied';
    let reason = 'unknown_card';
    let message = 'Access denied';

    // 4. Check whether card is active
    if (!card) {
      authorized = false;
      result = 'denied';
      reason = 'unknown_card';
      message = 'Access denied';
    } else if (card.status !== 'active') {
      authorized = false;
      result = 'denied';
      reason = 'revoked_card';
      message = 'Access denied';
    } else {
      authorized = true;
      result = 'granted';
      reason = 'authorized';
      message = 'Access granted';
    }

    // 5. Record every valid access attempt in AccessLog
    await AccessLog.create({
      uid: normalizedUID,
      deviceId: cleanDeviceId,
      result,
      reason,
      timestamp: new Date(),
    });

    // 6. Return authorization result
    return res.status(200).json({
      success: true,
      authorized,
      message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List access logs with pagination and filters (uid, result).
 * GET /api/access-logs
 * Protected by ADMIN_API_KEY.
 */
export async function getAccessLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    // Filter by UID
    if (req.query.uid) {
      try {
        filter.uid = normalizeUID(req.query.uid);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Invalid UID filter: ${err.message}`,
        });
      }
    }

    // Filter by result ('granted' or 'denied')
    if (req.query.result) {
      if (!['granted', 'denied'].includes(req.query.result)) {
        return res.status(400).json({
          success: false,
          message: "Result filter must be either 'granted' or 'denied'",
        });
      }
      filter.result = req.query.result;
    }

    // Query newest records first
    const [logs, total] = await Promise.all([
      AccessLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AccessLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}
