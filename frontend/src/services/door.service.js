import { apiRequest } from './api.js';

export const doorService = {
  /**
   * Send a remote unlock command (relay energized for 3 seconds).
   * @param {string} [deviceId='door-lock-01']
   */
  async unlockDoor(deviceId = 'door-lock-01') {
    return apiRequest('/door/unlock', {
      method: 'POST',
      body: { deviceId, durationMs: 3000 },
    });
  },

  /**
   * Send an immediate remote lock command (relay de-energized).
   * @param {string} [deviceId='door-lock-01']
   */
  async lockDoor(deviceId = 'door-lock-01') {
    return apiRequest('/door/lock', {
      method: 'POST',
      body: { deviceId },
    });
  },

  /**
   * Retrieve current relay state and last command details.
   * @param {string} [deviceId='door-lock-01']
   */
  async getDoorStatus(deviceId = 'door-lock-01') {
    return apiRequest(`/door/status?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
    });
  },
};
