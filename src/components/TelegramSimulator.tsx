import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Smartphone,
  Maximize2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Check,
  Copy,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  MessageCircle,
  Home,
  Link as LinkIcon,
  ShoppingBag,
  Plane,
  ShieldCheck,
  UploadCloud,
  Package,
  BookOpen,
} from 'lucide-react';
import { TelegramBotMessage, Order, ParsedProduct } from '../types';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { parseMarketplaceLink } from '../services/marketplaceParser';
import { calculateDoorstepPricing, getPaymentRatios } from '../services/pricingEngine';
import { PaymentQRCode } from './PaymentQRCode';
import { KorchaSaddleIcon } from './KorchaSaddleIcon';
import { MARKETPLACE_APPS, getSmartMarketplaceUrl, detectDeviceOS } from '../utils/marketplaceLinks';

interface TelegramSimulatorProps {
  officialRate: number;
  onNewOrderPlaced: (order: Order) => void;
  botToken: string;
  workerChatId: string;
  onNavigateToSearch?: () => void;
  onNavigateToOrders?: (phone?: string) => void;
}

// Benchmark catalog on the cheapest market (usually Shein)
// Used when screenshots are uploaded: reviews Shein for the lowest available price
const SHEIN_CHEAPEST_CATALOG = [
  {
    keywords: ['dress', 'floral', 'maxi', 'midi', 'kemis', 'skirt', 'gown', 'ቀሚስ', 'አበባማ'],
    title: 'የሼይን ፋሽን አበባማ የበጋ ቀሚስ (Shein Floral Summer Dress)',
    titleAmharic: 'የሼይን ፋሽን አበባማ የበጋ ቀሚስ',
    cheapestPriceUsd: 11.50,
    cargoWeightKg: 0.30,
    imgUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80',
    category: 'ልብስና ፋሽን (Women Fashion)',
  },
  {
    keywords: ['watch', 'smart', 'bluetooth', 'ሰዓት', 'ስማርት'],
    title: 'የሼይን ስማርት ሰዓት (Shein Bluetooth Smart Watch)',
    titleAmharic: 'የሼይን ስማርት ሰዓት',
    cheapestPriceUsd: 13.90,
    cargoWeightKg: 0.18,
    imgUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    category: 'ኤሌክትሮኒክስና ሰዓት (Smart Electronics)',
  },
  {
    keywords: ['earbuds', 'earphone', 'headphone', 'audio', 'airpods', 'ማዳመጫ', 'ጆሮ'],
    title: 'የሼይን ሽቦ አልባ ጆሮ ማዳመጫ (Shein TWS Wireless Earbuds)',
    titleAmharic: 'የሼይን ሽቦ አልባ ጆሮ ማዳመጫ',
    cheapestPriceUsd: 9.80,
    cargoWeightKg: 0.15,
    imgUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    category: 'ኤሌክትሮኒክስ (Electronics)',
  },
  {
    keywords: ['hoodie', 'jacket', 'sweater', 'sweatshirt', 'ካፖርት', 'ሁዲ', 'ሸሚዝ'],
    title: 'የሼይን ወፍራም ሁዲ (Shein Drop Shoulder Oversized Hoodie)',
    titleAmharic: 'የሼይን ወፍራም ሁዲ',
    cheapestPriceUsd: 14.50,
    cargoWeightKg: 0.55,
    imgUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80',
    category: 'የወንዶች ልብስ (Streetwear)',
  },
  {
    keywords: ['bag', 'handbag', 'crossbody', 'purse', 'tote', 'ቦርሳ'],
    title: 'የሼይን ዘመናዊ የሴቶች ቦርሳ (Shein Crossbody Shoulder Handbag)',
    titleAmharic: 'የሼይን ዘመናዊ የሴቶች ቦርሳ',
    cheapestPriceUsd: 10.20,
    cargoWeightKg: 0.35,
    imgUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
    category: 'ቦርሳና ጌጣጌጥ (Bags & Accessories)',
  },
  {
    keywords: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'ጫማ', 'ስኒከር'],
    title: 'የሼይን ዘመናዊ ስኒከር ጫማ (Shein Casual Street Sneakers)',
    titleAmharic: 'የሼይን ዘመናዊ ስኒከር ጫማ',
    cheapestPriceUsd: 16.90,
    cargoWeightKg: 0.70,
    imgUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    category: 'ጫማ (Footwear)',
  },
];

function findCheapestSheinMatch(queryText: string) {
  const lower = queryText.toLowerCase();
  for (const item of SHEIN_CHEAPEST_CATALOG) {
    if (item.keywords.some((k) => lower.includes(k))) {
      return item;
    }
  }
  // Default general best-value Shein item
  return {
    title: 'የሼይን ምርጥ የፋሽን እቃ (Shein Best-Price Item)',
    titleAmharic: 'የሼይን ምርጥ የፋሽን እቃ',
    cheapestPriceUsd: 12.00,
    cargoWeightKg: 0.35,
    imgUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
    category: 'ልብስና ፋሽን (Fashion)',
  };
}

// Visual sample screenshots for 1-click test
// Demonstrates that even if the screenshot shows a higher price on another market,
// the code reviews the cheapest market (Shein) and calculates the door price from the cheaper Shein price!
const SAMPLE_SCREENSHOTS = [
  {
    id: 'ss-sample-1',
    name: 'Shein Floral Dress',
    priceUsd: 11.50, // Best price from Shein
    store: 'Shein',
    imgUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80',
    title: 'የሼይን ፋሽን አበባማ ቀሚስ (Shein Floral Midi Dress)',
  },
  {
    id: 'ss-sample-2',
    name: 'Temu Smart Watch',
    priceUsd: 13.90, // Reviewed from cheapest market (Shein)
    store: 'Shein',
    imgUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    title: 'የሼይን ስማርት ሰዓት (በዝቅተኛ ዋጋ ከShein የተገኘ)',
  },
  {
    id: 'ss-sample-3',
    name: 'AliExpress Earbuds',
    priceUsd: 9.80, // Reviewed from cheapest market (Shein)
    store: 'Shein',
    imgUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    title: 'የሼይን ዋየርለስ ጆሮ ማዳመጫ (በዝቅተኛ ዋጋ ከShein የተገኘ)',
  },
];

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  officialRate,
  onNewOrderPlaced,
  botToken,
  workerChatId,
  onNavigateToSearch,
  onNavigateToOrders,
}) => {
  const [messages, setMessages] = useState<TelegramBotMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastQuotedProduct, setLastQuotedProduct] = useState<ParsedProduct | null>(null);
  const [awaitingPriceEdit, setAwaitingPriceEdit] = useState<boolean>(false);
  const [awaitingDetailsFor, setAwaitingDetailsFor] = useState<{
    product: ParsedProduct;
    quantity: number;
    size?: string;
    color?: string;
    pricing?: any;
  } | null>(null);

  const [pendingTicket, setPendingTicket] = useState<{
    product: ParsedProduct;
    ticketId: string;
  } | null>(null);
  const [orderCheckoutStep, setOrderCheckoutStep] = useState<'IDLE' | 'AWAITING_PHONE' | 'AWAITING_LANDMARK' | 'AWAITING_OPTIONS'>('IDLE');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('');
  const [checkoutLandmark, setCheckoutLandmark] = useState<string>('');
  const [checkoutSubcity, setCheckoutSubcity] = useState<string>('ቦሌ');
  const { advancePercent, codPercent } = getPaymentRatios();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reader = new FileReader();
    reader.onload = () => {
      const imgDataUrl = reader.result as string;

      setMessages((prev) => [
        ...prev,
        {
          id: `usr-img-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '📸 የምርቱ ስክሪንሾት (Product Screenshot)',
          photoUrl: imgDataUrl,
        },
      ]);

      setTimeout(() => {
        const rawFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const sheinMatch = findCheapestSheinMatch(rawFileName);

        const screenshotProduct: ParsedProduct = {
          id: `ss-${Date.now()}`,
          marketplace: 'shein',
          url: 'https://m.shein.com',
          title: `${sheinMatch.title}`,
          titleAmharic: sheinMatch.titleAmharic,
          category: sheinMatch.category,
          imageUrl: imgDataUrl || sheinMatch.imgUrl,
          // Calculate from the cheapest market (Shein) rather than the screenshot's printed price
          originalPriceUsd: sheinMatch.cheapestPriceUsd,
          availableSizes: ['S', 'M', 'L', 'XL'],
          availableColors: ['እንደ ፎቶው'],
        };
        submitCustomerProductToWorker(screenshotProduct, 'screenshot');
      }, 500);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleTestSampleScreenshot = (sample: typeof SAMPLE_SCREENSHOTS[0]) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-img-${Date.now()}`,
        sender: 'user',
        timestamp: timeStr,
        text: `📸 ስክሪንሾት: ${sample.title}`,
        photoUrl: sample.imgUrl,
      },
    ]);

    setTimeout(() => {
      const sheinMatch = findCheapestSheinMatch(sample.name);
      const screenshotProduct: ParsedProduct = {
        id: `ss-sample-${Date.now()}`,
        marketplace: 'shein',
        url: 'https://m.shein.com',
        title: sample.title,
        titleAmharic: sheinMatch.titleAmharic,
        category: sheinMatch.category,
        imageUrl: sample.imgUrl,
        // Calculated from cheapest market (Shein)
        originalPriceUsd: sample.priceUsd,
        availableSizes: ['Standard', 'M', 'L'],
        availableColors: ['እንደ ፎቶው'],
      };
      submitCustomerProductToWorker(screenshotProduct, 'screenshot');
    }, 500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      initWelcome();
    }
  }, [officialRate]);

  // Initial Welcome Page of the Telegram Bot
  // Exactly implements the user requested Amharic greeting & 3-step instructions:
  // "ውድ .... እንኳን ወደ ኮርቻ መጡ። በኮርቻ በመጠቀም ከቻይና እቃዎችን ማስመጣት ይችላሉ። 3 ሂደቶችን ብቻ ይጠቀሙ።
  // 1) የሚፈልጉትን ዕቃ ከተለያዩ ቦታዎች ይምረጡ።
  // 2) የመረጡትን ዕቃ ሊንክ ወይንም ፎቶ (screenshot) ወደ መተግበሪያው ያስገቡ።
  // 3) መተግበሪያው ቤትዎ ሲደርስ የሚከፍሉትን የዕቃውን ዋጋ ሲያስቀምጥልዎት 25% ዋጋ በመክፈል ይዘዙን። ዕቃው ከ10 እስከ 14 ባለው ቀናት ውስጥ እጅዎ ይገባል። ቤትዎ ሲደርስ ቀሪዎን 75% ይከፍላሉ።
  // እገዛ ከፈለጉ እኛን ያናግሩን።
  // የፈለጉትን ይሸምቱ። መልካም ገበያ።"
  const initWelcome = () => {
    const { advancePercent, codPercent } = getPaymentRatios();
    const welcomeMsg: TelegramBotMessage = {
      id: `msg-init-${Date.now()}`,
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text:
        `👋 ሰላም <b>ውድ ደንበኛ</b> እንኳን ወደ ኮርቻ የኢ-ኮሜርስ ቦት በደህና መጡ።\n\n` +
        `ከአለምአቀፍ ድረ-ገጾች ላይ የወደዱትን እቃ በቀላሉ ወደ ኢትዮጵያ ደጃፍዎ ድረስ ማስመጣት ይችላሉ።\n\n` +
        `🛍️ <b>የገበያ ቦታዎች (Marketplaces)</b>\n` +
        `1. 👗 Shein (ሺኢን)\n` +
        `2. 📦 AliExpress (አሊኤክስፕረስ)\n` +
        `3. Temu (ቴሙ) (ይህን የገበያ ቦታ ለመጠቀም ስልኮ ላይ VPN ያብሩ)\n\n` +
        `📌 <b>እንዴት ማዘዝ ይችላሉ?</b>\n` +
        `• የመረጡትን እቃ ፎቶ ስክሪንሾት አንስቶ በመላክ\n` +
        `ወይም\n` +
        `• የእቃውን ሊንክ (URL) ኮፒ ሊንክ አድርጎ ለተወካይ አገልግሎት አቅራቢ ሠራተኛ በመላክ\n` +
        `• ሰራተኛችን ዋጋውን በጥቂት ደቂቃዎች ውስጥ አስልቶ ያሳዉቆታል\n` +
        `• ከዋጋዉ <b>${advancePercent}%</b> ቅድመ ክፍያ በመክፈል ያዛሉ፤ ቀሪ <b>${codPercent}%</b> እቃውን ሲቀበሉ ይከፍላሉ!`,
      inlineKeyboard: [
        [
          { text: '👗 Shein አፕ (ዳውንሎድ)', action: 'link_shein' },
          { text: '🛍️ Temu አፕ (ዳውንሎድ)', action: 'link_temu' },
          { text: '📦 AliExpress አፕ (ዳውንሎድ)', action: 'link_ali' },
        ],
        [
          { text: '📸 ስክሪንሾት ላክ (Upload Screenshot)', action: 'prompt_upload_screenshot' },
          { text: '🔗 ሊንክ አስገባ (Paste Link)', action: 'prompt_paste_link' },
        ],
        [
          { text: '📖 የአጠቃቀም መመሪያ (Guide)', action: 'show_guide' },
          { text: '💬 ሰራተኛ እዚህ በቦቱ አናግር', action: 'chat_worker' },
        ],
        [
          { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
        ],
      ],
    };
    setMessages([welcomeMsg]);
  };

  const handleAction = async (action: string, payload?: any) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Return to main / start
    if (action === 'return_main' || action === 'start') {
      initWelcome();
      return;
    }

    // Prompt Upload Screenshot
    if (action === 'prompt_upload_screenshot') {
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '📸 ስክሪንሾት ለመላክ እፈልጋለሁ (Upload Screenshot)',
        },
        {
          id: `bot-ss-prompt-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📸 <b>የመረጡትን እቃ ስክሪንሾት ወይም ፎቶ ይላኩልን:</b>\n\n` +
            `1. የመረጡትን እቃ ስክሪንሾት ያንሱ\n` +
            `2. ከታች ያለውን <b>የካሜራ ምልክት (📷)</b> በመጫን ወይም ፎቶ በማያያዝ ይላኩ\n\n` +
            `👉 <b>ሰራተኛችን የእቃውን የቀጥታ ዋጋ እና ክብደት አረጋግጦ ዋጋውን በ5 ደቂቃ ውስጥ አስልቶ ያሳውቅዎታል።</b>`,
          inlineKeyboard: [
            [
              { text: '📷 ፎቶ ለመምረጥ እዚህ ይጫኑ', action: 'trigger_file_input' },
              { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    if (action === 'trigger_file_input') {
      fileInputRef.current?.click();
      return;
    }

    // Prompt Paste Link
    if (action === 'prompt_paste_link') {
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '🔗 ሊንክ ለማስገባት እፈልጋለሁ (Paste Link)',
        },
        {
          id: `bot-link-prompt-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `🔗 <b>የመረጡትን እቃ ሊንክ ይላኩልን (Paste Link):</b>\n\n` +
            `ከ <b>Shein</b>፣ <b>Temu</b> ወይም <b>AliExpress</b> ያዩትን እቃ <b>Share ➔ Copy Link</b> አድርገው እዚህ ቻት ላይ ይለጥፉ (Paste)።\n\n` +
            `👉 <b>ሰራተኛችን የቀጥታ ዋጋውንና ክብደቱን አረጋግጦ ዋጋውን በ5 ደቂቃ ውስጥ አስልቶ ያሳውቅዎታል።</b>`,
          inlineKeyboard: [
            [
              { text: '👗 Shein ናሙና ሞክር', action: 'test_sample_shein' },
              { text: '⚡ Temu ናሙና ሞክር', action: 'test_sample_temu' },
            ],
            [
              { text: '📱 AliExpress ናሙና ሞክር', action: 'test_sample_ali' },
              { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    if (action === 'test_sample_shein') {
      const p = SAMPLE_PRODUCTS[0];
      setInputVal(p.url);
      submitCustomerProductToWorker(p, 'link');
      return;
    }

    if (action === 'test_sample_temu') {
      const p = SAMPLE_PRODUCTS[3];
      setInputVal(p.url);
      submitCustomerProductToWorker(p, 'link');
      return;
    }

    if (action === 'test_sample_ali') {
      const p = SAMPLE_PRODUCTS[6];
      setInputVal(p.url);
      submitCustomerProductToWorker(p, 'link');
      return;
    }

    // Simulate Worker Responding with price quote
    if (action === 'deliver_worker_quote' && pendingTicket) {
      deliverWorkerQuote(pendingTicket.product, pendingTicket.ticketId);
      return;
    }

    // App Store Download Actions for Shein, Temu, and AliExpress
    if (action === 'link_shein') {
      const app = MARKETPLACE_APPS.shein;
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '👗 Shein አፕሊኬሽን ማውረድ እፈልጋለሁ',
        },
        {
          id: `bot-shein-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📲 <b>${app.name} (${app.amharicName}) አፕሊኬሽን ያውርዱ፦</b>\n\n` +
            `📌 <b>መግለጫ፦</b> ${app.description}\n\n` +
            `የስልክዎን አይነት ይምረጡ፤ በቀጥታ ወደ ስቶር ወስዶ ያወርድልዎታል፦`,
          inlineKeyboard: [
            [
              { text: '📱 Google Play Store (ለ Android)', action: 'open_store', url: app.androidUrl },
              { text: '🍎 Apple App Store (ለ iPhone)', action: 'open_store', url: app.iosUrl },
            ],
            [
              { text: '👗 Shein ናሙና እቃ ሞክር', action: 'test_sample_shein' },
              { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    if (action === 'link_temu') {
      const app = MARKETPLACE_APPS.temu;
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '🛍️ Temu አፕሊኬሽን ማውረድ እፈልጋለሁ',
        },
        {
          id: `bot-temu-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📲 <b>${app.name} (${app.amharicName}) አፕሊኬሽን ያውርዱ፦</b>\n\n` +
            `📌 <b>መግለጫ፦</b> ${app.description}\n\n` +
            `የስልክዎን አይነት ይምረጡ፤ በቀጥታ ወደ ስቶር ወስዶ ያወርድልዎታል፦`,
          inlineKeyboard: [
            [
              { text: '📱 Google Play Store (ለ Android)', action: 'open_store', url: app.androidUrl },
              { text: '🍎 Apple App Store (ለ iPhone)', action: 'open_store', url: app.iosUrl },
            ],
            [
              { text: '⚡ Temu ናሙና እቃ ሞክር', action: 'test_sample_temu' },
              { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    if (action === 'link_ali') {
      const app = MARKETPLACE_APPS.aliexpress;
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '📦 AliExpress አፕሊኬሽን ማውረድ እፈልጋለሁ',
        },
        {
          id: `bot-ali-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📲 <b>${app.name} (${app.amharicName}) አፕሊኬሽን ያውርዱ፦</b>\n\n` +
            `📌 <b>መግለጫ፦</b> ${app.description}\n\n` +
            `የስልክዎን አይነት ይምረጡ፤ በቀጥታ ወደ ስቶር ወስዶ ያወርድልዎታል፦`,
          inlineKeyboard: [
            [
              { text: '📱 Google Play Store (ለ Android)', action: 'open_store', url: app.androidUrl },
              { text: '🍎 Apple App Store (ለ iPhone)', action: 'open_store', url: app.iosUrl },
            ],
            [
              { text: '📱 AliExpress ናሙና ሞክር', action: 'test_sample_ali' },
              { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    // In-Bot Worker Chat Action (No personal chats)
    if (action === 'chat_worker') {
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '💬 ከኮርቻ ሰራተኛ ጋር በቦቱ መነጋገር እፈልጋለሁ (Chat in Bot)',
        },
        {
          id: `bot-worker-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `💬 <b>ለኮርቻ ሰራተኞች ጥያቄዎን ወይም ማስታወሻዎን እዚህ ይጻፉ፦</b>\n\n` +
            `ስለ እቃ ዋጋ፣ ስለ መጠንና ቀለም፣ ስለ ማድረሻ ጊዜ ወይም ሌላ ማንኛውም ጥያቄ ካለዎት ከታች ባለው የመልዕክት መጻፊያ ላይ ይጻፉልን። ሰራተኛችን <b>በቀጥታ እዚህ በቦቱ</b> ይመልስልዎታል!\n\n` +
            `<i>(የሰራተኛውን የቀጥታ ምላሽ ለመሞከር ከታች ያለውን "👨‍💼 የሰራተኛ ምላሽ ሞክር" የሚለውን ይጫኑ)</i>`,
          inlineKeyboard: [
            [
              { text: '👨‍💼 የሰራተኛ ምላሽ ሞክር (Simulate Worker Reply)', action: 'simulate_worker_support_reply', style: 'success' },
            ],
            [
              { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    // Simulate Worker replying back to the customer directly on the bot
    if (action === 'simulate_worker_support_reply') {
      setMessages((prev) => [
        ...prev,
        {
          id: `worker-reply-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `👨‍💼 <b>የኮርቻ ሰራተኛ ምላሽ (Korcha Support Reply)፦</b>\n\n` +
            `"ጤና ይስጥልኝ! ያዩት እቃ በአሁኑ ሰዓት አለ፤ በ 10-14 የስራ ቀናት ውስጥ አዲስ አበባ በርዎ ይደርሳል። ማዘዝ ወይም ዋጋ ማወቅ ከፈለጉ ሊንኩን ወይም ስክሪንሾቱን እዚህ መላክ ይችላሉ!"\n\n` +
            `<i>*(ምላሽ ለመስጠት ወይም ሌላ ጥያቄ ለመጠየቅ ከታች መጻፍ ይችላሉ)*</i>`,
          inlineKeyboard: [
            [
              { text: '🔗 ሊንክ አስገባ (Paste Link)', action: 'prompt_paste_link' },
              { text: '📸 ስክሪንሾት ላክ', action: 'prompt_upload_screenshot' },
            ],
            [
              { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    // Show Payment QR Generator
    if (action === 'show_payment_qr') {
      const lastOrderMsg = [...messages].reverse().find((m) => m.orderConfirmation);
      const targetOrder: any = lastOrderMsg?.orderConfirmation || {
        orderNumber: pendingTicket?.ticketId || ('KC-' + Math.floor(100000 + Math.random() * 900000)),
        item: {
          product: pendingTicket?.product || { title: 'Korcha Cross-Border Order' },
          pricing: {
            depositAmountEtb: 1850,
            depositPercent: advancePercent || 40,
            totalPriceEtb: 4625,
            codAmountEtb: 2775,
          },
        },
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `qr-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📱 <b>የቴሌብር (Telebirr) እና የንግድ ባንክ (CBE) QR ኮድ ጀነሬተር</b>\n\n` +
            `ከታች ባለው የ QR ጀነሬተር ላይ <b>ቴሌብር</b> ወይም <b>CBE Birr</b> በመምረጥ ስካን በማድረግ ወይም ምስሉን አስቀምጠው በጋለሪ በቀላሉ መክፈል ይችላሉ፦`,
          orderConfirmation: targetOrder,
          inlineKeyboard: [
            [
              { text: '🧾 ደረሰኝ እዚህ በቦቱ ላክ', action: 'send_payment_proof' },
              { text: '💬 ስለ ክፍያው ሰራተኛ ጠይቅ', action: 'chat_worker' },
            ],
            [
              { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    if (action === 'prompt_edit_price') {
      setAwaitingPriceEdit(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-prompt-price-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `✏️ <b>ትክክለኛውን ዋጋ ያስገቡ:</b>\n\n` +
            `በጣቢያው ላይ ያዩትን የዶላር ($) ዋጋ ይጻፉልን (ምሳሌ: <code>14.50</code> ወይም <code>$19.99</code>):\n` +
            `ሰራተኛችን የደጃፍ ዋጋውን እና የ 25% ቅድመ ክፍያውን አዘምኖ ያቀርብልዎታል።`,
          inlineKeyboard: [
            [{ text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' }],
          ],
        },
      ]);
      return;
    }

    if (action === 'agree_and_order' && payload) {
      startCheckoutFlow(payload);
      return;
    }

    // Guide action (መመሪያ)
    if (action === 'show_guide') {
      const { advancePercent, codPercent } = getPaymentRatios();
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          sender: 'user',
          timestamp: timeStr,
          text: '📖 የአጠቃቀም መመሪያ (Guide)',
        },
        {
          id: `bot-guide-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text:
            `📖 <b>የአጠቃቀም መመሪያ (User Guide)</b>\n\n` +
            `📌 <b>እንዴት ማዘዝ ይችላሉ?</b>\n` +
            `• ከታች ካሉት የገበያ ቦታዎች እቃ ይምረጡ\n` +
            `• የእቃውን ሊንክ (URL) ወይም ስክሪንሾት (Screenshot) እዚህ ይላኩልን\n` +
            `• የሚፈልጉትን መጠን (Size) እና ቀለም (Color)  እና ሌሎች መረጃዎች አብረው ይግለጹ\n` +
            `• ሰራተኛችን ዋጋውን በ 5 ደቂቃ ውስጥ አስልቶ ይልክልዎታል\n` +
            `• በ <b>${advancePercent}%</b> የቴሌብር ቅድመ ክፍያ ያዛሉ፤ ቀሪ <b>${codPercent}%</b> እቃው ደጃፍዎ ሲደርስ ይከፍላሉ!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🛍️ <b>የገበያ ቦታዎች (Marketplaces)፦</b>\n` +
            `1. 👗 Shein (ሺኢን)\n` +
            `2. 📦 AliExpress (አሊኤክስፕረስ)\n` +
            `3. Temu (ቴሙ) (ይህን የገበያ ቦታ ለመጠቀም ስልኮ ላይ VPN ያብሩ)\n\n` +
            `✈️ <b>የማድረሻ ጊዜ፦</b> በአየር ጭነት በ 10 እስከ 14 የስራ ቀናት ውስጥ አዲስ አበባና አካባቢው ደጃፍዎ ይደርሳል።\n\n` +
            `📦 <b>ትዕዛዝ መከታተል፦</b> የትዕዛዝዎን ሁኔታ በማንኛውም ሰዓት በስልክ ቁጥርዎ ወይም በቲኬት ቁጥርዎ ለማየት <b>"የእኔ ትዕዛዞች"</b> የሚለውን ይጫኑ ወይም በስልክ ቁጥርዎ ይፈልጉ።`,
          inlineKeyboard: [
            [
              { text: '👗 Shein አፕ (ዳውንሎድ)', action: 'link_shein' },
              { text: '🛍️ Temu አፕ (ዳውንሎድ)', action: 'link_temu' },
              { text: '📦 AliExpress አፕ (ዳውንሎድ)', action: 'link_ali' },
            ],
            [
              { text: '📸 ስክሪንሾት ላክ', action: 'prompt_upload_screenshot' },
              { text: '🔗 ሊንክ አስገባ', action: 'prompt_paste_link' },
            ],
            [
              { text: '💬 ሰራተኛ እዚህ በቦቱ አናግር', action: 'chat_worker' },
              { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
            ],
          ],
        },
      ]);
      return;
    }

    // Quick Checkout Actions
    if (action === 'quick_phone_0911') {
      advanceToLandmarkStep('0911234567');
      return;
    }
    if (action === 'quick_phone_0922') {
      advanceToLandmarkStep('0922889900');
      return;
    }
    if (action === 'quick_landmark_bole') {
      advanceToOptionsStep('ቦሌ መድኃኔዓለም ከአትላስ ሆቴል አጠገብ', 'ቦሌ');
      return;
    }
    if (action === 'quick_landmark_meganagna') {
      advanceToOptionsStep('መገናኛ ማራቶን ህንጻ አጠገብ', 'የካ');
      return;
    }
    if (action === 'quick_landmark_piassa') {
      advanceToOptionsStep('ፒያሳ ቴሌ አጠገብ ካቴድራል ፊት ለፊት', 'አራዳ');
      return;
    }
    if (action === 'opt_size_m') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'Size M (ሚዲየም)');
      return;
    }
    if (action === 'opt_size_l') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'Size L (ላርጅ)');
      return;
    }
    if (action === 'opt_size_42') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'Size 42 (ጫማ)');
      return;
    }
    if (action === 'opt_color_black') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'ጥቁር ቀለም (Black)');
      return;
    }
    if (action === 'opt_color_white') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'ነጭ ቀለም (White)');
      return;
    }
    if (action === 'opt_skip') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, 'መደበኛ (Standard / No choice)');
      return;
    }
    if (action === 'cancel_order') {
      setOrderCheckoutStep('IDLE');
      setAwaitingDetailsFor(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-cancel-${Date.now()}`,
          sender: 'bot',
          timestamp: timeStr,
          text: '❌ <b>ትዕዛዝዎ ተሰርዟል፤ ወደ ዋና ማውጫ ተመልሰዋል።</b>',
          inlineKeyboard: [[{ text: '🏠 ወደ ዋና ገጽ', action: 'return_main' }]],
        },
      ]);
      return;
    }

    if (action === 'track_order' || action === 'my_orders') {
      if (onNavigateToOrders) {
        onNavigateToOrders(checkoutPhone || undefined);
      }
      return;
    }
  };

  // Submit product chosen by customer to worker for price estimation
  // "remove the price estimation. Rather, once the customer chooses the product, they will link to the worker and the worker will estimate the price based on the link/screenshot provided. (Add 'ዋጋውን በ5 ደቂቃ ውስጥ አስልተን እናሳውቅዎታለን' when they submit the screenshot/link)"
  const submitCustomerProductToWorker = (
    product: ParsedProduct,
    submissionType: 'screenshot' | 'link'
  ) => {
    const ticketId = `KORCHA-${Math.floor(100000 + Math.random() * 900000)}`;
    setPendingTicket({ product, ticketId });
    setLastQuotedProduct(product);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageText =
      submissionType === 'screenshot'
        ? `📸 <b>ስክሪንሾቱ ደርሶናል!</b>\n\n` +
          `📝 <b>መግለጫ፦</b> የእቃ ፎቶ/ስክሪንሾት\n` +
          `🎫 <b>መለያ ቁጥር፦</b> <code>#${ticketId}</code>\n\n` +
          `የሚያስተናግዶት ሠራተኛ የእቃዉን ዋጋ አስልቶ በጥቂት ደቂቃዎች ዉስጥ ያሳውቅዎታል።`
        : `🔗 <b>የእቃው ሊንክ ደርሶናል!</b>\n\n` +
          `📦 <b>እቃ፦</b> ${product.titleAmharic || product.title}\n` +
          `🌐 <b>ገበያ፦</b> ${product.marketplace.toUpperCase()}\n` +
          `🎫 <b>መለያ ቁጥር፦</b> <code>#${ticketId}</code>\n\n` +
          `የሚያስተናግዶት ሠራተኛ የእቃዉን ዋጋ አስልቶ በጥቂት ደቂቃዎች ዉስጥ ያሳውቅዎታል።`;

    const pendingNoticeMsg: TelegramBotMessage = {
      id: `bot-notice-${Date.now()}`,
      sender: 'bot',
      timestamp: timeStr,
      photoUrl: product.imageUrl,
      text: messageText,
      inlineKeyboard: [
        [
          {
            text: '💬 ከሰራተኛው ጋር ይገናኙ (Talk to Worker)',
            url: `https://t.me/korcha_support?start=quote_${ticketId}`,
          },
        ],
        [
          {
            text: '⚡ ሰራተኛው ዋጋውን ላከ (Simulate Worker Response)',
            action: 'deliver_worker_quote',
            style: 'success',
          },
          { text: '🏠 ወደ ዋና ገጽ', action: 'return_main' },
        ],
      ],
    };

    setMessages((prev) => [...prev, pendingNoticeMsg]);

    // Simulate realistic worker calculation and delivery
    setTimeout(() => {
      deliverWorkerQuote(product, ticketId);
    }, 3500);
  };

  // Deliver the verified quote estimated by worker
  const deliverWorkerQuote = (parsedProduct: ParsedProduct, ticketId: string) => {
    setLastQuotedProduct(parsedProduct);
    setPendingTicket(null);
    setAwaitingPriceEdit(false);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const pricing = calculateDoorstepPricing(parsedProduct.originalPriceUsd);

    const quoteItem = {
      product: parsedProduct,
      quantity: 1,
      selectedSize: parsedProduct.availableSizes[0] || 'Standard',
      selectedColor: parsedProduct.availableColors[0] || 'Default',
      pricing,
    };

    const quoteMsg: TelegramBotMessage = {
      id: `bot-quote-${Date.now()}`,
      sender: 'bot',
      timestamp: timeStr,
      photoUrl: parsedProduct.imageUrl,
      text:
        `📋 <b>የሰራተኛው የተረጋገጠ የደጃፍ ዋጋ ስሌት (Worker Quote)</b>\n\n` +
        `📦 <b>እቃ፦</b> ${parsedProduct.title}\n` +
        `🏬 <b>ምንጭ፦</b> ${parsedProduct.marketplace.toUpperCase()} | 🏷️ <b>ቲኬት፦</b> <code>#${ticketId}</code>\n` +
        `⚖️ <b>የእቃው ክብደት፦</b> ~${pricing.cargoWeightKg || 0.4} ኪ.ግ (እስከ 50×50 ሳ.ሜ)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>ጠቅላላ የደጃፍ ዋጋ፦ ${pricing.totalPriceEtb.toLocaleString()} ብር (ETB)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔹 <b>አሁን የሚከፈል ${pricing.depositPercent || 40}% ቅድመ ክፍያ፦</b> <b>${pricing.depositAmountEtb.toLocaleString()} ብር</b> (በቴሌብር ወይም በ CBE)\n` +
        `🔹 <b>ቀሪ ${pricing.codPercent || 60}% እቃው በርዎ ሲደርስ (COD)፦</b> ${pricing.codAmountEtb.toLocaleString()} ብር\n\n` +
        `✈️ <b>የማድረሻ ጊዜ፦</b> ከ 10 እስከ 14 የስራ ቀናት (በአየር ጭነት እስከ ደጃፍዎ)\n\n` +
        `ይህን እቃ ለማዘዝ ከታች ያለውን <b>አሁን እዘዝ (Order Now)</b> ይጫኑ፦`,
      quoteCard: quoteItem,
      inlineKeyboard: [
        [
          { text: '✅ አሁን እዘዝ (Order Now)', action: 'agree_and_order', style: 'success' },
          { text: '💬 እዚህ በቦቱ ሰራተኛ ያነጋግሩ', action: 'chat_worker' },
        ],
        [
          { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
        ],
      ],
    };

    setMessages((prev) => [...prev, quoteMsg]);
  };

  // Multi-Step Order Flow matching telegram_korcha bot
  // Step 1: Prompt for Phone number
  const startCheckoutFlow = (itemPayload: any) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAwaitingDetailsFor(itemPayload);
    setOrderCheckoutStep('AWAITING_PHONE');

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        sender: 'user',
        timestamp: timeStr,
        text: '✅ ውሎችን ተስማምቻለሁ፤ ማዘዝ እፈልጋለሁ (Order Now)',
      },
      {
        id: `bot-order-step1-${Date.now()}`,
        sender: 'bot',
        timestamp: timeStr,
        text:
          `📦 <b>ትዕዛዝ ማረጋገጫ (Step 1/2)</b>\n\n` +
          `የመረጡት እቃ፦ <b>${itemPayload.product.title}</b>\n` +
          `የ ${itemPayload.pricing?.depositPercent || 40}% ቅድመ ክፍያ፦ <b>${itemPayload.pricing.depositAmountEtb.toLocaleString()} ብር</b>\n\n` +
          `እባክዎን <b>ስልክ ቁጥርዎን</b> ያስገቡ፦\n<i>(ምሳሌ፦ 0911234567)</i>`,
        inlineKeyboard: [
          [
            { text: '📞 0911234567 ተጠቀም', action: 'quick_phone_0911' },
            { text: '📞 0922889900 ተጠቀም', action: 'quick_phone_0922' },
          ],
          [
            { text: '🔙 ሰርዝና ወደ ዋና ማውጫ ተመለስ', action: 'cancel_order' },
          ],
        ],
      },
    ]);
  };

  // Step 2: Prompt for Landmark / Delivery Address
  const advanceToLandmarkStep = (phone: string) => {
    setCheckoutPhone(phone);
    setOrderCheckoutStep('AWAITING_LANDMARK');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-phone-${Date.now()}`,
        sender: 'user',
        timestamp: timeStr,
        text: `📱 ስልክ ቁጥር፦ ${phone}`,
      },
      {
        id: `bot-order-step2-${Date.now()}`,
        sender: 'bot',
        timestamp: timeStr,
        text:
          `📍 <b>የመዳረሻ አድራሻ (Step 2/3 - አድራሻ)</b>\n\n` +
          `እባክዎን <b>የመዳረሻ ምልክት (Landmark) ወይም ክፍለ ከተማ</b> ይጻፉ፦\n` +
          `<i>(ምሳሌ፦ ቦሌ መድኃኔዓለም ወይም መገናኛ ማራቶን ህንጻ አጠገብ)</i>`,
        inlineKeyboard: [
          [
            { text: '📍 ቦሌ መድኃኔዓለም (አ.አ)', action: 'quick_landmark_bole' },
            { text: '📍 መገናኛ ማራቶን (አ.አ)', action: 'quick_landmark_meganagna' },
          ],
          [
            { text: '📍 ፒያሳ ቴሌ አጠገብ (አ.አ)', action: 'quick_landmark_piassa' },
            { text: '🔙 ሰርዝና ተመለስ', action: 'cancel_order' },
          ],
        ],
      },
    ]);
  };

  // Step 3: Prompt for Size, Color & Other Choices
  const advanceToOptionsStep = (landmark: string, subcity: string = 'ቦሌ') => {
    setCheckoutLandmark(landmark);
    setCheckoutSubcity(subcity);
    setOrderCheckoutStep('AWAITING_OPTIONS');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-lm-${Date.now()}`,
        sender: 'user',
        timestamp: timeStr,
        text: `📍 መዳረሻ፦ ${landmark} (${subcity})`,
      },
      {
        id: `bot-order-step3-${Date.now()}`,
        sender: 'bot',
        timestamp: timeStr,
        text:
          `🎨 <b>የእቃው ዝርዝር ምርጫ (Step 3/3 - Size, Color & Choices)</b>\n\n` +
          `እባክዎን የሚፈልጉትን <b>መጠን (Size)</b>፣ <b>ቀለም (Color)</b> ወይም <b>ተጨማሪ ምርጫ</b> ይምረጡ ወይም ይጻፉልን፦\n` +
          `<i>(ምሳሌ፦ "መጠን 42፣ ጥቁር ቀለም" ወይም "Size L, Red Color")</i>`,
        inlineKeyboard: [
          [
            { text: '📏 Size M (ሚዲየም)', action: 'opt_size_m' },
            { text: '📏 Size L (ላርጅ)', action: 'opt_size_l' },
            { text: '📏 Size 42 (ጫማ)', action: 'opt_size_42' },
          ],
          [
            { text: '🎨 ጥቁር ቀለም (Black)', action: 'opt_color_black' },
            { text: '🎨 ነጭ ቀለም (White)', action: 'opt_color_white' },
          ],
          [
            { text: '⏩ ያለ ተጨማሪ ምርጫ ቀጥል (Skip)', action: 'opt_skip' },
            { text: '🔙 ሰርዝና ተመለስ', action: 'cancel_order' },
          ],
        ],
      },
    ]);
  };

  // Finalize Order and display payment instructions
  const handleFinalizeOrder = (phone: string, landmark: string, subcity: string = 'ቦሌ', options: string = 'መደበኛ (Standard)') => {
    setOrderCheckoutStep('IDLE');
    submitFinalOrder({
      customerName: 'የኮርቻ ደንበኛ',
      customerPhone: phone,
      deliveryCity: 'አዲስ አበባ',
      deliverySubcity: subcity,
      deliveryLandmark: landmark,
      options,
    });
  };

  const submitFinalOrder = (customerDetails: {
    customerName: string;
    customerPhone: string;
    deliveryCity: string;
    deliverySubcity: string;
    deliveryLandmark: string;
    options?: string;
  }) => {
    if (!awaitingDetailsFor) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orderNumber = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
    const chosenOptions = customerDetails.options || 'መደበኛ (Standard / Link default)';

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName: customerDetails.customerName,
      customerPhone: customerDetails.customerPhone,
      customerTelegramUser: '@ethio_customer',
      customerTelegramId: '89104829',
      deliveryCity: customerDetails.deliveryCity,
      deliverySubcity: customerDetails.deliverySubcity,
      deliveryLandmark: customerDetails.deliveryLandmark,
      notes: chosenOptions,
      item: {
        product: awaitingDetailsFor.product,
        quantity: awaitingDetailsFor.quantity,
        selectedSize: chosenOptions.includes('Size') ? chosenOptions : (awaitingDetailsFor.size || 'M'),
        selectedColor: chosenOptions.includes('ቀለም') || chosenOptions.includes('Color') ? chosenOptions : (awaitingDetailsFor.color || 'Original'),
        pricing: awaitingDetailsFor.pricing || calculateDoorstepPricing(awaitingDetailsFor.product.originalPriceUsd),
      },
      termsAgreed: true,
      termsAgreedAt: new Date().toISOString(),
      depositStatus: 'pending_verification',
      status: 'pending_deposit',
      workerNotified: true,
    };

    onNewOrderPlaced(newOrder);
    setAwaitingDetailsFor(null);

    const confirmationMsg: TelegramBotMessage = {
      id: `bot-conf-${Date.now()}`,
      sender: 'bot',
      timestamp: timeStr,
      text:
        `🎉 <b>ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!</b>\n\n` +
        `📦 <b>የትዕዛዝ ቁጥር፦</b> <code>#${orderNumber}</code>\n` +
        `🛍️ <b>እቃ፦</b> ${newOrder.item.product.title}\n` +
        `🎨 <b>የተመረጠ መጠንና ቀለም፦</b> <b>${chosenOptions}</b>\n` +
        `💰 <b>ጠቅላላ የደጃፍ ዋጋ፦</b> ${newOrder.item.pricing.totalPriceEtb.toLocaleString()} ብር\n` +
        `💳 <b>መከፈል ያለበት ${newOrder.item.pricing.depositPercent || 40}% ቅድመ ክፍያ፦</b> <b>${newOrder.item.pricing.depositAmountEtb.toLocaleString()} ብር</b>\n` +
        `🚚 <b>ቀሪ ${newOrder.item.pricing.codPercent || 60}% ሲደርስ የሚከፈል፦</b> ${newOrder.item.pricing.codAmountEtb.toLocaleString()} ብር\n\n` +
        `📍 <b>የማድረሻ አድራሻ፦</b> ${newOrder.deliveryCity}፣ ${newOrder.deliverySubcity} (${newOrder.deliveryLandmark})\n` +
        `📞 <b>ስልክ፦</b> ${newOrder.customerPhone}\n\n` +
        `✈️ <b>የማድረሻ ጊዜ፦</b> ከ 10 እስከ 14 የስራ ቀናት ውስጥ በርዎ ይደርሳል!\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📲 <b>የቅድመ ክፍያ መመሪያ (Payment Steps)፦</b>\n` +
        `1. ከታች ያለውን የ <b>ቴሌብር (Telebirr)</b> ወይም <b>CBE</b> QR ኮድ ስካን ያድርጉ\n` +
        `2. ወይም በቴሌብር ቁጥር <code>+251-996237800</code> ወይም በ CBE <code>10001116390</code> የ ${newOrder.item.pricing.depositPercent || 40}% ቅድመ ክፍያ ይላኩ\n` +
        `3. ክፍያውን እንደፈጸሙ የክፍያ ደረሰኝ (Screenshot) እዚህ በቦቱ ይላኩልን።`,
      orderConfirmation: newOrder,
      inlineKeyboard: [
        [
          { text: '📱 የ QR ኮድ ጀነሬተር (Show QR)', action: 'show_payment_qr' },
          { text: '🧾 ደረሰኝ እዚህ በቦቱ ላክ', action: 'send_payment_proof' },
        ],
        [
          { text: '💬 ስለ ትዕዛዙ እዚህ በቦቱ ጠይቅ', action: 'chat_worker' },
          { text: '📦 ትዕዛዜን ተከታተል (Track Order)', action: 'track_order' },
        ],
        [
          { text: '🏠 ወደ ዋና ገጽ (Return to Main)', action: 'return_main' },
        ],
      ],
    };

    setMessages((prev) => [...prev, confirmationMsg]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputVal.trim()) return;

    const text = inputVal.trim();
    setInputVal('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        sender: 'user',
        timestamp: timeStr,
        text,
      },
    ]);

    // Handle cancel command
    if (/^(ተመለስ|ሰርዝ|cancel|back|main menu|ወደ ዋና ማውጫ)$/i.test(text)) {
      setOrderCheckoutStep('IDLE');
      setAwaitingDetailsFor(null);
      setTimeout(() => initWelcome(), 200);
      return;
    }

    // Step 1: Handle phone input during order checkout
    if (orderCheckoutStep === 'AWAITING_PHONE') {
      const cleanPhone = text.replace(/[\s-]/g, '');
      const phoneMatch = cleanPhone.match(/(?:\+251|0)?9\d{8}|(?:\+251|0)?7\d{8}/)?.[0] || cleanPhone;
      advanceToLandmarkStep(phoneMatch);
      return;
    }

    // Step 2: Handle landmark input during order checkout -> advance to Size/Color options
    if (orderCheckoutStep === 'AWAITING_LANDMARK') {
      advanceToOptionsStep(text, 'ቦሌ');
      return;
    }

    // Step 3: Handle Size, Color or Other choices entered by customer
    if (orderCheckoutStep === 'AWAITING_OPTIONS') {
      handleFinalizeOrder(checkoutPhone || '0911234567', checkoutLandmark || 'አዲስ አበባ', checkoutSubcity, text);
      return;
    }

    // Fallback if legacy awaitingDetailsFor is set
    if (awaitingDetailsFor) {
      handleFinalizeOrder('0911234567', text, 'ቦሌ', 'መደበኛ');
      return;
    }

    // Check Guide / Help commands (መመሪያ)
    if (
      text === '/help' ||
      text === '/guide' ||
      text.toLowerCase() === 'help' ||
      text.toLowerCase() === 'guide' ||
      text.includes('መመሪያ') ||
      text.includes('አጠቃቀም') ||
      text.includes('እንዴት ልዘዝ')
    ) {
      setTimeout(() => handleAction('show_guide'), 200);
      return;
    }

    // Fallback if legacy awaitingDetailsFor is set
    if (awaitingDetailsFor) {
      handleFinalizeOrder('0911234567', text);
      return;
    }

    // Check Start / Return to Main commands
    if (
      text === '/start' ||
      text === '/main' ||
      text === '/menu' ||
      text.toLowerCase() === 'start' ||
      text.toLowerCase() === 'main' ||
      text.includes('ዋና ገጽ')
    ) {
      setTimeout(() => initWelcome(), 300);
      return;
    }

    // Check Track / My Orders commands
    if (
      text === '/track' ||
      text === '/orders' ||
      text === '/myorders' ||
      text.toLowerCase().includes('track') ||
      text.includes('ትዕዛዝ') ||
      text.includes('ክትትል')
    ) {
      if (onNavigateToOrders) {
        onNavigateToOrders();
        return;
      }
    }

    // Direct worker chat request
    if (text.includes('አስተናጋጅ') || text.includes('ሰራተኛ') || text.toLowerCase().includes('worker') || text.toLowerCase().includes('chat') || text.includes('እገዛ')) {
      setTimeout(() => handleAction('chat_worker'), 300);
      return;
    }

    // Direct screenshot request
    if (text.includes('ስክሪንሾት') || text.toLowerCase().includes('screenshot')) {
      setTimeout(() => handleAction('prompt_upload_screenshot'), 300);
      return;
    }

    // Default: parse link or product text and submit to worker for quote
    setTimeout(() => {
      const parsedProduct = parseMarketplaceLink(text);
      submitCustomerProductToWorker(parsedProduct, 'link');
    }, 400);
  };

  const copySampleLinkToInput = (url: string, id: string) => {
    setInputVal(url);
    setCopiedId(id);
    navigator.clipboard?.writeText(url);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* 🌟 Attractive Frontpage Hero Banner with User's Exact Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-10">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">
              ኮርቻ (Korcha) • ከቻይና እቃዎች ወደ ኢትዮጵያ
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 10 - 14 ቀናት በርዎ ድረስ
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
            ውድ ደንበኛችን እንኳን ወደ ኮርቻ መጡ።
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            በኮርቻ በመጠቀም ከቻይና እቃዎችን ማስመጣት ይችላሉ። <b>3 ሂደቶችን ብቻ ይጠቀሙ:</b>
          </p>

          {/* 3 Step Visual Cards with Real Photography */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Step 1: Select Items from various places */}
            <div className="group rounded-2xl bg-slate-950/80 border border-slate-800/90 overflow-hidden hover:border-amber-500/50 transition-all shadow-lg flex flex-col">
              <div className="h-32 w-full overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80"
                  alt="Select products from online stores"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <span className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                  1
                </span>
                <span className="absolute bottom-2 left-3 text-[11px] font-bold text-amber-300">
                  Shein • Temu • AliExpress
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-sm font-bold text-white">ዕቃ ከተለያዩ ቦታዎች ይምረጡ</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    የሚፈልጉትን ማንኛውንም ፋሽን፣ ቴክኖሎጂ ወይም የቤት እቃ በሱቆቹ ውስጥ ይምረጡ።
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <a
                    href={getSmartMarketplaceUrl('shein')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-pink-300 hover:text-white underline decoration-pink-500/50"
                    title="Download Shein App (Play Store / App Store)"
                  >
                    📲 Shein App
                  </a>
                  <span className="text-slate-600">·</span>
                  <a
                    href={getSmartMarketplaceUrl('temu')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-orange-300 hover:text-white underline decoration-orange-500/50"
                    title="Download Temu App (Play Store / App Store)"
                  >
                    📲 Temu App
                  </a>
                  <span className="text-slate-600">·</span>
                  <a
                    href={getSmartMarketplaceUrl('aliexpress')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-red-300 hover:text-white underline decoration-red-500/50"
                    title="Download AliExpress App (Play Store / App Store)"
                  >
                    📲 AliExpress App
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2: Link or Screenshot */}
            <div className="group rounded-2xl bg-slate-950/80 border border-slate-800/90 overflow-hidden hover:border-sky-500/50 transition-all shadow-lg flex flex-col">
              <div className="h-32 w-full overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&auto=format&fit=crop&q=80"
                  alt="Product link or screenshot"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <span className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                  2
                </span>
                <span className="absolute bottom-2 left-3 text-[11px] font-bold text-sky-300">
                  Link ወይም Screenshot
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-sm font-bold text-white">ሊንክ ወይንም ፎቶ ያስገቡ</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    የመረጡትን ዕቃ ሊንክ ወይንም ፎቶ (screenshot) ወደ መተግበሪያው ያስገቡ።
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleAction('prompt_upload_screenshot')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" /> ስክሪንሾት
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    onClick={() => handleAction('prompt_paste_link')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <LinkIcon className="w-3 h-3" /> ሊንክ
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: 25% Advance & 75% on Delivery */}
            <div className="group rounded-2xl bg-slate-950/80 border border-slate-800/90 overflow-hidden hover:border-emerald-500/50 transition-all shadow-lg flex flex-col">
              <div className="h-32 w-full overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80"
                  alt="Air cargo doorstep delivery"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <span className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                  3
                </span>
                <span className="absolute bottom-2 left-3 text-[11px] font-bold text-emerald-300">
                  {advancePercent}% ቅድመ ክፍያ • {codPercent}% በር ላይ
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{advancePercent}% ከፍለው ይዘዙ፤ 10-14 ቀናት እጅዎ ይገባል</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    ዋጋው ሲቀመጥልዎት {advancePercent}% በመክፈል ይዘዙን። ዕቃው ከ10 እስከ 14 ባለው ቀናት ውስጥ እጅዎ ይገባል። ቤትዎ ሲደርስ ቀሪዎን {codPercent}% ይከፍላሉ።
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-400 font-medium">
                  <Plane className="w-3 h-3" /> በአየር ጭነት እስከ ደጃፍዎ
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>እገዛ ከፈለጉ እኛን ያናግሩን። የፈለጉትን ይሸምቱ። <b>መልካም ገበያ!</b></span>
            </div>

            <a
              href="https://t.me/korcha_support"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold transition-colors cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>💬 ከአስተናጋጅ ጋር አውራ (@korcha_support)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Interactive Row: Simulator + Attractive Visual Cards */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Telegram Bot Simulator */}
        <div className={`flex-1 flex flex-col items-center justify-center transition-all ${isPhoneFrame ? 'py-2' : ''}`}>
          <div
            className={`w-full bg-[#0e1621] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all ${
              isPhoneFrame ? 'max-w-[400px] h-[780px] border-4 border-slate-700' : 'max-w-2xl h-[700px]'
            }`}
          >
            {/* Telegram Header */}
            <div className="bg-[#17212b] px-4 py-3 border-b border-slate-800 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 via-amber-700 to-amber-900 border border-amber-500/40 flex items-center justify-center font-black text-white shadow-md p-1.5">
                    <KorchaSaddleIcon className="w-6 h-6 text-amber-300 drop-shadow" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#17212b]" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm tracking-wide text-white">Korcha Bot (ኮርቻ)</h3>
                    <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 font-semibold rounded border border-amber-500/30">
                      BOT
                    </span>
                    <span className="text-xs">🇪🇹</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    China to Ethiopia Shopping Assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <a
                  href="https://t.me/korchaetbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors cursor-pointer"
                  title="በእውነተኛው ቴሌግራም ክፈት (Open in real Telegram App)"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">በቴሌግራም ክፈት</span>
                </a>

                <button
                  onClick={initWelcome}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                  title="Return to Main / Restart (/start)"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ዋና ገጽ</span>
                </button>

                <button
                  onClick={() => setIsPhoneFrame(!isPhoneFrame)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title={isPhoneFrame ? 'Expand View' : 'Phone Frame View'}
                >
                  {isPhoneFrame ? <Maximize2 className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </button>

                <button
                  onClick={initWelcome}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Restart Chat (/start)"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Telegram Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#0e1621] via-[#111923] to-[#0e1621]">
              {messages.map((msg) => {
                const isBot = msg.sender === 'bot';

                return (
                  <div key={msg.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-3.5 shadow-md ${
                        isBot
                          ? 'bg-[#182533] text-slate-100 rounded-tl-sm border border-slate-800/80'
                          : 'bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-tr-sm shadow-amber-600/20'
                      }`}
                    >
                      {/* Optional Product Photo in Bot Message */}
                      {msg.photoUrl && (
                        <div className="relative mb-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 group">
                          <img
                            src={msg.photoUrl}
                            alt="Product preview"
                            className="w-full h-44 object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                            {msg.quoteCard?.product.marketplace || 'Product'}
                          </div>
                        </div>
                      )}

                      {/* Message Body */}
                      <div
                        className="text-xs sm:text-sm leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      />

                      {/* Embedded Dynamic QR Code if this is an Order Confirmation */}
                      {msg.orderConfirmation && (
                        <div className="mt-3">
                          <PaymentQRCode
                            amountEtb={msg.orderConfirmation.item.pricing.depositAmountEtb}
                            orderNumber={msg.orderConfirmation.orderNumber}
                          />
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        {!isBot && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      </div>
                    </div>

                    {/* Inline Keyboards */}
                    {msg.inlineKeyboard && (
                      <div className="mt-2 w-full max-w-[88%] sm:max-w-[80%] flex flex-col gap-1.5">
                        {msg.inlineKeyboard.map((row, rIdx) => (
                          <div key={rIdx} className="flex flex-wrap gap-1.5">
                            {row.map((btn, bIdx) => {
                              // If this button is an external URL rerouting
                              if (btn.url) {
                                return (
                                  <a
                                    key={bIdx}
                                    href={btn.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-[120px] py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all shadow-sm bg-[#242f3d] hover:bg-[#2b3749] text-sky-400 hover:text-white border border-slate-700/60 flex items-center justify-center gap-1.5"
                                  >
                                    <span>{btn.text}</span>
                                    <ExternalLink className="w-3 h-3 text-amber-400 shrink-0" />
                                  </a>
                                );
                              }

                              return (
                                <button
                                  key={bIdx}
                                  onClick={() => {
                                    if (!btn.action) return;
                                    if (btn.action === 'agree_and_order' && msg.quoteCard) {
                                      handleAction(btn.action, msg.quoteCard);
                                    } else if (btn.action === 'quick_addr_bole') {
                                      handleFinalizeOrder('0911234567', 'ቦሌ መድኃኒዓለም ከአብሲኒያ ባንክ ጀርባ', 'ቦሌ');
                                    } else if (btn.action === 'quick_addr_piassa') {
                                      handleFinalizeOrder('0922345678', 'ፒያሳ ቴሌ አጠገብ', 'አራዳ');
                                    } else if (btn.action === 'quick_addr_cmc') {
                                      handleFinalizeOrder('0711998877', 'ሲኤምሲ ሚካኤል ኖህ ሪል እስቴት', 'የካ');
                                    } else {
                                      handleAction(btn.action);
                                    }
                                  }}
                                  className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all shadow-sm cursor-pointer ${
                                    btn.style === 'success'
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-emerald-900/30'
                                      : 'bg-[#242f3d] hover:bg-[#2b3749] text-sky-400 border border-slate-700/60'
                                  }`}
                                >
                                  {btn.text}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Persistent Quick Action Chips: Start, Return to Main, Upload Screenshot, Paste Link, Worker Chat */}
            <div className="bg-[#17212b]/95 border-t border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={initWelcome}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                title="Return to Main Menu"
              >
                <Home className="w-3 h-3 text-amber-400" />
                <span>🏠 ዋና ገጽ</span>
              </button>

              <button
                onClick={() => handleAction('show_guide')}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                title="Help & Ordering Guide"
              >
                <BookOpen className="w-3 h-3 text-purple-400" />
                <span>📖 መመሪያ (Help)</span>
              </button>

              <button
                onClick={() => handleAction('prompt_upload_screenshot')}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <Camera className="w-3 h-3 text-sky-400" />
                <span>📸 ስክሪንሾት ላክ</span>
              </button>

              <button
                onClick={() => handleAction('prompt_paste_link')}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <LinkIcon className="w-3 h-3 text-indigo-400" />
                <span>🔗 ሊንክ አስገባ</span>
              </button>

              {onNavigateToOrders && (
                <button
                  onClick={() => onNavigateToOrders()}
                  className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                  title="My Orders & Tracking"
                >
                  <Package className="w-3 h-3 text-emerald-400" />
                  <span>📦 ትዕዛዞቼ (My Orders)</span>
                </button>
              )}

              <a
                href="https://t.me/korcha_support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center gap-1 font-medium"
              >
                <MessageCircle className="w-3 h-3 text-emerald-400" />
                <span>💬 ከአስተናጋጅ ጋር አውራ</span>
              </a>
            </div>

            {/* Input Bar with Screenshot Upload & Text */}
            <form
              onSubmit={handleSendMessage}
              className="bg-[#17212b] border-t border-slate-800 p-2.5 flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleScreenshotUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-xl bg-[#242f3d] hover:bg-[#2b3749] text-sky-400 hover:text-white border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="ስክሪንሾት ወይም ፎቶ ጫን (Upload Screenshot)"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Paste product link, or type start..."
                className="flex-1 bg-[#242f3d] text-white text-xs sm:text-sm placeholder-slate-400 px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold flex items-center justify-center transition-all shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: High Quality Attractive Visual Cards (Link for Link, Screenshot for Screenshot) */}
        <div className="w-full lg:w-96 flex flex-col gap-5">
          {/* 🔗 Card: Link for Link with Visual Photography */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
            <div className="h-32 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop&q=80"
                alt="Copy product link"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <div className="absolute bottom-2.5 left-4 flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-amber-500 text-slate-950">
                  <LinkIcon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-white">🔗 ሊንክ መቅጃና መላኪያ (Link for Link)</span>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                የመረጡትን እቃ <b>Share ➔ Copy Link</b> አድርገው እዚህ ይላኩ፤ ወዲያውኑ የበር ላይ ዋጋ እና የ {advancePercent}% ቅድመ ክፍያ ያገኛሉ።
              </p>

              {/* Sample 1-Click Link Testers */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  የናሙና ሊንኮች (1-Click Test Links):
                </span>
                {SAMPLE_PRODUCTS.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-xs text-white font-semibold truncate">
                        <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-800 text-amber-400">
                          {item.marketplace}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ${item.originalPriceUsd} USD
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copySampleLinkToInput(item.url, item.id)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                        title="Copy to input"
                      >
                        {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => submitCustomerProductToWorker(item, 'link')}
                        className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer"
                        title="Send link to bot"
                      >
                        ላክ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 📸 Card: Screenshot for Screenshot with Visual Photography */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
            <div className="h-32 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=800&auto=format&fit=crop&q=80"
                alt="Product screenshot"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              <div className="absolute bottom-2.5 left-4 flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-sky-500 text-slate-950">
                  <Camera className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-black text-white">📸 ስክሪንሾት ማንበቢያ (Screenshot for Screenshot)</span>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                የመረጡትን እቃ ፎቶ ወይም ስክሪንሾት ሲልኩ፡ ሰራተኛችን እቃውን በዝቅተኛ ዋጋ ካለው ገበያ (በተለይ ከShein) በመፈለግ <b>ዋጋውን በ5 ደቂቃ ውስጥ አስልቶ ያሳውቅዎታል።</b>
              </p>

              {/* Upload CTA Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>ስክሪንሾት ለመጫን እዚህ ይጫኑ (Upload)</span>
              </button>

              {/* 1-Click Sample Screenshot Testers */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  የናሙና ስክሪንሾቶች (Click to Test):
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {SAMPLE_SCREENSHOTS.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleTestSampleScreenshot(sample)}
                      className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 flex flex-col items-center gap-1 text-center transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800">
                        <img
                          src={sample.imgUrl}
                          alt={sample.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-300 truncate w-full">
                        {sample.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ✈️ Card: 10 - 14 Days Doorstep Delivery */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Plane className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">ከ 10 እስከ 14 ቀናት እጅዎ ይገባል</h4>
                <p className="text-[11px] text-slate-400">Doorstep Delivery in Addis & Nationwide</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              እቃዎ በአየር ጭነት ከ10 እስከ 14 ባለው ቀናት ውስጥ እጅዎ ይገባል። ቤትዎ ሲደርስ ቀሪዎን 75% ይከፍላሉ።
            </p>

            <a
              href="https://t.me/korcha_support"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>💬 ከአስተናጋጅ ጋር አውራ (እገዛ)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
