// src/components/StorefrontHome.tsx: Customer Storefront with 6 Shelf Categories, Buy Flow & Empty State
import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon,
  Camera,
  MessageCircle,
  ShieldCheck,
  Truck,
  CreditCard,
  Sparkles,
  ShoppingBag,
  PackageOpen,
  Send,
} from 'lucide-react';
import { CATEGORIES } from '../data/categories';

interface ShelfProduct {
  id: string;
  titleAm: string;
  titleEn: string;
  category: string;
  priceEtb: number;
  size?: string;
  description: string;
  image: string;
  stockQuantity: number;
  inStock: boolean;
  badge?: string;
  deliveryTime?: string;
}

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
  const [shelfItems, setShelfItems] = useState<ShelfProduct[]>([]);
  const [isLoadingShelf, setIsLoadingShelf] = useState<boolean>(true);

  const workerUsername =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) ||
    'korcha_support';
  const cleanWorker = workerUsername.replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanWorker}`;

  const marketplaces = [
    { name: 'Shein', url: 'https://www.shein.com', color: 'from-black to-stone-800', desc: 'አልባሳትና ፋሽን' },
    { name: 'Temu', url: 'https://www.temu.com', color: 'from-orange-600 to-amber-600', desc: 'የቤትና የተለያዩ እቃዎች' },
    { name: 'AliExpress', url: 'https://www.aliexpress.com', color: 'from-red-600 to-rose-600', desc: 'ኤሌክትሮኒክስና መለዋወጫ' },
  ];

  // Fetch live on-hand inventory from backend
  useEffect(() => {
    let isMounted = true;
    async function fetchShelf() {
      try {
        const res = await fetch('/api/shelf');
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.rawItems)) {
          setShelfItems(data.rawItems);
        }
      } catch (err) {
        console.warn('[Shelf Fetch Warning]', err);
      } finally {
        if (isMounted) setIsLoadingShelf(false);
      }
    }
    fetchShelf();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter items based on active category
  const filteredProducts = shelfItems.filter((item) => {
    if (!selectedCategory || selectedCategory === 'all') return true;
    return item.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  // Helper: Open Telegram chat with pre-filled Buy message to worker
  const handleBuyProduct = (product: ShelfProduct) => {
    const itemName = product.titleAm || product.titleEn;
    const price = product.priceEtb?.toLocaleString();
    const sizeInfo = product.size ? ` (መጠን: ${product.size})` : '';
    const message = `ሰላም! ይህንን በእጅ ላይ ያለ እቃ መግዛት እፈልጋለሁ፡ ${itemName}${sizeInfo} - ${price} ETB (ኮድ: ${product.id})`;
    const buyUrl = `https://t.me/${cleanWorker}?text=${encodeURIComponent(message)}`;
    window.open(buyUrl, '_blank');
  };

  return (
    <div className="space-y-4 pb-12 animate-fade-in max-w-md mx-auto">
      {/* Hero Banner with Direct Assisted Quote Actions */}
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
            ከ Shein, Temu ወይም AliExpress የመረጡትን እቃ ሊንክ ወይም ስክሪንሾት ያስገቡ። የኮርቻ ሰራተኞች ወጪውን አስልተው ያቀርቡልዎታል።
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <LinkIcon className="w-4 h-4" />
              <span>ሊንክ ያስገቡ</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-white/15 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>ስክሪንሾት ላክ</span>
            </button>
          </div>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Global Marketplace Browsing Cards */}
      <div className="space-y-2">
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
              className="group p-2.5 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-400 hover:shadow-md transition-all text-center block"
            >
              <div
                className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${m.color} text-white font-extrabold text-xs flex items-center justify-center mx-auto mb-1 shadow-xs group-hover:scale-105 transition-transform`}
              >
                {m.name[0]}
              </div>
              <p className="font-bold text-xs text-stone-900 group-hover:text-amber-700">{m.name}</p>
              <p className="text-[10px] text-stone-400 line-clamp-1">{m.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* 6 Category Filter Grid with Smaller/Compact Features */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            የእቃዎች ምድብ (6 Categories)
          </h3>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => onSelectCategory('all')}
              className="text-[11px] text-amber-600 font-semibold hover:underline"
            >
              ሁሉንም አሳይ
            </button>
          )}
        </div>

        {/* 6 Compact Category Cards */}
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(isSelected ? 'all' : cat.id)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center space-y-0.5 transition-all active:scale-95 text-center shadow-2xs ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold scale-[1.02]'
                    : 'bg-white border-stone-200/70 hover:border-amber-400 hover:bg-amber-50/50 text-stone-800'
                }`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[11px] font-semibold line-clamp-1">{cat.nameAm}</span>
                <span className={`text-[8.5px] line-clamp-1 ${isSelected ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>
                  {cat.nameEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* On-Hand Available Products Section */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5">
            <ShoppingBag className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
              በእጅ ላይ ያሉ እቃዎች {activeCategoryObj && selectedCategory !== 'all' ? `(${activeCategoryObj.nameAm})` : ''}
            </h3>
          </div>
          <span className="text-[10px] text-stone-400">
            {filteredProducts.length > 0 ? `${filteredProducts.length} እቃዎች አሉ` : '0 እቃ'}
          </span>
        </div>

        {/* Dynamic Display: In-Stock Product Grid or Customer-Specified Empty State */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col"
              >
                <div className="relative aspect-square bg-stone-100 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.titleAm}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[9px] font-bold shadow-xs">
                    {product.badge || 'በእጅ ላይ ያለ'}
                  </div>
                  {product.size && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-stone-900/80 text-white text-[8.5px] font-medium backdrop-blur-xs">
                      ሳይዝ: {product.size}
                    </div>
                  )}
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-bold text-xs text-stone-900 line-clamp-2 leading-tight">
                      {product.titleAm || product.titleEn}
                    </h4>
                    <p className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">
                      {product.description || product.category}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <p className="text-[8.5px] text-stone-400 font-medium">ዋጋ</p>
                      <p className="text-xs font-extrabold text-amber-600">
                        {product.priceEtb.toLocaleString()} ETB
                      </p>
                    </div>

                    {/* Step 1 Customer Buy Button -> Direct Worker Contact */}
                    <button
                      onClick={() => handleBuyProduct(product)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10px] font-extrabold flex items-center space-x-1 shadow-xs active:scale-95 transition-all"
                    >
                      <Send className="w-3 h-3" />
                      <span>ይግዙ</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Step 1 Exact Empty State Notice */
          <div className="p-5 rounded-3xl bg-white border border-dashed border-stone-300 text-center space-y-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-stone-900 leading-snug">
                በዚህ ዝርዝር ውስጥ የሚሸጥ ዕቃ ጨርሰናል። <br />
                <span className="text-amber-700">እባክዎ በቴሌግራም ቦት ወይንም በሚኒ አፕ ይዘዙን።</span>
              </h4>
              <p className="text-[10px] text-stone-400 leading-relaxed max-w-xs mx-auto">
                ከ Shein, Temu, Amazon ወይም AliExpress ላይ የሚፈልጉትን እቃ ሊንክ ወይም ስክሪንሾት በመላክ በደጃፍዎ ማስመጣት ይችላሉ!
              </p>
            </div>
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs inline-flex items-center space-x-1.5 shadow-xs active:scale-95 transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>እቃ ከውጭ አስመጣ (Order via Link)</span>
            </button>
          </div>
        )}
      </div>

      {/* Trust & Service Highlights */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-0.5">
          <CreditCard className="w-4 h-4 text-amber-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">በቴሌብር ይክፈሉ</p>
          <p className="text-[9.5px] text-stone-500">40% ቅድመ ክፍያ ብቻ</p>
        </div>

        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-0.5">
          <Truck className="w-4 h-4 text-emerald-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">በርዎ ድረስ</p>
          <p className="text-[9.5px] text-stone-500">ቀሪውን ሲረከቡ ይክፈሉ</p>
        </div>

        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-0.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">የታመነ አገልግሎት</p>
          <p className="text-[9.5px] text-stone-500">ቀጥታ ድጋፍ በቦት</p>
        </div>
      </div>

      {/* Direct Contact Card with korcha_support */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3.5 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="font-bold text-xs text-emerald-950 flex items-center space-x-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>በቦቱ ከአስተናጋጅ ጋር አውራ</span>
          </p>
          <p className="text-[10px] text-emerald-800">
            የእቃ ጥያቄዎችንና መረጃዎችን በቴሌግራም ያግኙ (@{cleanWorker})
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
