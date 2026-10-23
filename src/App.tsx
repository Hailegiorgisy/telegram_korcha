// src/App.tsx: Main Application Component with Live Worker Response Thread, Auto-refresh, and Payment Marketing
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import StorefrontHome from './components/StorefrontHome';
import LinkOrScreenshotQuoteModal from './components/LinkOrScreenshotQuoteModal';
import { 
  Package, 
  Search, 
  Phone, 
  ExternalLink, 
  Bell, 
  MessageSquare, 
  CheckCircle,
  RefreshCw,
  Send,
  Zap,
  CreditCard,
  Clock
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'orders'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [quoteModalMode, setQuoteModalMode] = useState<'link' | 'screenshot'>('link');
  const [preferredPayment, setPreferredPayment] = useState<'telebirr' | 'cbe_birr'>('telebirr');

  // Order lookup state
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Ping & Direct Messaging state
  const [pingingCode, setPingingCode] = useState<string | null>(null);
  const [pingSuccess, setPingSuccess] = useState<Record<string, boolean>>({});
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});
  const [isSendingReply, setIsSendingReply] = useState<Record<string, boolean>>({});

  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';

  // Initialize Telegram WebApp SDK if available
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // Periodic Auto-refresh for Live Worker Responses (Polls every 12 seconds when user is on orders tab)
  useEffect(() => {
    if (activeTab !== 'orders' || userOrders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const param = searchCode 
          ? `code=${encodeURIComponent(searchCode)}` 
          : `phone=${encodeURIComponent(searchPhone)}`;
        const res = await fetch(`/api/orders/lookup?${param}`);
        const data = await res.json();
        if (data.success && data.orders) {
          setUserOrders(data.orders);
        }
      } catch (_) {
        // silent background poll
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [activeTab, userOrders.length, searchCode, searchPhone]);

  const handleOpenQuoteModal = (
    mode: 'link' | 'screenshot' = 'link',
    payment: 'telebirr' | 'cbe_birr' = 'telebirr'
  ) => {
    setQuoteModalMode(mode);
    setPreferredPayment(payment);
    setIsQuoteModalOpen(true);
  };

  const handleSearchOrders = async (silent = false) => {
    if (!searchPhone && !searchCode) {
      alert('እባክዎ ስልክ ቁጥር ወይም የትዕዛዝ ኮድ ያስገቡ');
      return;
    }
    if (!silent) setIsSearching(true);
    setHasSearched(true);
    try {
      const param = searchCode ? `code=${encodeURIComponent(searchCode)}` : `phone=${encodeURIComponent(searchPhone)}`;
      const res = await fetch(`/api/orders/lookup?${param}`);
      const data = await res.json();
      if (data.success && data.orders) {
        setUserOrders(data.orders);
      } else {
        setUserOrders([]);
      }
    } catch (err) {
      setUserOrders([]);
    } finally {
      if (!silent) setIsSearching(false);
    }
  };

  const handleSendCustomerMessage = async (orderCode: string, phone: string) => {
    const messageText = (replyInput[orderCode] || '').trim();
    if (!messageText) return;

    setIsSendingReply(prev => ({ ...prev, [orderCode]: true }));
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: searchPhone || phone,
          note: messageText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReplyInput(prev => ({ ...prev, [orderCode]: '' }));
        setPingSuccess(prev => ({ ...prev, [orderCode]: true }));
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        // Refresh orders immediately to update timeline
        handleSearchOrders(true);
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (err) {
      alert('መልዕክቱን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSendingReply(prev => ({ ...prev, [orderCode]: false }));
    }
  };

  const handleQuickPing = async (orderCode: string, phone: string) => {
    setPingingCode(orderCode);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: searchPhone || phone,
          note: 'ደንበኛ በ Mini App መከታተያ በኩል ወቅታዊ ሁኔታ እንዲገለጽለት ጠይቋል (Quick Ping)',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPingSuccess(prev => ({ ...prev, [orderCode]: true }));
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (err) {
      alert('ጥያቄውን መላክ አልተቻለም።');
    } finally {
      setPingingCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'home' | 'orders')}
        orderCount={userOrders.length}
        onOpenQuoteModal={handleOpenQuoteModal}
      />

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === 'home' && (
          <StorefrontHome
            onOpenQuoteModal={handleOpenQuoteModal}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {/* Orders / Tracking Tab (Customer Self-Service & Direct Support Responses) */}
        {activeTab === 'orders' && (
          <div className="space-y-4 pb-12 animate-fade-in">
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-stone-900 flex items-center space-x-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>የትዕዛዝ ሁኔታ መከታተያ (Track Orders)</span>
                </h3>
                {userOrders.length > 0 && (
                  <button
                    onClick={() => handleSearchOrders(true)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-amber-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    title="ወቅታዊ መረጃ ለማየት አድስ (Refresh for updates)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500">
                በትዕዛዝ ወቅት የተጠቀሙትን ስልክ ቁጥር ወይም የትዕዛዝ ኮድ ያስገቡ
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">ስልክ ቁጥር</label>
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="09**** / 07****"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">ወይም የትዕዛዝ ኮድ (Order Code)</label>
                  <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="ምሳሌ፡ KC-102948"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-hidden"
                  />
                </div>
                <button
                  onClick={() => handleSearchOrders(false)}
                  disabled={isSearching}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'እየፈለገ ነው...' : 'ፈልግ (Search)'}</span>
                </button>
              </div>
            </div>

            {/* Results */}
            {hasSearched && (
              <div className="space-y-3">
                {userOrders.length > 0 ? (
                  userOrders.map((ord) => (
                    <div key={ord.order_code || ord.id} className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                          {ord.order_code}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 font-medium">{ord.product_summary || 'የተዘዘ እቃ'}</p>
                      
                      <div className="flex items-center justify-between text-xs border-t border-stone-100 pt-2">
                        <span className="text-stone-500">ጠቅላላ ክፍያ:</span>
                        <span className="font-bold text-stone-900">{ord.total_price_etb} ETB</span>
                      </div>

                      {/* Payment Marketing Badge */}
                      <div className="flex items-center justify-between text-[11px] bg-stone-50 rounded-xl p-2">
                        <span className="text-stone-500">የክፍያ ዘዴ:</span>
                        <span className="font-bold text-stone-800 flex items-center space-x-1">
                          {ord.payment_method === 'cbe_birr' ? (
                            <>
                              <CreditCard className="w-3 h-3 text-purple-600" />
                              <span>CBE Birr / ንግድ ባንክ</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 text-amber-600" />
                              <span>Telebirr (ቴሌብር)</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* FEATURE 1 & 3: Direct Worker Response Box */}
                      {(ord.latest_worker_note || ord.worker_response) ? (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-xl p-3 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-950">
                            <span className="flex items-center space-x-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                              <span>ከአስተጋጅ የተሰጠ የቀጥታ ምላሽ (Support Response):</span>
                            </span>
                            <span className="text-[10px] text-amber-700 bg-amber-200/60 px-1.5 py-0.2 rounded-full">ቀጥታ</span>
                          </div>
                          <p className="text-xs text-stone-900 font-semibold pl-5 leading-relaxed bg-white/70 p-2 rounded-lg border border-amber-100">
                            "{ord.latest_worker_note || ord.worker_response}"
                          </p>
                        </div>
                      ) : (
                        <div className="bg-stone-50 rounded-xl p-2.5 text-[11px] text-stone-500 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>ጥያቄዎ በመገምገም ላይ ነው። አስተናጋጃችን መልስ ሲጽፉ ወዲያውኑ እዚህ ይታያል።</span>
                        </div>
                      )}

                      {/* Direct Two-Way Message Box: Send Question or Message directly from TMA */}
                      <div className="pt-2 border-t border-stone-100 space-y-2">
                        <div className="flex space-x-1.5">
                          <input
                            type="text"
                            value={replyInput[ord.order_code] || ''}
                            onChange={(e) => setReplyInput({ ...replyInput, [ord.order_code]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendCustomerMessage(ord.order_code, ord.customer_phone);
                            }}
                            placeholder="ለአስተናጋጅ መልዕክት ወይም ጥያቄ ይጻፉ..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                          <button
                            onClick={() => handleSendCustomerMessage(ord.order_code, ord.customer_phone)}
                            disabled={isSendingReply[ord.order_code] || !(replyInput[ord.order_code] || '').trim()}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isSendingReply[ord.order_code] ? '...' : 'ላክ'}</span>
                          </button>
                        </div>

                        {/* Quick Ping Button */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-stone-500">
                            {pingSuccess[ord.order_code] ? (
                              <span className="text-emerald-700 font-bold flex items-center">
                                <CheckCircle className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                                ጥያቄው ለአስተናጋጅ ደርሷል
                              </span>
                            ) : (
                              'አስቸኳይ ክትትል ይፈልጋሉ?'
                            )}
                          </span>
                          <button
                            onClick={() => handleQuickPing(ord.order_code, ord.customer_phone)}
                            disabled={pingingCode === ord.order_code || pingSuccess[ord.order_code]}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                              pingSuccess[ord.order_code]
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs'
                            }`}
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>
                              {pingingCode === ord.order_code
                                ? 'እየተላከ...'
                                : pingSuccess[ord.order_code]
                                ? 'ተልኳል'
                                : 'ሁኔታ እንዲጣራ (Quick Ping)'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl p-6 text-center border border-stone-200/80 text-xs text-stone-500 space-y-2">
                    <p>ምንም የተገኘ ትዕዛዝ የለም። እባክዎ ስልክ ቁጥሩን ወይም ኮዱን በትክክል ያስገቡ።</p>
                    <a 
                      href={`https://t.me/${workerUsername}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-block text-amber-700 font-bold underline"
                    >
                      አስተናጋጅ ያነጋግሩ (@{workerUsername})
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Guided 3-Step Quote Modal */}
      <LinkOrScreenshotQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        initialMode={quoteModalMode}
        preferredPayment={preferredPayment}
      />
    </div>
  );
}

export default App;