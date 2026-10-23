// backend/services/pricingService.js

const HKD_EXCHANGE_RATE = 30.0;
const USD_TO_HKD = 7.8;
const KG_CARGO_RATE_ETB = 1000.0;
const SUPPLIER_PERCENT = 0.27; // +27%
const DELIVERY_PERCENT = 0.54; // +54%

/**
 * WORKER CALCULATION HELPER SERVICE
 * Standard Korcha Door-to-Door Landed Cost Formula:
 * 1. Convert USD to HKD then ETB via 30 ETB/HKD
 * 2. Add 27% supplier fee
 * 3. Add 54% delivery service fee
 * 4. Add air cargo shipping: weightKg * 1,000 ETB
 * 5. Split: 25% Telebirr prepayment deposit + 75% COD
 */
export function calculateOrderPricing(usdPrice, weightKg = 0.40, customHkdRate = 30.0) {
  const usd = Math.max(0, parseFloat(usdPrice || 0));
  const weight = Math.max(0.1, parseFloat(weightKg || 0.40));
  const hkdRate = customHkdRate || HKD_EXCHANGE_RATE;

  const priceHkd = usd * USD_TO_HKD;
  const baseEtb = Math.round(priceHkd * hkdRate);

  const supplierFeeEtb = Math.round(baseEtb * SUPPLIER_PERCENT);
  const deliveryFeeEtb = Math.round(baseEtb * DELIVERY_PERCENT);
  const cargoCostEtb = Math.round(weight * KG_CARGO_RATE_ETB);

  const totalDoorPriceEtb = Math.round(baseEtb + supplierFeeEtb + deliveryFeeEtb + cargoCostEtb);
  const deposit25Etb = Math.max(100, Math.round((totalDoorPriceEtb * 0.25) / 100) * 100);
  const cod75Etb = Math.max(0, totalDoorPriceEtb - deposit25Etb);

  return {
    priceUsd: Number(usd.toFixed(2)),
    weightKg: Number(weight.toFixed(2)),
    hkdExchangeRate: hkdRate,
    baseEtb,
    supplierFeeEtb,
    deliveryFeeEtb,
    cargoCostEtb,
    totalDoorPriceEtb,
    deposit25Etb,
    cod75Etb,
    // Convenient aliases
    totalPriceEtb: totalDoorPriceEtb,
    advanceDepositEtb: deposit25Etb,
    cashOnDeliveryEtb: cod75Etb,
    totalEtb: totalDoorPriceEtb,
    depositEtb: deposit25Etb,
    codEtb: cod75Etb,
  };
}
