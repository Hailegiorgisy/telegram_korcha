import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  ShieldCheck,
  Calendar,
  Phone,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  CreditCard,
  MessageCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { PaymentQRCode } from './PaymentQRCode';
import { getPaymentRatios } from '../services/pricingEngine';

interface MyOrdersViewProps {
  orders: Order[];
  onNavigateToSimulator?: () => void;
  onNavigateToSearch?: () => void;
}

// 7 Logistics Milestones matching Korcha cross-border flow
const TRACKING_STAGES: {
  key: OrderStatus;
  titleAmharic: string;
  titleEnglish: string;
  icon: any;
  desc: string;
}[] = [
  {
    key: 'pending_deposit',
    titleAmharic: 'የቅድመ ክፍያ ማረጋገጫ',
    titleEnglish: 'Deposit Verification',
    icon: Clock,
    desc: 'የቴሌብር ወይም የCBE ባንክ ክፍያ በኮርቻ ሰራተኞች በመረጋገጥ ላይ ነው።',
  },
  {
    key: 'deposit_verified',
    titleAmharic: 'ክፍያ ተረጋግጧል',
    titleEnglish: 'Payment Confirmed',
    icon: CheckCircle2,
    desc: 'ቅድመ ክፍያው ተረጋግጦ ትዕዛዝዎ ወደ ግዢ ክፍል ተላልፏል።',
  },
  {
    key: 'procured_in_china',
    titleAmharic: 'ከዓለም አቀፍ ገበያ ተገዝቷል',
    titleEnglish: 'Procured from Global markets',
    icon: Package,
    desc: 'እቃው ከሱቁ ተገዝቶ ወደ ጓንግዡ መጋዘን ገብቷል።',
  },
  {
    key: 'freight_in_transit',
    titleAmharic: 'በአየር ጭነት በረራ ላይ',
    titleEnglish: 'Air Cargo to Bole Airport',
    icon: Truck,
    desc: 'የኢትዮጵያ አየር መንገድ ጭነት በረራ ወደ አዲስ አበባ ቦሌ አየር ማረፊያ በመብረር ላይ ነው።',
  },
  {
    key: 'customs_clearing',
    titleAmharic: 'ቦሌ ጉምሩክ ክሊራንስ',
    titleEnglish: 'Customs Clearance',
    icon: ShieldCheck,
    desc: 'የጉምሩክ ፍተሻና የክሊራንስ ሰነዶች በማጠናቀቅ ላይ ናቸው።',
  },
  {
    key: 'out_for_delivery',
    titleAmharic: 'ቤት ለቤት በመጓዝ ላይ',
    titleEnglish: 'Out for Doorstep Delivery',
    icon: MapPin,
    desc: 'የኮርቻ አሽከርካሪ እቃውን ወደ መኖሪያ ምልክትዎ ይዞ ወጥቷል።',
  },
  {
    key: 'delivered',
    titleAmharic: 'ደጃፍዎ ደርሷል',
    titleEnglish: 'Delivered',
    icon: CheckCircle2,
    desc: `እቃው በሰላም ደርሶ ቀሪው ${getPaymentRatios().codPercent}% ክፍያ ተጠናቋል።`,
  },
];

/**
 * Returns color-coded stage badge configuration for current order progress
 * - Green for completed
 * - Sky / Cyan for in transit & active processing
 * - Amber for pending / awaiting deposit
 */
export const getOrderStageBadge = (status: OrderStatus) => {
  switch (status) {
    case 'delivered':
      return {
        labelAmharic: 'ተጠናቋል • ደጃፍዎ ደርሷል',
        labelEnglish: 'Completed',
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-300',
        border: 'border-emerald-500/40',
        dot: 'bg-emerald-400',
      };
    case 'out_for_delivery':
      return {
        labelAmharic: 'በማድረስ ላይ • ቤት ለቤት',
        labelEnglish: 'Out for Delivery',
        bg: 'bg-teal-500/20',
        text: 'text-teal-300',
        border: 'border-teal-500/40',
        dot: 'bg-teal-400 animate-pulse',
      };
    case 'customs_clearing':
      return {
        labelAmharic: 'ቦሌ ጉምሩክ ፍተሻ',
        labelEnglish: 'Customs Clearance',
        bg: 'bg-cyan-500/20',
        text: 'text-cyan-300',
        border: 'border-cyan-500/40',
        dot: 'bg-cyan-400',
      };
    case 'freight_in_transit':
      return {
        labelAmharic: 'በአየር ጭነት በረራ ላይ',
        labelEnglish: 'Air Cargo in Transit',
        bg: 'bg-sky-500/20',
        text: 'text-sky-300',
        border: 'border-sky-500/40',
        dot: 'bg-sky-400 animate-ping',
      };
    case 'procured_in_china':
      return {
        labelAmharic: 'ከዓለም አቀፍ ገበያ ተገዝቷል',
        labelEnglish: 'Procured in Global markets',
        bg: 'bg-indigo-500/20',
        text: 'text-indigo-300',
        border: 'border-indigo-500/40',
        dot: 'bg-indigo-400',
      };
    case 'deposit_verified':
      return {
        labelAmharic: 'ቅድመ ክፍያ ተረጋግጧል',
        labelEnglish: 'Deposit Confirmed',
        bg: 'bg-blue-500/20',
        text: 'text-blue-300',
        border: 'border-blue-500/40',
        dot: 'bg-blue-400',
      };
    case 'pending_deposit':
    default:
      return {
        labelAmharic: 'ቅድመ ክፍያ በመጠባበቅ ላይ',
        labelEnglish: 'Pending Deposit',
        bg: 'bg-amber-500/20',
        text: 'text-amber-300',
        border: 'border-amber-500/40',
        dot: 'bg-amber-400 animate-pulse',
      };
  }
};

export const MyOrdersView: React.FC<MyOrdersViewProps> = ({
  orders,
  onNavigateToSimulator,
  onNavigateToSearch,
}) => {
  // Remember customer phone number in localStorage
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>(() => {
    return localStorage.getItem('korcha_customer_phone') || '';
  });
  const [activeSearchPhone, setActiveSearchPhone] = useState<string>(() => {
    return localStorage.getItem('korcha_customer_phone') || '';
  });

  const [expandedQrOrderId, setExpandedQrOrderId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);

  // Sync active phone to localStorage
  useEffect(() => {
    if (activeSearchPhone) {
      localStorage.setItem('korcha_customer_phone', activeSearchPhone);
    }
  }, [activeSearchPhone]);

  // Clean phone matching: matches 09..., 07..., +251... or sub-string digits
  const normalizeDigits = (val: string) => val.replace(/\D/g, '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberInput.trim()) return;
    setActiveSearchPhone(phoneNumberInput.trim());
  };

  const handleQuickPhoneClick = (phone: string) => {
    setPhoneNumberInput(phone);
    setActiveSearchPhone(phone);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filter orders matching the active search query
  const cleanSearchDigits = normalizeDigits(activeSearchPhone);
  const matchedOrders = orders.filter((order) => {
    if (!activeSearchPhone.trim()) return false;
    const cleanOrderPhone = normalizeDigits(order.customerPhone);
    const cleanOrderNum = order.orderNumber.toLowerCase().replace(/\s/g, '');
    const cleanQuery = activeSearchPhone.trim().toLowerCase();

    // Match phone number or order number
    return (
      (cleanSearchDigits.length >= 4 && cleanOrderPhone.includes(cleanSearchDigits)) ||
      cleanOrderNum.includes(cleanQuery) ||
      order.customerPhone.includes(activeSearchPhone.trim())
    );
  });

  // Calculate current stage index for tracking progress
  const getStageIndex = (status: OrderStatus) => {
    const idx = TRACKING_STAGES.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  // Sample phone numbers present in existing orders for easy 1-click test
  const demoPhoneSuggestions = Array.from(
    new Set(orders.map((o) => o.customerPhone))
  ).slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Package className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                የደንበኞች አገልግሎት (Customer Portal)
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              📦 ትዕዛዞች እና የቀጥታ መከታተያ (My Orders & Live Tracking)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              ያዘዟቸውን እቃዎች፣ የ {getPaymentRatios().advancePercent}% ቅድመ ክፍያ ማረጋገጫ እና ከእቃ አቅራቢዉ እስከ ደጃፍዎ ያለውን የቀጥታ የጉዞ ሁኔታ ለመከታተል ስልክ ቁጥርዎን ወይም የትዕዛዝ ቁጥርዎን ይላኩልን።
            </p>
            <div className="text-xs text-amber-300/90 font-medium pt-1">
              💡 ምሳሌ፦ <span className="font-mono bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-700 text-amber-300">/track 09********</span> ወይም <span className="font-mono bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-700 text-amber-300">/track KC-******</span> ወይም በቀጥታ ስልክዎን እዚህ ይጻፉ።
            </div>
          </div>

          <a
            href="https://t.me/korchaetbot?start=support"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all shrink-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>💬 በቦቱ ከአስተናጋጅ ጋር አውራ (@korchaetbot)</span>
          </a>
        </div>

        {/* Phone Number Search Form */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              ስልክ ቁጥርዎን ያስገቡ (Enter Your Phone Number) *:
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={phoneNumberInput}
                  onChange={(e) => setPhoneNumberInput(e.target.value)}
                  placeholder="ምሳሌ፦ 09******** ወይም 07******** (ወይም የትዕዛዝ ቁጥር)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                <span>ትዕዛዞቼን ፈልግ (Find My Orders)</span>
              </button>
            </div>
          </form>

          {/* Quick Demo Suggestions */}
          {demoPhoneSuggestions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-500">የናሙና ስልኮች (Quick Test):</span>
              {demoPhoneSuggestions.map((phone) => (
                <button
                  key={phone}
                  type="button"
                  onClick={() => handleQuickPhoneClick(phone)}
                  className={`px-3 py-1 rounded-xl border transition-colors cursor-pointer text-xs font-mono ${
                    activeSearchPhone === phone
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {phone}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!activeSearchPhone ? (
        /* Empty Prompt State */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto flex items-center justify-center">
            <Phone className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">የትዕዛዝ ታሪክዎን ለማየት ስልክ ቁጥርዎን ያስገቡ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              በቴሌግራም ቦት ወይም በድረ-ገጹ ላይ ያዘዙበትን ስልክ ቁጥር ከላይ ባለው ሳጥን ውስጥ ጽፈው ይፈልጉ።
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {demoPhoneSuggestions[0] && (
              <button
                onClick={() => handleQuickPhoneClick(demoPhoneSuggestions[0])}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                በናሙና ስልክ ሞክር ({demoPhoneSuggestions[0]})
              </button>
            )}
          </div>
        </div>
      ) : matchedOrders.length === 0 ? (
        /* No Orders Found for this phone */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">በዚህ ስልክ ቁጥር የተመዘገበ ትዕዛዝ አልተገኘም</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ስልክ ቁጥር «<span className="font-mono text-amber-400">{activeSearchPhone}</span>» ላይ ትዕዛዝ አልተገኘም። እባክዎ በትክክል መጻፉን ያረጋግጡ ወይም አዲስ እቃ ይዘዙ።
            </p>
          </div>
          <div className="pt-3 flex flex-wrap justify-center gap-3">
            {onNavigateToSimulator && (
              <button
                onClick={onNavigateToSimulator}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                በቴሌግራም ቦት እዘዝ (Order via Bot)
              </button>
            )}
            {onNavigateToSearch && (
              <button
                onClick={onNavigateToSearch}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                ሱቆችን አስስ (Explore Marketplaces)
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>የተገኙ ትዕዛዞች ({matchedOrders.length})</span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  ለስልክ: {activeSearchPhone}
                </span>
              </h3>
            </div>
            <button
              onClick={() => setActiveSearchPhone('')}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              ፍለጋ ቀይር (Change Phone)
            </button>
          </div>

          <div className="space-y-6">
            {matchedOrders.map((order) => {
              const currentStageIdx = getStageIndex(order.status);
              const isQrExpanded = expandedQrOrderId === order.id;
              const isDetailExpanded = selectedOrderForDetail === order.id || matchedOrders.length === 1;

              return (
                <div
                  key={order.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all"
                >
                  {/* Order Card Header */}
                  <div className="p-6 bg-slate-850/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-black text-amber-400">
                          #{order.orderNumber}
                        </span>

                        {/* Visual Color-Coded Stage Badge */}
                        {(() => {
                          const badge = getOrderStageBadge(order.status);
                          return (
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                              <span>{badge.labelAmharic}</span>
                            </span>
                          );
                        })()}

                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-300 font-semibold">
                          {order.customerName}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {order.deliveryCity}፣ {order.deliverySubcity} ({order.deliveryLandmark})
                        </span>
                      </div>
                    </div>

                    {/* Deposit Verification Status Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {order.depositStatus === 'verified' ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>{order.item.pricing?.depositPercent || 40}% ቅድመ ክፍያ ተረጋግጧል (Verified)</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                            <span>{order.item.pricing?.depositPercent || 40}% ቅድመ ክፍያ ማረጋገጫ በመጠባበቅ ላይ</span>
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedQrOrderId(isQrExpanded ? null : order.id)
                            }
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-amber-500/20"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{isQrExpanded ? 'QR ደብቅ' : 'QR ክፈት'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Telebirr / CBE Payment Section if user needs to pay or verify deposit */}
                  {isQrExpanded && order.depositStatus !== 'verified' && (
                    <div className="p-6 bg-slate-950 border-b border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-amber-400">
                          📲 የ {order.item.pricing?.depositPercent || 40}% ቅድመ ክፍያ ማስተላለፊያ ({order.item.pricing.depositAmountEtb.toLocaleString()} ብር):
                        </span>
                        <span className="text-xs text-slate-400">ቴሌብር ወይም CBE Birr</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <PaymentQRCode
                          amountEtb={order.item.pricing.depositAmountEtb}
                          orderNumber={order.orderNumber}
                        />

                        <div className="space-y-3 flex-1 text-xs text-slate-300">
                          <p className="leading-relaxed text-slate-300">
                            የ {order.item.pricing?.depositPercent || 40}% ቅድመ ክፍያ <b>{order.item.pricing.depositAmountEtb.toLocaleString()} ብር</b> ከታች ባሉት የክፍያ አማራጮች ፈጽመው ደረሰኙን (Screenshot) ለአስተናጋጃችን ይላኩ፦
                          </p>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400">ቴሌብር ቁጥር (Telebirr):</div>
                              <div className="font-mono font-bold text-white">+251 911 234 567</div>
                            </div>
                            <button
                              onClick={() => handleCopy('+251911234567', `tb-${order.id}`)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            >
                              {copiedText === `tb-${order.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400">የኢትዮጵያ ንግድ ባንክ (CBE Account):</div>
                              <div className="font-mono font-bold text-white">1000123456789</div>
                            </div>
                            <button
                              onClick={() => handleCopy('1000123456789', `cbe-${order.id}`)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            >
                              {copiedText === `cbe-${order.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <a
                            href={`https://t.me/korchaetbot?start=payment_${order.orderNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold text-xs underline pt-1"
                          >
                            <span>💬 የክፍያ ማረጋገጫ በቦቱ ላክ →</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Details & Financial Overview */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Product visual & information (7 cols) */}
                    <div className="md:col-span-7 flex items-center gap-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative">
                        <img
                          src={order.item.product.imageUrl}
                          alt={order.item.product.title}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                          {order.item.product.marketplace}
                        </span>
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <h4 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug">
                          {order.item.product.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <span>መጠን: <b className="text-slate-200">{order.item.selectedSize || 'Standard'}</b></span>
                          <span>•</span>
                          <span>ቀለም: <b className="text-slate-200">{order.item.selectedColor || 'Default'}</b></span>
                          <span>•</span>
                          <span>ክብደት: <b className="text-slate-200">~{order.item.pricing.cargoWeightKg || 0.4} ኪ.ግ</b></span>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-0.5">
                          የማድረሻ ጊዜ፦ <b>ከ 10 እስከ 14 የስራ ቀናት</b> (በአየር ጭነት እስከ ደጃፍዎ)
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary (5 cols) */}
                    <div className="md:col-span-5 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ጠቅላላ የደጃፍ ዋጋ (Door Price):</span>
                        <span className="font-bold text-amber-400 text-sm">
                          {order.item.pricing.totalPriceEtb.toLocaleString()} ብር
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>• {order.item.pricing?.depositPercent || 40}% ቅድመ ክፍያ (Deposit):</span>
                        <span className="font-semibold text-emerald-400">
                          {order.item.pricing.depositAmountEtb.toLocaleString()} ብር
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>• {order.item.pricing?.codPercent || 60}% በርዎ ሲደርስ (COD):</span>
                        <span className="font-semibold text-sky-400">
                          {order.item.pricing.codAmountEtb.toLocaleString()} ብር
                        </span>
                      </div>
                      {order.telebirrTxnId && (
                        <div className="pt-1 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-500">
                          <span>Txn Ref:</span>
                          <span className="font-mono text-slate-400">{order.telebirrTxnId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🚀 LIVE LOGISTICS TRACKING MILESTONES TIMELINE */}
                  <div className="p-6 bg-slate-950/60 border-t border-slate-800 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-400" />
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                          የቀጥታ ጉዞ ሁኔታ (Live Logistics Milestone Updates)
                        </h5>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ደረጃ {currentStageIdx + 1} ከ 7
                      </span>
                    </div>

                    {/* Progress Bar (Desktop and Mobile) */}
                    <div className="relative">
                      {/* Desktop Horizontal Milestone Track */}
                      <div className="hidden lg:grid grid-cols-7 gap-2 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-5 left-6 right-6 h-1 bg-slate-800 z-0" />
                        <div
                          className="absolute top-5 left-6 h-1 bg-gradient-to-r from-emerald-500 to-amber-500 z-0 transition-all duration-700"
                          style={{
                            width: `${(currentStageIdx / (TRACKING_STAGES.length - 1)) * 96}%`,
                          }}
                        />

                        {TRACKING_STAGES.map((stage, sIdx) => {
                          const IconComp = stage.icon;
                          const isCompleted = sIdx < currentStageIdx;
                          const isCurrent = sIdx === currentStageIdx;
                          const isFuture = sIdx > currentStageIdx;

                          return (
                            <div
                              key={stage.key}
                              className="relative z-10 flex flex-col items-center text-center space-y-2"
                            >
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                  isCompleted
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                                    : isCurrent
                                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20 animate-pulse'
                                    : 'bg-slate-900 border border-slate-800 text-slate-600'
                                }`}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>

                              <div className="space-y-0.5">
                                <span
                                  className={`text-[11px] font-bold block leading-tight ${
                                    isCurrent
                                      ? 'text-amber-300'
                                      : isCompleted
                                      ? 'text-emerald-400'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {stage.titleAmharic}
                                </span>
                                <span className="text-[9px] text-slate-500 block">
                                  {stage.titleEnglish}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Mobile Vertical Milestone Track */}
                      <div className="lg:hidden space-y-4 relative pl-8 border-l-2 border-slate-800 ml-4">
                        {TRACKING_STAGES.map((stage, sIdx) => {
                          const IconComp = stage.icon;
                          const isCompleted = sIdx < currentStageIdx;
                          const isCurrent = sIdx === currentStageIdx;
                          const isFuture = sIdx > currentStageIdx;

                          return (
                            <div key={stage.key} className="relative space-y-1">
                              {/* Indicator dot */}
                              <div
                                className={`absolute -left-[41px] top-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                                  isCompleted
                                    ? 'bg-emerald-500 text-slate-950'
                                    : isCurrent
                                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 animate-pulse'
                                    : 'bg-slate-900 border border-slate-800 text-slate-600'
                                }`}
                              >
                                <IconComp className="w-3.5 h-3.5" />
                              </div>

                              <div className="flex items-baseline gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    isCurrent
                                      ? 'text-amber-300'
                                      : isCompleted
                                      ? 'text-emerald-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {stage.titleAmharic}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({stage.titleEnglish})
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">{stage.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current Stage Highlight Box */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          የአሁን ሁኔታ (Current Stage):
                        </span>
                        <div className="font-bold text-white text-sm">
                          {TRACKING_STAGES[currentStageIdx]?.titleAmharic}
                        </div>
                        <p className="text-slate-400 text-xs">
                          {TRACKING_STAGES[currentStageIdx]?.desc}
                        </p>
                      </div>

                      <a
                        href={`https://t.me/korchaetbot?start=track_${order.orderNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ስለ እቃው በቦቱ ጠይቅ (Ask in Bot)</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
