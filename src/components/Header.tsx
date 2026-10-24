// src/components/Header.tsx: Polished Telegram Mini App Header with In-App Worker Messages Tab
import React from 'react';
import { Home, Package, MessageCircle, Link as LinkIcon } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orderCount?: number;
  messageCount?: number;
  onOpenQuoteModal?: (mode?: 'link' | 'screenshot') => void;
  isTMA?: boolean;
  tmaUser?: { id: number; first_name?: string; username?: string };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  orderCount = 0,
  messageCount = 0,
  onOpenQuoteModal,
}) => {
  const handleSupportClick = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    setActiveTab('messages');
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

          {/* Direct Support & Worker Responses Button -> Opens In-App Messages Tab */}
          <button
            onClick={handleSupportClick}
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/70'
            }`}
            title="የሰራተኛ ምላሾች እና የቀጥታ ውይይት"
          >
            <MessageCircle className={`w-3.5 h-3.5 ${activeTab === 'messages' ? 'text-white' : 'text-emerald-600'}`} />
            <span>ሰራተኛ አውራ</span>
            {messageCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-stone-950 text-[10px] font-black rounded-full">
                {messageCount}
              </span>
            )}
          </button>
        </div>

        {/* Clean Navigation Bar - Bright highlight on መነሻ (Home) as primary landing page + In-App መልዕክት (Messages) */}
        <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 text-xs gap-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center space-x-1 py-1.5 px-2.5 rounded-lg font-semibold shadow-xs active:scale-95 transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-amber-600/90 text-white hover:bg-amber-600'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-white" />
            <span>መነሻ</span>
          </button>

          {/* Quick Action: ሊንክ ያስገቡ (Subtle tab styling) */}
          {onOpenQuoteModal && (
            <button
              onClick={() => onOpenQuoteModal('link')}
              className="flex items-center space-x-1 py-1.5 px-2.5 rounded-lg font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>ሊንክ ያስገቡ</span>
            </button>
          )}

          {/* In-App Worker Messages & Support Chat Tab */}
          <button
            onClick={() => setActiveTab('messages')}
            className={`relative flex items-center space-x-1 py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-300'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>መልዕክት</span>
            {messageCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                {messageCount}
              </span>
            )}
          </button>

          {/* Orders / Tracker Tab */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`relative flex items-center space-x-1 py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-300'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>ትዕዛዞቼ</span>
            {orderCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">
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
