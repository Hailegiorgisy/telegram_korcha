// src/components/StorefrontHome.tsx: Customer Storefront with Marketing Pictures, CBE Birr & Telebirr Promotion, and App Links
import React from 'react';
import { 
  Link as LinkIcon, 
  Camera, 
  MessageCircle, 
  CreditCard, 
  Truck, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink, 
  Download,
  Zap,
  Check,
  Percent
} from 'lucide-react';
import { CATEGORIES } from '../data/categories';

interface StorefrontHomeProps {
  onOpenQuoteModal: (mode?: 'link' | 'screenshot', preferredPayment?: 'telebirr' | 'cbe_birr') => void;
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
    {
      name: 'Shein',
      webUrl: 'https://www.shein.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.zzkko',
      appStoreUrl: 'https://apps.apple.com/app/shein-online-fashion/id878577184',
      color: 'from-black to-stone-800',
      desc: 'አልባሳትና ፋሽን',
    },
    {
      name: 'Temu',
      webUrl: 'https://www.temu.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.einnovation.temu',
      appStoreUrl: 'https://apps.apple.com/app/temu-shop-like-a-billionaire/id1641486558',
      color: 'from-orange-600 to-amber-600',
      desc: 'የቤትና የተለያዩ እቃዎች',
    },
    {
      name: 'AliExpress',
      webUrl: 'https://www.aliexpress.com',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.alibaba.aliexpresshd',
      appStoreUrl: 'https://apps.apple.com/app/aliexpress-shopping-app/id436672029',
      color: 'from-red-600 to-rose-600',
      desc: 'ኤሌክትሮኒክስና መለዋወጫ',
    },
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

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
              <span>ሊንክ ያስገቡ</span>
            </button>

            <button
              onClick={() => onOpenQuoteModal('screenshot')}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-white/15 active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>ስክሪንሾት ላክ</span>
            </button>
          </div>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* MARKETING PROMOTION: Telebirr & CBE Birr Payment Options */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              ETB
            </span>
            <div>
              <h3 className="font-extrabold text-xs text-stone-900 leading-tight">
                በ Telebirr ወይም CBE Birr ይክፈሉ!
              </h3>
              <p className="text-[10px] text-amber-800 font-semibold">
                የውጭ ምንዛሪ ወይም ቪዛ ካርድ አያስፈልግዎትም • 100% በብር
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
            0% Forex Fee
          </span>
        </div>

        {/* Dual Marketing Payment Cards */}
        <div className="grid grid-cols-2 gap-2">
          {/* Telebirr Card */}
          <button
            onClick={() => onOpenQuoteModal('link', 'telebirr')}
            className="p-3 rounded-2xl bg-white hover:bg-amber-50/50 border border-amber-200/80 shadow-2xs text-left transition-all group active:scale-98 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[10px]">
                ቴሌብር
              </span>
              <Zap className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="font-bold text-xs text-stone-900">Telebirr Instant</p>
            <p className="text-[10px] text-stone-500 mt-0.5">ቅጽበታዊ ማረጋገጫ • 40% ቅድመ ክፍያ</p>
            <div className="mt-2 text-[10px] font-bold text-amber-700 flex items-center space-x-1">
              <span>በቴሌብር እዘዝ</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>

          {/* CBE Birr Card */}
          <button
            onClick={() => onOpenQuoteModal('link', 'cbe_birr')}
            className="p-3 rounded-2xl bg-white hover:bg-purple-50/50 border border-purple-200/80 shadow-2xs text-left transition-all group active:scale-98 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-black text-[10px]">
                CBE Birr
              </span>
              <CreditCard className="w-3.5 h-3.5 text-purple-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="font-bold text-xs text-stone-900">CBE Birr / CBE</p>
            <p className="text-[10px] text-stone-500 mt-0.5">በኢትዮጵያ ንግድ ባንክ • ደህንነቱ የተጠበቀ</p>
            <div className="mt-2 text-[10px] font-bold text-purple-700 flex items-center space-x-1">
              <span>በ CBE እዘዝ</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>
        </div>

        {/* Marketing Feature Bullets */}
        <div className="grid grid-cols-3 gap-1 pt-1 text-center border-t border-amber-200/50">
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>40% ቅድመ ክፍያ</span>
          </div>
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>60% ሲረከቡ (COD)</span>
          </div>
          <div className="text-[9px] text-stone-600 font-semibold flex items-center justify-center space-x-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>ቀጥታ ደረሰኝ</span>
          </div>
        </div>
      </div>

      {/* Global Marketplace Browsing Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            ዓለም አቀፍ ገበያዎች (Global Sites & Apps)
          </h3>
          <span className="text-[11px] text-amber-700 font-semibold">ሊንኩን ኮፒ አድርገው ይዘዙ</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {marketplaces.map((m) => (
            <div
              key={m.name}
              className="p-3 rounded-2xl bg-white border border-stone-200/80 shadow-2xs flex flex-col justify-between space-y-2 text-center"
            >
              <a
                href={m.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${m.color} text-white font-extrabold text-sm flex items-center justify-center mx-auto mb-1.5 shadow-xs group-hover:scale-105 transition-transform`}>
                  {m.name[0]}
                </div>
                <p className="font-bold text-xs text-stone-900 group-hover:text-amber-700 flex items-center justify-center space-x-1">
                  <span>{m.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-stone-400" />
                </p>
                <p className="text-[10px] text-stone-400 line-clamp-1">{m.desc}</p>
              </a>

              {/* Play Store & App Store Buttons */}
              <div className="pt-1.5 border-t border-stone-100 flex items-center justify-center space-x-1 text-[9px]">
                <a
                  href={m.playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200/60 transition-colors"
                  title="Google Play Store App"
                >
                  Play Store
                </a>
                <a
                  href={m.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold border border-sky-200/60 transition-colors"
                  title="Apple App Store App"
                >
                  App Store
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Navigation with Marketing Pictures */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            የእቃዎች ምድብ (Categories)
          </h3>
          <span className="text-[11px] text-stone-400">ምስሉን ነክተው ይዘዙ</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                onOpenQuoteModal('link');
              }}
              className="relative overflow-hidden rounded-2xl h-24 border border-stone-200/80 shadow-xs hover:shadow-md transition-all active:scale-98 text-left group cursor-pointer"
            >
              {/* Background Marketing Image */}
              <img
                src={cat.image}
                alt={cat.nameEn}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Dark Gradient Overlay for Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-900/40 to-transparent" />

              {/* Text Badge Content */}
              <div className="relative z-10 h-full p-2.5 flex flex-col justify-end text-white">
                <span className="text-base mb-0.5">{cat.icon}</span>
                <p className="font-extrabold text-xs leading-tight drop-shadow-xs">{cat.nameAm}</p>
                <p className="text-[10px] text-stone-300 font-medium drop-shadow-xs">{cat.nameEn}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trust & Service Highlights */}
      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 space-y-1">
          <CreditCard className="w-4 h-4 text-amber-600 mx-auto" />
          <p className="font-bold text-[11px] text-stone-900">በቴሌብር / CBE</p>
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
