import { apiRequest } from './api.js';

export const logsService = {
  /**
   * List access logs with pagination and optional filters.
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.uid]
   * @param {'granted' | 'denied'} [params.result]
   */
  async getAccessLogs({ page = 1, limit = 20, uid, result } = {}) {
    const searchParams = new URLSearchParams();
    if (page) searchParams.append('page', page);
    if (limit) searchParams.append('limit', limit);
    if (uid && uid.trim()) searchParams.append('uid', uid.trim());
    if (result && result !== 'all') searchParams.append('result', result);

    const query = searchParams.toString();
    const endpoint = `/access-logs${query ? `?${query}` : ''}`;
    return apiRequest(endpoint, { method: 'GET' });
  },
};
