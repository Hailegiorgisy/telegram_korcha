<<<<<<< HEAD
// src/App.tsx: Main Application Component with Cleaned Routing
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StorefrontHome from './components/StorefrontHome';
import LinkOrScreenshotQuoteModal from './components/LinkOrScreenshotQuoteModal';
import { Package, Search, Phone, ExternalLink } from 'lucide-react';

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

        {/* Orders / Tracking Tab (Customer Self-Service) */}
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
=======
/*
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StorefrontHome } from './components/StorefrontHome';
import { MarketplaceSearchExplorer } from './components/MarketplaceSearchExplorer';
import { MarketplaceCalculator } from './components/MarketplaceCalculator';
import { MyOrdersView } from './components/MyOrdersView';
import { ScreenshotQuoteModal } from './components/ScreenshotQuoteModal';
import { Order, ParsedProduct } from './types';
import { SAMPLE_PRODUCTS } from './data/sampleProducts';
import { calculateDoorstepPricing, getPaymentRatios } from './services/pricingEngine';
import { sendLiveTelegramWorkerAlert } from './services/telegramApiService';
import { initTelegramMiniApp, TelegramUser } from './services/telegramWebApp';

const INITIAL_DEMO_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'KC-849102',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    customerName: 'ደንበኛ (Customer)',
    customerPhone: '09*******5',
    customerTelegramUser: '@user_****',
    customerTelegramId: '48291048',
    deliveryCity: 'አዲስ አበባ',
    deliverySubcity: 'ቦሌ',
    deliveryLandmark: 'ቦሌ (Bole)',
    item: {
      product: SAMPLE_PRODUCTS[0],
      quantity: 1,
      selectedSize: 'M',
      selectedColor: 'Navy Floral',
      pricing: calculateDoorstepPricing(SAMPLE_PRODUCTS[0].originalPriceUsd, 145.50),
    },
    termsAgreed: true,
    termsAgreedAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    depositStatus: 'verified',
    depositMethod: 'telebirr',
    telebirrTxnId: 'TB9841****',
    status: 'freight_in_transit',
    workerNotified: true,
  },
  {
    id: 'ord-102',
    orderNumber: 'KC-592019',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    customerName: 'ደንበኛ (Customer)',
    customerPhone: '07*******2',
    customerTelegramUser: '@user_****',
    customerTelegramId: '98410294',
    deliveryCity: 'አዲስ አበባ',
    deliverySubcity: 'ቂርቆስ',
    deliveryLandmark: 'ቂርቆስ (Kirkos)',
    item: {
      product: SAMPLE_PRODUCTS[1],
      quantity: 1,
      selectedSize: 'Standard',
      selectedColor: 'Matte Black',
      pricing: calculateDoorstepPricing(SAMPLE_PRODUCTS[1].originalPriceUsd, 145.50),
    },
    termsAgreed: true,
    termsAgreedAt: new Date(Date.now() - 1000 * 60 * 179).toISOString(),
    depositStatus: 'verified',
    depositMethod: 'cbe_birr',
    telebirrTxnId: 'CBE7192****',
    status: 'procured_in_china',
    workerNotified: true,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'calculator' | 'orders'>('home');
  const [officialRate] = useState<number>(145.50);
  const [selectedProductForEstimation, setSelectedProductForEstimation] = useState<ParsedProduct | null>(null);

  const [botToken] = useState<string>(() => localStorage.getItem('korcha_bot_token') || (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string) || '');
  const [workerChatId] = useState<string>(() => localStorage.getItem('korcha_worker_chat_id') || (import.meta.env.VITE_TELEGRAM_WORKER_CHAT_ID as string) || '');

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('korcha_orders');
    return saved ? JSON.parse(saved) : INITIAL_DEMO_ORDERS;
  });

  const [toastNotification, setToastNotification] = useState<{ message: string; phone?: string } | null>(null);
  const [tmaUser, setTmaUser] = useState<TelegramUser | null>(null);
  const [isTMA, setIsTMA] = useState<boolean>(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('korcha_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    const tma = initTelegramMiniApp();
    if (tma.isTMA) {
      setIsTMA(true);
      if (tma.user) {
        setTmaUser(tma.user);
        if (tma.user.username) {
          localStorage.setItem('korcha_customer_telegram_user', `@${tma.user.username}`);
        }
      }
      if (tma.startParam === 'orders' || window.location.search.includes('tab=orders')) {
        setActiveTab('orders');
      } else if (tma.startParam === 'calculator' || window.location.search.includes('tab=calculator')) {
        setActiveTab('calculator');
      } else if (tma.startParam === 'photo' || window.location.search.includes('photo=1')) {
        setShowScreenshotModal(true);
      }
    }
  }, []);

  // Native Telegram Mini App BackButton support
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    if (activeTab !== 'home' && isTMA) {
      tg.BackButton.show();
      const onBack = () => setActiveTab('home');
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton?.offClick(onBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [activeTab, isTMA]);

  const handleNavigateToOrders = (phone?: string) => {
    if (phone) {
      localStorage.setItem('korcha_customer_phone', phone);
    }
    setActiveTab('orders');
  };

  const handleNewOrderPlaced = async (newOrder: Order) => {
    const { advancePercent, codPercent } = getPaymentRatios();
    const depositPct = newOrder.item.pricing.depositPercent || advancePercent;
    const codPct = newOrder.item.pricing.codPercent || codPercent;

    setOrders((prev) => [newOrder, ...prev]);
    setToastNotification({
      message: `🚨 አዲስ ትዕዛዝ ደርሷል: #${newOrder.orderNumber} (ስልክ: ${newOrder.customerPhone}) • የ ${depositPct}% ክፍያ: ${newOrder.item.pricing.depositAmountEtb.toLocaleString()} ብር`,
      phone: newOrder.customerPhone,
    });

    setTimeout(() => {
      setToastNotification(null);
    }, 8000);

    // 1. Post to backend server so bot knows the order immediately
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    }).catch((err) => console.warn('Could not post order to server:', err));

    // 2. Also send direct worker alert if client tokens are present
    if (botToken && workerChatId) {
      const tgUserTag = newOrder.customerTelegramId
        ? `<a href="tg://user?id=${newOrder.customerTelegramId}">${newOrder.customerTelegramUser || 'ደንበኛ'}</a> (ID: <code>${newOrder.customerTelegramId}</code>)`
        : `${newOrder.customerTelegramUser || 'ደንበኛ'}`;

      const alertText =
        `🚨 <b>አዲስ የኮርቻ ትዕዛዝ ደርሷል! (#${newOrder.orderNumber})</b>\n\n` +
        `<b>👤 ደንበኛ:</b> ${tgUserTag}\n` +
        `<b>📞 ስልክ:</b> ${newOrder.customerPhone}\n` +
        `<b>📍 አድራሻ:</b> ${newOrder.deliveryCity} (${newOrder.deliveryLandmark})\n` +
        `<b>🛍️ እቃ:</b> ${newOrder.item.product.title}\n` +
        (newOrder.notes ? `<b>🎨 ምርጫ:</b> ${newOrder.notes}\n` : '') +
        `<b>💰 ጠቅላላ ዋጋ:</b> ${newOrder.item.pricing.totalPriceEtb.toLocaleString()} ETB\n` +
        `<b>💳 የ ${depositPct}% ቅድመ ክፍያ:</b> ${newOrder.item.pricing.depositAmountEtb.toLocaleString()} ETB\n` +
        `<b>🚚 ቀሪ ${codPct}%:</b> ${newOrder.item.pricing.codAmountEtb.toLocaleString()} ETB\n` +
        (newOrder.telebirrTxnId ? `<b>🧾 የክፍያ ማጣቀሻ (Txn ID):</b> <code>${newOrder.telebirrTxnId}</code>\n` : '') +
        `\n👉 <b>በቀጥታ በቦቱ ለደንበኛው ለመመለስ፦</b> ለዚህ መልዕክት Reply ያድርጉ ወይም <code>/reply ${newOrder.orderNumber} &lt;መልስ&gt;</code>`;

      await sendLiveTelegramWorkerAlert(botToken, workerChatId, alertText);
    }
  };

  const handleSelectProductFromSearch = (prod: ParsedProduct) => {
    setSelectedProductForEstimation(prod);
    setActiveTab('calculator');
    setToastNotification({ message: `✅ "${prod.title.slice(0, 30)}..." ወደ ዋጋ ማስያ ገጽ ተላልፏል!` });
    setTimeout(() => setToastNotification(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification Bar with quick tracking button */}
      {toastNotification && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2 font-bold text-xs sm:text-sm text-center flex items-center justify-center gap-3 shadow-lg sticky top-0 z-50">
          <span>{toastNotification.message}</span>
          {toastNotification.phone && (
            <button onClick={() => handleNavigateToOrders(toastNotification.phone)} className="px-2.5 py-0.5 rounded-lg bg-slate-950 text-amber-300 hover:text-white text-xs font-black transition-colors cursor-pointer">📦 ትዕዛዜን እይ (Track) →</button>
          )}
        </div>
      )}

      {/* Main Simplistic Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orderCount={orders.length}
        isTMA={isTMA}
        tmaUser={tmaUser}
        onOpenScreenshotModal={() => setShowScreenshotModal(true)}
      />

      {/* Tab Views */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <StorefrontHome
            onSelectProductForCalculator={handleSelectProductFromSearch}
            onNavigateToOrders={handleNavigateToOrders}
            onNavigateToSimulator={() => setActiveTab('search')}
            onOrderCompleted={handleNewOrderPlaced}
            officialRate={officialRate}
            onOpenScreenshotModal={() => setShowScreenshotModal(true)}
          />
        )}

        {activeTab === 'orders' && (
          <MyOrdersView orders={orders} onNavigateToSimulator={() => setActiveTab('search')} onNavigateToSearch={() => setActiveTab('search')} />
        )}

        {activeTab === 'search' && (
          <MarketplaceSearchExplorer officialRate={officialRate} onSelectProductForEstimation={handleSelectProductFromSearch} />
        )}

        {activeTab === 'calculator' && (
          <MarketplaceCalculator officialRate={officialRate} initialProduct={selectedProductForEstimation} onOrderCompleted={handleNewOrderPlaced} onNavigateToOrders={handleNavigateToOrders} />
        )}
      </main>

      {/* Screenshot Quote Modal */}
      <ScreenshotQuoteModal
        isOpen={showScreenshotModal}
        onClose={() => setShowScreenshotModal(false)}
        onOrderCreated={handleNewOrderPlaced}
        botToken={botToken}
        workerChatId={workerChatId}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-5 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-bold text-slate-300">Korcha (ኮርቻ)</div>
          <div>ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ | {getPaymentRatios().advancePercent}% በቴሌብር/CBE • {getPaymentRatios().codPercent}% በር ላይ • 10-14 ቀናት</div>
        </div>
      </footer>
    </div>
  );
}
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
