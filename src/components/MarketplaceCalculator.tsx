import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator,
  ArrowRight,
  CreditCard,
  Truck,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Send,
  Building2,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  Check,
  Copy,
  Camera,
  Image as ImageIcon,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Scale,
  Wrench,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Marketplace, ParsedProduct, Order } from '../types';
import { calculateDoorstepPricing } from '../services/pricingEngine';
import { parseMarketplaceLink } from '../services/marketplaceParser';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { PaymentQRCode } from './PaymentQRCode';
import { triggerTmaHaptic } from '../services/telegramWebApp';
import { MARKETPLACE_APPS, getSmartMarketplaceUrl } from '../utils/marketplaceLinks';

interface PriceEstimationProps {
  officialRate: number;
  initialProduct?: ParsedProduct | null;
  onOrderCompleted: (order: Order) => void;
  onNavigateToOrders?: (phone?: string) => void;
}

export const MarketplaceCalculator: React.FC<PriceEstimationProps> = ({
  officialRate,
  initialProduct,
  onOrderCompleted,
  onNavigateToOrders,
}) => {
  // Modes: 'link' (Customer Link), 'screenshot' (Customer Screenshot), 'worker' (Worker Helper)
  const [inputMode, setInputMode] = useState<'link' | 'screenshot' | 'worker'>('link');
  const [inputUrlOrText, setInputUrlOrText] = useState<string>('');
  const [customWeightKg, setCustomWeightKg] = useState<number>(0.4);
  const [showInternalFormula, setShowInternalFormula] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estimation lifecycle: customer submits link/screenshot -> awaits worker with 5-minute notice -> worker estimates -> order
  const [ticketId, setTicketId] = useState<string>('KORCHA-8491');
  const [hasSubmittedRequest, setHasSubmittedRequest] = useState<boolean>(false);
  const [isEstimatedByWorker, setIsEstimatedByWorker] = useState<boolean>(false);

  // Worker Helper panel states
  const [workerUsd, setWorkerUsd] = useState<number>(14.50);
  const [workerWeight, setWorkerWeight] = useState<number>(0.35);
  const [workerSize, setWorkerSize] = useState<string>('');
  const [workerColor, setWorkerColor] = useState<string>('');
  const [workerNotes, setWorkerNotes] = useState<string>('');

  // Customer item selection options
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<string>('እንደ ፎቶው');
  const [itemNotes, setItemNotes] = useState<string>('');

  const [product, setProduct] = useState<ParsedProduct>(() => {
    return initialProduct || SAMPLE_PRODUCTS[0];
  });

  // Whenever initialProduct changes from Search Explorer, update
  useEffect(() => {
    if (initialProduct) {
      setProduct(initialProduct);
      setInputUrlOrText(initialProduct.url);
      setWorkerUsd(initialProduct.originalPriceUsd);
      setHasSubmittedRequest(true);
      setIsEstimatedByWorker(false);
      setTicketId(`KORCHA-${Math.floor(1000 + Math.random() * 9000)}`);
      // Auto-simulate worker estimation after 3s
      const timer = setTimeout(() => {
        setIsEstimatedByWorker(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [initialProduct]);

  // Pricing based on user specification:
  // HKD exchange rate (30 ETB/HKD), 27% supplier, 1000 ETB/kg cargo, 54% delivery service, max 50x50cm
  const pricing = calculateDoorstepPricing(product.originalPriceUsd, customWeightKg);
  const workerPricing = calculateDoorstepPricing(workerUsd, workerWeight);

  // Checkout modal / agreement step
  const [showPaymentStep, setShowPaymentStep] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'telebirr' | 'cbe_birr' | 'awash_bank' | 'boa_digital'
  >('telebirr');

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerTelegram, setCustomerTelegram] = useState<string>(() => {
    const tg = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tg?.username) return `@${tg.username}`;
    return localStorage.getItem('korcha_customer_telegram_user') || '';
  });
  const [deliveryCity, setDeliveryCity] = useState<string>('አዲስ አበባ');
  const [deliverySubcity, setDeliverySubcity] = useState<string>('ቦሌ');
  const [deliveryLandmark, setDeliveryLandmark] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [orderConfirmed, setOrderConfirmed] = useState<Order | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  const handleEstimateLink = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputUrlOrText.trim()) return;

    const parsed = parseMarketplaceLink(inputUrlOrText.trim());
    setProduct(parsed);
    setWorkerUsd(parsed.originalPriceUsd);
    setTicketId(`KORCHA-${Math.floor(1000 + Math.random() * 9000)}`);
    setHasSubmittedRequest(true);
    setIsEstimatedByWorker(false);

    // Auto-simulate worker responding in 3.5 seconds
    setTimeout(() => {
      setIsEstimatedByWorker(true);
    }, 3500);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imgData = reader.result as string;
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'ከስክሪንሾት የተመረጠ እቃ';

      const newProd: ParsedProduct = {
        id: `ss-${Date.now()}`,
        marketplace: 'shein',
        url: 'https://m.shein.com',
        title: cleanTitle,
        titleAmharic: 'ከስክሪንሾት የተገኘ ምርት (በዝቅተኛ ዋጋ)',
        category: 'ልብስና ፋሽን',
        imageUrl: imgData,
        originalPriceUsd: 13.50,
        availableSizes: ['S', 'M', 'L', 'XL'],
        availableColors: ['እንደ ፎቶው'],
      };
      setProduct(newProd);
      setWorkerUsd(13.50);
      setTicketId(`KORCHA-${Math.floor(1000 + Math.random() * 9000)}`);
      setHasSubmittedRequest(true);
      setIsEstimatedByWorker(false);

      // Auto-simulate worker responding in 3.5 seconds
      setTimeout(() => {
        setIsEstimatedByWorker(true);
      }, 3500);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyWorkerQuote = () => {
    const updatedProd: ParsedProduct = {
      ...product,
      originalPriceUsd: workerUsd,
    };
    setProduct(updatedProd);
    setCustomWeightKg(workerWeight);
    if (workerSize.trim()) setSelectedSize(workerSize.trim());
    if (workerColor.trim()) setSelectedColor(workerColor.trim());
    if (workerNotes.trim()) setItemNotes(workerNotes.trim());
    setIsEstimatedByWorker(true);
    setHasSubmittedRequest(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() || !deliveryLandmark.trim()) {
      alert('እባክዎ ስልክ ቁጥርዎን እና የመኖሪያ ምልክትዎን ያስገቡ።');
      return;
    }

    const orderNumber = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    const optionsNote = [
      selectedSize ? `መጠን: ${selectedSize}` : null,
      selectedColor ? `ቀለም: ${selectedColor}` : null,
      itemNotes.trim() ? `ምርጫ: ${itemNotes.trim()}` : null,
      transactionRef ? `Txn Ref: ${transactionRef}` : null,
    ].filter(Boolean).join(' • ');

    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const rawTg = customerTelegram.trim();
    const resolvedTgUser = rawTg
      ? (rawTg.startsWith('@') ? rawTg : `@${rawTg}`)
      : (tgUser?.username ? `@${tgUser.username}` : (tgUser?.first_name ? `${tgUser.first_name}` : '@customer'));

    if (resolvedTgUser) {
      localStorage.setItem('korcha_customer_telegram_user', resolvedTgUser);
    }
    const realTgId = tgUser?.id ? String(tgUser.id) : undefined;
    const resolvedCustomerName = customerName.trim() || (tgUser?.first_name ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'የኮርቻ ደንበኛ');

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: resolvedCustomerName,
      customerPhone: customerPhone.trim(),
      customerTelegramUser: resolvedTgUser,
      customerTelegramId: realTgId,
      deliveryCity,
      deliverySubcity,
      deliveryLandmark: deliveryLandmark.trim(),
      notes: optionsNote || undefined,
      item: {
        product,
        quantity: 1,
        selectedSize: selectedSize || product.availableSizes[0] || 'Standard',
        selectedColor: selectedColor || product.availableColors[0] || 'Default',
        pricing,
      },
      termsAgreed: true,
      termsAgreedAt: new Date().toISOString(),
      depositStatus: 'pending_verification',
      status: 'pending_deposit',
      workerNotified: true,
      depositMethod: selectedPaymentMethod,
      telebirrTxnId: transactionRef || undefined,
    };

    triggerTmaHaptic('success');
    setOrderConfirmed(newOrder);
    onOrderCompleted(newOrder);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Calculator className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              ኮርቻ (Korcha Estimator)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Shein፣ Amazon እና AliExpress የዋጋ ማረጋገጫና ማዘዣ
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            በመረጡት ድረ-ገጽ ላይ እቃዎችን ይመልከቱ፤ ሊንኩን ወይም ስክሪንሾቱን ሲያስገቡ ሰራተኛችን ዋጋውን በ5 ደቂቃ ውስጥ አስልቶ ያሳውቅዎታል።
          </p>
        </div>

        {/* Direct In-Bot Support Link */}
        <a
          href="https://t.me/korchaetbot?start=support"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all shrink-0 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400" />
          <span>💬 በቦቱ ከሰራተኛው ጋር አውራ (@korchaetbot)</span>
        </a>
      </div>

      {/* 3 Supported Marketplaces Selector with App Store & Play Store Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Shein */}
        <div className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
          product.marketplace === 'shein'
            ? 'bg-pink-500/15 border-pink-500 ring-2 ring-pink-500/30'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => {
            setProduct((prev) => ({ ...prev, marketplace: 'shein' }));
            setInputUrlOrText('https://m.shein.com');
          }}>
            <div className="text-xs sm:text-sm font-black text-pink-300 flex items-center gap-1.5">
              <span>👗 Shein (ሺኢን)</span>
            </div>
            <span className="text-[10px] text-pink-400 font-bold bg-pink-500/20 px-2 py-0.5 rounded-full">ፋሽን</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">አልባሳት፣ ጫማና ፋሽን</div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
            <a
              href={MARKETPLACE_APPS.shein.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              📱 Play Store
            </a>
            <a
              href={MARKETPLACE_APPS.shein.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              🍎 App Store
            </a>
          </div>
        </div>

        {/* Amazon */}
        <div className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
          product.marketplace === 'Amazon'
            ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => {
            setProduct((prev) => ({ ...prev, marketplace: 'Amazon' }));
            setInputUrlOrText('https://www.Amazon.com');
          }}>
            <div className="text-xs sm:text-sm font-black text-orange-300 flex items-center gap-1.5">
              <span>🛍️ Amazon (ቴሙ)</span>
            </div>
            <span className="text-[10px] text-orange-400 font-bold bg-orange-500/20 px-2 py-0.5 rounded-full">የቤት/ቴክ</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">የቤትና ኩሽና እቃዎች</div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
            <a
              href={MARKETPLACE_APPS.Amazon.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              📱 Play Store
            </a>
            <a
              href={MARKETPLACE_APPS.Amazon.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              🍎 App Store
            </a>
          </div>
        </div>

        {/* AliExpress */}
        <div className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
          product.marketplace === 'aliexpress'
            ? 'bg-red-500/15 border-red-500 ring-2 ring-red-500/30'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => {
            setProduct((prev) => ({ ...prev, marketplace: 'aliexpress' }));
            setInputUrlOrText('https://m.aliexpress.com');
          }}>
            <div className="text-xs sm:text-sm font-black text-red-300 flex items-center gap-1.5">
              <span>📦 AliExpress</span>
            </div>
            <span className="text-[10px] text-red-400 font-bold bg-red-500/20 px-2 py-0.5 rounded-full">ቴክኖሎጂ</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">ቴክኖሎጂና መለዋወጫዎች</div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
            <a
              href={MARKETPLACE_APPS.aliexpress.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              📱 Play Store
            </a>
            <a
              href={MARKETPLACE_APPS.aliexpress.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1 px-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 text-center border border-slate-800 font-medium"
            >
              🍎 App Store
            </a>
          </div>
        </div>
      </div>

      {/* Main Tabbed Input Section: Link, Screenshot, Worker Helper */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setInputMode('link')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              inputMode === 'link'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🔗 በሊንክ (Customer Link)</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('screenshot')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              inputMode === 'screenshot'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>📸 በስክሪንሾት (Screenshot Upload)</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode('worker')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              inputMode === 'worker'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black'
                : 'text-emerald-400 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-300" />
            <span>🛠️ የሰራተኛ ረዳት (Worker Helper)</span>
          </button>
        </div>

        {/* Tab 1: Customer Link */}
        {inputMode === 'link' && (
          <form onSubmit={handleEstimateLink} className="space-y-4">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              የእቃውን ሊንክ እዚህ ይለጥፉ (Shein, Amazon, AliExpress URL) *:
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={inputUrlOrText}
                onChange={(e) => setInputUrlOrText(e.target.value)}
                placeholder="https://www.shein.com/... ወይም https://www.Amazon.com/... ወይም AliExpress"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                type="submit"
                className="py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <span>የዋጋ ስሌት ጠይቅ →</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Customer Screenshot */}
        {inputMode === 'screenshot' && (
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              የእቃው ፎቶ ወይም ስክሪንሾት (Screenshot) *:
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleScreenshotUpload}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-amber-500 bg-slate-950/60 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Camera className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">ፎቶውን ወይም ስክሪንሾቱን ለመምረጥ እዚህ ይጫኑ</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP እስከ 10MB</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: WORKER CALCULATION HELPER PANEL (Matches telegram_korcha exactly) */}
        {inputMode === 'worker' && (
          <div className="p-6 rounded-2xl bg-emerald-950/20 border-2 border-emerald-500/40 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-800/40">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                  <Wrench className="w-4 h-4" />
                </span>
                <h4 className="text-base font-bold text-white">
                  🛠️ የሰራተኛ የዋጋ ማስያና ረዳት ስሌት (Worker Tool)
                </h4>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                Worker Helper
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ሰራተኛው በ Shein፣ Amazon ወይም AliExpress ላይ ያገኘውን የቀጥታ ዋጋና ክብደት እዚህ በማስገባት ፈጣንና ትክክለኛ የደጃፍ ዋጋ ያሰላል፦
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  የእቃው ዶላር ዋጋ (USD Price) *:
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={workerUsd}
                  onChange={(e) => setWorkerUsd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  የእቃው ክብደት (Weight in kg) *:
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={workerWeight}
                  onChange={(e) => setWorkerWeight(parseFloat(e.target.value) || 0.1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Options to enter size, color, or other choices when entering data to worker */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  📏 መጠን (Size):
                </label>
                <input
                  type="text"
                  placeholder="ምሳሌ፦ S, M, L, 42"
                  value={workerSize}
                  onChange={(e) => setWorkerSize(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  🎨 ቀለም (Color):
                </label>
                <input
                  type="text"
                  placeholder="ምሳሌ፦ ጥቁር፣ ነጭ፣ ቀይ"
                  value={workerColor}
                  onChange={(e) => setWorkerColor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  📝 ተጨማሪ ምርጫ / ማስታወሻ:
                </label>
                <input
                  type="text"
                  placeholder="ልዩ ማስታወሻ ወይም ሞዴል"
                  value={workerNotes}
                  onChange={(e) => setWorkerNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Detailed Worker Calculation Breakdown */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>የመሰረት ዋጋ (Base in ETB @ 30 ETB/HKD):</span>
                <span className="font-mono text-sky-400 font-bold">{workerPricing.baseEtbAmount.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>የአቅራቢ ክፍያ (+27%):</span>
                <span className="font-mono text-amber-400">+{workerPricing.supplierFeeEtb.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>የጭነት ወጪ (1,000 ETB/kg × {workerWeight} kg):</span>
                <span className="font-mono text-sky-400">+{workerPricing.cargoCostEtb.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>የማድረሻ አገልግሎት (+54%):</span>
                <span className="font-mono text-amber-400">+{workerPricing.deliveryFeeEtb.toLocaleString()} ETB</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black text-white">
                <span>ጠቅላላ የደጃፍ ዋጋ (Total Door Price):</span>
                <span className="text-amber-400">{workerPricing.totalPriceEtb.toLocaleString()} ብር</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-400 font-bold">
                <span>• {workerPricing.depositPercent || 40}% የቴሌብር ቅድመ ክፍያ (Deposit):</span>
                <span>{workerPricing.depositAmountEtb.toLocaleString()} ብር</span>
              </div>
              <div className="flex justify-between text-xs text-sky-400 font-bold">
                <span>• {workerPricing.codPercent || 60}% ሲደርስ የሚከፈል (COD):</span>
                <span>{workerPricing.codAmountEtb.toLocaleString()} ብር</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyWorkerQuote}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>✓ ይህንን ዋጋ ወደ ደንበኛው ትዕዛዝ አስተላልፍ →</span>
            </button>
          </div>
        )}

        {/* Quick sample chips */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <span className="font-semibold text-slate-400">ምሳሌዎች (Samples):</span>
          {SAMPLE_PRODUCTS.slice(0, 4).map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setProduct(sample);
                setInputUrlOrText(sample.url);
                setWorkerUsd(sample.originalPriceUsd);
                setHasSubmittedRequest(true);
                setIsEstimatedByWorker(false);
                setTicketId(`KORCHA-${Math.floor(1000 + Math.random() * 9000)}`);
                setTimeout(() => setIsEstimatedByWorker(true), 3000);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {sample.title.slice(0, 24)}... ({calculateDoorstepPricing(sample.originalPriceUsd).totalPriceEtb.toLocaleString()} ብር)
            </button>
          ))}
        </div>
      </div>

      {/* Notice Banner: "ዋጋውን በ5 ደቂቃ ውስጥ አስልተን እናሳውቅዎታለን" */}
      {hasSubmittedRequest && !isEstimatedByWorker && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <span className="text-4xl animate-bounce">⏳</span>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-amber-300">
                ዋጋውን በ5 ደቂቃ ውስጥ አስልተን እናሳውቅዎታለን
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                ጥያቄዎ ለሰራተኛችን ደርሷል፤ ትክክለኛውን ዋጋ እና የክብደት ወጪ አረጋግጠን ወዲያውኑ እናሳውቅዎታለን።
              </p>
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-400">
                ቲኬት ቁጥር: #{ticketId}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <a
              href={`https://t.me/korchaetbot?start=quote_${ticketId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>💬 በቦቱ ከሰራተኛው ጋር ይገናኙ</span>
            </a>
            <button
              onClick={() => setIsEstimatedByWorker(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>⚡ ሰራተኛው ዋጋውን አፀደቀ</span>
            </button>
          </div>
        </div>
      )}

      {/* Verified Price Estimation Result Card (Visible once estimated by worker) */}
      {isEstimatedByWorker && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Product Visual & Basic Details (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="relative h-64 bg-slate-950">
              <img
                src={product.imageUrl}
                alt={product.title}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-slate-950/85 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-amber-300 border border-slate-800">
                {product.marketplace}
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-sm text-xs font-semibold text-slate-300">
                {product.category}
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  የተረጋገጠ የሰራተኛ ስሌት
                </span>
                <span className="text-xs font-mono text-slate-400">#{ticketId}</span>
              </div>

              <h3 className="text-base font-bold text-white leading-snug">{product.title}</h3>
              {product.titleAmharic && (
                <p className="text-xs text-slate-400">{product.titleAmharic}</p>
              )}

              {/* Weight and size badge */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>የእቃው ክብደት: <b>~{pricing.cargoWeightKg} ኪ.ግ</b></span>
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  እስከ 50×50 ሳ.ሜ የተፈቀደ
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>የማድረሻ ጊዜ: <b className="text-white">10 - 14 የስራ ቀናት</b></span>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                >
                  <span>ዋናውን እቃ ተመልከት</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Clean Landed Birr Estimation & Action (7 cols) */}
          <div className="lg:col-span-7 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  የተረጋገጠ የደጃፍ ዋጋ (Verified Doorstep Landed Price)
                </span>
                <h4 className="text-xl font-black text-white mt-0.5">የዋጋ ማጠቃለያ</h4>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                የ {pricing.depositPercent || 40}% ቅድመ ክፍያ + {pricing.codPercent || 60}% ሲደርስ
              </span>
            </div>

            {/* Clean Customer Landed Total Card */}
            <div className="bg-slate-950/90 rounded-2xl p-6 border border-slate-800/90 space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">
                  ጠቅላላ የደጃፍ ዋጋ በብር (Total Doorstep Landed Price):
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">
                    {pricing.totalPriceEtb.toLocaleString()}
                  </span>
                  <span className="text-xl font-bold text-amber-300">ብር (ETB)</span>
                </div>
              </div>

              {/* Collapsible formula details for verification */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowInternalFormula(!showInternalFormula)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {showInternalFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{showInternalFormula ? 'የስሌቱን ዝርዝር ደብቅ' : 'የውስጥ ስሌት ቀመር (Internal Formula)'}</span>
                </button>

                {showInternalFormula && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>HKD ተመን (30 ETB/HKD):</span>
                      <span className="font-mono text-sky-400">{pricing.baseEtbAmount.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+27% ለአቅራቢ (Supplier):</span>
                      <span className="font-mono text-amber-400">+{pricing.supplierFeeEtb.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>የክብደት ካርጎ ({pricing.cargoWeightKg} ኪ.ግ × 1000 ETB):</span>
                      <span className="font-mono text-sky-400">+{pricing.cargoCostEtb.toLocaleString()} ETB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+54% የማድረሻ አገልግሎት (Delivery):</span>
                      <span className="font-mono text-amber-400">+{pricing.deliveryFeeEtb.toLocaleString()} ETB</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Deposit and COD on Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 space-y-1">
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  አሁን የሚከፈል {pricing.depositPercent || 40}% ቅድመ ክፍያ:
                </span>
                <div className="text-2xl font-black text-emerald-300">
                  {pricing.depositAmountEtb.toLocaleString()} <span className="text-xs font-medium text-emerald-400">ብር</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  (ወደ ቅርብ 100 ብር የተጠጋጋ • በቴሌብር/CBE የሚከፈል)
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-sky-400 font-bold flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  ቀሪ {pricing.codPercent || 60}% እቃው በርዎ ሲደርስ:
                </span>
                <div className="text-2xl font-black text-white">
                  {pricing.codAmountEtb.toLocaleString()} <span className="text-xs font-medium text-slate-400">ብር</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  (እቃውን ተረክበው ሲፈትሹ በጥሬ ገንዘብ ወይም ቴሌብር)
                </p>
              </div>
            </div>

            {/* Action Button: Order Now */}
            {!showPaymentStep ? (
              <button
                type="button"
                onClick={() => setShowPaymentStep(true)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>✅ አሁን እዘዝ (Order Now)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              /* Checkout Form (Phone + Landmark + Payment) */
              <form onSubmit={handleCompleteOrder} className="space-y-5 pt-4 border-t border-slate-800">
                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>የማድረሻ አድራሻና ስልክ ቁጥር ያስገቡ</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">ስምዎ (Full Name):</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="ስምዎ (Your Name)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">ስልክ ቁጥር (Phone) *:</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="09******** ወይም 07********"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">ቴሌግራም መለያ (Telegram):</label>
                    <input
                      type="text"
                      value={customerTelegram}
                      onChange={(e) => setCustomerTelegram(e.target.value)}
                      placeholder="@username"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">ክፍለ ከተማ (Subcity):</label>
                    <select
                      value={deliverySubcity}
                      onChange={(e) => setDeliverySubcity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="ቦሌ">ቦሌ</option>
                      <option value="ቂርቆስ">ቂርቆስ</option>
                      <option value="አራዳ">አራዳ</option>
                      <option value="የካ">የካ</option>
                      <option value="ኮልፌ ቀራኒዮ">ኮልፌ ቀራኒዮ</option>
                      <option value="ንፋስ ስልክ ላፍቶ">ንፋስ ስልክ ላፍቶ</option>
                      <option value="ጉለሌ">ጉለሌ</option>
                      <option value="አቃቂ ቃሊቲ">አቃቂ ቃሊቲ</option>
                      <option value="ልደታ">ልደታ</option>
                      <option value="አዲስ ከተማ">አዲስ ከተማ</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">የመዳረሻ ምልክት (Landmark) *:</label>
                    <input
                      type="text"
                      required
                      value={deliveryLandmark}
                      onChange={(e) => setDeliveryLandmark(e.target.value)}
                      placeholder="ምሳሌ፦ ቦሌ ወይም ቂርቆስ ወይም አድራሻዎ"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Options to enter size, color, or other choices */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    🎨 የእቃው መጠንና ቀለም ምርጫ (Size & Color Choices)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">መጠን (Size):</label>
                      <input
                        type="text"
                        value={selectedSize}
                        onChange={(e) => setSelectedSize(e.target.value)}
                        placeholder="ምሳሌ፦ M, L, 42"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">ቀለም (Color):</label>
                      <input
                        type="text"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        placeholder="ምሳሌ፦ ጥቁር፣ ነጭ"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">ተጨማሪ ምርጫ / ማስታወሻ:</label>
                      <input
                        type="text"
                        value={itemNotes}
                        onChange={(e) => setItemNotes(e.target.value)}
                        placeholder="ልዩ ማስታወሻ ወይም ሞዴል"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Telebirr & CBE Payment QR Code Generator Section */}
                <div className="w-full">
                  <PaymentQRCode
                    amountEtb={pricing.depositAmountEtb}
                    orderNumber={ticketId}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>ትዕዛዜን አረጋግጥ (Confirm Order)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentStep(false)}
                    className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    ተመለስ
                  </button>
                </div>
              </form>
            )}

            {/* Success Confirmation Modal / Banner if order was placed */}
            {orderConfirmed && (
              <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="w-5 h-5" />
                  <span>ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል! (#{orderConfirmed.orderNumber})</span>
                </div>
                <p className="text-xs text-slate-300">
                  ትዕዛዙ ወደ ሰራተኛ ዴስክ ተላልፏል፤ የ {orderConfirmed.item.pricing.depositPercent || 40}% ቅድመ ክፍያውን እንደፈጸሙ እቃው ከዓለም አቀፍ ገበያ ይታዘዛል።
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <a
                    href="https://t.me/korcha_support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 underline font-bold"
                  >
                    <span>💬 የክፍያ ማረጋገጫ በቴሌግራም ለሰራተኛው ላክ →</span>
                  </a>

                  {onNavigateToOrders && (
                    <button
                      type="button"
                      onClick={() => onNavigateToOrders(orderConfirmed.customerPhone)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>📦 ትዕዛዜን ተከታተል (Track Order)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
