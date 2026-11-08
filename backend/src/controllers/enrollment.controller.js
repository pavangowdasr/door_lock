import crypto from 'node:crypto';
import Enrollment from '../models/Enrollment.js';
import { normalizeUID } from '../utils/normalizeUID.js';

const ENROLLMENT_TIMEOUT_SECONDS = 60;

/**
 * Start a new RFID enrollment session for a device.
 * POST /api/enrollment/start
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function startEnrollment(req, res, next) {
  try {
    const { deviceId = 'door-lock-01' } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId must be a non-empty string',
      });
    }

    const cleanDeviceId = deviceId.trim();

    // Cancel any existing pending/waiting sessions for this device
    await Enrollment.updateMany(
      { deviceId: cleanDeviceId, status: 'waiting' },
      { status: 'cancelled' }
    );

    const enrollmentId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ENROLLMENT_TIMEOUT_SECONDS * 1000);

    const session = await Enrollment.create({
      enrollmentId,
      deviceId: cleanDeviceId,
      status: 'waiting',
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: 'Enrollment session started',
      data: {
        enrollmentId: session.enrollmentId,
        deviceId: session.deviceId,
        status: session.status,
        expiresAt: session.expiresAt,
        timeoutSeconds: ENROLLMENT_TIMEOUT_SECONDS,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Check if there is an active enrollment session waiting for the calling IoT device.
 * GET /api/enrollment/device/status?deviceId=door-lock-01
 * Protected by DEVICE_API_KEY.
 */
export async function getDeviceEnrollmentStatus(req, res, next) {
  try {
    const { deviceId } = req.query || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId query parameter is required',
      });
    }

    const cleanDeviceId = deviceId.trim();

    const session = await Enrollment.findOne({
      deviceId: cleanDeviceId,
      status: 'waiting',
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(200).json({
        success: true,
        enrollmentActive: false,
      });
    }

    // Check expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      session.status = 'expired';
      await session.save();

      return res.status(200).json({
        success: true,
        enrollmentActive: false,
      });
    }

    const expiresIn = Math.max(
      0,
      Math.round((session.expiresAt.getTime() - Date.now()) / 1000)
    );

    return res.status(200).json({
      success: true,
      enrollmentActive: true,
      enrollmentId: session.enrollmentId,
      expiresIn,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record a scanned card UID from the IoT device into an active enrollment session.
 * POST /api/enrollment/device/scan
 * Protected by DEVICE_API_KEY.
 *
 * NOTE: Stored as pending scan result only. Does NOT create an authorized Card record.
 */
export async function recordDeviceScan(req, res, next) {
  try {
    const { deviceId, uid, enrollmentId } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required and must be a non-empty string',
      });
    }

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required',
      });
    }

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

    // Query active session for device
    const filter = {
      deviceId: cleanDeviceId,
      status: 'waiting',
    };
    if (enrollmentId && typeof enrollmentId === 'string' && enrollmentId.trim()) {
      filter.enrollmentId = enrollmentId.trim();
    }

    const session = await Enrollment.findOne(filter).sort({ createdAt: -1 });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'No active enrollment session waiting for this device',
      });
    }

    // Check expiration
    if (session.expiresAt.getTime() <= Date.now()) {
      session.status = 'expired';
      await session.save();

      return res.status(410).json({
        success: false,
        message: 'Enrollment session has expired',
      });
    }

    session.status = 'scanned';
    session.scannedUid = normalizedUID;
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Scanned UID recorded successfully',
      data: {
        enrollmentId: session.enrollmentId,
        deviceId: session.deviceId,
        status: 'scanned',
        uid: normalizedUID,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve current status and details of an enrollment session.
 * GET /api/enrollment/:enrollmentId
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function getEnrollmentById(req, res, next) {
  try {
    const { enrollmentId } = req.params;

    const session = await Enrollment.findOne({ enrollmentId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Enrollment session '${enrollmentId}' not found`,
      });
    }

    // Check if session has expired while waiting
    if (session.status === 'waiting' && session.expiresAt.getTime() <= Date.now()) {
      session.status = 'expired';
      await session.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        enrollmentId: session.enrollmentId,
        deviceId: session.deviceId,
        status: session.status,
        scannedUid: session.scannedUid,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        completedAt: session.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel an enrollment session.
 * POST /api/enrollment/:enrollmentId/cancel
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function cancelEnrollment(req, res, next) {
  try {
    const { enrollmentId } = req.params;

    const session = await Enrollment.findOne({ enrollmentId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Enrollment session '${enrollmentId}' not found`,
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an already completed enrollment session',
      });
    }

    session.status = 'cancelled';
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Enrollment session cancelled',
      data: {
        enrollmentId: session.enrollmentId,
        status: 'cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
}
