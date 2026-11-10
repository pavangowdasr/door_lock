import crypto from 'node:crypto';
import DoorCommand from '../models/DoorCommand.js';
import AccessLog from '../models/AccessLog.js';

const COMMAND_EXPIRATION_SECONDS = 10;
const MAX_UNLOCK_DURATION_MS = 3000;

/**
 * Queue a remote unlock command for an IoT door lock device.
 * POST /api/door/unlock
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function unlockDoor(req, res, next) {
  try {
    const { deviceId = 'door-lock-01', durationMs = 3000 } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId must be a non-empty string',
      });
    }

    const cleanDeviceId = deviceId.trim();

    // Expire any prior pending commands for this device so only one pending command exists
    await DoorCommand.updateMany(
      { deviceId: cleanDeviceId, status: 'pending' },
      { status: 'expired' }
    );

    const safeDuration = Math.min(
      MAX_UNLOCK_DURATION_MS,
      Math.max(1000, Number(durationMs) || 3000)
    );

    const commandId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + COMMAND_EXPIRATION_SECONDS * 1000);

    const command = await DoorCommand.create({
      commandId,
      deviceId: cleanDeviceId,
      type: 'unlock',
      durationMs: safeDuration,
      status: 'pending',
      expiresAt,
    });

    // Record remote admin unlock in audit logs
    await AccessLog.create({
      uid: 'REMOTE_ADMIN',
      deviceId: cleanDeviceId,
      result: 'granted',
      reason: 'remote_admin_unlock',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Remote unlock command queued successfully',
      data: {
        commandId: command.commandId,
        deviceId: command.deviceId,
        type: command.type,
        durationMs: command.durationMs,
        status: command.status,
        expiresAt: command.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Queue an immediate remote lock command for an IoT door lock device.
 * POST /api/door/lock
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function lockDoor(req, res, next) {
  try {
    const { deviceId = 'door-lock-01' } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId must be a non-empty string',
      });
    }

    const cleanDeviceId = deviceId.trim();

    // Supersede any pending unlock or lock commands
    await DoorCommand.updateMany(
      { deviceId: cleanDeviceId, status: 'pending' },
      { status: 'expired' }
    );

    const commandId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + COMMAND_EXPIRATION_SECONDS * 1000);

    const command = await DoorCommand.create({
      commandId,
      deviceId: cleanDeviceId,
      type: 'lock',
      durationMs: 0,
      status: 'pending',
      expiresAt,
    });

    // Record remote admin lock in audit logs
    await AccessLog.create({
      uid: 'REMOTE_ADMIN',
      deviceId: cleanDeviceId,
      result: 'denied',
      reason: 'remote_admin_lock',
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Immediate lock command queued successfully',
      data: {
        commandId: command.commandId,
        deviceId: command.deviceId,
        type: command.type,
        status: command.status,
        expiresAt: command.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Polled by IoT device to retrieve the next pending command.
 * GET /api/door/commands/next?deviceId=door-lock-01
 * Protected by DEVICE_API_KEY.
 */
export async function getNextDeviceCommand(req, res, next) {
  try {
    const { deviceId } = req.query || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId query parameter is required',
      });
    }

    const cleanDeviceId = deviceId.trim();

    // Expire any pending commands whose expiresAt has passed
    await DoorCommand.updateMany(
      {
        deviceId: cleanDeviceId,
        status: 'pending',
        expiresAt: { $lte: new Date() },
      },
      { status: 'expired' }
    );

    // Find the next active pending command
    const command = await DoorCommand.findOne({
      deviceId: cleanDeviceId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: 1 });

    if (!command) {
      return res.status(200).json({
        success: true,
        hasCommand: false,
      });
    }

    return res.status(200).json({
      success: true,
      hasCommand: true,
      command: {
        commandId: command.commandId,
        type: command.type,
        durationMs: command.durationMs,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Acknowledge command receipt and report execution outcome.
 * POST /api/door/commands/:commandId/ack
 * Protected by DEVICE_API_KEY.
 */
export async function acknowledgeCommand(req, res, next) {
  try {
    const { commandId } = req.params;
    const { deviceId, status = 'executed', message } = req.body || {};

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required in body',
      });
    }

    const cleanDeviceId = deviceId.trim();

    const command = await DoorCommand.findOne({
      commandId,
      deviceId: cleanDeviceId,
    });

    if (!command) {
      return res.status(404).json({
        success: false,
        message: `Command '${commandId}' for device '${cleanDeviceId}' not found`,
      });
    }

    if (command.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Command cannot be acknowledged. Current status: '${command.status}'`,
      });
    }

    // Check expiration
    if (command.expiresAt.getTime() <= Date.now()) {
      command.status = 'expired';
      await command.save();

      return res.status(410).json({
        success: false,
        message: 'Command has expired',
      });
    }

    command.status = status === 'failed' ? 'failed' : 'executed';
    command.executedAt = new Date();
    command.completedAt = new Date();
    if (message && typeof message === 'string') {
      command.errorMessage = message.trim();
    }
    await command.save();

    return res.status(200).json({
      success: true,
      message: 'Command execution acknowledged',
      data: {
        commandId: command.commandId,
        status: command.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve current door command status & relay state.
 * GET /api/door/status?deviceId=door-lock-01
 * Protected by Admin Authentication (Cookie or ADMIN_API_KEY).
 */
export async function getDoorStatus(req, res, next) {
  try {
    const { deviceId = 'door-lock-01' } = req.query || {};
    const cleanDeviceId = typeof deviceId === 'string' ? deviceId.trim() : 'door-lock-01';

    // Find the most recent command
    const lastCommand = await DoorCommand.findOne({ deviceId: cleanDeviceId }).sort({
      createdAt: -1,
    });

    // Check expiration if still pending
    if (
      lastCommand &&
      lastCommand.status === 'pending' &&
      lastCommand.expiresAt.getTime() <= Date.now()
    ) {
      lastCommand.status = 'expired';
      await lastCommand.save();
    }

    let relayState = 'locked';
    let remainingUnlockDurationMs = 0;

    if (
      lastCommand &&
      lastCommand.status === 'executed' &&
      lastCommand.type === 'unlock' &&
      lastCommand.executedAt
    ) {
      const elapsed = Date.now() - lastCommand.executedAt.getTime();
      if (elapsed < lastCommand.durationMs) {
        relayState = 'unlocking';
        remainingUnlockDurationMs = lastCommand.durationMs - elapsed;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        deviceId: cleanDeviceId,
        relayState,
        remainingUnlockDurationMs,
        lastCommand: lastCommand
          ? {
              commandId: lastCommand.commandId,
              type: lastCommand.type,
              status: lastCommand.status,
              createdAt: lastCommand.createdAt,
              executedAt: lastCommand.executedAt,
              durationMs: lastCommand.durationMs,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}
