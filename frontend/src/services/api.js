/**
 * Centralized API client for all backend communication.
 * All requests use same-origin credentials to send/receive HTTP-only session cookies.
 * Secrets (API keys, passwords) are NEVER handled or stored in the browser.
 */

const BASE_URL = '/api';

/**
 * Custom error class for API failures with backend status and payload details.
 */
export class ApiError extends Error {
  constructor(message, status = 0, data = null, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Core HTTP request handler.
 *
 * @param {string} endpoint - API path (e.g. '/cards', '/auth/login')
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const config = {
    ...options,
    credentials: 'include', // Ensure cookies are sent even in varied setups
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  };

  // If body is already a string, keep it; if it's an object, stringify
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      'Unable to connect to the backend server. Please verify the service is running.',
      0,
      null,
      true
    );
  }

  let responseData = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      responseData?.message ||
      `Request failed with status ${response.status} (${response.statusText || 'Error'})`;

    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData;
}
