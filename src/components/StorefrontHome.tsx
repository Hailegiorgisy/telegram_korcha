<<<<<<< HEAD
// src/components/StorefrontHome.tsx: Customer Storefront without Price Estimator or Worker Portal
import React from 'react';
import { Link as LinkIcon, Camera, MessageCircle, ExternalLink, ShieldCheck, Truck, CreditCard, Sparkles } from 'lucide-react';
import { CATEGORIES } from '../data/categories';

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode?: 'link' | 'screenshot') => void;
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onOpenQuoteModal,
  selectedCategory,
  onSelectCategory,
}) => {
  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';
  const supportUrl = `https://t.me/${workerUsername}`;

  const marketplaces = [
    { name: 'Shein', url: 'https://www.shein.com', color: 'from-black to-stone-800', desc: 'አልባሳትና ፋሽን' },
    { name: 'Temu', url: 'https://www.temu.com', color: 'from-orange-600 to-amber-600', desc: 'የቤትና የተለያዩ እቃዎች' },
    { name: 'AliExpress', url: 'https://www.aliexpress.com', color: 'from-red-600 to-rose-600', desc: 'ኤሌክትሮኒክስና መለዋወጫ' },
  ];

  return (
    <div className="space-y-5 pb-12 animate-fade-in max-w-md mx-auto">
      {/* Hero Banner: Beautified with "ሊንክ ያስገቡ" Call to Action */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-5 shadow-xl border border-stone-800">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</span>
          </div>

          <h2 className="text-xl font-extrabold leading-tight">
            የፈለጉትን እቃ ይምረጡ፣ <br />
            እኛ በርዎ ድረስ እናደርሳለን!
          </h2>

          <p className="text-xs text-stone-300 leading-relaxed">
            ከ Shein, Temu ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ስክሪንሾት ያስገቡ። አስተናጋጆቻችን ወጪውን አስልተው ያቀርቡልዎታል።
          </p>

          {/* Primary Action Button: "ሊንክ ያስገቡ" (as per 3.4) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <LinkIcon className="w-4 h-4" />
              <span>ሊንክ ያስገቡ</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-white/15 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>ስክሪንሾት ላክ</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Global Marketplace Browsing Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            ዓለም አቀፍ ገበያዎች (Global Sites)
          </h3>
          <span className="text-[11px] text-amber-700 font-semibold">ሊንኩን ኮፒ አድርገው ይዘዙ</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {marketplaces.map((m) => (
            <a
              key={m.name}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-3 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-400 hover:shadow-md transition-all text-center block"
            >
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${m.color} text-white font-extrabold text-xs flex items-center justify-center mx-auto mb-1.5 shadow-xs group-hover:scale-105 transition-transform`}>
                {m.name[0]}
              </div>
              <p className="font-bold text-xs text-stone-900 group-hover:text-amber-700">{m.name}</p>
              <p className="text-[10px] text-stone-400 line-clamp-1">{m.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Category Navigation (Fulfilled Requirement 5.1) */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 px-1">
          የእቃዎች ምድብ (Categories)
        </h3>

        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                onOpenQuoteModal('link');
              }}
              className="p-2.5 rounded-2xl bg-white border border-stone-200/70 hover:border-amber-400 hover:bg-amber-50/50 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 text-center shadow-2xs"
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-[11px] font-semibold text-stone-800 line-clamp-1">{cat.nameAm}</span>
              <span className="text-[9px] text-stone-400 line-clamp-1">{cat.nameEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Trust & Service Highlights */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-1">
          <CreditCard className="w-4 h-4 text-amber-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">በቴሌብር ይክፈሉ</p>
          <p className="text-[10px] text-stone-500">40% ቅድመ ክፍያ ብቻ</p>
        </div>

        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-1">
          <Truck className="w-4 h-4 text-emerald-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">በርዎ ድረስ</p>
          <p className="text-[10px] text-stone-500">ቀሪውን ሲረከቡ ይክፈሉ</p>
        </div>

        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-1">
          <ShieldCheck className="w-4 h-4 text-blue-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">የታመነ አገልግሎት</p>
          <p className="text-[10px] text-stone-500">ቀጥታ ድጋፍ በቦት</p>
        </div>
      </div>

      {/* Direct Contact Card with korcha_support (Fulfilling 2.3 & 2.4 & 7.2) */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="font-bold text-xs text-emerald-950 flex items-center space-x-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>በቦቱ ከአስተናጋጅ ጋር አውራ</span>
          </p>
          <p className="text-[11px] text-emerald-800">
            የእቃ ጥያቄዎችንና መረጃዎችን በቴሌግራም ያግኙ (@{workerUsername})
          </p>
        </div>
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-xs active:scale-95 transition-all"
        >
          አውራ
        </a>
      </div>
    </div>
  );
};

export default StorefrontHome;
=======
import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Plane,
  Truck,
  Sparkles,
  ExternalLink,
  Smartphone,
  Building2,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Tag,
  Clock,
  Star,
  Copy,
  Check,
  Layers,
  ShoppingBag,
  Camera,
} from 'lucide-react';
import { ParsedProduct, Order } from '../types';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { calculateDoorstepPricing, getPaymentRatios } from '../services/pricingEngine';
import { PaymentQRCode } from './PaymentQRCode';
import { parseMarketplaceLink } from '../services/marketplaceParser';
import { MARKETPLACE_APPS, getSmartMarketplaceUrl } from '../utils/marketplaceLinks';

interface StorefrontHomeProps {
  onSelectProductForCalculator: (prod: ParsedProduct) => void;
  onNavigateToOrders: (phone?: string) => void;
  onNavigateToSimulator: () => void;
  onOrderCompleted: (order: Order) => void;
  officialRate: number;
  onOpenScreenshotModal?: () => void;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onSelectProductForCalculator,
  onNavigateToOrders,
  onNavigateToSimulator,
  onOrderCompleted,
  officialRate,
  onOpenScreenshotModal,
}) => {
  const [pasteInput, setPasteInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickTrackInput, setQuickTrackInput] = useState<string>('');
  const [activeModalProduct, setActiveModalProduct] = useState<ParsedProduct | null>(null);

  // Quick order modal form state
  const [modalCustomerName, setModalCustomerName] = useState<string>('');
  const [modalCustomerPhone, setModalCustomerPhone] = useState<string>('');
  const [modalDeliveryCity, setModalDeliveryCity] = useState<string>('አዲስ አበባ (Addis Ababa)');
  const [modalDeliverySubcity, setModalDeliverySubcity] = useState<string>('ቦሌ (Bole)');
  const [modalDeliveryLandmark, setModalDeliveryLandmark] = useState<string>('');
  const [modalSize, setModalSize] = useState<string>('');
  const [modalColor, setModalColor] = useState<string>('');
  const [modalTxnRef, setModalTxnRef] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccessOrder, setModalSuccessOrder] = useState<Order | null>(null);

  const { advancePercent, codPercent } = getPaymentRatios();

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteInput.trim()) return;

    const trimmed = pasteInput.trim();
    const parsed = parseMarketplaceLink(trimmed);

    if (parsed) {
      onSelectProductForCalculator(parsed);
    } else {
      // Create custom product from search
      const customProd: ParsedProduct = {
        id: `custom-${Date.now()}`,
        marketplace: trimmed.includes('shein')
          ? 'shein'
          : trimmed.includes('temu')
          ? 'temu'
          : trimmed.includes('ali')
          ? 'aliexpress'
          : 'shein',
        url: trimmed.startsWith('http') ? trimmed : `https://www.shein.com/search?q=${encodeURIComponent(trimmed)}`,
        title: trimmed.startsWith('http') ? 'Cross-Border Marketplace Item' : trimmed,
        titleAmharic: trimmed.startsWith('http') ? 'የተመረጠ አለምአቀፍ እቃ' : trimmed,
        category: 'Custom Order',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
        originalPriceUsd: 25.0,
        availableSizes: ['Standard'],
        availableColors: ['Default'],
        rating: 4.8,
        reviewsCount: 150,
      };
      onSelectProductForCalculator(customProd);
    }
  };

  const handleOpenQuickOrder = (prod: ParsedProduct) => {
    setActiveModalProduct(prod);
    setModalSize(prod.availableSizes[0] || 'Standard');
    setModalColor(prod.availableColors[0] || 'Default');
    setModalError(null);
    setModalSuccessOrder(null);
  };

  const handleConfirmQuickOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalProduct) return;

    const cleanPhone = modalCustomerPhone.replace(/\s+/g, '');
    const isEthio = /^(\+2519|09|9)\d{8}$/.test(cleanPhone);
    const isSafari = /^(\+2517|07|7)\d{8}$/.test(cleanPhone);

    if (!isEthio && !isSafari) {
      setModalError('ትክክለኛ የኢትዮ ቴሌኮም (09...) ወይም የሳፋሪኮም (07...) ስልክ ቁጥር ያስገቡ።');
      return;
    }

    if (!modalDeliveryLandmark.trim()) {
      setModalError('እባክዎን መዳረሻ አድራሻ (የሰፈር ስም ወይም መለያ ቦታ) ያስገቡ።');
      return;
    }

    const pricing = calculateDoorstepPricing(activeModalProduct.originalPriceUsd, officialRate);
    const orderNumber = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: modalCustomerName.trim() || 'የኮርቻ ደንበኛ',
      customerPhone: cleanPhone,
      customerTelegramUser: (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.username
        ? `@${(window as any).Telegram.WebApp.initDataUnsafe.user.username}`
        : '@web_customer',
      customerTelegramId: (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
        ? String((window as any).Telegram.WebApp.initDataUnsafe.user.id)
        : undefined,
      deliveryCity: modalDeliveryCity,
      deliverySubcity: modalDeliverySubcity,
      deliveryLandmark: modalDeliveryLandmark.trim(),
      notes: `መጠን: ${modalSize} • ቀለም: ${modalColor}${modalTxnRef ? ` • Txn Ref: ${modalTxnRef}` : ''}`,
      item: {
        product: activeModalProduct,
        quantity: 1,
        selectedSize: modalSize,
        selectedColor: modalColor,
        pricing,
      },
      termsAgreed: true,
      termsAgreedAt: new Date().toISOString(),
      depositStatus: 'pending_verification',
      status: 'pending_deposit',
      workerNotified: true,
      depositMethod: 'telebirr',
      telebirrTxnId: modalTxnRef || undefined,
    };

    setModalSuccessOrder(newOrder);
    onOrderCompleted(newOrder);
  };

  const filteredProducts = SAMPLE_PRODUCTS.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'shein') return p.marketplace === 'shein';
    if (selectedCategory === 'temu') return p.marketplace === 'temu';
    if (selectedCategory === 'aliexpress') return p.marketplace === 'aliexpress';
    return true;
  });

  return (
    <div className="space-y-14 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 via-slate-950 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            
            {/* Tagline */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest">
              <span>Shein · Temu · AliExpress</span>
              <span aria-hidden="true">·</span>
              <span>ወደ ኢትዮጵያ በርዎ ድረስ</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              የመረጡትን እቃ ከዓለም አቀፍ ገበያ <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                በቀጥታ አዲስ አበባ ደጃፍዎ
              </span> ድረስ እናስመጣለን
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
              የእቃውን ሊንክ (Link) እዚህ ይለጥፉ፤ የደጃፍ ዋጋውን በብር አውቀው በቴሌብር ወይም በ CBE የ {advancePercent}% ቅድመ ክፍያ ብቻ ይዘዙ። ቀሪውን {codPercent}% እቃው በርዎ ሲደርስ ይከፍላሉ!
            </p>

            {/* Main Instant Paste / Search Form */}
            <form
              onSubmit={handlePasteSubmit}
              className="mt-6 max-w-2xl mx-auto p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl flex flex-col sm:flex-row items-center gap-2"
            >
              <div className="relative flex-1 w-full flex items-center">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="የ Shein, Temu ወይም AliExpress ሊንክ እዚህ ይለጥፉ (Paste Link)..."
                  className="w-full pl-11 pr-4 py-3 bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/25 shrink-0"
              >
                <span>ዋጋ አስላ & እዘዝ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Screenshot Action Banner linking to Korcha Worker */}
            {onOpenScreenshotModal && (
              <div className="mt-4 max-w-2xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-sky-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                      <span>📸 የእቃው ስክሪንሾት (ፎቶ) አለዎት?</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">ቀጥታ ለሰራተኛው</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      ስክሪንሾት በማስገባት ዋጋ ይጠይቁ — ሰራተኛችን ዋጋውን አስልቶ በቀጥታ ይልክልዎታል!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenScreenshotModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-md shadow-amber-500/20 shrink-0 whitespace-nowrap"
                >
                  📸 ስክሪንሾት አስገባ →
                </button>
              </div>
            )}

            {/* Quick Sample Links */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 pt-2">
              <span className="font-medium text-slate-400">ናሙና እቃዎች፦</span>
              <button
                type="button"
                onClick={() => onSelectProductForCalculator(SAMPLE_PRODUCTS[0])}
                className="hover:text-amber-300 underline cursor-pointer"
              >
                👗 Shein Dress ($16.50)
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => onSelectProductForCalculator(SAMPLE_PRODUCTS[1])}
                className="hover:text-amber-300 underline cursor-pointer"
              >
                🎧 Temu Earbuds ($14.99)
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => onSelectProductForCalculator(SAMPLE_PRODUCTS[2])}
                className="hover:text-amber-300 underline cursor-pointer"
              >
                ⌨️ AliExpress Keyboard ($34.20)
              </button>
            </div>

            {/* Value Props Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 text-left">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Plane className="w-4 h-4" />
                  <span>10 - 14 ቀናት</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  የቀጥታ አየር ጭነት ከጓንግዡ ወደ አዲስ አበባ ቦሌ
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  <span>{advancePercent}% ቅድመ ክፍያ</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  በቴሌብር (Telebirr) ወይም በንግድ ባንክ (CBE)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Truck className="w-4 h-4" />
                  <span>{codPercent}% በር ላይ</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  እቃው ደጃፍዎ ሲደርስ የሚከፈል ቀሪ ክፍያ
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>100% ዋስትና</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  ትክክለኛ እቃና ጉምሩክ ክሊራንስ የተረጋገጠ
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Supported Marketplaces Section (Shein, Temu, AliExpress) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                <span>የሚደገፉ የገበያ ቦታዎች (Supported Marketplaces)</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                ከ Shein፣ Temu ወይም AliExpress የሚፈልጉትን እቃ ይምረጡ፤ ሊንኩን ወይም ስክሪንሾቱን በማስገባት ዋጋ ማስላት ይችላሉ፦
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Shein Card */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              selectedCategory === 'fashion'
                ? 'bg-pink-500/15 border-pink-500/60 ring-2 ring-pink-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-pink-500/40'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-pink-300">👗 Shein (ሺኢን)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">ፋሽን</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  ዘመናዊ የሴቶች፣ የወንዶችና የህፃናት አልባሳት፣ ጫማዎችና ቦርሳዎች
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <a
                  href={getSmartMarketplaceUrl('shein')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  title="Shein App በ Play Store ወይም App Store ክፈት"
                >
                  <span>📲 Shein አፕ ክፈት</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                  <a
                    href={MARKETPLACE_APPS.shein.androidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    📱 Play Store
                  </a>
                  <a
                    href={MARKETPLACE_APPS.shein.iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    🍎 App Store
                  </a>
                </div>
              </div>
            </div>

            {/* Temu Card */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              selectedCategory === 'home'
                ? 'bg-orange-500/15 border-orange-500/60 ring-2 ring-orange-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-orange-500/40'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-orange-300">🛍️ Temu (ቴሙ)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">የቤት & ቴክ</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  ጥራት ያላቸው የቤትና የኩሽና እቃዎች፣ መገልገያዎችና ኤሌክትሮኒክስ
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <a
                  href={getSmartMarketplaceUrl('temu')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  title="Temu App በ Play Store ወይም App Store ክፈት"
                >
                  <span>📲 Temu አፕ ክፈት</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                  <a
                    href={MARKETPLACE_APPS.temu.androidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    📱 Play Store
                  </a>
                  <a
                    href={MARKETPLACE_APPS.temu.iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    🍎 App Store
                  </a>
                </div>
              </div>
            </div>

            {/* AliExpress Card */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
              selectedCategory === 'electronics'
                ? 'bg-red-500/15 border-red-500/60 ring-2 ring-red-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-red-500/40'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-red-300">📦 AliExpress (አሊኤክስፕረስ)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">ቴክኖሎጂ</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  በጅምላና በችርቻሮ የሚቀርቡ የቴክኖሎጂ እቃዎችና መለዋወጫዎች
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <a
                  href={getSmartMarketplaceUrl('aliexpress')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  title="AliExpress App በ Play Store ወይም App Store ክፈት"
                >
                  <span>📲 AliExpress አፕ ክፈት</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                  <a
                    href={MARKETPLACE_APPS.aliexpress.androidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    📱 Play Store
                  </a>
                  <a
                    href={MARKETPLACE_APPS.aliexpress.iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-center border border-slate-800 transition-colors"
                  >
                    🍎 App Store
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Products Catalog */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              የተመረጡ እቃዎች (Curated Catalog)
            </div>
            <h2 className="text-2xl font-black text-white mt-1">
              በብዛት የሚታዘዙ እቃዎችና የቀጥታ ዋጋ ስሌት
            </h2>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ሁሉንም (All)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('shein')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'shein'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👗 Shein ፋሽን
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('temu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'temu'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛍️ Temu ቤት & ኤሌክትሮኒክስ
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('aliexpress')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'aliexpress'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📦 AliExpress ቴክኖሎጂ
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const pricing = calculateDoorstepPricing(product.originalPriceUsd, officialRate);
            return (
              <div
                key={product.id}
                className="group rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col overflow-hidden shadow-lg hover:shadow-2xl"
              >
                {/* Product Image */}
                <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Marketplace badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md bg-slate-950/80 border border-white/10 text-white flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      product.marketplace === 'shein'
                        ? 'bg-pink-400'
                        : product.marketplace === 'temu'
                        ? 'bg-orange-400'
                        : 'bg-red-400'
                    }`} />
                    <span>{product.marketplace.toUpperCase()}</span>
                  </div>

                  {/* Rating */}
                  <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md text-[11px] font-bold backdrop-blur-md bg-slate-950/80 text-amber-300 flex items-center gap-1 border border-white/10">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{product.rating}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-amber-300 transition-colors">
                      {product.titleAmharic || product.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {product.title}
                    </p>
                  </div>

                  {/* Price breakdown pill box */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>የመነሻ ዋጋ:</span>
                      <span className="font-mono text-slate-300">${product.originalPriceUsd.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">ጠቅላላ የደጃፍ ዋጋ፦</span>
                      <span className="font-black text-amber-400 font-mono text-sm">
                        {pricing.totalPriceEtb.toLocaleString()} ብር
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-medium">
                        {advancePercent}% ቅድመ ክፍያ: <b>{pricing.depositAmountEtb.toLocaleString()} ብር</b>
                      </span>
                      <span className="text-slate-400">
                        {codPercent}% በር ላይ: {pricing.codAmountEtb.toLocaleString()} ብር
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectProductForCalculator(product)}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      🧮 ዋጋ አስላ
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenQuickOrder(product)}
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer text-center shadow-md shadow-amber-500/20"
                    >
                      🛍️ አሁን እዘዝ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Order Tracker Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl text-center lg:text-left">
            <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center justify-center lg:justify-start gap-1.5">
              <Truck className="w-4 h-4" />
              <span>የትዕዛዝ ቀጥታ ክትትል (Track Your Order)</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              የትዕዛዝዎን ሁኔታ በማንኛውም ሰዓት በስልክ ቁጥርዎ ይከታተሉ
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              ከጓንግዡ መጋዘን እስከ ቦሌ ጉምሩክና ደጃፍዎ ድረስ ያለውን የ 7 ደረጃዎች ጉዞ በቅጽበት ይመልከቱ።
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onNavigateToOrders(quickTrackInput.trim() || undefined);
            }}
            className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-2 max-w-md shrink-0"
          >
            <input
              type="text"
              value={quickTrackInput}
              onChange={(e) => setQuickTrackInput(e.target.value)}
              placeholder="ስልክ ቁጥር (09...) ወይም የትዕዛዝ ቁጥር (KC-...)"
              className="w-full sm:w-72 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              ተከታተል (Track)
            </button>
          </form>
        </div>
      </section>

      {/* How It Works (እንዴት ይሰራል?) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            ቀላል አሰራር
          </div>
          <h2 className="text-2xl font-black text-white">
            ከኮርቻ ጋር እንዴት ማዘዝ ይችላሉ?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-sm flex items-center justify-center">
              1
            </div>
            <h4 className="font-bold text-white text-sm">እቃ ይምረጡ</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              ከ Shein, Temu ወይም AliExpress ያዩትን እቃ ሊንክ ይቅዱ (Copy Link) ወይም ከኮርቻ ካታሎግ ይምረጡ።
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-sm flex items-center justify-center">
              2
            </div>
            <h4 className="font-bold text-white text-sm">ዋጋውን ይወቁ</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              ሊንኩን ሲለጥፉ የቀጥታ የካርጎና የጉምሩክ ክፍያ ተሰልቶ የደጃፍ ዋጋ በኢትዮጵያ ብር ይቀርብልዎታል።
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center">
              3
            </div>
            <h4 className="font-bold text-white text-sm">{advancePercent}% ቅድመ ክፍያ</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              በቴሌብር (Telebirr) ወይም በንግድ ባንክ (CBE) የ QR ኮድ ስካን በማድረግ ቅድመ ክፍያውን ይክፈሉ።
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 font-black text-sm flex items-center justify-center">
              4
            </div>
            <h4 className="font-bold text-white text-sm">በር ላይ ይቀበሉ</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              በ 10-14 የስራ ቀናት ውስጥ እቃው በርዎ ሲደርስ ቀሪ {codPercent}% ክፍያ ፈጽመው እቃዎን ይረከቡ!
            </p>
          </div>
        </div>
      </section>

      {/* Telegram Bot Call-out Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-800/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
              <span>🤖 Telegram Bot & Mini App</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              በቴሌግራም ቦት በቀጥታ ማዘዝ ይፈልጋሉ?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              በቴሌግራም ቻት ውስጥ ሆነው ስክሪንሾት በመላክ፣ ከሰራተኞቻችን ጋር በቀጥታ በመነጋገርና የክፍያ ደረሰኞችን በመጫን ፈጣን አገልግሎት ያግኙ።
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onNavigateToSimulator}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-blue-900/30"
            >
              💬 ቴሌግራም ቦት ክፈት (Open Bot)
            </button>
            <a
              href="https://t.me/korchaetbot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition-all border border-slate-700"
            >
              @korchaetbot
            </a>
          </div>
        </div>
      </section>

      {/* Quick Order Modal */}
      {activeModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 space-y-5 my-8 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  ቀጥታ የደጃፍ ትዕዛዝ ማረጋገጫ (Direct Checkout)
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {activeModalProduct.titleAmharic || activeModalProduct.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalProduct(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalSuccessOrder ? (
              /* Success View inside Modal */
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-black text-white">
                  ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!
                </h4>
                <p className="text-xs text-slate-300">
                  የትዕዛዝ ቁጥር፦ <b className="text-amber-400 font-mono">#{modalSuccessOrder.orderNumber}</b>
                </p>

                {/* Embedded Payment QR */}
                <div className="mt-4">
                  <PaymentQRCode
                    amountEtb={modalSuccessOrder.item.pricing.depositAmountEtb}
                    orderNumber={modalSuccessOrder.orderNumber}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalProduct(null);
                      onNavigateToOrders(modalSuccessOrder.customerPhone);
                    }}
                    className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    📦 ትዕዛዜን ተከታተል (Track Order)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalProduct(null)}
                    className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    ዝጋ
                  </button>
                </div>
              </div>
            ) : (
              /* Order Form */
              <form onSubmit={handleConfirmQuickOrder} className="space-y-4 text-left">
                {modalError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    {modalError}
                  </div>
                )}

                {/* Product Summary */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <img
                    src={activeModalProduct.imageUrl}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-bold text-white truncate">{activeModalProduct.title}</div>
                    <div className="text-[11px] text-slate-400">{activeModalProduct.category}</div>
                    <div className="text-amber-400 font-black font-mono mt-0.5">
                      {calculateDoorstepPricing(activeModalProduct.originalPriceUsd, officialRate).totalPriceEtb.toLocaleString()} ETB (ጠቅላላ ዋጋ)
                    </div>
                  </div>
                </div>

                {/* Options: Size & Color */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">መጠን (Size):</label>
                    <select
                      value={modalSize}
                      onChange={(e) => setModalSize(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    >
                      {activeModalProduct.availableSizes.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ቀለም (Color):</label>
                    <select
                      value={modalColor}
                      onChange={(e) => setModalColor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    >
                      {activeModalProduct.availableColors.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ስም (Full Name):</label>
                    <input
                      type="text"
                      required
                      value={modalCustomerName}
                      onChange={(e) => setModalCustomerName(e.target.value)}
                      placeholder="ምሳሌ: አበበ ከበደ"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      ስልክ ቁጥር (Phone Number - Ethio / Safaricom):
                    </label>
                    <input
                      type="tel"
                      required
                      value={modalCustomerPhone}
                      onChange={(e) => setModalCustomerPhone(e.target.value)}
                      placeholder="09... ወይም 07..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">ከተማ (City):</label>
                      <input
                        type="text"
                        value={modalDeliveryCity}
                        onChange={(e) => setModalDeliveryCity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">ክፍለ ከተማ (Subcity):</label>
                      <select
                        value={modalDeliverySubcity}
                        onChange={(e) => setModalDeliverySubcity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      >
                        <option value="ቦሌ (Bole)">ቦሌ (Bole)</option>
                        <option value="ቂርቆስ (Kirkos)">ቂርቆስ (Kirkos)</option>
                        <option value="የካ (Yeka)">የካ (Yeka)</option>
                        <option value="አራዳ (Arada)">አራዳ (Arada)</option>
                        <option value="ንፋስ ስልክ (Nifas Silk)">ንፋስ ስልክ (Nifas Silk)</option>
                        <option value="ኮልፌ (Kolfe)">ኮልፌ (Kolfe)</option>
                        <option value="አቃቂ ቃሊቲ (Akaki Kality)">አቃቂ ቃሊቲ (Akaki Kality)</option>
                        <option value="ጉለሌ (Gulele)">ጉለሌ (Gulele)</option>
                        <option value="ልደታ (Lideta)">ልደታ (Lideta)</option>
                        <option value="አዲስ ከተማ (Addis Ketema)">አዲስ ከተማ (Addis Ketema)</option>
                        <option value="ሌላ ክልል (Regional City)">ሌላ ክልል (Regional City)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      መለያ አድራሻ (Landmark / Specific Location):
                    </label>
                    <input
                      type="text"
                      required
                      value={modalDeliveryLandmark}
                      onChange={(e) => setModalDeliveryLandmark(e.target.value)}
                      placeholder="ምሳሌ፦ ቦሌ መድኃኒዓለም፣ ከአትላስ ሆቴል ፊት ለፊት"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <span>ትዕዛዜን መዝግብ & የ QR ኮድ አሳይ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
