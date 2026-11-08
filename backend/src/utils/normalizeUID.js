/**
 * Normalizes an RFID UID to uppercase hexadecimal without spaces or delimiters.
 * Throws an Error if the input is invalid.
 *
 * @param {string} rawUID - The raw RFID UID string
 * @returns {string} Normalized uppercase hexadecimal UID
 * @throws {Error} If UID is missing, not a string, or not valid hexadecimal
 */
export function normalizeUID(rawUID) {
  if (rawUID === undefined || rawUID === null || typeof rawUID !== 'string') {
    throw new Error('RFID UID is required and must be a string');
  }

  // Strip spaces, tabs, colons, and hyphens commonly produced by RFID readers
  const cleaned = rawUID.replace(/[\s:-]/g, '').toUpperCase();

  if (cleaned.length === 0) {
    throw new Error('RFID UID cannot be empty');
  }

  // Standard RFID UIDs are typically 4 bytes (8 hex chars), 7 bytes (14 hex chars),
  // or up to 10 bytes (20 hex chars). Allow 4 to 32 hex characters.
  if (!/^[0-9A-F]{4,32}$/.test(cleaned)) {
    throw new Error('Invalid RFID UID format. UID must be a hexadecimal string between 4 and 32 characters');
  }

  return cleaned;
}

/**
 * Checks whether the given input can be normalized into a valid RFID UID.
 *
 * @param {unknown} rawUID
 * @returns {boolean}
 */
export function isValidHexUID(rawUID) {
  try {
    normalizeUID(rawUID);
    return true;
  } catch {
    return false;
  }
}
