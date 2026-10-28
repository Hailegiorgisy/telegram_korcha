// src/App.tsx: Main Application Component with Dedicated TMA Worker Messages Center, Live Continuous Chat, and Order Tracking
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
  ExternalLink
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'messages'>('home');
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
        } else if (!selectedConvCode) {
          setSelectedConvCode(defaultCode);
        }
      }
    } catch (_) {
      // silent fallback
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  // Poll customer conversations every 5 seconds so worker replies appear live
  useEffect(() => {
    fetchCustomerConversations(false);
    const interval = setInterval(() => {
      fetchCustomerConversations(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [searchPhone, savedCodes.join(','), activeTab]);

  // Periodic Auto-refresh for Live Worker Responses on Orders Tab
  useEffect(() => {
    if (activeTab !== 'orders' || userOrders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const param = searchCode 
          ? `code=${encodeURIComponent(searchCode)}` 
          : `phone=${encodeURIComponent(searchPhone)}`;
        const res = await fetch(`/api/orders/lookup?${param}&silent=1`);
        const data = await res.json();
        if (data.success && data.orders) {
          setUserOrders(data.orders);
          fetchMessagesForOrders(data.orders);
        }
      } catch (_) {}
    }, 8000);

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

  const fetchMessagesForOrders = async (orders: any[]) => {
    if (!orders || orders.length === 0) return;
    const newMessages: Record<string, any[]> = {};
    await Promise.all(
      orders.map(async (ord) => {
        try {
          const res = await fetch(`/api/orders/${encodeURIComponent(ord.order_code)}/messages`);
          const data = await res.json();
          if (data.success && data.messages) {
            newMessages[ord.order_code] = data.messages;
          }
        } catch (_) {}
      })
    );
    setTicketChatMessages(prev => ({ ...prev, ...newMessages }));
  };

  const handleSearchOrders = async (silent = false) => {
    if (!searchPhone && !searchCode) {
      alert('እባክዎ ስልክ ቁጥር ወይም የትዕዛዝ ኮድ ያስገቡ');
      return;
    }
    if (!silent) setIsSearching(true);
    setHasSearched(true);
    setAutoTrackingMessage('ዕቃዎ የደረሰበትን ቦታ/ሁኔታ ሰራተኛችኝ ያሳውቅዎታል። ትንሽ ይጠብቁ።');
    try {
      const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const tgParams = tmaUser
        ? `&telegramId=${encodeURIComponent(tmaUser.id || '')}&telegramUsername=${encodeURIComponent(tmaUser.username || '')}&firstName=${encodeURIComponent(tmaUser.first_name || '')}`
        : '';
      const silentParam = silent ? '&silent=1' : '';
      const param = searchCode ? `code=${encodeURIComponent(searchCode)}` : `phone=${encodeURIComponent(searchPhone)}`;
      const res = await fetch(`/api/orders/lookup?${param}${tgParams}${silentParam}`);
      const data = await res.json();
      if (data.autoMessage) {
        setAutoTrackingMessage(data.autoMessage);
      }
      if (data.trackingCode) {
        rememberTicketAndPhone(data.trackingCode, searchPhone);
        setSelectedConvCode(data.trackingCode);
      }
      if (data.success && data.orders) {
        setUserOrders(data.orders);
        fetchMessagesForOrders(data.orders);
      } else {
        setUserOrders([]);
      }
    } catch (err) {
      setUserOrders([]);
    } finally {
      if (!silent) setIsSearching(false);
    }
  };

  const handleSendCustomerMessage = async (orderCode: string, phone: string, customText?: string) => {
    const messageText = (customText !== undefined ? customText : (replyInput[orderCode] || '')).trim();
    if (!messageText) return;

    setIsSendingReply(prev => ({ ...prev, [orderCode]: true }));
    const tmaUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    rememberTicketAndPhone(orderCode, phone);

    // Optimistic UI append for instant response feel
    const optimisticMsg = {
      id: Date.now(),
      ticket_code: orderCode,
      sender_role: 'customer',
      sender_name: tmaUser?.first_name || 'እርስዎ',
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
          status: 'በሰራተኛ እየታየ ነው (Waiting for Worker)',
          customerPhone: phone || searchPhone || null,
          latestWorkerResponse: null,
          messages: [optimisticMsg],
          updatedAt: optimisticMsg.created_at,
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
          senderName: tmaUser?.username ? `@${tmaUser.username}` : (tmaUser?.first_name || searchPhone || phone || 'ደንበኛ'),
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

  // Send message from the dedicated Messages tab
  const handleSendFromMessagesTab = async () => {
    const text = directChatInput.trim();
    if (!text) return;
    const targetCode = selectedConvCode || getDefaultSupportCode();
    setSelectedConvCode(targetCode);
    setDirectChatInput('');
    setIsSendingDirectChat(true);
    try {
      await handleSendCustomerMessage(targetCode, searchPhone, text);
    } finally {
      setIsSendingDirectChat(false);
    }
  };

  // Link a ticket code or phone number in the Messages tab
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

  // Count how many conversations have worker responses
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
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'home' | 'orders' | 'messages')}
        orderCount={userOrders.length}
        messageCount={workerRepliesCount || conversations.length}
        onOpenQuoteModal={handleOpenQuoteModal}
      />

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === 'home' && (
          <StorefrontHome
            onOpenQuoteModal={handleOpenQuoteModal}
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

        {/* DEDICATED MESSAGES & WORKER RESPONSES TAB (TMA Live Chat for Price Estimations, Tracker & Support) */}
        {activeTab === 'messages' && (
          <div className="space-y-4 pb-12 animate-fade-in">
            {/* Top Banner: Worker Responses & Support Chat */}
            <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white rounded-2xl p-4 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black">
                    <MessageCircle className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sm leading-tight">
                      የሰራተኛ ምላሾች እና የቀጥታ ውይይት
                    </h3>
                    <p className="text-[11px] text-amber-300 font-medium">
                      የዋጋ ግምት፣ የትዕዛዝ ክትትል እና ማንኛውንም ጥያቄ እዚህ ይጠይቁ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => fetchCustomerConversations(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="መልዕክቶችን አድስ (Refresh Messages)"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingConversations ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Lookup / Link Ticket or Phone Number Box */}
            <div className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs space-y-2">
              <label className="block text-[11px] font-bold text-stone-700">
                🔍 የትዕዛዝ ኮድ ወይም ስልክ ቁጥር ያስገቡ (Track Order / View Reply):
              </label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  value={msgFilterInput}
                  onChange={(e) => setMsgFilterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLinkTicketOrPhone();
                  }}
                  placeholder="ምሳሌ፡ KC-751301 ወይም 0912345678"
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <button
                  onClick={handleLinkTicketOrPhone}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>ክፈት</span>
                </button>
              </div>
            </div>

            {/* Active Conversation Selector Pills (If customer has multiple quotes/orders/chats) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-stone-600">
                  የእርስዎ ትዕዛዞችና ውይይቶች (Your Orders & Messages):
                </span>
                <button
                  onClick={() => {
                    const newCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
                    rememberTicketAndPhone(newCode, searchPhone);
                    setSelectedConvCode(newCode);
                  }}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>አዲስ ጥያቄ ጀምር</span>
                </button>
              </div>

              {conversations.length > 0 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {conversations.map((conv) => {
                    const isSelected = conv.ticketCode === activeConversation.ticketCode;
                    const badgeLabel =
                      conv.category === 'price_quote'
                        ? '💰 የዋጋ ግምት'
                        : conv.category === 'order_tracker'
                        ? '📦 ክትትል'
                        : '💬 ድጋፍ';
                    return (
                      <button
                        key={conv.ticketCode}
                        onClick={() => setSelectedConvCode(conv.ticketCode)}
                        className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-extrabold text-xs">{conv.ticketCode}</span>
                          {conv.latestWorkerResponse && (
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                          )}
                        </div>
                        <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-amber-100' : 'text-stone-500'}`}>
                          {badgeLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Conversation Card & Continuous Two-Way Chat Window */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-xs space-y-3">
              {/* Ticket Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-extrabold text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      {activeConversation.ticketCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {activeConversation.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 font-medium mt-1 line-clamp-2">
                    {activeConversation.summary}
                  </p>
                </div>
              </div>

              {/* Latest Worker Response Highlight Banner (if worker has replied on price estimation or tracker) */}
              {activeConversation.latestWorkerResponse && (
                <div className="rounded-2xl p-3 bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-emerald-800 flex items-center space-x-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ከሰራተኛ (@{workerUsername}) የተሰጠ ምላሽ:</span>
                    </span>
                  </div>
                  <p className="font-semibold whitespace-pre-wrap leading-relaxed">
                    {activeConversation.latestWorkerResponse}
                  </p>
                </div>
              )}

              {/* Scrollable Chat Thread */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
                {(!activeConversation.messages || activeConversation.messages.length === 0) ? (
                  <div className="text-center py-6 space-y-1.5 text-xs text-stone-500">
                    <MessageSquare className="w-6 h-6 text-amber-500 mx-auto opacity-80" />
                    <p className="font-bold text-stone-700">
                      ከኮርቻ ሰራተኛ (@{workerUsername}) ጋር የቀጥታ ውይይት ይጀምሩ!
                    </p>
                    <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                      ስለ ዋጋ ግምት (Price Estimation)፣ ስለ ትዕዛዝዎ ሁኔታ (Order Tracker) ወይም ማንኛውንም ጥያቄ ከታች ይጻፉ። ሰራተኛችን ወዲያውኑ መልስ ይሰጥዎታል።
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map((msg: any, idx: number) => (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${
                        msg.sender_role === 'worker' ? 'items-start' : 'items-end'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                          msg.sender_role === 'worker'
                            ? 'bg-amber-100/95 text-amber-950 rounded-tl-xs border border-amber-300'
                            : 'bg-stone-900 text-white rounded-tr-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] mb-1 font-bold opacity-80">
                          <span>{msg.sender_role === 'worker' ? `👨‍💼 ሰራተኛ (@${workerUsername})` : '👤 እርስዎ (You)'}</span>
                          <span className="ml-2 font-normal">
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>
                        <p className="font-medium whitespace-pre-wrap">{msg.message_text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Continuous Message Input Box */}
              <div className="space-y-2 pt-1">
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    value={directChatInput}
                    onChange={(e) => setDirectChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendFromMessagesTab();
                    }}
                    placeholder="ለሰራተኛ ጥያቄ ወይም መልዕክት እዚህ ይጻፉ..."
                    className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden bg-white font-medium"
                  />
                  <button
                    onClick={handleSendFromMessagesTab}
                    disabled={isSendingDirectChat || !directChatInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingDirectChat ? '...' : 'ላክ'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                  <span>ውይይቱ ያለማቋረጥ ይቀጥላል (Continuous Chat)</span>
                  <a
                    href={`https://t.me/${workerUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-bold hover:underline inline-flex items-center space-x-1"
                  >
                    <span>በቴሌግራም ክፈት (@{workerUsername})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
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
                {/* Automatic Tracking Response Banner */}
                <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-3.5 shadow-2xs flex items-start space-x-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs text-amber-950 leading-relaxed">
                      {autoTrackingMessage}
                    </p>
                    <p className="text-[11px] text-amber-800">
                      ጥያቄዎ ለሰራተኛ (@{workerUsername}) ደርሷል። ምላሹ እዚህ ገጽ ላይ እና በቴሌግራም ቦት በቀጥታ ይደርስዎታል።
                    </p>
                  </div>
                </div>

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

                      {/* CONTINUOUS TWO-WAY TICKET CHAT THREAD */}
                      <div className="pt-2 border-t border-stone-100 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
                          <span className="flex items-center space-x-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                            <span>የቀጥታ ውይይት ከሰራተኛ ጋር (Order #{ord.order_code} Chat)</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                            የቀጥታ ውይይት (Active)
                          </span>
                        </div>

                        {/* Scrollable Conversation Bubble History */}
                        <div className="space-y-2 max-h-56 overflow-y-auto p-2.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                          {(!ticketChatMessages[ord.order_code] || ticketChatMessages[ord.order_code].length === 0) ? (
                            (ord.latest_worker_note || ord.worker_response) ? (
                              <div className="rounded-xl p-2.5 bg-amber-100/70 border border-amber-200 text-xs text-amber-950">
                                <p className="text-[10px] font-bold text-amber-900 mb-0.5">👨‍💼 ሰራተኛ (@{workerUsername}):</p>
                                <p className="font-medium whitespace-pre-wrap">{ord.latest_worker_note || ord.worker_response}</p>
                              </div>
                            ) : (
                              <div className="text-center py-2 text-[11px] text-stone-400">
                                እስካሁን የተላከ መልዕክት የለም። ከሰራተኛ ጋር ለመነጋገር ከታች ይጻፉ።
                              </div>
                            )
                          ) : (
                            ticketChatMessages[ord.order_code].map((msg, idx) => (
                              <div
                                key={msg.id || idx}
                                className={`flex flex-col ${
                                  msg.sender_role === 'worker' ? 'items-start' : 'items-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-2xs ${
                                    msg.sender_role === 'worker'
                                      ? 'bg-amber-100/90 text-amber-950 rounded-tl-xs border border-amber-200'
                                      : 'bg-stone-900 text-white rounded-tr-xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[9px] mb-1 font-bold opacity-75">
                                    <span>{msg.sender_role === 'worker' ? `👨‍💼 ሰራተኛ` : '👤 እርስዎ'}</span>
                                    <span className="ml-2 font-normal">
                                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                  </div>
                                  <p className="font-medium whitespace-pre-wrap">{msg.message_text}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Continuous Message Input */}
                        <div className="flex space-x-1.5 pt-0.5">
                          <input
                            type="text"
                            value={replyInput[ord.order_code] || ''}
                            onChange={(e) => setReplyInput({ ...replyInput, [ord.order_code]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendCustomerMessage(ord.order_code, ord.customer_phone);
                            }}
                            placeholder="ለሰራተኛ መልዕክት ወይም ጥያቄ ይጻፉ..."
                            className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
                          />
                          <button
                            onClick={() => handleSendCustomerMessage(ord.order_code, ord.customer_phone)}
                            disabled={isSendingReply[ord.order_code] || !(replyInput[ord.order_code] || '').trim()}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSendingReply[ord.order_code] ? '...' : 'ላክ'}</span>
                          </button>
                        </div>

                        {/* Quick Ping Button */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-stone-500">
                            {pingSuccess[ord.order_code] ? (
                              <span className="text-emerald-700 font-bold flex items-center">
                                <CheckCircle className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                                ጥያቄው ለሰራተኛ ደርሷል
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
                    <p className="font-bold text-stone-800">ዕቃዎ የደረሰበትን ቦታ/ሁኔታ ሰራተኛችኝ ያሳውቅዎታል። ትንሽ ይጠብቁ።</p>
                    <button
                      onClick={() => setActiveTab('messages')}
                      className="inline-block text-amber-700 font-bold underline cursor-pointer"
                    >
                      ከሰራተኛ ጋር አውራ (@{workerUsername})
                    </button>
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
        onQuoteSubmitted={(qCode, phone) => {
          rememberTicketAndPhone(qCode, phone);
          setSelectedConvCode(qCode);
          fetchCustomerConversations(true);
        }}
        onOpenMessagesTab={(qCode) => {
          if (qCode) setSelectedConvCode(qCode);
          setActiveTab('messages');
          fetchCustomerConversations(false);
        }}
      />
    </div>
  );
}

export default App;
