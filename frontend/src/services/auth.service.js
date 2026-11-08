import { apiRequest } from './api.js';

export const authService = {
  /**
   * Log in single administrator. Sets HTTP-only cookie on the backend.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  /**
   * Retrieve current administrator session information.
   */
  async getMe() {
    return apiRequest('/auth/me', {
      method: 'GET',
    });
  },

  /**
   * Log out administrator and clear the session cookie.
   */
  async logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },
};
