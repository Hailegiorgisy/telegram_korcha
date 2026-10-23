// frontend/src/types/index.ts

export type Language = "am" | "en";
export type Marketplace = "shein" | "temu" | "aliexpress" | "other";

export interface PricingBreakdown {
  priceUsd: number;
  weightKg: number;
  baseEtb: number;
  supplierFeeEtb: number;
  deliveryFeeEtb: number;
  cargoCostEtb: number;
  totalDoorPriceEtb: number;
  deposit25Etb: number;
  cod75Etb: number;
}

export interface WorkerHelperData {
  detectedPrice?: number;
  suggestedWeightKg: number;
  suggestedTotalEtb?: number;
  suggestedDepositEtb?: number;
  suggestedCodEtb?: number;
  instructions?: string;
}

export interface QuoteRequest {
  ticketId: string;
  marketplace: Marketplace;
  sourceUrl?: string;
  screenshotName?: string;
  screenshotUrl?: string;
  title: string;
  imageUrl?: string;
  status: "pending_worker_estimation" | "estimated" | "ordered";
  customerMessage: string;
  workerHelper?: WorkerHelperData;
  pricing?: PricingBreakdown;
  selectedSize?: string;
  selectedColor?: string;
  quantity: number;
  notes?: string;
  workerLink: string;
  createdAt: string;
}

export interface QuotedProduct {
  id: string;
  ticketId?: string;
  marketplace?: Marketplace;
  sheinUrl: string;
  title: string;
  imageUrl?: string;
  originalUsd: number;
  priceEtb: number;
  depositEtb: number;
  codEtb: number;
  selectedSize: string;
  selectedColor: string;
  customNotes?: string;
  quantity: number;
}

export interface DeliveryProfile {
  userId: string;
  gps?: {
    lat: number;
    lng: number;
  };
  landmark: string;
  primaryPhone: string;
  backupPhone?: string;
  deliveryMethod?: "MotorCourier" | "HubPickup";
}

export interface Order {
  orderId: string;
  ticketId?: string;
  userId: string;
  items: QuotedProduct[];
  totalPrice: number;
  paymentOption: "Deposit25" | "NoAdvancePayment";
  depositAmount: number;
  codAmount: number;
  depositPaid: boolean;
  telebirrTransactionId?: string;
  status: "Pending" | "Dispatched" | "Delivered";
  createdAt: string;
  deliveryProfile: DeliveryProfile;
}

export interface HelpTicket {
  ticketId?: string;
  name: string;
  phone: string;
  message: string;
  sheinLink?: string;
}
