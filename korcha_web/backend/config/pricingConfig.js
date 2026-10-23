// backend/config/pricingConfig.js

// Current floating market exchange rate: 188.0 ETB per USD
export const EXCHANGE_RATE = parseFloat(process.env.USD_TO_ETB_RATE) || 188.0;

// Flat 50% markup to cover consolidated freight, customs buffer, and platform margin
export const MARKUP_PERCENT = 50;

// Payment split ratios
export const DEPOSIT_PERCENT = 25; // 25% upfront via Telebirr / CBE / M-Pesa
export const COD_PERCENT = 75;     // 75% Cash on Delivery

// Telebirr Receiver linkage (Configurable via environment variable)
export const TELEBIRR_RECEIVER_PHONE = process.env.TELEBIRR_RECEIVER_PHONE || "+251911234567";
export const TELEBIRR_RECEIVER_NAME = process.env.TELEBIRR_RECEIVER_NAME || "Korcha Logistics (ኮርቻ ሎጂስቲክስ)";
