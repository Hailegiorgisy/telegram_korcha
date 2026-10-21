export type Marketplace = 'shein' | 'temu' | 'aliexpress' | 'other';

export interface PricingResult {
  originalPriceUsd: number;
  priceHkd: number; // Converted or base HKD price
  hkdExchangeRate: number; // 30 ETB per HKD
  baseEtbAmount: number; // priceHkd * 30
  supplierFeeEtb: number; // +27% for supplier
  cargoWeightKg: number; // Package weight in kg
  cargoCostEtb: number; // 1,000 ETB per 1 kg
  deliveryFeeEtb: number; // +54% for delivery service
  dimensions: string; // e.g. "30cm x 30cm"
  isOversized: boolean; // Dimensions exceeding 50cm x 50cm
  totalPriceEtb: number; // Total doorstep price in ETB
  depositPercent: number; // Dynamic advance payment % (e.g. 40%)
  depositAmountEtb: number; // Advance pre-payment (rounded to nearest 100 ETB)
  codAmountEtb: number; // Remaining amount on delivery (e.g. 60%)
  codPercent?: number; // Dynamic cash-on-delivery % (e.g. 60%)
  multiplier?: number;
  landedPriceUsd?: number;
  officialExchangeRate?: number;
  etbBaseAmount?: number;
  addon88AmountEtb?: number;
}

export interface ParsedProduct {
  id: string;
  marketplace: Marketplace;
  url: string;
  title: string;
  titleAmharic?: string;
  category: string;
  imageUrl: string;
  originalPriceUsd: number;
  availableSizes: string[];
  availableColors: string[];
  rating?: number;
  reviewsCount?: number;
}

export interface OrderItem {
  product: ParsedProduct;
  selectedSize?: string;
  selectedColor?: string;
  quantity: number;
  pricing: PricingResult;
}

export type OrderStatus = 
  | 'pending_deposit'
  | 'deposit_verified'
  | 'procured_in_china'
  | 'freight_in_transit'
  | 'customs_clearing'
  | 'out_for_delivery'
  | 'delivered';

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerTelegramUser?: string;
  customerTelegramId?: string;
  deliveryCity: string;
  deliverySubcity: string;
  deliveryLandmark: string;
  notes?: string;
  item: OrderItem;
  termsAgreed: boolean;
  termsAgreedAt: string;
  depositStatus: 'unpaid' | 'pending_verification' | 'verified';
  depositMethod?: 'telebirr' | 'cbe_birr' | 'awash_bank' | 'boa_digital';
  telebirrTxnId?: string;
  status: OrderStatus;
  workerNotified: boolean;
}

export interface TelegramBotMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  photoUrl?: string;
  inlineKeyboard?: {
    text: string;
    action?: string;
    url?: string;
    style?: 'primary' | 'secondary' | 'success' | 'danger';
  }[][];
  quoteCard?: OrderItem;
  orderConfirmation?: Order;
}
