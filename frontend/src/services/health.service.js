import { apiRequest } from './api.js';

export const healthService = {
  /**
   * Check backend server and MongoDB status.
   */
  async getHealth() {
    return apiRequest('/health', { method: 'GET' });
  },
};
