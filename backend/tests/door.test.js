import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import DoorCommand from '../src/models/DoorCommand.js';
import AccessLog from '../src/models/AccessLog.js';

const TEST_ADMIN_KEY = 'test-admin-secret-key-123';
const TEST_DEVICE_KEY = 'test-device-secret-key-456';
const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/door_lock_test';
const TEST_DEVICE_ID = 'door-lock-01';

let server;
let baseUrl;

describe('Remote Door Control Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    process.env.DEVICE_API_KEY = TEST_DEVICE_KEY;
    process.env.MONGODB_URI = TEST_MONGODB_URI;

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await DoorCommand.deleteMany({});
    await AccessLog.deleteMany({});
  });

  // 1. Unauthenticated administrator cannot unlock
  it('should reject remote unlock without admin credentials (401)', async () => {
    const res = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    assert.equal(res.status, 401);
  });

  // 2. Authenticated administrator can unlock
  it('should allow authenticated admin to queue a remote unlock command', async () => {
    const res = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID, durationMs: 3000 }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.deviceId, TEST_DEVICE_ID);
    assert.equal(body.data.type, 'unlock');
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.durationMs, 3000);
    assert.ok(body.data.commandId);

    // Verify audit log entry
    const log = await AccessLog.findOne({ reason: 'remote_admin_unlock' });
    assert.ok(log);
    assert.equal(log.uid, 'REMOTE_ADMIN');
    assert.equal(log.result, 'granted');
  });

  // 3. Authenticated administrator can lock
  it('should allow authenticated admin to queue an immediate lock command', async () => {
    const res = await fetch(`${baseUrl}/api/door/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.type, 'lock');
    assert.equal(body.data.status, 'pending');

    // Verify audit log entry
    const log = await AccessLog.findOne({ reason: 'remote_admin_lock' });
    assert.ok(log);
    assert.equal(log.uid, 'REMOTE_ADMIN');
    assert.equal(log.result, 'denied');
  });

  // 4. Unauthenticated device cannot poll commands
  it('should reject device polling without DEVICE_API_KEY (401)', async () => {
    const res = await fetch(
      `${baseUrl}/api/door/commands/next?deviceId=${TEST_DEVICE_ID}`
    );
    assert.equal(res.status, 401);
  });

  // 5. Device can retrieve pending commands
  it('should allow device with DEVICE_API_KEY to retrieve the next pending command', async () => {
    // Admin queues unlock
    const unlockRes = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: unlockData } = await unlockRes.json();

    // Device polls next command
    const pollRes = await fetch(
      `${baseUrl}/api/door/commands/next?deviceId=${TEST_DEVICE_ID}`,
      {
        headers: { 'x-api-key': TEST_DEVICE_KEY },
      }
    );
    assert.equal(pollRes.status, 200);
    const pollBody = await pollRes.json();
    assert.equal(pollBody.success, true);
    assert.equal(pollBody.hasCommand, true);
    assert.equal(pollBody.command.commandId, unlockData.commandId);
    assert.equal(pollBody.command.type, 'unlock');
    assert.equal(pollBody.command.durationMs, 3000);
  });

  // 6. Device acknowledges command execution
  it('should allow device to acknowledge execution of a command', async () => {
    const unlockRes = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: unlockData } = await unlockRes.json();

    const ackRes = await fetch(
      `${baseUrl}/api/door/commands/${unlockData.commandId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({
          deviceId: TEST_DEVICE_ID,
          status: 'executed',
        }),
      }
    );
    assert.equal(ackRes.status, 200);
    const ackBody = await ackRes.json();
    assert.equal(ackBody.success, true);
    assert.equal(ackBody.data.status, 'executed');

    // Polling again should yield no pending command
    const nextRes = await fetch(
      `${baseUrl}/api/door/commands/next?deviceId=${TEST_DEVICE_ID}`,
      {
        headers: { 'x-api-key': TEST_DEVICE_KEY },
      }
    );
    const nextBody = await nextRes.json();
    assert.equal(nextBody.hasCommand, false);
  });

  // 7. Repeated commands cannot execute twice
  it('should reject acknowledging an already executed command', async () => {
    const unlockRes = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: unlockData } = await unlockRes.json();

    // First ack
    await fetch(`${baseUrl}/api/door/commands/${unlockData.commandId}/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID, status: 'executed' }),
    });

    // Second ack should fail
    const secondAckRes = await fetch(
      `${baseUrl}/api/door/commands/${unlockData.commandId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({ deviceId: TEST_DEVICE_ID, status: 'executed' }),
      }
    );
    assert.equal(secondAckRes.status, 400);
  });

  // 8. Expired commands are rejected
  it('should reject expired commands when polling or acknowledging', async () => {
    const expiredCmd = await DoorCommand.create({
      commandId: 'expired-cmd-999',
      deviceId: TEST_DEVICE_ID,
      type: 'unlock',
      durationMs: 3000,
      status: 'pending',
      expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    });

    // Polling should mark it expired and return hasCommand: false
    const pollRes = await fetch(
      `${baseUrl}/api/door/commands/next?deviceId=${TEST_DEVICE_ID}`,
      {
        headers: { 'x-api-key': TEST_DEVICE_KEY },
      }
    );
    const pollBody = await pollRes.json();
    assert.equal(pollBody.hasCommand, false);

    // Acking should be rejected with 410 or 400
    const ackRes = await fetch(
      `${baseUrl}/api/door/commands/${expiredCmd.commandId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({ deviceId: TEST_DEVICE_ID, status: 'executed' }),
      }
    );
    assert.equal(ackRes.status, 400); // Already expired by polling
  });

  // 9. Wrong device ID is rejected
  it('should reject command acknowledgement from a different device ID', async () => {
    const unlockRes = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: unlockData } = await unlockRes.json();

    const ackRes = await fetch(
      `${baseUrl}/api/door/commands/${unlockData.commandId}/ack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({ deviceId: 'wrong-device-99', status: 'executed' }),
      }
    );
    assert.equal(ackRes.status, 404);
  });

  // 10. Lock command supersedes a pending unlock
  it('should supersede a pending unlock command when an immediate lock is queued', async () => {
    // 1. Queue unlock
    const unlockRes = await fetch(`${baseUrl}/api/door/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: unlockData } = await unlockRes.json();

    // 2. Queue lock immediately
    const lockRes = await fetch(`${baseUrl}/api/door/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: lockData } = await lockRes.json();

    // Verify earlier unlock command status is now expired/superseded
    const priorUnlock = await DoorCommand.findOne({ commandId: unlockData.commandId });
    assert.equal(priorUnlock.status, 'expired');

    // Device should receive the lock command next
    const pollRes = await fetch(
      `${baseUrl}/api/door/commands/next?deviceId=${TEST_DEVICE_ID}`,
      {
        headers: { 'x-api-key': TEST_DEVICE_KEY },
      }
    );
    const pollBody = await pollRes.json();
    assert.equal(pollBody.hasCommand, true);
    assert.equal(pollBody.command.commandId, lockData.commandId);
    assert.equal(pollBody.command.type, 'lock');
  });

  // 11. Admin can fetch door status
  it('should return current door status and relay state to admin', async () => {
    const res = await fetch(`${baseUrl}/api/door/status?deviceId=${TEST_DEVICE_ID}`, {
      headers: { 'x-api-key': TEST_ADMIN_KEY },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.deviceId, TEST_DEVICE_ID);
    assert.equal(body.data.relayState, 'locked');
  });
});
