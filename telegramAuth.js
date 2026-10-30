// telegramAuth.js — Telegram Mini App initData validation (HMAC-SHA256)
import crypto from 'crypto';

/**
 * Validate Telegram WebApp initData per official docs:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - raw initData query string from Telegram.WebApp.initData
 * @param {string} botToken - TELEGRAM_BOT_TOKEN
 * @param {number} maxAgeSeconds - reject data older than this (default 24h)
 * @returns {{ ok: boolean, user?: object, authDate?: number, error?: string }}
 */
export function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || typeof initData !== 'string') {
    return { ok: false, error: 'Missing initData' };
  }
  if (!botToken) {
    return { ok: false, error: 'Bot token not configured' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { ok: false, error: 'Missing hash in initData' };
    }

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { ok: false, error: 'Invalid initData signature' };
    }

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (authDate) {
      const age = Math.floor(Date.now() / 1000) - authDate;
      if (age > maxAgeSeconds) {
        return { ok: false, error: 'initData expired' };
      }
    }

    let user = null;
    const userRaw = params.get('user');
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {
        return { ok: false, error: 'Invalid user JSON in initData' };
      }
    }

    return { ok: true, user, authDate };
  } catch (err) {
    return { ok: false, error: err.message || 'initData validation failed' };
  }
}

/**
 * Extract initData from Express request (header preferred, then body/query).
 */
export function extractInitData(req) {
  return (
    req.headers['x-telegram-init-data'] ||
    req.body?.initData ||
    req.query?.initData ||
    ''
  );
}
