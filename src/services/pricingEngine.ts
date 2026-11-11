// src/services/pricingEngine.ts: Dynamic Multi-factor Landed Pricing Engine

// Helper to safely read environment variables across Vite (import.meta.env) and Node (process.env)
function getEnvVar(viteKey: string, nodeKey: string, fallback: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey] !== undefined) {
    return String(import.meta.env[viteKey]);
  }
  if (typeof process !== 'undefined' && process.env && process.env[nodeKey] !== undefined) {
    return String(process.env[nodeKey]);
  }
  return fallback;
}

// Dynamically configured rates and margins from environment (.env)
export function getPricingConfig() {
  const hkdRate = parseFloat(getEnvVar('VITE_HKD_EXCHANGE_RATE', 'HKD_EXCHANGE_RATE', '30.0')) || 30.0;
  const usdToHkd = parseFloat(getEnvVar('VITE_USD_TO_HKD', 'USD_TO_HKD', '7.8')) || 7.8;
  const cargoKgRate = parseFloat(getEnvVar('VITE_KG_CARGO_RATE_ETB', 'KG_CARGO_RATE_ETB', '1000.0')) || 1000.0;
  const supplierPercent = parseFloat(getEnvVar('VITE_SUPPLIER_PERCENT', 'SUPPLIER_PERCENT', '0.27')) || 0.27;
  const deliveryPercent = parseFloat(getEnvVar('VITE_DELIVERY_PERCENT', 'DELIVERY_PERCENT', '0.54')) || 0.54;
  const advancePercent = parseFloat(getEnvVar('VITE_ADVANCE_PAYMENT_PERCENT', 'ADVANCE_PAYMENT_PERCENT', '40')) || 40;
  const codPercent = 100 - advancePercent;

  const telebirrPhone = getEnvVar('VITE_TELEBIRR_PHONE', 'TELEBIRR_PHONE', '+251-996237800');
  const cbeAccount = getEnvVar('VITE_CBE_ACCOUNT', 'CBE_ACCOUNT', '10001116390');
  const workerUsername = getEnvVar('VITE_WORKER_TELEGRAM_USERNAME', 'WORKER_TELEGRAM_USERNAME', 'korcha_support');

  return {
    hkdRate,
    usdToHkd,
    cargoKgRate,
    supplierPercent,
    deliveryPercent,
    advancePercent,
    codPercent,
    telebirrPhone,
    cbeAccount,
    workerUsername,
  };
}

// Category-based weight estimation heuristics
export function estimateCategoryWeight(categoryOrTitle: string): number {
  const lower = (categoryOrTitle || '').toLowerCase();
  if (lower.includes('boot') || lower.includes('shoe') || lower.includes('winter') || lower.includes('luggage')) {
    return 0.85;
  }
  if (lower.includes('hoodie') || lower.includes('jacket') || lower.includes('coat') || lower.includes('sweater') || lower.includes('bag')) {
    return 0.55;
  }
  if (lower.includes('dress') || lower.includes('skirt') || lower.includes('shirt') || lower.includes('blouse') || lower.includes('kemis')) {
    return 0.35;
  }
  if (lower.includes('watch') || lower.includes('earbud') || lower.includes('airpod') || lower.includes('ring') || lower.includes('jewelry')) {
    return 0.15;
  }
  if (lower.includes('electronics') || lower.includes('keyboard') || lower.includes('phone') || lower.includes('appliance')) {
    return 0.70;
  }
  return 0.40; // Default baseline weight in kg
}

export interface PricingBreakdown {
  originalPriceUsd: number;
  priceHkd: number;
  baseEtbAmount: number;
  cargoWeightKg: number;
  cargoCostEtb: number;
  supplierFeeEtb: number;
  deliveryFeeEtb: number;
  totalPriceEtb: number;
  depositAmountEtb: number;
  codAmountEtb: number;
  advancePercent: number;
  codPercent: number;
}

// Core Landed Cost Calculation
export function calculateDoorstepPricing(
  originalPriceUsd: number,
  categoryOrTitle: string = '',
  customWeightKg?: number
): PricingBreakdown {
  const config = getPricingConfig();
  const cleanUsd = Math.max(0, Number(originalPriceUsd) || 0);

  // Conversion: USD -> HKD -> ETB
  const priceHkd = cleanUsd * config.usdToHkd;
  const baseEtbAmount = Math.round(priceHkd * config.hkdRate);

  // Freight & Cargo calculation
  const cargoWeightKg = customWeightKg && customWeightKg > 0 ? customWeightKg : estimateCategoryWeight(categoryOrTitle);
  const cargoCostEtb = Math.round(cargoWeightKg * config.cargoKgRate);

  // Supplier & Delivery/Import Markups
  const supplierFeeEtb = Math.round(baseEtbAmount * config.supplierPercent);
  const deliveryFeeEtb = Math.round(baseEtbAmount * config.deliveryPercent);

  // Total Landed Cost in ETB
  const totalPriceEtb = Math.round(baseEtbAmount + supplierFeeEtb + deliveryFeeEtb + cargoCostEtb);

  // Split: Deposit vs Doorstep Cash-on-Delivery (rounded to nearest 100 ETB)
  const rawDeposit = Math.round((totalPriceEtb * (config.advancePercent / 100)) / 100) * 100;
  const depositAmountEtb = Math.max(100, rawDeposit);
  const codAmountEtb = Math.max(0, totalPriceEtb - depositAmountEtb);

  return {
    originalPriceUsd: cleanUsd,
    priceHkd: Math.round(priceHkd * 100) / 100,
    baseEtbAmount,
    cargoWeightKg,
    cargoCostEtb,
    supplierFeeEtb,
    deliveryFeeEtb,
    totalPriceEtb,
    depositAmountEtb,
    codAmountEtb,
    advancePercent: config.advancePercent,
    codPercent: config.codPercent,
  };
}
