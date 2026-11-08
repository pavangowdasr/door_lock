import { apiRequest } from './api.js';

export const cardsService = {
  /**
   * List cards with pagination and optional status filter.
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'active' | 'revoked'} [params.status]
   */
  async getCards({ page = 1, limit = 10, status } = {}) {
    const searchParams = new URLSearchParams();
    if (page) searchParams.append('page', page);
    if (limit) searchParams.append('limit', limit);
    if (status && status !== 'all') searchParams.append('status', status);

    const query = searchParams.toString();
    const endpoint = `/cards${query ? `?${query}` : ''}`;
    return apiRequest(endpoint, { method: 'GET' });
  },

  /**
   * Retrieve card details by UID.
   * @param {string} uid
   */
  async getCardByUID(uid) {
    return apiRequest(`/cards/${encodeURIComponent(uid)}`, { method: 'GET' });
  },

  /**
   * Register a new RFID card.
   * @param {object} cardData
   * @param {string} cardData.uid - Hexadecimal UID string
   * @param {string} [cardData.label] - Optional descriptive label
   */
  async registerCard({ uid, label }) {
    return apiRequest('/cards', {
      method: 'POST',
      body: { uid, label: label || '' },
    });
  },

  /**
   * Activate or revoke an existing card.
   * @param {string} uid
   * @param {'active' | 'revoked'} status
   */
  async updateCardStatus(uid, status) {
    return apiRequest(`/cards/${encodeURIComponent(uid)}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },
};
