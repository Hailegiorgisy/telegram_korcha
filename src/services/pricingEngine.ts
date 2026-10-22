<<<<<<< HEAD
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
=======
import { PricingResult } from '../types';

export const DEFAULT_HKD_RATE = 30.0; // 30 ETB per HK Dollar
export const DEFAULT_USD_TO_HKD = 7.8; // 1 USD ≈ 7.8 HKD
export const DEFAULT_CARGO_KG_RATE = 1000.0; // 1 kg = 1,000 ETB
export const SUPPLIER_PERCENT = 0.27; // +27% for supplier
export const DELIVERY_PERCENT = 0.54; // +54% for delivery service
export const MAX_SIZE_CM = 50; // Max allowed size: 50cm by 50cm

/**
 * Estimates item weight in kg based on item category or name
 */
export function estimateCategoryWeight(categoryOrTitle: string = ''): number {
  const t = categoryOrTitle.toLowerCase();
  if (t.includes('boot') || t.includes('winter') || t.includes('luggage') || t.includes('sneaker') || t.includes('shoes')) {
    return 0.85;
  }
  if (t.includes('hoodie') || t.includes('jacket') || t.includes('sweater') || t.includes('bag') || t.includes('backpack')) {
    return 0.55;
  }
  if (t.includes('dress') || t.includes('skirt') || t.includes('shirt') || t.includes('blouse') || t.includes('kemis')) {
    return 0.35;
  }
  if (t.includes('earbud') || t.includes('watch') || t.includes('jewelry') || t.includes('case')) {
    return 0.15;
  }
  if (t.includes('electronics') || t.includes('keyboard') || t.includes('kitchen')) {
    return 0.70;
  }
  return 0.40; // Default 400 grams
}

/**
 * Retrieves dynamic payment ratios (Advance deposit % and Cash-On-Delivery %)
 * Configurable via .env (ADVANCE_PAYMENT_PERCENT, COD_PAYMENT_PERCENT,
 * VITE_ADVANCE_PAYMENT_PERCENT, VITE_COD_PAYMENT_PERCENT)
 * Default: 40% Advance Deposit, 60% Cash-on-Delivery
 */
export function getPaymentRatios(): { advancePercent: number; codPercent: number } {
  let advance = 40;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADVANCE_PAYMENT_PERCENT) {
      advance = parseInt((import.meta as any).env.VITE_ADVANCE_PAYMENT_PERCENT, 10) || 40;
    } else if (typeof process !== 'undefined' && process.env?.ADVANCE_PAYMENT_PERCENT) {
      advance = parseInt(process.env.ADVANCE_PAYMENT_PERCENT, 10) || 40;
    }
  } catch {
    advance = 40;
  }

  let cod = 100 - advance;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_COD_PAYMENT_PERCENT) {
      cod = parseInt((import.meta as any).env.VITE_COD_PAYMENT_PERCENT, 10) || (100 - advance);
    } else if (typeof process !== 'undefined' && process.env?.COD_PAYMENT_PERCENT) {
      cod = parseInt(process.env.COD_PAYMENT_PERCENT, 10) || (100 - advance);
    }
  } catch {
    cod = 100 - advance;
  }

  return { advancePercent: advance, codPercent: cod };
}

/**
 * Calculates Door-to-Door Birr landed cost based on user's exact requirements:
 * 1. Price converted using HKD to ETB exchange rate (~30 ETB per HKD)
 * 2. Cargo weight calculation: 1,000 ETB per 1 kg (Size limit: max 50cm x 50cm)
 * 3. +27% for supplier
 * 4. +54% for delivery service
 * 5. Dynamic upfront pre-payment % from .env (default 40%), remaining COD on delivery (default 60%)
 */
export function calculateDoorstepPricing(
  originalPriceUsd: number,
  customWeightKg?: number,
  customDimensions?: { lengthCm: number; widthCm: number }
): PricingResult {
  const cleanUsd = Math.max(0, Number(originalPriceUsd) || 0);
  const priceHkd = cleanUsd * DEFAULT_USD_TO_HKD;
  const baseEtbAmount = Math.round(priceHkd * DEFAULT_HKD_RATE);

  // Weight and dimensions
  const cargoWeightKg = customWeightKg && customWeightKg > 0 ? customWeightKg : 0.40;
  const cargoCostEtb = Math.round(cargoWeightKg * DEFAULT_CARGO_KG_RATE);

  const lengthCm = customDimensions?.lengthCm ?? 30;
  const widthCm = customDimensions?.widthCm ?? 30;
  const isOversized = lengthCm > MAX_SIZE_CM || widthCm > MAX_SIZE_CM;

  // Percentage additions
  const supplierFeeEtb = Math.round(baseEtbAmount * SUPPLIER_PERCENT);
  const deliveryFeeEtb = Math.round(baseEtbAmount * DELIVERY_PERCENT);

  // Total Doorstep Price
  const totalPriceEtb = Math.round(baseEtbAmount + supplierFeeEtb + deliveryFeeEtb + cargoCostEtb);

  // Dynamic advance pre-payment %, rounded to nearest 100 ETB
  const { advancePercent, codPercent } = getPaymentRatios();
  const rawDeposit = totalPriceEtb * (advancePercent / 100);
  const depositAmountEtb = Math.max(100, Math.round(rawDeposit / 100) * 100);
  const codAmountEtb = Math.max(0, totalPriceEtb - depositAmountEtb);

  return {
    originalPriceUsd: Number(cleanUsd.toFixed(2)),
    priceHkd: Number(priceHkd.toFixed(2)),
    hkdExchangeRate: DEFAULT_HKD_RATE,
    baseEtbAmount,
    supplierFeeEtb,
    cargoWeightKg: Number(cargoWeightKg.toFixed(2)),
    cargoCostEtb,
    deliveryFeeEtb,
    dimensions: `${lengthCm}cm x ${widthCm}cm`,
    isOversized,
    totalPriceEtb,
    depositPercent: advancePercent,
    codPercent: codPercent,
    depositAmountEtb,
    codAmountEtb,
    // Legacy compatibility fields
    multiplier: 1.88,
    landedPriceUsd: Number((cleanUsd * 1.88).toFixed(2)),
    officialExchangeRate: DEFAULT_HKD_RATE,
    etbBaseAmount: baseEtbAmount,
    addon88AmountEtb: supplierFeeEtb + deliveryFeeEtb + cargoCostEtb,
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
  };
}
