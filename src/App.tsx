// src/App.tsx: Main Application Component with Dedicated Worker Operations Center & Customer Experience
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StorefrontHome from './components/StorefrontHome';
import LinkOrScreenshotQuoteModal from './components/LinkOrScreenshotQuoteModal';
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
  Image as ImageIcon
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'quotes' | 'orders' | 'messages'>('home');
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

  // Ping & Direct Messaging state
  const [pingingCode, setPingingCode] = useState<string | null>(null);
  const [pingSuccess, setPingSuccess] = useState<Record<string, boolean>>({});
  const [replyInput, setReplyInput] = useState<Record<string, string>>({});
  const [isSendingReply, setIsSendingReply] = useState<Record<string, boolean>>({});
  const [ticketChatMessages, setTicketChatMessages] = useState<Record<string, any[]>>({});

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
  const [msgFilterInput, setMsgFilterInput] = useState<string>('');
  const [directChatInput, setDirectChatInput] = useState<string>('');
  const [isSendingDirectChat, setIsSendingDirectChat] = useState<boolean>(false);

  const workerUsername = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKER_TELEGRAM_USERNAME) 
    || 'korcha_support').replace(/^@/, '');
  const tgUser = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;

  // Multi-Signal Robust Worker Detection: Telegram context + URL param + LocalStorage toggle
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isUrlWorker = Boolean(
    searchParams?.get('worker') === '1' ||
    searchParams?.get('role') === 'worker' ||
    searchParams?.get('admin') === '1' ||
    searchParams?.get('user')?.replace(/^@/, '').toLowerCase() === workerUsername.toLowerCase()
  );
  const isStorageWorker = typeof localStorage !== 'undefined' && localStorage.getItem('korcha_worker_active') === 'true';

  const isAuthorizedWorker = Boolean(
    isUrlWorker ||
    isStorageWorker ||
    (tgUser?.username && tgUser.username.replace(/^@/, '').toLowerCase() === workerUsername.toLowerCase())
  );

  const handleToggleWorker = () => {
    const next = !isAuthorizedWorker;
    localStorage.setItem('korcha_worker_active', String(next));
    window.location.reload();
  };

  // Dedicated Worker State (Real-time Operations Workspace)
  const [workerOverview, setWorkerOverview] = useState<{
    pendingQuotes: any[];
    pendingOrders: any[];
    conversations: any[];
    stats: any;
  }>({
    pendingQuotes: [],
    pendingOrders: [],
    conversations: [],
    stats: { pendingQuotesCount: 0, pendingOrdersCount: 0, totalConversationsCount: 0 },
  });
  const [isLoadingWorkerOverview, setIsLoadingWorkerOverview] = useState(false);
  const [pricingForm, setPricingForm] = useState<Record<string, { total: string; deposit: string; note: string }>>({});
  const [isSubmittingQuote, setIsSubmittingQuote] = useState<Record<string, boolean>>({});
  const [confirmDeliveryForm, setConfirmDeliveryForm] = useState<Record<string, string>>({});
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<Record<string, boolean>>({});

  const fetchWorkerOverview = async (silent = true) => {
    if (!silent) setIsLoadingWorkerOverview(true);
    try {
      const res = await fetch('/api/worker/overview');
      const data = await res.json();
      if (data.success) {
        setWorkerOverview({
          pendingQuotes: data.pendingQuotes || [],
          pendingOrders: data.pendingOrders || [],
          conversations: data.conversations || [],
          stats: data.stats || {},
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

  const handleWorkerSubmitQuote = async (quoteCode: string) => {
    const form = pricingForm[quoteCode] || { total: '', deposit: '', note: '' };
    if (!form.total || isNaN(Number(form.total))) {
      alert('እባክዎ ትክክለኛ የብር መጠን ያስገቡ (Please enter valid ETB price)');
      return;
    }
    setIsSubmittingQuote(prev => ({ ...prev, [quoteCode]: true }));
    try {
      const res = await fetch('/api/worker/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteCode,
          totalPriceEtb: Number(form.total),
          depositAmountEtb: form.deposit ? Number(form.deposit) : Math.round(Number(form.total) * 0.4),
          note: form.note || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert(`✅ የዋጋ ግምት ለትኬት ${quoteCode} ለደንበኛው በቦት ተልኳል!`);
        await fetchWorkerOverview(false);
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (e: any) {
      alert(`ስህተት: ${e.message}`);
    } finally {
      setIsSubmittingQuote(prev => ({ ...prev, [quoteCode]: false }));
    }
  };

  const handleWorkerConfirmOrder = async (orderCode: string) => {
    const deliveryWindow = confirmDeliveryForm[orderCode] || 'በ10-14 ቀን';
    setIsConfirmingOrder(prev => ({ ...prev, [orderCode]: true }));
    try {
      const res = await fetch('/api/worker/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderCode,
          deliveryWindow,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        alert(`🎉 የትዕዛዝ ${orderCode} ክፍያ ተረጋግጧል! ማሳወቂያ ለደንበኛ ተልኳል።`);
        await fetchWorkerOverview(false);
      } else {
        alert(data.error || 'ስህተት ተከስቷል');
      }
    } catch (e: any) {
      alert(`ስህተት: ${e.message}`);
    } finally {
      setIsConfirmingOrder(prev => ({ ...prev, [orderCode]: false }));
    }
  };

  const getDefaultSupportCode = () => {
    const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tmaUser?.id) return `KC-${String(tmaUser.id).slice(-6)}`;
    if (searchPhone) return `KC-${searchPhone.replace(/\D/g, '').slice(-6)}`;
    return 'KC-SUPPORT';
  };

  // Helper to persist customer phone & ticket codes locally
  const rememberTicketAndPhone = (code?: string, phone?: string) => {
    try {
      if (phone && phone.trim()) {
        localStorage.setItem('korcha_customer_phone', phone.trim());
        if (!searchPhone) setSearchPhone(phone.trim());
      }
      if (code && code.trim()) {
        const cleanCode = code.trim();
        setSavedCodes(prev => {
          const next = Array.from(new Set([cleanCode, ...prev]));
          localStorage.setItem('korcha_ticket_codes', JSON.stringify(next));
          return next;
        });
      }
    } catch (_) {}
  };

  // Initialize Telegram WebApp SDK if available
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // Fetch all customer conversations (Price Estimations, Order Tracker, General Support) for the Messages tab
  const fetchCustomerConversations = async (silent = true) => {
    if (isAuthorizedWorker) {
      return fetchWorkerOverview(silent);
    }

    if (!silent) setIsLoadingConversations(true);
    try {
      const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const tgId = tmaUser?.id ? String(tmaUser.id) : '';
      const phoneParam = searchPhone || localStorage.getItem('korcha_customer_phone') || '';
      const defaultCode = getDefaultSupportCode();
      const allCodes = Array.from(new Set([...savedCodes, ...(selectedConvCode ? [selectedConvCode] : []), defaultCode]));

      const qs = new URLSearchParams();
      if (tgId) qs.set('telegramId', tgId);
      if (phoneParam) qs.set('phone', phoneParam);
      if (allCodes.length > 0) qs.set('codes', allCodes.join(','));

      const res = await fetch(`/api/messages/customer?${qs.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
        if (!selectedConvCode && data.conversations.length > 0) {
          setSelectedConvCode(data.conversations[0].ticketCode);
        }
      }
    } catch (err) {
      console.warn('[Fetch Conversations Error]', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  // Polling for real-time customer updates every 5 seconds
  useEffect(() => {
    fetchCustomerConversations(true);
    const interval = setInterval(() => {
      fetchCustomerConversations(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [searchPhone, selectedConvCode]);

  const handleOpenQuoteModal = (mode: 'link' | 'screenshot' = 'link', payment: 'telebirr' | 'cbe_birr' = 'telebirr') => {
    if (isAuthorizedWorker) return;
    setQuoteModalMode(mode);
    setPreferredPayment(payment);
    setIsQuoteModalOpen(true);
  };

  // Search orders by phone or tracking code
  const handleSearchOrders = async (silent = false) => {
    if (!searchPhone.trim() && !searchCode.trim()) {
      if (!silent) alert('እባክዎ ስልክ ቁጥር ወይም የትዕዛዝ ኮድ ያስገቡ (Please enter phone or order code)');
      return;
    }

    if (!silent) setIsSearching(true);
    try {
      const qs = new URLSearchParams();
      if (searchPhone.trim()) qs.set('phone', searchPhone.trim());
      if (searchCode.trim()) qs.set('code', searchCode.trim());

      const res = await fetch(`/api/orders/lookup?${qs.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.orders)) {
        setUserOrders(data.orders);
        setHasSearched(true);
        if (data.orders.length > 0) {
          rememberTicketAndPhone(data.orders[0].order_code, searchPhone);
        }
        if (data.automaticMessage) {
          setAutoTrackingMessage(data.automaticMessage);
        }
        fetchMessagesForOrders(data.orders);
      } else {
        setUserOrders([]);
        setHasSearched(true);
      }
    } catch (err) {
      console.error('[Search Orders Error]', err);
      if (!silent) alert('የትዕዛዝ መረጃውን ለማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      if (!silent) setIsSearching(false);
    }
  };

  const fetchMessagesForOrders = async (orders: any[]) => {
    const newMessages: Record<string, any[]> = {};
    for (const ord of orders) {
      if (!ord.order_code) continue;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(ord.order_code)}/messages`);
        const data = await res.json();
        if (data.success && data.messages) {
          newMessages[ord.order_code] = data.messages;
        }
      } catch (_) {}
    }
    setTicketChatMessages(prev => ({ ...prev, ...newMessages }));
  };

  const handleSendCustomerMessage = async (orderCode: string, phone: string, customText?: string) => {
    const messageText = (customText !== undefined ? customText : (replyInput[orderCode] || '')).trim();
    if (!messageText) return;

    setIsSendingReply(prev => ({ ...prev, [orderCode]: true }));
    const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    rememberTicketAndPhone(orderCode, phone);

    const optimisticMsg = {
      id: Date.now(),
      ticket_code: orderCode,
      sender_role: isAuthorizedWorker ? 'worker' : 'customer',
      sender_name: isAuthorizedWorker ? `@${workerUsername}` : (tmaUser?.first_name || 'እርስዎ'),
      message_text: messageText,
      created_at: new Date().toISOString(),
    };
    setTicketChatMessages(prev => ({
      ...prev,
      [orderCode]: [...(prev[orderCode] || []), optimisticMsg],
    }));
    setConversations(prev => {
      const exists = prev.some(c => c.ticketCode === orderCode);
      if (exists) {
        return prev.map(c =>
          c.ticketCode === orderCode
            ? { ...c, messages: [...(c.messages || []), optimisticMsg], updatedAt: optimisticMsg.created_at }
            : c
        );
      }
      return [
        {
          ticketCode: orderCode,
          category: 'support',
          summary: messageText,
          status: isAuthorizedWorker ? 'በሰራተኛ ተመልሷል (Replied)' : 'በሰራተኛ እየታየ ነው (Waiting for Worker)',
          customerPhone: phone || null,
          latestWorkerResponse: isAuthorizedWorker ? messageText : null,
          updatedAt: optimisticMsg.created_at,
          messages: [optimisticMsg],
        },
        ...prev,
      ];
    });

    if (customText === undefined) {
      setReplyInput(prev => ({ ...prev, [orderCode]: '' }));
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText,
          senderName: isAuthorizedWorker ? `@${workerUsername}` : (tmaUser?.username ? `@${tmaUser.username}` : (tmaUser?.first_name || searchPhone || phone || 'ደንበኛ')),
          telegramId: tmaUser?.id || null,
          phone: searchPhone || phone || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        fetchCustomerConversations(true);
      }
    } catch (err) {
      alert('መልዕክቱን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSendingReply(prev => ({ ...prev, [orderCode]: false }));
    }
  };

  const handleSendFromMessagesTab = async (explicitText?: string) => {
    const text = (explicitText !== undefined ? explicitText : directChatInput).trim();
    if (!text) return;
    const targetCode = selectedConvCode || getDefaultSupportCode();
    setSelectedConvCode(targetCode);
    if (explicitText === undefined) setDirectChatInput('');
    setIsSendingDirectChat(true);
    try {
      await handleSendCustomerMessage(targetCode, searchPhone, text);
    } finally {
      setIsSendingDirectChat(false);
    }
  };

  const handleLinkTicketOrPhone = async () => {
    const raw = msgFilterInput.trim();
    if (!raw) return;
    if (/^(?:\+?251|0)?[79]\d{8}$/.test(raw.replace(/[^\d+]/g, ''))) {
      setSearchPhone(raw);
      rememberTicketAndPhone(undefined, raw);
    } else {
      rememberTicketAndPhone(raw, undefined);
      setSelectedConvCode(raw);
    }
    setMsgFilterInput('');
    await fetchCustomerConversations(false);
  };

  const workerRepliesCount = conversations.filter(c => Boolean(c.latestWorkerResponse)).length;
  const activeConversation =
    conversations.find(c => c.ticketCode === selectedConvCode) ||
    conversations[0] || {
      ticketCode: selectedConvCode || getDefaultSupportCode(),
      category: 'support',
      summary: 'ከሰራተኛ ጋር የቀጥታ ውይይት (Direct Support & Questions)',
      status: 'መልዕክት ለመላክ ዝግጁ (Ready to Chat)',
      customerPhone: searchPhone || null,
      latestWorkerResponse: null,
      messages: [],
    };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* Header with Role-Based Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as any)}
        orderCount={isAuthorizedWorker ? workerOverview.pendingOrders.length : userOrders.length}
        messageCount={isAuthorizedWorker ? workerOverview.conversations.length : workerRepliesCount || conversations.length}
        pendingQuotesCount={workerOverview.pendingQuotes.length}
        onOpenQuoteModal={isAuthorizedWorker ? undefined : handleOpenQuoteModal}
        tmaUser={tmaUser || undefined}
        isWorker={isAuthorizedWorker}
        onToggleWorker={handleToggleWorker}
      />

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-3">
        {/* Worker Mode Active Status Banner */}
        {isAuthorizedWorker && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-stone-900 text-amber-300 border border-amber-500/50 shadow-sm flex items-center justify-between text-xs font-bold">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>👨‍💼 የሰራተኛ ማዕከል (@{workerUsername})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-stone-300 font-normal">
                {workerOverview.pendingQuotes.length} ጥያቄዎች • {workerOverview.pendingOrders.length} ክፍያዎች
              </span>
              <button
                onClick={handleToggleWorker}
                className="px-2 py-0.5 rounded bg-stone-800 text-[9px] text-amber-400 hover:bg-stone-700"
                title="ወደ ደንበኛ እይታ ቀይር"
              >
                እይታ ቀይር
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: Shelf & Storefront (Home) */}
        {activeTab === 'home' && (
          <StorefrontHome
            onOpenQuoteModal={isAuthorizedWorker ? () => {} : handleOpenQuoteModal}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onShelfOrderCreated={(orderCode, phone, openMessages) => {
              rememberTicketAndPhone(orderCode, phone);
              setSelectedConvCode(orderCode);
              fetchCustomerConversations(true);
              if (openMessages) {
                setActiveTab('messages');
              }
            }}
          />
        )}

        {/* TAB 2 (WORKER ONLY): Quotes to Price Workspace */}
        {activeTab === 'quotes' && isAuthorizedWorker && (
          <div className="space-y-3 pb-12 animate-fade-in">
            <div className="bg-gradient-to-r from-stone-900 to-amber-950 text-white p-3.5 rounded-2xl shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>ያልተመለሱ የእቃ ጥያቄዎች (Pending Quotes)</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px]">
                  {workerOverview.pendingQuotes.length} አዳዲስ
                </span>
              </div>
              <p className="text-[11px] text-stone-300">
                የደንበኞችን ሊንክ ወይም ስክሪንሾት አይተው አጠቃላይ ዋጋ በብር ያስገቡ። ለደንበኛ በቦት ይላካል!
              </p>
            </div>

            {workerOverview.pendingQuotes.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-bold text-sm text-stone-800">ዋጋ ያልተሰጠው አዲስ ጥያቄ የለም!</p>
                <p className="text-xs text-stone-400">ሁሉም ጥያቄዎች ተመልሰዋል። ደንበኛ አዲስ ጥያቄ ሲልክ እዚህ ወዲያውኑ ይታያል።</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workerOverview.pendingQuotes.map((q) => {
                  const currentForm = pricingForm[q.quote_code] || { total: '', deposit: '', note: '' };
                  const totalNum = Number(currentForm.total) || 0;
                  const depositCalc = totalNum > 0 ? Math.round(totalNum * 0.4) : 0;
                  const balanceCalc = totalNum > 0 ? totalNum - depositCalc : 0;
                  const isSubmitting = isSubmittingQuote[q.quote_code] || false;

                  return (
                    <div key={q.quote_code} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <span className="font-mono font-black text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                          {q.quote_code}
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 block">{new Date(q.created_at).toLocaleTimeString()}</span>
                          <span className="text-[11px] font-bold text-stone-700">📱 {q.customer_phone || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Product Preview & Specs */}
                      <div className="space-y-1.5 text-xs">
                        {q.product_url && (
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-stone-500 shrink-0">🔗 ሊንክ፡</span>
                            <a 
                              href={q.product_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-amber-700 font-bold hover:underline truncate flex items-center space-x-1"
                            >
                              <span className="truncate">{q.product_url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        )}

                        {q.screenshot_url && (
                          <div className="flex items-center space-x-2 pt-1">
                            <span className="font-bold text-stone-500 shrink-0">📸 ፎቶ፡</span>
                            <a
                              href={`/uploads/${q.screenshot_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-[11px] font-bold hover:bg-stone-200"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                              <span>ስክሪንሾት እይ (View Screenshot)</span>
                            </a>
                          </div>
                        )}

                        <div className="p-2.5 rounded-xl bg-stone-50 text-stone-800 text-[11px] space-y-1">
                          <p className="font-semibold">{q.details || 'N/A'}</p>
                          <div className="flex space-x-3 text-[10px] text-stone-500 font-medium">
                            <span>መጠን: {q.size || 'N/A'}</span>
                            <span>ቀለም: {q.color || 'N/A'}</span>
                            <span>ብዛት: {q.quantity || 1}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Submission Box */}
                      <div className="pt-2 border-t border-stone-100 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-700 mb-0.5">አጠቃላይ ዋጋ (ETB)</label>
                            <input
                              type="number"
                              placeholder="ምሳሌ: 2500"
                              value={currentForm.total}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPricingForm(prev => ({
                                  ...prev,
                                  [q.quote_code]: { ...currentForm, total: val }
                                }));
                              }}
                              className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden"
                            />
                          </div>

                          <div className="bg-amber-50/80 p-1.5 rounded-xl border border-amber-200/70 text-right flex flex-col justify-center">
                            <span className="text-[9px] text-amber-800 font-bold">40% ቅድመ ክፍያ</span>
                            <span className="text-xs font-black text-amber-900">{depositCalc.toLocaleString()} ETB</span>
                            <span className="text-[8px] text-stone-400">ቀሪ 60%: {balanceCalc.toLocaleString()} ETB</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleWorkerSubmitQuote(q.quote_code)}
                          disabled={isSubmitting || !totalNum}
                          className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? 'እየተላከ ነው...' : '💰 የዋጋ ግምት ለደንበኛ በቦት ላክ'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Orders Tab (Role-Adapted: Worker Confirmations vs Customer Tracker) */}
        {activeTab === 'orders' && (
          <div className="space-y-4 pb-12 animate-fade-in">
            {isAuthorizedWorker ? (
              /* WORKER ORDERS & DEPOSIT CONFIRMATIONS */
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-stone-900 to-emerald-950 text-white p-3.5 rounded-2xl shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>የክፍያ ማረጋገጫ የሚጠብቁ ትዕዛዞች</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                      {workerOverview.pendingOrders.length} ክፍያዎች
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300">
                    ደንበኞች ያስገቡትን 40% ቅድመ ክፍያ በቴሌብር/CBE አረጋግጠው "ክፍያ አረጋግጥ" የሚለውን ይጫኑ።
                  </p>
                </div>

                {workerOverview.pendingOrders.length === 0 ? (
                  <div className="p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm text-stone-800">ማረጋገጫ የሚጠብቅ የክፍያ ትዕዛዝ የለም!</p>
                    <p className="text-xs text-stone-400">ሁሉም ክፍያዎች ጸድቀዋል። ደንበኛ አዲስ ትዕዛዝ ሲያዝ እዚህ ወዲያውኑ ይታያል።</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workerOverview.pendingOrders.map((ord) => {
                      const deliveryVal = confirmDeliveryForm[ord.order_code] || 'በ10-14 ቀን';
                      const isConfirming = isConfirmingOrder[ord.order_code] || false;

                      return (
                        <div key={ord.order_code} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                            <span className="font-mono font-black text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              {ord.order_code}
                            </span>
                            <div className="text-right">
                              <span className="text-[10px] text-stone-400 block">{new Date(ord.created_at).toLocaleTimeString()}</span>
                              <span className="text-[11px] font-bold text-stone-800">📱 {ord.customer_phone}</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-stone-900">{ord.product_summary || 'የተዘዘ እቃ'}</p>
                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-stone-50 text-[11px]">
                              <div>
                                <span className="text-stone-400 block text-[10px]">ጠቅላላ ዋጋ</span>
                                <span className="font-black text-stone-900">{ord.total_price_etb} ETB</span>
                              </div>
                              <div>
                                <span className="text-emerald-700 font-bold block text-[10px]">የ40% ቅድመ ክፍያ</span>
                                <span className="font-black text-emerald-800">{ord.deposit_amount_etb} ETB</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-stone-500">የክፍያ ዘዴ፡ {ord.payment_method === 'cbe_birr' ? 'CBE Birr (ንግድ ባንክ)' : 'Telebirr (ቴሌብር)'}</p>
                          </div>

                          <div className="pt-2 border-t border-stone-100 flex items-center space-x-2">
                            <input
                              type="text"
                              value={deliveryVal}
                              onChange={(e) => setConfirmDeliveryForm(prev => ({ ...prev, [ord.order_code]: e.target.value }))}
                              placeholder="የመድረሻ ቀን (ምሳሌ፡ በ10-14 ቀን)"
                              className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                            />
                            <button
                              onClick={() => handleWorkerConfirmOrder(ord.order_code)}
                              disabled={isConfirming}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isConfirming ? '...' : '✅ አረጋግጥ'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* CUSTOMER ORDER TRACKER */
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
                      title="ወቅታዊ መረጃ ለማየት አድስ"
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
            )}
          </div>
        )}

        {/* TAB 4: Messages Tab (Customer Chat vs Worker Triage) */}
        {activeTab === 'messages' && (
          <div className="space-y-4 pb-12 animate-fade-in">
            {/* Top Banner */}
            <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white rounded-2xl p-4 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black">
                    <MessageCircle className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sm leading-tight">
                      {isAuthorizedWorker ? 'የደንበኞች መልዕክት ማዕከል (Worker Ticket Center)' : 'የሰራተኛ ምላሾች እና የቀጥታ ውይይት'}
                    </h3>
                    <p className="text-[11px] text-amber-200">
                      {isAuthorizedWorker ? 'ሁሉንም የደንበኛ ጥያቄዎችና ትዕዛዞች እዚህ በቀጥታ ይመልሱ' : 'የእቃ ዋጋ ግምት፣ የትዕዛዝ ክትትልና የቀጥታ ጥያቄ'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => fetchCustomerConversations(false)}
                  disabled={isLoadingConversations}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  title="መልዕክቶችን አድስ (Refresh Messages)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Conversation Selector / Search */}
            <div className="bg-white rounded-2xl p-3 border border-stone-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-stone-600">
                  {isAuthorizedWorker ? 'ሁሉም የደንበኛ ውይይቶች (All Conversations):' : 'የእርስዎ ትዕዛዞችና ውይይቶች (Your Orders & Messages):'}
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                  {conversations.length} ውይይቶች
                </span>
              </div>

              {/* Horizontal / Grid conversation switcher */}
              <div className="flex space-x-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                {conversations.map((conv) => {
                  const isSelected = conv.ticketCode === activeConversation.ticketCode;
                  return (
                    <button
                      key={conv.ticketCode}
                      onClick={() => setSelectedConvCode(conv.ticketCode)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-400'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <span className="font-mono">{conv.ticketCode}</span>
                      {conv.customerPhone && (
                        <span className="text-[9px] opacity-75 font-normal">({conv.customerPhone.slice(-4)})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Conversation Chat Window */}
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden flex flex-col">
              {/* Ticket Header */}
              <div className="p-3 bg-stone-50 border-b border-stone-200/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-xs text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {activeConversation.ticketCode}
                    </span>
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                      {activeConversation.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-800 font-bold mt-1 line-clamp-1">
                    {activeConversation.summary}
                  </p>
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto bg-stone-50/50">
                {(!activeConversation.messages || activeConversation.messages.length === 0) ? (
                  <div className="text-center py-8 text-xs text-stone-400 space-y-1">
                    <MessageSquare className="w-6 h-6 text-stone-300 mx-auto" />
                    <p>እስካሁን የተላከ መልዕክት የለም። ውይይት ለመጀመር ከታች ይጻፉ።</p>
                  </div>
                ) : (
                  activeConversation.messages.map((msg: any, idx: number) => {
                    const isWorker = msg.sender_role === 'worker';
                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex flex-col ${isWorker ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                            isWorker
                              ? 'bg-amber-50 text-stone-900 border border-amber-200/80 rounded-tl-xs'
                              : 'bg-emerald-600 text-white rounded-tr-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between space-x-2 text-[9px] mb-1 font-bold opacity-75">
                            <span>{isWorker ? `👨‍💼 ሰራተኛ (@${workerUsername})` : `👤 ${msg.sender_name || 'ደንበኛ'}`}</span>
                            <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                          <p className="whitespace-pre-wrap font-medium">{msg.message_text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input & Fast Actions */}
              <div className="p-3 border-t border-stone-200 bg-white space-y-2">
                {/* Fast Action Templates */}
                {isAuthorizedWorker ? (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDirectChatInput('የእቃው ጠቅላላ ዋጋ ... ብር ነው። የ40% ቅድመ ክፍያ ... ብር ነው።')}
                      className="py-1 px-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold hover:bg-amber-100 text-center"
                    >
                      💰 ዋጋ አስታውቅ (Quote)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectChatInput('ክፍያዎ ተፈጽሟል። ዕቃዎ በ10-14 ቀን ይደርሳል።')}
                      className="py-1 px-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold hover:bg-emerald-100 text-center"
                    >
                      🎉 ክፍያ አረጋግጥ (Confirm)
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleSendFromMessagesTab('✅ በዋጋው ተስማምቻለሁ! 40% ቅድመ ክፍያ በቴሌብር ወይም በCBE አስገባለሁ።')}
                      className="py-1 px-2 rounded-lg bg-emerald-600 text-white font-extrabold shadow-2xs hover:bg-emerald-500 text-center"
                    >
                      ✅ በዋጋው ተስማምቻለሁ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendFromMessagesTab('❌ ዋጋው አልተስማማሁም። የተሻለ ወይም ርካሽ አማራጭ ካለ ቢያሳውቁኝ።')}
                      className="py-1 px-2 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 font-bold hover:bg-stone-200 text-center"
                    >
                      ❌ ዋጋው አልተስማማሁም
                    </button>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={directChatInput}
                    onChange={(e) => setDirectChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendFromMessagesTab();
                    }}
                    placeholder={isAuthorizedWorker ? "ለደንበኛው መልዕክት እዚህ ይጻፉ..." : "ለሰራተኛ ጥያቄ ወይም መልዕክት እዚህ ይጻፉ..."}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden bg-white font-medium"
                  />
                  <button
                    onClick={() => handleSendFromMessagesTab()}
                    disabled={isSendingDirectChat || !directChatInput.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingDirectChat ? '...' : 'ላክ'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quote Submission Modal (Customers Only) */}
      {!isAuthorizedWorker && isQuoteModalOpen && (
        <LinkOrScreenshotQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          initialMode={quoteModalMode}
          preferredPayment={preferredPayment}
          onQuoteSubmitted={(qCode, phone) => {
            rememberTicketAndPhone(qCode, phone);
            setSelectedConvCode(qCode);
            fetchCustomerConversations(true);
            setActiveTab('messages');
          }}
          onOpenMessagesTab={(qCode) => {
            if (qCode) setSelectedConvCode(qCode);
            setActiveTab('messages');
          }}
        />
      )}
    </div>
  );
}

export default App;
