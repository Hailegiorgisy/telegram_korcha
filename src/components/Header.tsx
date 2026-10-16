import React from 'react';
import {
  Home,
  Search,
  Calculator,
  Package,
  Send,
} from 'lucide-react';
import { KorchaSaddleIcon } from './KorchaSaddleIcon';

interface HeaderProps {
  activeTab: 'home' | 'search' | 'calculator' | 'orders';
  setActiveTab: (tab: 'home' | 'search' | 'calculator' | 'orders') => void;
  orderCount?: number;
  isTMA?: boolean;
  tmaUser?: { id: number; first_name?: string; username?: string } | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  orderCount,
  isTMA,
  tmaUser,
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
                ከቻይና እቃዎች ወደ ኢትዮጵያ በታማኝነት • China to Ethiopia Shopping
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
        </div>
      </div>
    </header>
  );
};
