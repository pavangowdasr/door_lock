import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import Card from '../src/models/Card.js';
import AccessLog from '../src/models/AccessLog.js';

const TEST_ADMIN_KEY = 'test-admin-secret-key-123';
const TEST_DEVICE_KEY = 'test-device-secret-key-456';
const TEST_PORT = 5055;
const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/door_lock_test';

let server;
let baseUrl;

describe('IoT RFID Door Lock Backend Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    process.env.DEVICE_API_KEY = TEST_DEVICE_KEY;
    process.env.MONGODB_URI = TEST_MONGODB_URI;

    // Connect Mongoose to test DB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    // Start HTTP server on dynamic port
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
    // Drop test database and disconnect
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    // Clear collections between tests
    await Card.deleteMany({});
    await AccessLog.deleteMany({});
  });

  // 1. HEALTH CHECK
  describe('GET /api/health', () => {
    it('should return server status and database connection status', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.status, 'ok');
      assert.equal(body.database, 'connected');
      assert.ok(typeof body.uptime === 'number');
      assert.ok(body.timestamp);
    });
  });

  // 2. SECURITY & AUTHENTICATION
  describe('Security & API Key Enforcement', () => {
    it('should reject card endpoints when ADMIN_API_KEY is missing (401)', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'CEE4E857', label: 'Admin Card' }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /Admin API key is missing/i);
    });

    it('should reject card endpoints with invalid ADMIN_API_KEY (403)', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'wrong-admin-key',
        },
        body: JSON.stringify({ uid: 'CEE4E857', label: 'Admin Card' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /Invalid Admin API key/i);
    });

    it('should reject verification endpoint when DEVICE_API_KEY is missing (401)', async () => {
      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'CEE4E857', deviceId: 'door-lock-01' }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /Device API key is missing/i);
    });

    it('should reject verification endpoint with invalid DEVICE_API_KEY (403)', async () => {
      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'wrong-device-key',
        },
        body: JSON.stringify({ uid: 'CEE4E857', deviceId: 'door-lock-01' }),
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /Invalid Device API key/i);
    });

    it('should authenticate with Authorization Bearer header', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });
  });

  // 3. CARD MANAGEMENT
  describe('Card Management Endpoints', () => {
    it('should register a card successfully and normalize UID', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ uid: 'cee4 e857', label: 'Master Key' }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.uid, 'CEE4E857');
      assert.equal(json.data.label, 'Master Key');
      assert.equal(json.data.status, 'active');
      assert.ok(json.data.createdAt);
      assert.ok(json.data.updatedAt);
    });

    it('should reject invalid hexadecimal UIDs (400)', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ uid: 'NOT-A-HEX-UID!', label: 'Bad Card' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    it('should prevent duplicate card registration (409)', async () => {
      // First registration
      await Card.create({ uid: 'CEE4E857', label: 'Existing' });

      // Duplicate attempt
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ uid: 'cee4e857', label: 'Duplicate' }),
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /already registered/i);
    });

    it('should list registered cards with pagination', async () => {
      await Card.create([
        { uid: '11111111', label: 'Card 1' },
        { uid: '22222222', label: 'Card 2' },
        { uid: '33333333', label: 'Card 3' },
      ]);

      const res = await fetch(`${baseUrl}/api/cards?page=1&limit=2`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.length, 2);
      assert.equal(json.pagination.total, 3);
      assert.equal(json.pagination.page, 1);
      assert.equal(json.pagination.limit, 2);
      assert.equal(json.pagination.totalPages, 2);
    });

    it('should retrieve a single card by UID', async () => {
      await Card.create({ uid: 'A1B2C3D4', label: 'Single Card' });

      const res = await fetch(`${baseUrl}/api/cards/a1-b2-c3-d4`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.uid, 'A1B2C3D4');
      assert.equal(json.data.label, 'Single Card');
    });

    it('should return 404 when retrieving unknown card', async () => {
      const res = await fetch(`${baseUrl}/api/cards/99999999`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /not found/i);
    });

    it('should update card status to revoked', async () => {
      await Card.create({ uid: 'A1B2C3D4', label: 'Staff Card', status: 'active' });

      const res = await fetch(`${baseUrl}/api/cards/A1B2C3D4/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ status: 'revoked' }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'revoked');

      // Verify in DB
      const updated = await Card.findOne({ uid: 'A1B2C3D4' });
      assert.equal(updated.status, 'revoked');
    });

    it('should reject invalid card status update values', async () => {
      await Card.create({ uid: 'A1B2C3D4', label: 'Staff Card' });

      const res = await fetch(`${baseUrl}/api/cards/A1B2C3D4/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ status: 'pending' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // 4. ACCESS VERIFICATION & LOGGING
  describe('Access Verification (POST /api/access/verify)', () => {
    it('should grant access to active registered card and record granted log', async () => {
      await Card.create({ uid: 'CEE4E857', label: 'Authorized Card', status: 'active' });

      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({
          uid: 'cee4e857',
          deviceId: 'door-lock-01',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, {
        success: true,
        authorized: true,
        message: 'Access granted',
      });

      // Verify AccessLog was recorded
      const log = await AccessLog.findOne({ uid: 'CEE4E857' });
      assert.ok(log);
      assert.equal(log.deviceId, 'door-lock-01');
      assert.equal(log.result, 'granted');
      assert.equal(log.reason, 'authorized');
      assert.ok(log.timestamp);
    });

    it('should deny access for revoked card and record revoked_card log', async () => {
      await Card.create({ uid: 'FEEDBEEF', label: 'Revoked Employee Card', status: 'revoked' });

      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({
          uid: 'feedbeef',
          deviceId: 'door-lock-01',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, {
        success: true,
        authorized: false,
        message: 'Access denied',
      });

      // Verify AccessLog was recorded
      const log = await AccessLog.findOne({ uid: 'FEEDBEEF' });
      assert.ok(log);
      assert.equal(log.result, 'denied');
      assert.equal(log.reason, 'revoked_card');
    });

    it('should deny access for unknown card and record unknown_card log', async () => {
      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({
          uid: 'DEADBEEF',
          deviceId: 'door-lock-02',
        }),
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, {
        success: true,
        authorized: false,
        message: 'Access denied',
      });

      // Verify AccessLog was recorded
      const log = await AccessLog.findOne({ uid: 'DEADBEEF' });
      assert.ok(log);
      assert.equal(log.deviceId, 'door-lock-02');
      assert.equal(log.result, 'denied');
      assert.equal(log.reason, 'unknown_card');
    });

    it('should reject access verify request with missing deviceId (400)', async () => {
      const res = await fetch(`${baseUrl}/api/access/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_DEVICE_KEY,
        },
        body: JSON.stringify({ uid: 'DEADBEEF' }),
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);

      // Verify no log created for invalid request
      const logCount = await AccessLog.countDocuments();
      assert.equal(logCount, 0);
    });
  });

  // 5. ACCESS LOGS RETRIEVAL & FILTERING
  describe('Access Logs (GET /api/access-logs)', () => {
    it('should list logs with newest records first and filter by UID and result', async () => {
      const now = Date.now();
      await AccessLog.create([
        { uid: '11111111', deviceId: 'door-1', result: 'granted', reason: 'authorized', timestamp: new Date(now - 3000) },
        { uid: '11111111', deviceId: 'door-1', result: 'denied', reason: 'revoked_card', timestamp: new Date(now - 2000) },
        { uid: '22222222', deviceId: 'door-2', result: 'denied', reason: 'unknown_card', timestamp: new Date(now - 1000) },
      ]);

      // Test all logs (newest first)
      const resAll = await fetch(`${baseUrl}/api/access-logs`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });
      assert.equal(resAll.status, 200);
      const jsonAll = await resAll.json();
      assert.equal(jsonAll.data.length, 3);
      assert.equal(jsonAll.data[0].uid, '22222222'); // Newest first

      // Filter by UID
      const resUID = await fetch(`${baseUrl}/api/access-logs?uid=11111111`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });
      const jsonUID = await resUID.json();
      assert.equal(jsonUID.data.length, 2);

      // Filter by result
      const resGranted = await fetch(`${baseUrl}/api/access-logs?result=granted`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });
      const jsonGranted = await resGranted.json();
      assert.equal(jsonGranted.data.length, 1);
      assert.equal(jsonGranted.data[0].reason, 'authorized');
    });
  });

  // 6. ERROR HANDLING & EDGE CASES
  describe('Centralized Error Handling & Edge Cases', () => {
    it('should return 400 for malformed JSON body', async () => {
      const res = await fetch(`${baseUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEST_ADMIN_KEY,
        },
        body: '{"uid": "CEE4E857", invalid json',
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /Invalid JSON/i);
    });

    it('should return 404 for unknown route', async () => {
      const res = await fetch(`${baseUrl}/api/nonexistent`, {
        headers: { 'x-api-key': TEST_ADMIN_KEY },
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /Resource not found/i);
    });
  });
});
