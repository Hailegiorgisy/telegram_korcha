// src/components/StorefrontHome.tsx: Customer Storefront with High-Visibility Order CTAs
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ExternalLink, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Truck, 
  Search, 
  Filter, 
  CreditCard,
  MessageCircle,
  Link as LinkIcon,
  Camera,
  ChevronRight,
  X
} from 'lucide-react';

interface Product {
  id: number;
  category_id: string;
  name: string;
  size?: string;
  price_etb: number;
  photo_url?: string;
  is_bestseller?: boolean;
}

interface Category {
  id: string;
  nameAm: string;
  nameEn: string;
  icon: string;
  color: string;
}

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode: 'link' | 'screenshot') => void;
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  onShelfOrderCreated?: (orderCode: string, phone: string, openMessages?: boolean) => void;
}

export const StorefrontHome: React.FC<StorefrontHomeProps> = ({
  onOpenQuoteModal,
  selectedCategory,
  onSelectCategory,
  onShelfOrderCreated,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', nameAm: 'ሁሉም', nameEn: 'All', icon: '✨', color: 'from-amber-500 to-amber-600' },
    { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Clothing", icon: '👗', color: 'from-pink-500 to-rose-600' },
    { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸', color: 'from-amber-400 to-orange-500' },
    { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄', color: 'from-fuchsia-500 to-purple-600' },
    { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱', color: 'from-blue-500 to-indigo-600' },
    { id: 'home', nameAm: 'የቤት ውስጥ', nameEn: 'Home & Kitchen', icon: '🍳', color: 'from-stone-600 to-stone-800' },
    { id: 'miscellaneous', nameAm: 'ሌሎች', nameEn: 'Other', icon: '✨', color: 'from-emerald-500 to-teal-700' },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Shelf Checkout Modal State
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<Product | null>(null);
  const [checkoutPhone, setCheckoutPhone] = useState<string>(() => {
    try { return localStorage.getItem('korcha_customer_phone') || ''; } catch { return ''; }
  });
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'telebirr' | 'cbe_birr'>('telebirr');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);

  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) || 'korcha_support').replace(/^@/, '');
  const tgUser = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;

  useEffect(() => {
    fetchShelfData();
  }, [selectedCategory]);

  const fetchShelfData = async () => {
    setIsLoading(true);
    try {
      const url = selectedCategory && selectedCategory !== 'all' 
        ? `/api/shelf?category=${encodeURIComponent(selectedCategory)}` 
        : '/api/shelf';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (data.products) setProducts(data.products);
        if (data.categories && data.categories.length > 0) {
          setCategories([
            { id: 'all', nameAm: 'ሁሉም', nameEn: 'All', icon: '✨', color: 'from-amber-500 to-amber-600' },
            ...data.categories
          ]);
        }
      }
    } catch (e) {
      console.warn('[Fetch Shelf Error]', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Direct Shelf Order
  const handleDirectShelfOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForOrder) return;
    if (!checkoutPhone.trim()) {
      alert('እባክዎ ስልክ ቁጥርዎን ያስገቡ (Please enter phone number)');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch('/api/shelf/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductForOrder.id,
          productName: selectedProductForOrder.name,
          size: selectedProductForOrder.size || 'Standard',
          priceEtb: selectedProductForOrder.price_etb,
          photoUrl: selectedProductForOrder.photo_url || '',
          paymentMethod: checkoutPaymentMethod,
          phone: checkoutPhone.trim(),
          telegramUsername: tgUser?.username || '',
          telegramId: tgUser?.id || null,
          firstName: tgUser?.first_name || '',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        localStorage.setItem('korcha_customer_phone', checkoutPhone.trim());
        setConfirmedOrder(data);
        if (onShelfOrderCreated) {
          onShelfOrderCreated(data.orderCode, checkoutPhone.trim(), false);
        }
      } else {
        alert(data.error || 'ትዕዛዝ መመዝገብ አልተቻለም');
      }
    } catch (err: any) {
      alert('ስህተት: ' + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-3 pb-16 animate-fade-in max-w-md mx-auto px-1">
      {/* 1. HERO BANNER: TWO BIG PRIMARY ORDER ACTIONS */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-4 shadow-lg border border-amber-900/30">
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>የውጭ ገበያ እቃ አቅራቢ</span>
            </span>
            <span className="text-[9px] font-bold text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-600/40">
              40% ቅድመ ክፍያ • በብር
            </span>
          </div>

          <div className="flex items-start justify-between gap-2.5">
            <div className="space-y-1">
              <h2 className="text-sm font-extrabold leading-snug text-white">
                የፈለጉትን እቃ ይምረጡ፣ በርዎ ድረስ እናደርሳለን!
              </h2>
              <p className="text-[11px] text-stone-300 leading-tight">
                ከ Shein, Amazon ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ፎቶ አስገብተው አሁኑኑ እዘዙ።
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-400 p-0.5 border border-amber-500/40 shadow-md shadow-amber-500/20 shrink-0 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Korcha" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* HIGH-VISIBILITY PROMINENT ORDER BUTTONS */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <LinkIcon className="w-4 h-4 text-stone-950" />
              <span>🔗 በሊንክ እዘዝ (Order)</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center space-x-1.5 border border-white/20 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>📸 በፎቶ እዘዝ (Order)</span>
            </button>
          </div>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. GLOBAL MARKETPLACES SECTION */}
      <div className="bg-white rounded-2xl p-3 border border-stone-200/80 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs">🌍</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              ዓለም አቀፍ ገበያዎች (Global Marketplaces)
            </h3>
          </div>
          <span className="text-[10px] text-amber-700 font-semibold">ሊንክ ኮፒ አድርገው እዘዙ</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { name: 'Shein', url: 'https://www.shein.com', gradient: 'from-rose-500 to-pink-600', label: 'ልብሶችና ፋሽን' },
            { name: 'Amazon', url: 'https://www.amazon.com', gradient: 'from-amber-500 to-orange-600', label: 'ሁሉም ዓይነት' },
            { name: 'AliExpress', url: 'https://www.aliexpress.com', gradient: 'from-red-500 to-amber-600', label: 'ኤሌክትሮኒክስ' },
          ].map((m) => (
            <div key={m.name} className="p-2 rounded-xl bg-stone-50 border border-stone-200/90 flex flex-col justify-between space-y-1 text-center">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="block group">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${m.gradient} text-white font-black text-xs flex items-center justify-center mx-auto mb-1 shadow-2xs group-hover:scale-105 transition-transform`}>
                  {m.name[0]}
                </div>
                <p className="font-extrabold text-[11px] text-stone-900 leading-none">{m.name}</p>
                <p className="text-[9px] text-stone-500 mt-0.5">{m.label}</p>
              </a>
              <button
                onClick={() => onOpenQuoteModal('link')}
                className="w-full mt-1 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center space-x-0.5 transition-all"
              >
                <span>እዘዝ</span>
                <ChevronRight className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SHELF CATEGORIES CHIPS */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-stone-800 flex items-center space-x-1">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>በአዲስ አበባ ዝግጁ የሆኑ እቃዎች (1-2 ቀን ማድረሻ)</span>
          </h3>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            አሁን ዝግጁ
          </span>
        </div>

        {/* Compact Horizontal Scroll or Grid for Categories */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.nameAm}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. SHELF PRODUCTS GRID WITH HIGH-VISIBILITY "እዘዝ / ግዛ" BUTTON ON EVERY CARD */}
      {isLoading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-stone-500">እቃዎች እየተጫኑ ነው...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-2xl border border-stone-200 space-y-2">
          <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto" />
          <p className="text-xs font-bold text-stone-700">በዚህ ምድብ ዝግጁ እቃ አልተገኘም</p>
          <p className="text-[11px] text-stone-500">
            ከ Shein ወይም Amazon የፈለጉትን እቃ ሊንክ በማስገባት ማዘዝ ይችላሉ!
          </p>
          <button
            onClick={() => onOpenQuoteModal('link')}
            className="py-2 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
          >
            በሊንክ እዘዝ (Custom Order)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow"
            >
              {/* Product Photo */}
              <div className="relative aspect-square bg-stone-100 overflow-hidden">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
                {p.is_bestseller && (
                  <span className="absolute top-1.5 left-1.5 bg-amber-500 text-stone-950 font-black text-[9px] px-2 py-0.5 rounded-md shadow-xs">
                    ተወዳጅ
                  </span>
                )}
                <span className="absolute bottom-1.5 right-1.5 bg-stone-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                  1-2 ቀን
                </span>
              </div>

              {/* Product Info & Prominent Order CTA */}
              <div className="p-2.5 space-y-1.5 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="font-extrabold text-xs text-stone-900 line-clamp-2 leading-snug">
                    {p.name}
                  </h4>
                  {p.size && (
                    <p className="text-[10px] text-stone-500">መጠን: <b>{p.size}</b></p>
                  )}
                </div>

                <div className="space-y-1.5 pt-1 border-t border-stone-100">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-black text-amber-700">
                      {Number(p.price_etb).toLocaleString()} ETB
                    </span>
                    <span className="text-[9px] text-stone-400">
                      40%: {Math.round(p.price_etb * 0.4).toLocaleString()}
                    </span>
                  </div>

                  {/* HIGH-VISIBILITY "እዘዝ / ግዛ" BUTTON */}
                  <button
                    onClick={() => {
                      setSelectedProductForOrder(p);
                      setConfirmedOrder(null);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-stone-950" />
                    <span>እዘዝ (Order Now)</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. MODAL: DIRECT SHELF CHECKOUT MODAL */}
      {selectedProductForOrder && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-stone-900">
                    {confirmedOrder ? 'ትዕዛዝዎ ተረጋግጧል!' : 'የቀጥታ መደርደሪያ እቃ ማዘዣ'}
                  </h3>
                  <p className="text-[10px] text-stone-500">በ1-2 ቀን ውስጥ አዲስ አበባ ድረስ ይደርሳል</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForOrder(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmedOrder ? (
              /* ORDER CONFIRMED SCREEN */
              <div className="space-y-3 text-center py-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-black text-sm text-stone-900">
                  ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!
                </h4>
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-left text-xs space-y-1">
                  <p>🏷️ የትዕዛዝ ኮድ: <b className="font-mono text-amber-700">{confirmedOrder.orderCode}</b></p>
                  <p>📦 እቃ: <b>{selectedProductForOrder.name}</b></p>
                  <p>💰 ጠቅላላ ዋጋ: <b>{Number(selectedProductForOrder.price_etb).toLocaleString()} ETB</b></p>
                  <p>💳 40% ቅድመ ክፍያ: <b className="text-emerald-700">{Math.round(selectedProductForOrder.price_etb * 0.4).toLocaleString()} ETB</b></p>
                  <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200">
                    የ40% ቅድመ ክፍያውን በቴሌብር ወይም በንግድ ባንክ ያስገቡ። ሰራተኛችን ወዲያውኑ ያረጋግጥልዎታል።
                  </p>
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedProductForOrder(null);
                      if (onShelfOrderCreated) {
                        onShelfOrderCreated(confirmedOrder.orderCode, checkoutPhone, true);
                      }
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
                  >
                    መልዕክቶችን ተከታተል
                  </button>
                </div>
              </div>
            ) : (
              /* CHECKOUT FORM */
              <form onSubmit={handleDirectShelfOrder} className="space-y-3">
                {/* Product Summary */}
                <div className="flex items-center space-x-3 p-2.5 rounded-2xl bg-stone-50 border border-stone-200">
                  {selectedProductForOrder.photo_url && (
                    <img
                      src={selectedProductForOrder.photo_url}
                      alt={selectedProductForOrder.name}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                    />
                  )}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-stone-900 truncate">
                      {selectedProductForOrder.name}
                    </h4>
                    {selectedProductForOrder.size && (
                      <p className="text-[10px] text-stone-500">መጠን: <b>{selectedProductForOrder.size}</b></p>
                    )}
                    <p className="text-xs font-black text-amber-700">
                      ጠቅላላ፡ {Number(selectedProductForOrder.price_etb).toLocaleString()} ETB
                    </p>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-stone-700">
                    <span>አሁን የሚከፈል (40% ቅድመ ክፍያ)፡</span>
                    <b className="text-amber-900 font-bold">{Math.round(selectedProductForOrder.price_etb * 0.4).toLocaleString()} ETB</b>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>ሲረከቡ የሚከፈል (60% በ1-2 ቀን)፡</span>
                    <span>{Math.round(selectedProductForOrder.price_etb * 0.6).toLocaleString()} ETB</span>
                  </div>
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-800 mb-1">
                    ስልክ ቁጥርዎን ያስገቡ (Phone Number) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={checkoutPhone}
                    onChange={(e) => setCheckoutPhone(e.target.value)}
                    placeholder="09**** / 07****"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-hidden bg-stone-50/50"
                  />
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-800 mb-1">
                    የቅድመ ክፍያ ዘዴ ይምረጡ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutPaymentMethod('telebirr')}
                      className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        checkoutPaymentMethod === 'telebirr'
                          ? 'border-amber-500 bg-amber-50/80 ring-1 ring-amber-500'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                        T
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-stone-900">ቴሌብር</p>
                        <p className="text-[9px] text-stone-500">Telebirr</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCheckoutPaymentMethod('cbe_birr')}
                      className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                        checkoutPaymentMethod === 'cbe_birr'
                          ? 'border-purple-500 bg-purple-50/80 ring-1 ring-purple-500'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">
                        C
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-stone-900">ንግድ ባንክ</p>
                        <p className="text-[9px] text-stone-500">CBE / CBE Birr</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Submit Order Button */}
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4 text-stone-950" />
                  <span>{isSubmittingOrder ? 'እየተመዘገበ ነው...' : 'አሁን እዘዝ (Confirm Order)'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontHome;
