import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { hashPassword } from '../src/utils/auth.js';

const TEST_ADMIN_KEY = 'test-admin-secret-key-123';
const TEST_DEVICE_KEY = 'test-device-secret-key-456';
const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/door_lock_test';
const TEST_PASSWORD = 'superSecretPassword123';
const TEST_PASSWORD_HASH = hashPassword(TEST_PASSWORD);

let server;
let baseUrl;

describe('Administrator Authentication Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    process.env.DEVICE_API_KEY = TEST_DEVICE_KEY;
    process.env.MONGODB_URI = TEST_MONGODB_URI;
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD_HASH = TEST_PASSWORD_HASH;
    process.env.SESSION_SECRET = 'test-session-secret-999';

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

  it('should reject login with wrong password (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Invalid username or password/i);
  });

  it('should reject login with wrong username (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'notadmin', password: TEST_PASSWORD }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  let sessionCookie = '';

  it('should successfully log in with valid credentials and return HTTP-only cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: TEST_PASSWORD }),
    });
    assert.equal(res.status, 200);

    const setCookieHeader = res.headers.get('set-cookie');
    assert.ok(setCookieHeader, 'Set-Cookie header should be present');
    assert.match(setCookieHeader, /admin_session=/);
    assert.match(setCookieHeader, /HttpOnly/i);

    // Extract cookie value
    sessionCookie = setCookieHeader.split(';')[0];

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.username, 'admin');
  });

  it('should access /api/auth/me using the session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.username, 'admin');
    assert.equal(body.data.authMethod, 'session');
  });

  it('should access protected admin cards endpoint using the session cookie without API key header', async () => {
    const res = await fetch(`${baseUrl}/api/cards`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('should reject /api/auth/me without cookie or API key (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  it('should log out successfully and clear the session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(res.status, 200);
    const setCookieHeader = res.headers.get('set-cookie');
    assert.ok(setCookieHeader);
    // Clearing a cookie sets Max-Age=0 or an expired Date
    assert.match(setCookieHeader, /admin_session=;/);
  });
});
