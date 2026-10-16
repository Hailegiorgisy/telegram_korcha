/*
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StorefrontHome } from './components/StorefrontHome';
import { MarketplaceSearchExplorer } from './components/MarketplaceSearchExplorer';
import { MarketplaceCalculator } from './components/MarketplaceCalculator';
import { OrderTracker } from './components/OrderTracker';
import { MyOrdersView } from './components/MyOrdersView';
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
    customerName: 'ኤልሳቤጥ ተሾመ (Elshaday T.)',
    customerPhone: '+251911445566',
    customerTelegramUser: '@elshaday_shein',
    customerTelegramId: '48291048',
    deliveryCity: 'አዲስ አበባ',
    deliverySubcity: 'ቦሌ',
    deliveryLandmark: 'ቦሌ መድኃኒዓለም፣ ከአትላስ ሆቴል አጠገብ',
    item: {
      product: SAMPLE_PRODUCTS[0],
      quantity: 1,
      selectedSize: 'M',
      selectedColor: 'Navy Floral (ሰማያዊ አበባ)',
      pricing: calculateDoorstepPricing(SAMPLE_PRODUCTS[0].originalPriceUsd, 145.50),
    },
    termsAgreed: true,
    termsAgreedAt: new Date(Date.now() - 1000 * 60 * 34).toISOString(),
    depositStatus: 'verified',
    depositMethod: 'telebirr',
    telebirrTxnId: 'TB98410294',
    status: 'freight_in_transit',
    workerNotified: true,
  },
  {
    id: 'ord-102',
    orderNumber: 'KC-592019',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    customerName: 'ዮናስ ታደሰ (Yonas T.)',
    customerPhone: '+251922889900',
    customerTelegramUser: '@yonas_tech',
    customerTelegramId: '98410294',
    deliveryCity: 'አዲስ አበባ',
    deliverySubcity: 'ቂርቆስ',
    deliveryLandmark: 'ካዛንቺስ፣ ከኢሊሌ ሆቴል ፊት ለፊት',
    item: {
      product: SAMPLE_PRODUCTS[3],
      quantity: 2,
      selectedSize: 'Standard',
      selectedColor: 'Matte Black',
      pricing: calculateDoorstepPricing(SAMPLE_PRODUCTS[3].originalPriceUsd * 2, 145.50),
    },
    termsAgreed: true,
    termsAgreedAt: new Date(Date.now() - 1000 * 60 * 179).toISOString(),
    depositStatus: 'verified',
    depositMethod: 'cbe_birr',
    telebirrTxnId: 'CBE71920482',
    status: 'procured_in_china',
    workerNotified: true,
  },
  {
    id: 'ord-103',
    orderNumber: 'KC-194029',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    customerName: 'ዳዊት ግርማ (Dawit G.)',
    customerPhone: '+251711223344',
    customerTelegramUser: '@dawit_dev',
    customerTelegramId: '10928491',
    deliveryCity: 'አዲስ አበባ',
    deliverySubcity: 'የካ',
    deliveryLandmark: 'ሲኤምሲ ሚካኤል፣ ፀሐይ ሪል እስቴት መግቢያ',
    item: {
      product: SAMPLE_PRODUCTS[6],
      quantity: 1,
      selectedSize: 'Compact 75%',
      selectedColor: 'Brown Switch',
      pricing: calculateDoorstepPricing(SAMPLE_PRODUCTS[6].originalPriceUsd, 145.50),
    },
    termsAgreed: true,
    termsAgreedAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    depositStatus: 'pending_verification',
    depositMethod: 'telebirr',
    telebirrTxnId: 'TB59201948',
    status: 'pending_deposit',
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

    // Forward alert to Telegram workers if configured
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
      <Header activeTab={activeTab} setActiveTab={setActiveTab} orderCount={orders.length} isTMA={isTMA} tmaUser={tmaUser} />

      {/* Tab Views */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <StorefrontHome onSelectProductForCalculator={handleSelectProductFromSearch} onNavigateToOrders={handleNavigateToOrders} onNavigateToSimulator={() => setActiveTab('search')} onOrderCompleted={handleNewOrderPlaced} officialRate={officialRate} />
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

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-5 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-bold text-slate-300">Korcha (ኮርቻ)</div>
          <div>ከዓለም አቀፍ ገበያዎች እቃዎች ወደ ኢትዮጵያ | {getPaymentRatios().advancePercent}% በቴሌብር/CBE • {getPaymentRatios().codPercent}% በር ላይ • 10-14 ቀናት</div>
        </div>
      </footer>
    </div>
  );
}
