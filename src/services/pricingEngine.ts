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
  };
}
