/**
 * Korcha Mobile SDK (src/sdk/KorchaClient.js)
 * Connects the React Native / Expo app to your Korcha Express backend.
 */

const DEFAULT_BASE_URL = 'https://telegram.korcha.com.et';

export class KorchaClient {
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  /** Fetch live regional shelf products */
  async getShelfProducts() {
    const data = await this._request('/api/shelf');
    const valid = (data.products || []).filter(
      (p) => p && p.country && ['USA', 'KOREAN', 'ARABIAN'].includes(p.country.toUpperCase())
    );
    return valid.map((p) => ({
      ...p,
      country: p.country.toUpperCase(),
      photos: p.photos && p.photos.length > 0 ? p.photos : p.photo_url ? [p.photo_url] : [],
    }));
  }

  /** Place a direct in-stock order (calculates 40% deposit) */
  async placeDirectOrder({ phone, productName, priceEtb, paymentMethod = 'telebirr' }) {
    return this._request('/api/shelf/order', {
      method: 'POST',
      body: JSON.stringify({ phone, productName, priceEtb, paymentMethod }),
    });
  }

  /** Submit a sourcing quote or live chat message */
  async sendQuoteOrChat({ phone, details, productUrl = '', site = '' }) {
    return this._request('/api/quotes', {
      method: 'POST',
      body: JSON.stringify({ phone, details, productUrl, site }),
    });
  }

  /** Track order status by ticket code (e.g., KC-123456) */
  async trackOrder(code) {
    const data = await this._request(
      `/api/messages/customer?codes=${encodeURIComponent(code.trim())}`
    );
    return data.conversations && data.conversations.length > 0 ? data.conversations[0] : null;
  }
}

export const korchaSdk = new KorchaClient();
