import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import Card from '../src/models/Card.js';
import Enrollment from '../src/models/Enrollment.js';

const TEST_ADMIN_KEY = 'test-admin-secret-key-123';
const TEST_DEVICE_KEY = 'test-device-secret-key-456';
const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/door_lock_test';
const TEST_DEVICE_ID = 'door-lock-01';

let server;
let baseUrl;

describe('RFID Remote Enrollment Suite', () => {
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
    await Card.deleteMany({});
    await Enrollment.deleteMany({});
  });

  // 1 & 2. Admin start enrollment & auth enforcement
  it('should reject starting enrollment without admin auth (401)', async () => {
    const res = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    assert.equal(res.status, 401);
  });

  it('should allow admin to start enrollment with valid ADMIN_API_KEY', async () => {
    const res = await fetch(`${baseUrl}/api/enrollment/start`, {
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
    assert.equal(body.data.deviceId, TEST_DEVICE_ID);
    assert.equal(body.data.status, 'waiting');
    assert.ok(body.data.enrollmentId);
    assert.ok(body.data.expiresAt);
  });

  // 3 & 4. Device poll enrollment status & device auth
  it('should reject device polling without DEVICE_API_KEY (401)', async () => {
    const res = await fetch(
      `${baseUrl}/api/enrollment/device/status?deviceId=${TEST_DEVICE_ID}`
    );
    assert.equal(res.status, 401);
  });

  it('should return active enrollment to authorized device', async () => {
    // Start an enrollment first
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: startData } = await startRes.json();

    // Device polls
    const pollRes = await fetch(
      `${baseUrl}/api/enrollment/device/status?deviceId=${TEST_DEVICE_ID}`,
      {
        headers: {
          'x-api-key': TEST_DEVICE_KEY,
        },
      }
    );
    assert.equal(pollRes.status, 200);
    const pollBody = await pollRes.json();
    assert.equal(pollBody.success, true);
    assert.equal(pollBody.enrollmentActive, true);
    assert.equal(pollBody.enrollmentId, startData.enrollmentId);
    assert.ok(pollBody.expiresIn > 0);
  });

  // 5. Device submits valid UID
  it('should allow device to submit a scanned UID for an active session', async () => {
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: startData } = await startRes.json();

    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'ce:e4-e8 57',
        enrollmentId: startData.enrollmentId,
      }),
    });

    assert.equal(scanRes.status, 200);
    const scanBody = await scanRes.json();
    assert.equal(scanBody.success, true);
    assert.equal(scanBody.data.status, 'scanned');
    assert.equal(scanBody.data.uid, 'CEE4E857');

    // 12. Verification: Card record must NOT be created yet!
    const cardInDb = await Card.findOne({ uid: 'CEE4E857' });
    assert.equal(cardInDb, null, 'Card must not be created upon scan alone');
  });

  // 6. Invalid UID is rejected
  it('should reject invalid hexadecimal UID from device (400)', async () => {
    await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });

    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'NOT-HEX-ZZ',
      }),
    });
    assert.equal(scanRes.status, 400);
  });

  // 7. Device cannot submit without active enrollment
  it('should reject scan if no active enrollment session exists for device (400)', async () => {
    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'CEE4E857',
      }),
    });
    assert.equal(scanRes.status, 400);
  });

  // 8. Expired enrollment rejects scans
  it('should reject scan if enrollment session has expired (410)', async () => {
    // Manually create an expired session
    const expiredSession = await Enrollment.create({
      enrollmentId: 'expired-session-123',
      deviceId: TEST_DEVICE_ID,
      status: 'waiting',
      expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
    });

    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'CEE4E857',
        enrollmentId: expiredSession.enrollmentId,
      }),
    });
    assert.equal(scanRes.status, 410);

    const updatedSession = await Enrollment.findOne({ enrollmentId: expiredSession.enrollmentId });
    assert.equal(updatedSession.status, 'expired');
  });

  // 9. Cancelled enrollment rejects scans
  it('should reject scan if enrollment was cancelled by admin', async () => {
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: startData } = await startRes.json();

    // Admin cancels
    const cancelRes = await fetch(`${baseUrl}/api/enrollment/${startData.enrollmentId}/cancel`, {
      method: 'POST',
      headers: {
        'x-api-key': TEST_ADMIN_KEY,
      },
    });
    assert.equal(cancelRes.status, 200);

    // Device tries to scan
    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'CEE4E857',
        enrollmentId: startData.enrollmentId,
      }),
    });
    assert.equal(scanRes.status, 400);
  });

  // 10. Wrong device ID is rejected
  it('should reject scan submission for a different device ID', async () => {
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: 'door-lock-01' }),
    });
    const { data: startData } = await startRes.json();

    const scanRes = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: 'other-device-99',
        uid: 'CEE4E857',
        enrollmentId: startData.enrollmentId,
      }),
    });
    assert.equal(scanRes.status, 400);
  });

  // 11. Repeated submissions are handled safely
  it('should prevent repeated scan submissions on an already scanned session', async () => {
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: startData } = await startRes.json();

    // First scan
    const firstScan = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'CEE4E857',
        enrollmentId: startData.enrollmentId,
      }),
    });
    assert.equal(firstScan.status, 200);

    // Second scan on same session
    const secondScan = await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: 'B5BC2914',
        enrollmentId: startData.enrollmentId,
      }),
    });
    assert.equal(secondScan.status, 400);
  });

  // 13. Successful admin confirmation registers the card and marks enrollment completed
  it('should complete enrollment session when admin confirms registration at /api/cards', async () => {
    const startRes = await fetch(`${baseUrl}/api/enrollment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID }),
    });
    const { data: startData } = await startRes.json();

    // Device submits scan
    await fetch(`${baseUrl}/api/enrollment/device/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: '7BD01175',
        enrollmentId: startData.enrollmentId,
      }),
    });

    // Admin fetches enrollment state
    const pollRes = await fetch(`${baseUrl}/api/enrollment/${startData.enrollmentId}`, {
      headers: { 'x-api-key': TEST_ADMIN_KEY },
    });
    const pollBody = await pollRes.json();
    assert.equal(pollBody.data.status, 'scanned');
    assert.equal(pollBody.data.scannedUid, '7BD01175');

    // Admin confirms card registration
    const regRes = await fetch(`${baseUrl}/api/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_ADMIN_KEY,
      },
      body: JSON.stringify({
        uid: pollBody.data.scannedUid,
        label: 'Enrolled Keycard',
        enrollmentId: startData.enrollmentId,
      }),
    });
    assert.equal(regRes.status, 201);

    // Verify session is marked completed
    const sessionInDb = await Enrollment.findOne({ enrollmentId: startData.enrollmentId });
    assert.equal(sessionInDb.status, 'completed');
    assert.ok(sessionInDb.completedAt);

    // 14. Existing ESP8266 verification remains functional for newly enrolled card
    const verifyRes = await fetch(`${baseUrl}/api/access/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TEST_DEVICE_KEY,
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        uid: '7BD01175',
      }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.authorized, true);
    assert.equal(verifyBody.message, 'Access granted');
  });
});
