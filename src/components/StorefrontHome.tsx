// src/components/StorefrontHome.tsx: Customer Storefront without Price Estimator or Worker Portal
import React from 'react';
import { Link as LinkIcon, Camera, MessageCircle, CreditCard, Truck, ShieldCheck, Sparkles } from 'lucide-react';
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
      {/* Hero Banner */}
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

          {/* Primary Action Button: "ሊንክ ያስገቡ" */}
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

      {/* Category Navigation */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 px-1">
          የእቃዎች ምድብ (Categories)
        </h3>

        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
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

      {/* Direct Contact Card with korcha_support */}
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