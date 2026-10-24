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
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
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

          {/* Direct Support Button: በቦቱ ከሰራተኛ ጋር አውራ -> korcha_support */}
          <button
            onClick={handleSupportClick}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70 text-xs font-semibold shadow-xs transition-colors active:scale-95"
            title="ከሰራተኛ ጋር ይገናኙ"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>ሰራተኛ አውራ</span>
          </button>
        </div>

        {/* Clean Navigation Bar - Bright highlight on መነሻ (Home) as primary landing page */}
        <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-semibold shadow-xs active:scale-95 transition-all ${
              activeTab === 'home'
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-amber-600/90 text-white hover:bg-amber-600'
            }`}
          >
            <Home className="w-4 h-4 text-white" />
            <span>መነሻ (Home)</span>
          </button>

          {/* Quick Action: ሊንክ ያስገቡ (Subtle tab styling instead of bright background) */}
          {onOpenQuoteModal && (
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="flex items-center space-x-1.5 py-1.5 px-3 rounded-lg font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:scale-95 transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>ሊንክ ወይም ስክሪንሾት ያስገቡ</span>
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
        </div>
      </div>
    </header>
  );
};

export default Header;
