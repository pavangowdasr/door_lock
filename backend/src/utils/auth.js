import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const DEFAULT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash a plain-text password using crypto.scrypt.
 * Output format: <salt-hex>:<hash-hex>
 *
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a candidate password against a stored hash (<salt>:<hash>)
 * or fall back to timing-safe comparison if a legacy plain password was configured.
 *
 * @param {string} candidatePassword
 * @param {string} storedHashOrPlain
 * @returns {boolean}
 */
export function verifyPassword(candidatePassword, storedHashOrPlain) {
  if (typeof candidatePassword !== 'string' || typeof storedHashOrPlain !== 'string') {
    return false;
  }

  // If stored value is in format salt:hash
  if (storedHashOrPlain.includes(':')) {
    const [salt, storedHash] = storedHashOrPlain.split(':');
    if (!salt || !storedHash) return false;

    try {
      const derivedKey = crypto.scryptSync(candidatePassword, salt, SCRYPT_KEYLEN);
      const storedBuffer = Buffer.from(storedHash, 'hex');
      if (derivedKey.length !== storedBuffer.length) return false;
      return crypto.timingSafeEqual(derivedKey, storedBuffer);
    } catch {
      return false;
    }
  }

  // Fallback: direct timing-safe comparison with plain text (e.g. in dev)
  const candidateHash = crypto.createHash('sha256').update(candidatePassword).digest();
  const storedHash = crypto.createHash('sha256').update(storedHashOrPlain).digest();
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

/**
 * Create a signed, tamper-proof session token.
 * Token format: <base64url-payload>.<hmac-sha256-hex>
 *
 * @param {object} payload
 * @param {string} secret
 * @param {number} [expiresInMs]
 * @returns {string}
 */
export function createSessionToken(payload, secret, expiresInMs = DEFAULT_SESSION_EXPIRY_MS) {
  const sessionData = {
    ...payload,
    exp: Date.now() + expiresInMs,
    iat: Date.now(),
  };

  const payloadEncoded = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('hex');

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verify a signed session token. Returns the decoded payload or null if invalid/expired.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {object | null}
 */
export function verifySessionToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) {
    return null;
  }

  try {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadEncoded)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const providedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
