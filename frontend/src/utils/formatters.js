/**
 * Formats an ISO date string into a localized, human-readable date and time.
 * @param {string | Date} dateInput
 * @returns {string}
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid date';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats uptime in seconds to human-readable string (e.g., "1d 4h 32m 10s").
 * @param {number} seconds
 * @returns {string}
 */
export function formatUptime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0s';

  const totalSecs = Math.floor(seconds);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Normalizes an RFID UID: strips delimiters/whitespace and converts to uppercase.
 * @param {string} rawUID
 * @returns {string}
 */
export function normalizeUID(rawUID) {
  if (!rawUID || typeof rawUID !== 'string') return '';
  return rawUID.replace(/[\s:-]/g, '').toUpperCase();
}

/**
 * Validates whether an RFID UID is a valid 4-32 hexadecimal character string.
 * @param {string} rawUID
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function validateUID(rawUID) {
  if (!rawUID || typeof rawUID !== 'string' || !rawUID.trim()) {
    return { valid: false, normalized: '', error: 'Card UID is required' };
  }

  const normalized = normalizeUID(rawUID);

  if (normalized.length === 0) {
    return { valid: false, normalized: '', error: 'Card UID cannot be empty' };
  }

  if (normalized.length < 4 || normalized.length > 32) {
    return {
      valid: false,
      normalized,
      error: `Card UID must be between 4 and 32 hex characters (got ${normalized.length})`,
    };
  }

  if (!/^[0-9A-F]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Card UID must contain only hexadecimal characters (0-9, A-F)',
    };
  }

  return { valid: true, normalized };
}
