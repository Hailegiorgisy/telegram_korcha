// src/components/Header.tsx: Telegram Mini App Header with Role-Based Navigation
import React from 'react';
import { Home, Package, MessageCircle, Link as LinkIcon, Shield, FileText, CheckCircle2, ShoppingBag } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orderCount?: number;
  messageCount?: number;
  pendingQuotesCount?: number;
  merchantPendingCount?: number;
  onOpenQuoteModal?: (mode?: 'link' | 'screenshot') => void;
  isTMA?: boolean;
  tmaUser?: { id: number; first_name?: string; username?: string };
  isWorker?: boolean;
  onToggleWorker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  orderCount = 0,
  messageCount = 0,
  pendingQuotesCount = 0,
  merchantPendingCount = 0,
  onOpenQuoteModal,
  tmaUser,
  isWorker = false,
  onToggleWorker,
}) => {
  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) || 'korcha_support').replace(/^@/, '').toLowerCase();

  const handleSupportClick = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    setActiveTab('messages');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs transition-all">
      <div className="max-w-md mx-auto px-4 py-2">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              onClick={onToggleWorker}
              title={isWorker ? "የሰራተኛ ሞድ (Worker Mode Active - Click to switch)" : "KORCHA Ethiopia (Click to switch mode)"}
              className="w-9 h-9 rounded-xl bg-amber-400 p-0.5 border border-amber-500/40 shadow-xs shadow-amber-500/20 flex items-center justify-center cursor-pointer active:scale-95 transition-transform overflow-hidden relative"
            >
              <img 
                src="/logo.png" 
                alt="Korcha Logo" 
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              <span className="hidden w-full h-full bg-gradient-to-tr from-amber-600 to-amber-500 items-center justify-center text-white font-bold text-base rounded-lg">
                ኮ
              </span>
            </button>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-stone-900 tracking-tight text-sm">KORCHA</span>
                {isWorker ? (
                  <span className="text-[9px] uppercase font-black tracking-wider bg-amber-500 text-stone-950 px-1.5 py-0.2 rounded-md">
                    WORKER HUB
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                    Ethiopia
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 font-medium leading-none">
                {isWorker ? 'የሰራተኛ መቆጣጠሪያ ማዕከል' : 'የውጭ ገበያ እቃ አቅራቢ'}
              </p>
            </div>
          </div>

          {/* Top-Right Badge */}
          {isWorker ? (
            <button
              onClick={onToggleWorker}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-stone-900 text-amber-300 border border-amber-500/50 text-[11px] font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
              title="የሰራተኛ ማረጋገጫ (@korcha_support) — ለመቀየር ጠቅ ያድርጉ"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Shield className="w-3 h-3 text-amber-400" />
              <span>@{workerUsername}</span>
            </button>
          ) : (
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
          )}
        </div>

        {/* Clean Navigation Bar */}
        <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-1.5 text-xs gap-1">
          {/* Tab 1: Home / Shelf */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-semibold shadow-xs active:scale-95 transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Home className={`w-3.5 h-3.5 ${activeTab === 'home' ? 'text-white' : 'text-stone-600'}`} />
            <span>{isWorker ? 'መደርደሪያ' : 'መነሻ'}</span>
          </button>

          {/* Tab 2: For Worker: Quotes & Pricing (/quotes) | For Customer: እዘዝ (Order) */}
          {isWorker ? (
            <button
              onClick={() => setActiveTab('quotes')}
              className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'quotes'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'quotes' ? 'text-white' : 'text-amber-600'}`} />
              <span>ዋጋ መጠየቂያ</span>
              {pendingQuotesCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full animate-bounce">
                  {pendingQuotesCount}
                </span>
              )}
            </button>
          ) : (
            onOpenQuoteModal && (
              <button
                onClick={() => onOpenQuoteModal('link')}
                className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:scale-95 transition-all cursor-pointer shadow-xs border border-amber-300"
                title="አዲስ እቃ እዘዝ (በሊንክ ወይም በፎቶ)"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                <span>እዘዝ (Order)</span>
              </button>
            )
          )}

          {/* Tab 3: For Worker: Order Confirmations | For Customer: Messages */}
          {isWorker ? (
            <button
              onClick={() => setActiveTab('orders')}
              className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'orders' ? 'text-white' : 'text-emerald-600'}`} />
              <span>ክፍያዎች</span>
              {orderCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-black rounded-full">
                  {orderCount}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('messages')}
              className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-300'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>መልዕክት</span>
              {messageCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded-full">
                  {messageCount}
                </span>
              )}
            </button>
          )}

          {/* Tab 4: For Worker: All Customer Chats | For Customer: Orders Tracker */}
          {isWorker ? (
            <button
              onClick={() => setActiveTab('messages')}
              className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <MessageCircle className={`w-3.5 h-3.5 ${activeTab === 'messages' ? 'text-white' : 'text-amber-600'}`} />
              <span>ውይይቶች</span>
              {messageCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-stone-950 text-[9px] font-black rounded-full">
                  {messageCount}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('orders')}
              className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-50 text-amber-900 font-bold shadow-xs ring-1 ring-amber-300'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>ትዕዛዞቼ</span>
              {orderCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-600 text-white text-[9px] font-bold rounded-full">
                  {orderCount}
                </span>
              )}
            </button>
          )}

          {/* Tab 5 (For Merchant Portal): For Customer or Merchant */}
          <button
            onClick={() => setActiveTab('merchant')}
            className={`relative flex-1 flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'merchant'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
            title="የአካባቢ ነጋዴዎች እቃ ማስገቢያ (Merchant Portal)"
          >
            <ShoppingBag className={`w-3.5 h-3.5 ${activeTab === 'merchant' ? 'text-white' : 'text-amber-600'}`} />
            <span>{isWorker ? 'የነጋዴ እቃ' : 'ነጋዴ'}</span>
            {isWorker && merchantPendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-black rounded-full animate-bounce">
                {merchantPendingCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
