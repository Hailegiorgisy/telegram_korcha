import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  User,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  FileImage,
} from 'lucide-react';
import { Order, ParsedProduct } from '../types';
import { calculateDoorstepPricing } from '../services/pricingEngine';
import { sendLiveTelegramWorkerAlert } from '../services/telegramApiService';
import { triggerTmaHaptic } from '../services/telegramWebApp';

interface ScreenshotQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
  botToken?: string;
  workerChatId?: string;
}

export const ScreenshotQuoteModal: React.FC<ScreenshotQuoteModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  botToken = '',
  workerChatId = '',
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [marketplace, setMarketplace] = useState<'shein' | 'Amazon' | 'aliexpress' | 'other'>('shein');
  const [notes, setNotes] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>(() => localStorage.getItem('korcha_customer_phone') || '');
  const [customerTelegram, setCustomerTelegram] = useState<string>(() => {
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.username) return `@${tgUser.username}`;
    return localStorage.getItem('korcha_customer_telegram_user') || '';
  });
  const [deliveryCity, setDeliveryCity] = useState<string>('አዲስ አበባ');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketId: string;
    orderNumber: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      triggerTmaHaptic('light');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      triggerTmaHaptic('light');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) {
      alert('እባክዎን የእቃውን ስክሪንሾት ወይም ፎቶ ይምረጡ።');
      return;
    }
    if (!customerPhone.trim()) {
      alert('እባክዎን ስልክ ቁጥርዎን ያስገቡ (ምሳሌ፦ 09******** ወይም 07********)።');
      return;
    }

    setIsSubmitting(true);
    triggerTmaHaptic('medium');

    const ticketId = `KORCHA-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderNumber = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const realTgId = tgUser?.id ? String(tgUser.id) : undefined;
    const rawTg = customerTelegram.trim();
    const resolvedTgUser = rawTg
      ? (rawTg.startsWith('@') ? rawTg : `@${rawTg}`)
      : (tgUser?.username ? `@${tgUser.username}` : (tgUser?.first_name ? `${tgUser.first_name}` : '@customer'));

    const virtualProduct: ParsedProduct = {
      id: `ss-${Date.now()}`,
      marketplace,
      url: `https://m.${marketplace}.com`,
      title: notes.trim() ? `ስክሪንሾት፦ ${notes.slice(0, 45)}` : `ከ${marketplace.toUpperCase()} የተመረጠ እቃ (Screenshot)`,
      titleAmharic: 'ከስክሪንሾት የተመረጠ እቃ (የሰራተኛ ዋጋ ስሌት በመጠባበቅ ላይ)',
      category: 'ስክሪንሾት እቃ',
      imageUrl: imagePreview,
      originalPriceUsd: 15.00,
      availableSizes: ['እንደ ምርጫዎ'],
      availableColors: ['እንደ ፎቶው'],
    };

    const initialPricing = calculateDoorstepPricing(15.00, 0.4);

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: tgUser?.first_name ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'ውድ ደንበኛ',
      customerPhone: customerPhone.trim(),
      customerTelegramUser: resolvedTgUser,
      customerTelegramId: realTgId,
      deliveryCity,
      deliverySubcity: 'ቦሌ',
      deliveryLandmark: 'ስክሪንሾት ትዕዛዝ',
      notes: notes.trim() ? `[ስክሪንሾት]: ${notes.trim()}` : '[የእቃ ስክሪንሾት ቀርቧል]',
      item: {
        product: virtualProduct,
        quantity: 1,
        selectedSize: 'እንደ ስክሪንሾቱ',
        selectedColor: 'እንደ ፎቶው',
        pricing: initialPricing,
      },
      termsAgreed: true,
      termsAgreedAt: new Date().toISOString(),
      depositStatus: 'pending_verification',
      status: 'pending_deposit',
      workerNotified: true,
    };

    // Save customer phone for auto-filling
    localStorage.setItem('korcha_customer_phone', customerPhone.trim());
    if (resolvedTgUser) {
      localStorage.setItem('korcha_customer_telegram_user', resolvedTgUser);
    }

    // 1. Post quote directly to backend server
    fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        orderNumber,
        customerPhone: customerPhone.trim(),
        customerTelegramUser: resolvedTgUser,
        customerTelegramId: realTgId,
        marketplace,
        notes: notes.trim(),
        imageUrl: imagePreview,
      }),
    }).catch((err) => console.warn('Could not post quote to backend:', err));

    // 2. Forward direct alert to Korcha worker chat if configured
    const activeBotToken = botToken || (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string) || '';
    const activeWorkerChatId = workerChatId || (import.meta.env.VITE_TELEGRAM_WORKER_CHAT_ID as string) || '';

    if (activeBotToken && activeWorkerChatId) {
      const tgUserTag = realTgId
        ? `<a href="tg://user?id=${realTgId}">${resolvedTgUser}</a> (ID: <code>${realTgId}</code>)`
        : `${resolvedTgUser}`;

      const workerAlertText =
        `📸 <b>አዲስ የእቃ ስክሪንሾት ጥያቄ ደርሷል! (#${orderNumber})</b>\n\n` +
        `👤 <b>ደንበኛ:</b> ${tgUserTag}\n` +
        `📞 <b>ስልክ:</b> <code>${customerPhone.trim()}</code>\n` +
        `🌐 <b>የገበያ ቦታ:</b> ${marketplace.toUpperCase()}\n` +
        (notes.trim() ? `📝 <b>የደንበኛ ማስታወሻ:</b> ${notes.trim()}\n` : '') +
        `🎫 <b>ቲኬት ቁጥር:</b> <code>#${ticketId}</code>\n\n` +
        `👉 <b>ለደንበኛው በቀጥታ በቦቱ መልስ ለመስጠት፦</b>\n` +
        `<code>/reply ${orderNumber} &lt;የዋጋ ዝርዝር&gt;</code>`;

      await sendLiveTelegramWorkerAlert(activeBotToken, activeWorkerChatId, workerAlertText);
    }

    onOrderCreated(newOrder);
    setSubmittedTicket({ ticketId, orderNumber });
    setIsSubmitting(false);
    triggerTmaHaptic('success');
  };

  const handleResetAndClose = () => {
    setImagePreview(null);
    setImageFileName('');
    setNotes('');
    setSubmittedTicket(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success / Submitted State */}
        {submittedTicket ? (
          <div className="text-center py-6 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                ስክሪንሾት ለሰራተኛው ተላልፏል
              </span>
              <h3 className="text-xl font-black text-white">
                ስክሪንሾትዎ በስኬት ደርሷል!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                የኮርቻ ሰራተኛ እቃዎን ከ {marketplace.toUpperCase()} ፈልጎ የደጃፍ ዋጋውን አስልቶ በ 5 ደቂቃ ውስጥ እዚህ በቦቱ ይልክልዎታል።
              </p>
            </div>

            {/* Ticket Info Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 max-w-sm mx-auto font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>የትዕዛዝ ቁጥር፦</span>
                <span className="text-amber-400 font-bold">#{submittedTicket.orderNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>የቲኬት ቁጥር፦</span>
                <span className="text-sky-400 font-bold">#{submittedTicket.ticketId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ስልክ፦</span>
                <span className="text-white">{customerPhone}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ሁኔታ፦</span>
                <span className="text-emerald-400 font-sans font-bold">⏳ ሰራተኛ ዋጋ በማስላት ላይ</span>
              </div>
            </div>

            {/* Direct Action: Open Bot to Send / Chat */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://t.me/korchaetbot?start=quote_${submittedTicket.ticketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>በቴሌግራም ቦቱ ክፈት (@korchaetbot) →</span>
              </a>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                እሺ ጨርሻለሁ (Close)
              </button>
            </div>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                <Camera className="w-4 h-4" />
                <span>ስክሪንሾት አስገባና ዋጋ ጠይቅ (SCREENSHOT QUOTE)</span>
              </div>
              <h3 className="text-xl font-black text-white">
                የእቃውን ስክሪንሾት ለሰራተኛው ይላኩ
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ከ Shein፣ Amazon ወይም AliExpress ያዩትን እቃ ፎቶ እዚህ ይላኩልን፤ ሰራተኛችን ዋጋ አስልቶ በቀጥታ ይልክልዎታል!
              </p>
            </div>

            {/* File Upload Box */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-slate-950 p-2 text-center group">
                <img
                  src={imagePreview}
                  alt="የእቃው ስክሪንሾት"
                  className="max-h-60 mx-auto rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFileName('');
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/80 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-lg"
                  title="ፎቶውን አስወግድ"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="mt-2 text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{imageFileName || 'ፎቶው ተመርጧል'}</span>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/60 rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    ፎቶውን ወይም ስክሪንሾቱን ለመምረጥ እዚህ ይጫኑ
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    ከስልክዎ ጋለሪ ወይም ካሜራ (PNG, JPG, WebP)
                  </p>
                </div>
              </div>
            )}

            {/* Marketplace Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                የገበያ ቦታ (Marketplace) *:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'shein', label: '👗 Shein', color: 'hover:border-pink-500' },
                  { key: 'Amazon', label: '🛍️ Amazon', color: 'hover:border-orange-500' },
                  { key: 'aliexpress', label: '📦 AliExpress', color: 'hover:border-red-500' },
                  { key: 'other', label: '🌐 ሌላ', color: 'hover:border-amber-500' },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMarketplace(m.key as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      marketplace === m.key
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                        : `bg-slate-950 border-slate-800 text-slate-300 ${m.color}`
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone & Telegram Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  ስልክ ቁጥር (Phone) *:
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="09******** ወይም 07********"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  ቴሌግራም ዩዘርኔም (Telegram User):
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={customerTelegram}
                    onChange={(e) => setCustomerTelegram(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Size / Color / Preferences Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                የሚፈልጉት መጠን፣ ቀለም ወይም ምርጫ (Size / Color / Notes):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ምሳሌ፦ መጠን 41፣ ጥቁር ቀለም ወይም 2 ፍሬ ይሁንልኝ..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !imagePreview}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>ስክሪንሾቱን ለሰራተኛው በመላክ ላይ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>🚀 ስክሪንሾቱን ለሰራተኛው ላክ (Submit to Korcha Worker)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
