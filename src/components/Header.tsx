<<<<<<< HEAD
// src/components/Header.tsx: Polished, Cleaned Telegram Mini App Header
import React from 'react';
import { Home, Package, MessageCircle, Link as LinkIcon, Camera } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orderCount?: number;
  onOpenQuoteModal?: (mode?: 'link' | 'screenshot') => void;
  isTMA?: boolean;
  tmaUser?: { id: number; first_name?: string; username?: string };
=======
import React from 'react';
import {
  Home,
  Search,
  Calculator,
  Package,
  Send,
  Camera,
} from 'lucide-react';
import { KorchaSaddleIcon } from './KorchaSaddleIcon';

interface HeaderProps {
  activeTab: 'home' | 'search' | 'calculator' | 'orders';
  setActiveTab: (tab: 'home' | 'search' | 'calculator' | 'orders') => void;
  orderCount?: number;
  isTMA?: boolean;
  tmaUser?: { id: number; first_name?: string; username?: string } | null;
  onOpenScreenshotModal?: () => void;
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
<<<<<<< HEAD
  orderCount = 0,
  onOpenQuoteModal,
  tmaUser,
}) => {
  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';
  const supportUrl = `https://t.me/${workerUsername}`;

  const handleSupportClick = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback?.impactOccurred('medium');
      window.Telegram.WebApp.openTelegramLink(supportUrl);
    } else {
      window.open(supportUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-sm transition-all">
      <div className="max-w-md mx-auto px-4 py-2.5">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 font-bold text-lg">
              ኮ
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-stone-900 tracking-tight text-base">KORCHA</span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                  Ethiopia
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">የውጭ ገበያ እቃ አቅራቢ</p>
            </div>
          </div>

          {/* Direct Support Button: በቦቱ ከአስተናጋጅ ጋር አውራ -> korcha_support */}
          <button
            onClick={handleSupportClick}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70 text-xs font-semibold shadow-xs transition-colors active:scale-95"
            title="ከአስተናጋጅ ጋር ይገናኙ"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>አስተናጋጅ አውራ</span>
          </button>
        </div>

        {/* Clean Navigation Bar - Strictly Removed 'ዋጋ ማስያ & QR' and 'ቴሌግራም' */}
        <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-medium transition-all ${
              activeTab === 'home'
                ? 'bg-amber-50 text-amber-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Home className="w-4 h-4 text-amber-600" />
            <span>መነሻ (Home)</span>
          </button>

          {/* Quick Action: ሊንክ / ፎቶ አስገባ */}
          {onOpenQuoteModal && (
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="flex items-center space-x-1.5 py-1.5 px-3 rounded-lg bg-amber-600 text-white font-semibold shadow-xs hover:bg-amber-700 active:scale-95 transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ሊንክ ያስገቡ</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('orders')}
            className={`relative flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-medium transition-all ${
              activeTab === 'orders'
                ? 'bg-amber-50 text-amber-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Package className="w-4 h-4 text-amber-600" />
            <span>ትዕዛዞቼ</span>
            {orderCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                {orderCount}
              </span>
            )}
          </button>
=======
  orderCount,
  isTMA,
  tmaUser,
  onOpenScreenshotModal,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-700 to-amber-900 border border-amber-500/40 flex items-center justify-center shadow-lg">
              <KorchaSaddleIcon className="w-7 h-7 text-amber-300 drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Korcha <span className="text-amber-400 font-bold text-sm">(ኮርቻ)</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isTMA ? 'Mini App' : 'E-Commerce'}
                </span>
                {isTMA && tmaUser && (
                  <span className="hidden sm:inline-block text-[10px] text-sky-400 font-mono">
                    👤 {tmaUser.username ? `@${tmaUser.username}` : tmaUser.first_name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                ከዓለም አቀፍ ገበያዎች እቃዎች ወደ ኢትዮጵያ በታማኝነት • Global Market Shopping
              </p>
            </div>
          </div>

          {/* Simplistic Navigation Tabs with Home, Search, Calculator and My Orders view */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'home'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>ሱቅ (Home)</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap relative ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>የእኔ ትዕዛዞች (My Orders)</span>
              {typeof orderCount === 'number' && orderCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                  activeTab === 'orders'
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {orderCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'search'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>ሱቆች መፈለጊያ</span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>ዋጋ ማስያ & QR</span>
            </button>

            {onOpenScreenshotModal && (
              <button
                type="button"
                onClick={onOpenScreenshotModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/25 transition-all cursor-pointer whitespace-nowrap"
                title="የእቃውን ስክሪንሾት በማስገባት ዋጋ ይጠይቁ"
              >
                <Camera className="w-4 h-4" />
                <span>📸 ስክሪንሾት አስገባ</span>
              </button>
            )}

            {/* Direct Telegram App Link */}
            <a
              href="https://t.me/korchaetbot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 transition-all"
              title="ክፈት በቴሌግራም መተግበሪያ (Open directly in Telegram)"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">ቴሌግራም ቦት ክፈት</span>
              <span className="sm:hidden">ቴሌግራም</span>
            </a>

            <a
              href="https://t.me/korchaetbot?start=support"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all"
              title="በቦቱ ከአስተናጋጅ ጋር ይነጋገሩ (Live In-Bot Support)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>💬 በቦቱ ከአስተናጋጅ ጋር አውራ</span>
            </a>
          </nav>
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
        </div>
      </div>
    </header>
  );
};
<<<<<<< HEAD

export default Header;
=======
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
