import { apiRequest } from './api.js';

export const enrollmentService = {
  /**
   * Start a remote RFID enrollment session on the backend for a specific device.
   * @param {string} [deviceId='door-lock-01']
   */
  async startEnrollment(deviceId = 'door-lock-01') {
    return apiRequest('/enrollment/start', {
      method: 'POST',
      body: { deviceId },
    });
  },

  /**
   * Retrieve the current state of an ongoing enrollment session.
   * @param {string} enrollmentId
   */
  async getEnrollment(enrollmentId) {
    return apiRequest(`/enrollment/${encodeURIComponent(enrollmentId)}`, {
      method: 'GET',
    });
  },

  /**
   * Cancel an ongoing enrollment session.
   * @param {string} enrollmentId
   */
  async cancelEnrollment(enrollmentId) {
    return apiRequest(`/enrollment/${encodeURIComponent(enrollmentId)}/cancel`, {
      method: 'POST',
    });
  },
};
