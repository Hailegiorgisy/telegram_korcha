// src/App.tsx: Main Application Component with Cleaned Routing
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StorefrontHome from './components/StorefrontHome';
import LinkOrScreenshotQuoteModal from './components/LinkOrScreenshotQuoteModal';
import { Package, Search } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'orders'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [quoteModalMode, setQuoteModalMode] = useState<'link' | 'screenshot'>('link');

  // Order lookup state
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const workerUsername = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support';

  // Initialize Telegram WebApp SDK if available
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  const handleOpenQuoteModal = (mode: 'link' | 'screenshot' = 'link') => {
    setQuoteModalMode(mode);
    setIsQuoteModalOpen(true);
  };

  const handleSearchOrders = async () => {
    if (!searchPhone && !searchCode) {
      alert('እባክዎ ስልክ ቁጥር ወይም የትዕዛዝ ኮድ ያስገቡ');
      return;
    }
    setIsSearching(true);
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
      setIsSearching(false);
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

        {/* Orders / Tracking Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4 pb-12 animate-fade-in">
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900 flex items-center space-x-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span>የትዕዛዝ ሁኔታ መከታተያ (Track Orders)</span>
              </h3>
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
                  onClick={handleSearchOrders}
                  disabled={isSearching}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'እየፈለገ ነው...' : 'ፈልግ (Search)'}</span>
                </button>
              </div>
            </div>

            {/* Results */}
            {hasSearched && (
              <div className="space-y-2.5">
                {userOrders.length > 0 ? (
                  userOrders.map((ord) => (
                    <div key={ord.order_code || ord.id} className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2">
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
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl p-6 text-center border border-stone-200/80 text-xs text-stone-500">
                    ምንም የተገኘ ትዕዛዝ የለም። እባክዎ ስልክ ቁጥሩን ወይም ኮዱን በትክክል ያስገቡ ወይም{' '}
                    <a href={`https://t.me/${workerUsername}`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">
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
      />
    </div>
  );
}

export default App;