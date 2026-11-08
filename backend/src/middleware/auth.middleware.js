import crypto from 'node:crypto';
import { verifySessionToken } from '../utils/auth.js';

/**
 * Safely compares two strings in constant time to prevent timing attacks.
 * Uses SHA-256 digests to avoid leaking string length differences.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Extracts an API key from request headers.
 * Supports dedicated headers, x-api-key, and Bearer token in Authorization header.
 *
 * @param {import('express').Request} req
 * @param {string} specificHeader
 * @returns {string | null}
 */
function extractApiKey(req, specificHeader) {
  if (specificHeader && req.headers[specificHeader.toLowerCase()]) {
    return String(req.headers[specificHeader.toLowerCase()]).trim();
  }
  if (req.headers['x-api-key']) {
    return String(req.headers['x-api-key']).trim();
  }
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  return null;
}

/**
 * Middleware to require and validate Admin authentication.
 * Accepts either:
 * 1. ADMIN_API_KEY in request headers (x-api-key, Authorization: Bearer, etc.)
 * 2. HTTP-only session cookie (admin_session) from admin login
 *
 * Protects card management and access log endpoints.
 */
export function requireAdminApiKey(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: ADMIN_API_KEY is not configured',
    });
  }

  const providedKey = extractApiKey(req, 'x-admin-api-key');

  // 1. If an API key was provided in headers, validate it
  if (providedKey) {
    if (!secureCompare(providedKey, adminKey)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid Admin API key.',
      });
    }
    req.admin = {
      username: process.env.ADMIN_USERNAME || 'admin',
      authMethod: 'api_key',
    };
    return next();
  }

  // 2. If no API key was provided, check for a valid admin session cookie
  const sessionCookie = req.cookies?.admin_session;
  if (sessionCookie) {
    const sessionSecret = process.env.SESSION_SECRET || `${adminKey}-session-secret`;
    const payload = verifySessionToken(sessionCookie, sessionSecret);

    if (payload && payload.username) {
      req.admin = {
        username: payload.username,
        authMethod: 'session',
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Admin session expired or invalid. Please log in again.',
    });
  }

  // 3. Neither valid API key nor session cookie present
  return res.status(401).json({
    success: false,
    message: 'Admin API key is missing. Provide it via x-api-key or Authorization header.',
  });
}

export const requireAdminAuth = requireAdminApiKey;

/**
 * Middleware to require and validate DEVICE_API_KEY.
 * Protects access verification endpoint.
 */
export function requireDeviceApiKey(req, res, next) {
  const deviceKey = process.env.DEVICE_API_KEY;

  if (!deviceKey) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: DEVICE_API_KEY is not configured',
    });
  }

  const providedKey = extractApiKey(req, 'x-device-api-key');

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      message: 'Device API key is missing. Provide it via x-api-key or Authorization header.',
    });
  }

  if (!secureCompare(providedKey, deviceKey)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid Device API key.',
    });
  }

  next();
}
