// src/App.tsx: Main Application Component with Strict Role Separation
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StorefrontHome from './components/StorefrontHome';
import LinkOrScreenshotQuoteModal from './components/LinkOrScreenshotQuoteModal';
import MerchantPortal from './components/MerchantPortal';
import { 
  Package, 
  Search, 
  Bell, 
  MessageSquare, 
  CheckCircle,
  RefreshCw, 
  Send, 
  Zap, 
  CreditCard, 
  Clock, 
  MessageCircle, 
  Plus, 
  ExternalLink,
  Shield,
  FileText,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  ShoppingBag
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'quotes' | 'orders' | 'messages' | 'merchant'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [quoteModalMode, setQuoteModalMode] = useState<'link' | 'screenshot'>('link');
  const [preferredPayment, setPreferredPayment] = useState<'telebirr' | 'cbe_birr'>('telebirr');

  // Order lookup state
  const [searchPhone, setSearchPhone] = useState<string>(() => {
    try { return localStorage.getItem('korcha_customer_phone') || ''; } catch { return ''; }
  });
  const [searchCode, setSearchCode] = useState<string>('');
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [autoTrackingMessage, setAutoTrackingMessage] = useState<string>(
    'ዕቃዎ የደረሰበትን ቦታ/ሁኔታ ሰራተኛችኝ ያሳውቅዎታል። ትንሽ ይጠብቁ።'
  );

  // Dedicated TMA Messages / Support Center state
  const [savedCodes, setSavedCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('korcha_ticket_codes');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvCode, setSelectedConvCode] = useState<string>('');
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);

  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support').replace(/^@/, '');
  const tgUser = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;

  // STRICT Role Separation:
  // Customers are ALWAYS the default role.
  // Worker mode is ONLY granted if:
  // 1. Explicitly requested via ?worker=1 or ?role=worker in URL
  // 2. OR Telegram username matches authorized worker list (@korcha_support, @Hailegiorgisy)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isExplicitUrlWorker = Boolean(
    searchParams?.get('worker') === '1' ||
    searchParams?.get('role') === 'worker' ||
    searchParams?.get('admin') === '1'
  );

  const currentTgUsername = (tgUser?.username || '').replace(/^@/, '').toLowerCase();
  const isAuthorizedUsername = Boolean(
    currentTgUsername && (
      currentTgUsername === workerUsername.toLowerCase() ||
      currentTgUsername === 'hailegiorgisy' ||
      currentTgUsername === 'korcha_support'
    )
  );

  // If worker query parameter is set or authorized telegram username
  const isAuthorizedWorker = isExplicitUrlWorker || isAuthorizedUsername;

  // Dedicated toggle only for authorized users
  const handleToggleWorker = () => {
    if (isAuthorizedWorker) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('worker') === '1') {
        url.searchParams.delete('worker');
      } else {
        url.searchParams.set('worker', '1');
      }
      window.location.href = url.toString();
    }
  };

  // Dedicated Worker State
  const [workerOverview, setWorkerOverview] = useState<{
    pendingQuotes: any[];
    pendingOrders: any[];
    conversations: any[];
    merchantSubmissions: any[];
    stats: any;
  }>({
    pendingQuotes: [],
    pendingOrders: [],
    conversations: [],
    merchantSubmissions: [],
    stats: { pendingQuotesCount: 0, pendingOrdersCount: 0, totalConversationsCount: 0, pendingMerchantsCount: 0 },
  });
  const [isLoadingWorkerOverview, setIsLoadingWorkerOverview] = useState(false);

  const fetchWorkerOverview = async (silent = true) => {
    if (!silent) setIsLoadingWorkerOverview(true);
    try {
      const [res, merchantRes] = await Promise.all([
        fetch('/api/worker/overview'),
        fetch('/api/worker/merchant-submissions')
      ]);
      const data = await res.json();
      const merchantData = await merchantRes.json();
      if (data.success) {
        const mList = merchantData.submissions || [];
        const mPending = mList.filter((s: any) => s.status === 'pending_review' || s.status === 'in_negotiation');
        setWorkerOverview({
          pendingQuotes: data.pendingQuotes || [],
          pendingOrders: data.pendingOrders || [],
          conversations: data.conversations || [],
          merchantSubmissions: mList,
          stats: {
            ...(data.stats || {}),
            pendingMerchantsCount: mPending.length,
          },
        });
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations);
          if (!selectedConvCode) {
            setSelectedConvCode(data.conversations[0].ticketCode);
          }
        }
      }
    } catch (err) {
      console.warn('[Worker Overview Error]', err);
    } finally {
      if (!silent) setIsLoadingWorkerOverview(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedWorker) {
      localStorage.setItem('korcha_worker_active', 'true');
      fetchWorkerOverview(false);
      const interval = setInterval(() => fetchWorkerOverview(true), 6000);
      return () => clearInterval(interval);
    }
  }, [isAuthorizedWorker]);

  const handleOpenQuoteModal = (mode: 'link' | 'screenshot' = 'link') => {
    // Only customers can open the order quote modal; workers do not place customer orders
    if (isAuthorizedWorker) return;
    setQuoteModalMode(mode);
    setIsQuoteModalOpen(true);
  };

  const rememberTicketAndPhone = (code: string, phone?: string) => {
    if (code) {
      setSavedCodes(prev => {
        if (!prev.includes(code)) {
          const updated = [code, ...prev];
          try { localStorage.setItem('korcha_ticket_codes', JSON.stringify(updated)); } catch (_) {}
          return updated;
        }
        return prev;
      });
    }
    if (phone) {
      try { localStorage.setItem('korcha_customer_phone', phone); } catch (_) {}
    }
  };

  const fetchCustomerConversations = async (silent = false) => {
    if (!silent) setIsLoadingConversations(true);
    try {
      const phoneParam = searchPhone.trim() || localStorage.getItem('korcha_customer_phone') || '';
      const tgId = tgUser?.id;
      const codesParam = savedCodes.join(',');

      const params = new URLSearchParams();
      if (phoneParam) params.set('phone', phoneParam);
      if (tgId) params.set('telegramId', String(tgId));
      if (codesParam) params.set('codes', codesParam);

      const res = await fetch(`/api/messages/customer?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.conversations) {
        setConversations(data.conversations);
        if (!selectedConvCode && data.conversations.length > 0) {
          setSelectedConvCode(data.conversations[0].ticketCode);
        }
      }
    } catch (err) {
      console.warn('[Fetch Customer Conversations Error]', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (!isAuthorizedWorker) {
      fetchCustomerConversations(false);
      const interval = setInterval(() => fetchCustomerConversations(true), 8000);
      return () => clearInterval(interval);
    }
  }, [isAuthorizedWorker, searchPhone, savedCodes.length]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans select-none">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orderCount={isAuthorizedWorker ? workerOverview.pendingOrders.length : userOrders.length}
        messageCount={isAuthorizedWorker ? workerOverview.conversations.length : conversations.length}
        pendingQuotesCount={workerOverview.pendingQuotes.length}
        merchantPendingCount={workerOverview.stats?.pendingMerchantsCount || 0}
        onOpenQuoteModal={isAuthorizedWorker ? undefined : handleOpenQuoteModal}
        isWorker={isAuthorizedWorker}
        onToggleWorker={handleToggleWorker}
      />

      <main className="flex-1 max-w-md mx-auto w-full p-2.5">
        {/* TAB 1: SHELF / STOREFRONT — WORKERS EDIT, CUSTOMERS ORDER */}
        {activeTab === 'home' && (
          <StorefrontHome
            onOpenQuoteModal={isAuthorizedWorker ? () => {} : handleOpenQuoteModal}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            isWorker={isAuthorizedWorker}
            onShelfOrderCreated={(orderCode, phone, openMessages) => {
              rememberTicketAndPhone(orderCode, phone);
              setSelectedConvCode(orderCode);
              fetchCustomerConversations(true);
              if (openMessages) setActiveTab('messages');
            }}
          />
        )}

        {/* TAB 2 (WORKER ONLY): PENDING QUOTES TO PRICE */}
        {activeTab === 'quotes' && isAuthorizedWorker && (
          <div className="p-4 bg-white rounded-2xl shadow-xs text-center space-y-2 border border-stone-200">
            <h3 className="font-extrabold text-sm text-stone-900">ዋጋ ያልተሰጣቸው ጥያቄዎች (Worker Pricing Hub)</h3>
            <p className="text-xs text-stone-500">በአጠቃላይ {workerOverview.pendingQuotes.length} ጥያቄዎች ዋጋ ማስተካከል ይጠብቃሉ</p>
          </div>
        )}

        {/* TAB 3: CUSTOMER ORDERS TRACKER OR WORKER DEPOSIT VERIFICATION */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {isAuthorizedWorker ? (
              <div className="p-4 bg-white rounded-2xl shadow-xs border border-stone-200 text-center space-y-1">
                <h3 className="font-extrabold text-xs text-stone-900">የክፍያ ማረጋገጫዎች (Worker Confirmations)</h3>
                <p className="text-xs text-stone-500">{workerOverview.pendingOrders.length} ክፍያዎች ማረጋገጫ ይጠብቃሉ</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-white rounded-2xl shadow-xs border border-stone-200">
                  <h3 className="font-extrabold text-xs text-stone-900 mb-2 flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-amber-600" />
                    <span>የትዕዛዝ ሁኔታ መከታተያ (Track Order)</span>
                  </h3>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      placeholder="ስልክ ቁጥር (09.../07...) ወይም ኮድ"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 bg-stone-50"
                    />
                    <button
                      onClick={() => fetchCustomerConversations(false)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs"
                    >
                      ፈልግ
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-amber-950">አዲስ እቃ ማዘዝ ይፈልጋሉ?</p>
                    <p className="text-[10px] text-amber-800">ከ Shein ወይም Amazon ሊንክ አስገብተው ይዘዙ</p>
                  </div>
                  <button
                    onClick={() => handleOpenQuoteModal('link')}
                    className="py-1.5 px-3 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center space-x-1 shadow-xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>አሁን እዘዝ</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: MESSAGES / SUPPORT CHAT */}
        {activeTab === 'messages' && (
          <div className="p-4 bg-white rounded-2xl shadow-xs border border-stone-200 space-y-2">
            <h3 className="font-extrabold text-xs text-stone-900 flex items-center space-x-1.5">
              <MessageCircle className="w-4 h-4 text-amber-600" />
              <span>{isAuthorizedWorker ? 'የደንበኞች መልዕክቶች (Support Inbox)' : `ከሰራተኛ ጋር የቀጥታ ውይይት (@${workerUsername})`}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {isAuthorizedWorker ? 'ከደንበኞች የተላኩ ጥያቄዎች እና መልዕክቶች' : 'የዋጋ ግምገማ፣ የደረሰኝ ማረጋገጫ እና ወቅታዊ መረጃ እዚህ ይደርስዎታል'}
            </p>
          </div>
        )}

        {/* TAB 5: MERCHANT PORTAL */}
        {activeTab === 'merchant' && (
          <MerchantPortal
            workerUsername={workerUsername}
            onOpenChatWithWorker={(code) => {
              rememberTicketAndPhone(code, searchPhone);
              setSelectedConvCode(code);
              fetchCustomerConversations(true);
              setActiveTab('messages');
            }}
          />
        )}
      </main>

      {/* Quote Order Modal — Strictly for Customers */}
      {!isAuthorizedWorker && isQuoteModalOpen && (
        <LinkOrScreenshotQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          initialMode={quoteModalMode}
          preferredPayment={preferredPayment}
          onQuoteSubmitted={(code, phone) => {
            rememberTicketAndPhone(code, phone);
            setSelectedConvCode(code);
            fetchCustomerConversations(true);
            setActiveTab('messages');
          }}
        />
      )}
    </div>
  );
}

export default App;
