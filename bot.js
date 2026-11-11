// korcha/bot.js: Full-Featured Express Backend & Telegram Bot for telegram.korcha.com.et
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, Markup, session } from 'telegraf';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  runMigrations,
  upsertCustomer,
  createQuote,
  getQuoteByCode,
  getQuotesByPhone,
  resolveTrackingTarget,
  createOrder,
  getOrderByCode,
  getOrdersByPhone,
  getPendingQuotes,
  getPendingOrders,
  updateQuotePrice,
  getAllConversationsForWorker,
  updateOrderStatus,
  recordCustomerPing,
  recordOrderLookup,
  respondToCustomerPing,
  getCustomerPings,
  addTicketMessage,
  getTicketMessages,
  getLatestCustomerTicketByTelegramId,
  getCustomerConversations,
  getShelfProducts,
  getBestSellerProducts,
  addShelfProduct,
  updateShelfProduct,
  deleteShelfProduct,
  getShelfCategories,
  updateShelfCategory,
  createMerchantSubmission,
  getMerchantSubmissions,
  getAllMerchantSubmissionsForWorker,
  approveMerchantSubmissionToShelf,
  addWorkerNote,
  getOrderDossier,
  closePool,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// Configs
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;
const WORKER_USERNAME = (process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support').replace(/^@/, '');
const TELEBIRR_PHONE = process.env.TELEBIRR_PHONE || '+251-996237800';
const CBE_ACCOUNT = process.env.CBE_ACCOUNT || '10001116390';
const PORT = process.env.PORT || 3000;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://telegram.korcha.com.et';
const AUTO_TRACKING_RESPONSE = 'ዕቃዎ የደረሰበትን ቦታ/ሁኔታ ሰራተኛችኝ ያሳውቅዎታል። ትንሽ ይጠብቁ።';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeEthiopianPhone(phoneInput) {
  if (!phoneInput) return null;
  let digits = String(phoneInput).trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+251')) digits = digits.slice(4);
  else if (digits.startsWith('251')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  if (/^(9|7)\d{8}$/.test(digits)) return '0' + digits;
  return null;
}

function isValidEthiopianPhone(phone) {
  return Boolean(normalizeEthiopianPhone(phone));
}

const AUTHORIZED_WORKERS = [
  'korcha_support',
  'hailegiorgisy',
  WORKER_USERNAME.toLowerCase()
];

function isAuthorizedWorkerUsername(username) {
  if (!username) return false;
  const clean = String(username).replace(/^@/, '').trim().toLowerCase();
  return AUTHORIZED_WORKERS.includes(clean);
}

function isWorkerContext(ctx) {
  const username = ctx.from?.username;
  const chatId = String(ctx.chat?.id || '');
  const userId = String(ctx.from?.id || '');
  return isAuthorizedWorkerUsername(username) || 
         (WORKER_CHAT_ID && (chatId === String(WORKER_CHAT_ID) || userId === String(WORKER_CHAT_ID)));
}

const userSessions = new Map();
function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { state: 'IDLE', data: {}, activeTicket: null });
  }
  return userSessions.get(userId);
}
function clearSession(userId) {
  const existing = userSessions.get(userId);
  userSessions.set(userId, { state: 'IDLE', data: {}, activeTicket: existing?.activeTicket || null });
}

// Keyboards
function getWorkerKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp('🛠️ የሰራተኛ መቆጣጠሪያ ማዕከል (Worker App)', `${MINI_APP_URL}?worker=1`)],
    ['📋 ያልተመለሱ ጥያቄዎች (Pending Quotes)', '💰 የገቡ ክፍያዎች (Pending Orders)'],
    ['🛍️ የደንበኛ እይታ (Customer View)', 'ℹ️ የሰራተኛ መመሪያ (Help)']
  ]).resize();
}

function getMainMenuKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp('🛍️ ሱቅ ይክፈቱ (Open Mini App)', MINI_APP_URL)],
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')']
  ]).resize();
}

// Bot Instance
let bot = null;
if (BOT_TOKEN && BOT_TOKEN !== '123456789:ABCdefghIJKlmnopQRstuvwxYZ') {
  try {
    bot = new Telegraf(BOT_TOKEN);
    bot.use(session());

    // Start
    bot.start(async (ctx) => {
      clearSession(ctx.from.id);
      if (isWorkerContext(ctx)) {
        const workerWelcome = `
👨‍💼 <b>እንኳን ወደ ኮርቻ የሰራተኛ መቆጣጠሪያ ማዕከል በደህና መጡ! (Worker Hub)</b>
━━━━━━━━━━━━━━━━━━━━
እዚህ የደንበኞችን ጥያቄዎች መመለስ፣ የገቡ ክፍያዎችን ማረጋገጥ እና የመደርደሪያ እቃዎችን ማስተዳደር ይችላሉ።

🛠️ <b>ፈጣን አማራጮች፡</b>
• <b>የሰራተኛ መቆጣጠሪያ አፕ፡</b> መደርደሪያ ላይ እቃ ለመጨመር እና ዋጋ ለመቀየር ከታች ያለውን ይጫኑ
• <b>ዋጋ ለመመለስ፡</b> <code>/reply &lt;ኮድ&gt; ዋጋው ... ብር ነው</code>
• <b>ክፍያ ለማረጋገጥ፡</b> <code>/confirm &lt;ኮድ&gt; በ10-14 ቀን</code>

ከታች ካሉት የሰራተኛ አማራጮች ይምረጡ 👇
`;
        return ctx.replyWithHTML(workerWelcome, getWorkerKeyboard());
      }

      const welcome = `
👋 <b>እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!</b>
<i>የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</i>

የፈለጉትን እቃ በሊንክ ወይም በፎቶ ይዘዙ፣ ወጪውን አስልተን በርዎ ድረስ እናደርሳለን!

💳 <b>ልዩ የክፍያ ዋስትና፡</b>
• 100% በብር በ <b>Telebirr</b> ወይም <b>CBE Birr</b> ይክፈሉ
• 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% ሲረከቡ የሚከፈል (COD)
• 0% ተጨማሪ የውጭ ምንዛሪ ክፍያ

ከታች ካሉት አማራጮች ይጀምሩ 👇
`;
      await ctx.replyWithHTML(welcome, getMainMenuKeyboard());
    });

    bot.hears(['🛍️ ሱቅ ይክፈቱ (Open Mini App)', '🛍️ Open Mini App', 'Open the Mini App', '/app', '/shop'], async (ctx) => {
      await ctx.replyWithHTML(
        '🛍️ <b>የኮርቻ ሚኒ አፕ (Korcha Mini App) ለመክፈት ከታች ያለውን ይጫኑ፡</b>',
        Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ሱቁን ይክፈቱ (Open Mini App)', MINI_APP_URL)]
        ])
      );
    });

    bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '🔗 ሊንክ አስገባ', '/link'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_LINK';
      await ctx.replyWithHTML(`
🔗 <b>የእቃውን ድረ-ገጽ ሊንክ እዚህ ይላኩልን፡</b>
━━━━━━━━━━━━━━━━━━━━
እቃውን ከመረጡበት መተግበሪያ ላይ <b>Share / Copy Link</b> አድርገው እዚህ <b>Paste</b> ያድርጉት።

👇 ገና እቃ ካልመረጡ ከታች ያሉትን ገበያዎች ከፍተው መምረጥ ይችላሉ፡
`, Markup.inlineKeyboard([
        [
          Markup.button.url('🛍️ Shein (ፋሽንና አልባሳት)', 'https://www.shein.com'),
          Markup.button.url('🛒 Amazon (ሁሉም ዓይነት)', 'https://www.amazon.com')
        ],
        [
          Markup.button.url('⚡ AliExpress (ኤሌክትሮኒክስ)', 'https://www.aliexpress.com'),
          Markup.button.url('🇨🇳 Pinduoduo (የፋብሪካ ዋጋ)', 'https://mobile.yangkeduo.com')
        ]
      ]));
      await ctx.reply('ሊንኩን ከታች ባለው ሳጥን ውስጥ ይጻፉ ወይም ይለጥፉ (Paste) 👇', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
    });

    bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '📸 ፎቶ ላክ', '/photo'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_PHOTO';
      await ctx.replyWithHTML(
        '📸 <b>የእቃውን ፎቶ ወይም ስክሪንሾት እዚህ ይላኩልን፡</b>',
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // 1. Customer Order & Quote Tracker Handler
    bot.hears(['📦 የትዕዛዝ ሁኔታ መከታተያ', 'የትዕዛዝ ሁኔታ መከታተያ', '/track', '/status'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_TRACKING_CODE';
      await ctx.replyWithHTML(`
📦 <b>የትዕዛዝ ወይም የዋጋ መጠየቂያ ሁኔታ መከታተያ (Track Order / Quote)</b>
━━━━━━━━━━━━━━━━━━━━
እባክዎ የትዕዛዝ ኮድዎን (ምሳሌ፡ <code>KC-123456</code>) ወይም ያዘዙበትን <b>ስልክ ቁጥር</b> (ምሳሌ፡ <code>0911223344</code>) እዚህ ይላኩልን 👇
`, Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
    });

    // 2. Customer Chat with Worker Handler
    bot.hears([
      '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')',
      '💬 ከሰራተኛ ጋር አውራ',
      'ከሰራተኛ ጋር አውራ',
      '/chat',
      '/support'
    ], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_SUPPORT_MESSAGE';
      const workerHandle = WORKER_USERNAME.replace(/^@/, '');
      await ctx.replyWithHTML(`
💬 <b>ከኮርቻ ሰራተኛ ጋር የቀጥታ ውይይት (Chat with Support)</b>
━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>በቀጥታ በቴሌግራም ለማውራት፡</b>
👉 <a href="https://t.me/${workerHandle}">@${workerHandle} ን እዚህ ይጫኑ</a>

2️⃣ <b>እዚሁ ቦት ላይ መልዕክት ለመተው፡</b>
የሚፈልጉትን ጥያቄ፣ ማብራሪያ ወይም የትዕዛዝ ቁጥርዎን ጽፈው ይላኩልን። ሰራተኛችን ተመልክቶ ወዲያውኑ ይመልስልዎታል። 👇
━━━━━━━━━━━━━━━━━━━━
`, Markup.inlineKeyboard([
        [Markup.button.url(`💬 ቀጥታ አውራ (@${workerHandle})`, `https://t.me/${workerHandle}`)],
        [Markup.button.webApp('📱 በመልዕክት ማዕከል ክፈት', MINI_APP_URL)]
      ]));
      await ctx.reply('መልዕክትዎን እዚህ መጻፍ ይችላሉ (ወይም ለመሰረዝ ሰርዝ የሚለውን ይጫኑ)፡', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
    });
// Worker Command: /reply <code> <message...>
    bot.hears(/^\/reply\s+([A-Za-z0-9\-]+)\s+([\s\S]+)$/, async (ctx) => {
      if (!isWorkerContext(ctx)) return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው።');
      const code = ctx.match[1].trim();
      const replyMessage = ctx.match[2].trim();
      const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');

      const resolved = await resolveTrackingTarget(code);
      await addTicketMessage({
        ticketCode: code,
        senderRole: 'worker',
        senderName: workerName,
        messageText: replyMessage,
      });

      if (resolved?.customerTelegramId) {
        const directMsg = `
💬 <b>ከኮርቻ ሰራተኛ የተሰጠ ምላሽ (Support Reply):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>
📝 "${escapeHtml(replyMessage)}"
━━━━━━━━━━━━━━━━━━━━
👉 በዋጋው ከተስማሙ <b>"✅ በዋጋው ተስማምቻለሁ"</b> የሚለውን ይጫኑ ወይም ለሰራተኛው እዚህ በቀጥታ ይጻፉ።
`.trim();
        await bot.telegram.sendMessage(resolved.customerTelegramId, directMsg, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ በዋጋው ተስማምቻለሁ', `agree_price:${code}`),
              Markup.button.callback('❌ ዋጋው አልተስማማሁም', `decline_price:${code}`)
            ],
            [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
          ])
        }).catch(() => {});
      }
      await ctx.replyWithHTML(`✅ ምላሽዎ ለ <code>${code}</code> ተልኳል!`);
    });

    // Worker Command: /confirm <code> [delivery_window]
    
    // Callback Query Handler: Customer Price Acceptance & Decline
    bot.action(/^agree_price:(.+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch (_) {}
      const code = ctx.match[1];
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_RECEIPT';
      session.activeTicket = code;

      const agreementMsg = `
🎉 <b>በዋጋው ስለተስማሙ እናመሰግናለን!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(code)}</code>

💳 <b>የ 40% ቅድመ ክፍያ መፈጸሚያ ሂሳቦች፡</b>
• <b>Telebirr:</b> <code>${TELEBIRR_PHONE}</code> (Korcha)
• <b>ንግድ ባንክ (CBE):</b> <code>${CBE_ACCOUNT}</code> (Korcha)

📸 <b>ክፍያውን ከፈጸሙ በኋላ የደረሰኙን ስክሪንሾት/ፎቶ እዚህ ይላኩልን!</b>
━━━━━━━━━━━━━━━━━━━━
`;
      await ctx.replyWithHTML(agreementMsg, Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());

      if (WORKER_CHAT_ID) {
        const customerTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
        await bot.telegram.sendMessage(
          WORKER_CHAT_ID,
          `🔔 <b>ደንበኛ ${customerTag} ለትዕዛዝ <code>${code}</code> በዋጋው ተስማምቷል!</b>\nክፍያ ደረሰኝ በመጠባበቅ ላይ ነው።`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    bot.action(/^decline_price:(.+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch (_) {}
      const code = ctx.match[1];
      const workerHandle = WORKER_USERNAME.replace(/^@/, '');

      await ctx.replyWithHTML(`
🙏 <b>ዋጋው ስላልተስማማዎት እናዝናለን።</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት ኮድ:</b> <code>${escapeHtml(code)}</code>

ስለ ቅናሽ ወይም ስለ ሌላ አማራጭ እቃ ከሰራተኛችን ጋር በቀጥታ መወያየት ይችላሉ፡
👉 <a href="https://t.me/${workerHandle}">@${workerHandle}</a>
`, Markup.inlineKeyboard([
        [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${workerHandle})`, `https://t.me/${workerHandle}`)],
        [Markup.button.webApp('🛍️ ሱቅ ክፈት', MINI_APP_URL)]
      ]));

      if (WORKER_CHAT_ID) {
        const customerTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
        await bot.telegram.sendMessage(
          WORKER_CHAT_ID,
          `⚠️ <b>ደንበኛ ${customerTag} ለትዕዛዝ <code>${code}</code> ዋጋው እንዳልተስማማው ገልጿል።</b>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    bot.hears(/^\/confirm\s+([A-Za-z0-9\-]+)(?:\s+([\s\S]+))?$/, async (ctx) => {
      if (!isWorkerContext(ctx)) return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው።');
      const code = ctx.match[1].trim();
      const deliveryText = ctx.match[2] ? ctx.match[2].trim() : '10-14 ቀን';
      const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');

      await updateOrderStatus(code, 'deposit_verified', workerName, `ክፍያ ተረጋግጧል — እቃው በ${deliveryText} ይደርሳል`);
      const resolved = await resolveTrackingTarget(code);

      if (resolved?.customerTelegramId) {
        const msg = `
🎉 <b>ክፍያዎ ተፈጽሟል። ዕቃዎ በ${escapeHtml(deliveryText)} ይደርሳል።</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(code)}</code>
📊 <b>ሁኔታ:</b> ክፍያ ተረጋግጧል (Deposit Verified)
━━━━━━━━━━━━━━━━━━━━
`;
        await bot.telegram.sendMessage(resolved.customerTelegramId, msg, { parse_mode: 'HTML' }).catch(() => {});
      }
      await ctx.replyWithHTML(`✅ ክፍያ ተረጋግጧል! (ኮድ: <code>${code}</code>)`);
    });


    // Worker Commands and Menu Actions
    bot.hears(['🛠️ የሰራተኛ መቆጣጠሪያ ማዕከል (Worker App)', '/worker', '/admin', '🛠️ ሰራተኛ ሞድ'], async (ctx) => {
      if (!isWorkerContext(ctx)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው።');
      }
      const pendingQ = await getPendingQuotes();
      const pendingO = await getPendingOrders();
      const statusMsg = `
👨‍💼 <b>የሰራተኛ መቆጣጠሪያ ማዕከል (Worker Dashboard)</b>
━━━━━━━━━━━━━━━━━━━━
📋 <b>ያልተመለሱ ጥያቄዎች (Pending Quotes):</b> <b>${pendingQ.length}</b>
💰 <b>የገቡ ክፍያዎች (Pending Orders):</b> <b>${pendingO.length}</b>
━━━━━━━━━━━━━━━━━━━━
👉 የመደርደሪያ እቃዎችን ለማስተዳደር ከታች ያለውን የሰራተኛ አፕ ይክፈቱ፡
`;
      await ctx.replyWithHTML(statusMsg, getWorkerKeyboard());
    });

    bot.hears(['📋 ያልተመለሱ ጥያቄዎች (Pending Quotes)', '/quotes'], async (ctx) => {
      if (!isWorkerContext(ctx)) return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው።');
      const quotes = await getPendingQuotes(10);
      if (!quotes || quotes.length === 0) {
        return ctx.replyWithHTML('✅ <b>ምንም ያልተመለሰ የደንበኛ ጥያቄ የለም! ሁሉም ተመልሰዋል።</b>', getWorkerKeyboard());
      }

      let msg = `📋 <b>ያልተመለሱ የደንበኞች ጥያቄዎች (${quotes.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      quotes.forEach((q, idx) => {
        msg += `<b>${idx + 1}. ኮድ:</b> <code>${q.quote_code}</code>\n`;
        msg += `📱 ስልክ: <code>${q.customer_phone || 'N/A'}</code>\n`;
        if (q.product_url) msg += `🔗 ሊንክ: ${q.product_url}\n`;
        msg += `📝 ዝርዝር: ${q.details || 'Standard'}\n`;
        msg += `👉 ምላሽ ለመስጠት፡ <code>/reply ${q.quote_code} ዋጋው ... ብር ነው</code>\n\n`;
      });
      await ctx.replyWithHTML(msg, getWorkerKeyboard());
    });

    bot.hears(['💰 የገቡ ክፍያዎች (Pending Orders)', '/orders'], async (ctx) => {
      if (!isWorkerContext(ctx)) return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው።');
      const orders = await getPendingOrders(10);
      if (!orders || orders.length === 0) {
        return ctx.replyWithHTML('✅ <b>ክፍያ ማረጋገጫ የሚጠብቅ ትዕዛዝ የለም።</b>', getWorkerKeyboard());
      }

      let msg = `💰 <b>ክፍያ ማረጋገጫ የሚጠብቁ ትዕዛዞች (${orders.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      orders.forEach((o, idx) => {
        msg += `<b>${idx + 1}. ኮድ:</b> <code>${o.order_code}</code>\n`;
        msg += `📱 ስልክ: <code>${o.customer_phone}</code>\n`;
        msg += `💵 ጠቅላላ: <b>${o.total_price_etb} ETB</b> (ቅድመ ክፍያ: <b>${o.deposit_amount_etb} ETB</b>)\n`;
        msg += `👉 ለማረጋገጥ፡ <code>/confirm ${o.order_code} በ10-14 ቀን</code>\n\n`;
      });
      await ctx.replyWithHTML(msg, getWorkerKeyboard());
    });

    bot.hears(['🛍️ የደንበኛ እይታ (Customer View)', '/customer'], async (ctx) => {
      await ctx.replyWithHTML('🛍️ <b>ወደ ደንበኛ እይታ ተቀይሯል። የደንበኛውን ገጽ ከታች ማየት ይችላሉ፡</b>', getMainMenuKeyboard());
    });

    bot.hears(['ℹ️ የሰራተኛ መመሪያ (Help)', '/worker_help'], async (ctx) => {
      if (!isWorkerContext(ctx)) return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው።');
      const helpMsg = `
ℹ️ <b>የሰራተኛ የትዕዛዝ መመሪያ (Worker Commands):</b>
━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>ዋጋ ለመመለስ (Price Quote):</b>
<code>/reply &lt;ኮድ&gt; ዋጋው 3500 ብር ነው። 40% ቅድመ ክፍያ 1400 ብር ይክፈሉ።</code>

2️⃣ <b>ክፍያ ለማረጋገጥ (Confirm Deposit):</b>
<code>/confirm &lt;ኮድ&gt; በ10-14 ቀን</code>

3️⃣ <b>የሰራተኛ ሚኒ አፕ፡</b>
ከታች ያለውን <b>🛠️ የሰራተኛ መቆጣጠሪያ ማዕከል</b> በመጫን እቃዎችን ከመደርደሪያ ላይ መደመር/መቀነስ ይችላሉ።
━━━━━━━━━━━━━━━━━━━━
`;
      await ctx.replyWithHTML(helpMsg, getWorkerKeyboard());
    });

    // Photo Handler
    // Photo Handler: Full Multi-Photo & Receipt Support
    bot.on('photo', async (ctx) => {
      const session = getSession(ctx.from.id);
      const photos = ctx.message.photo;
      const fileId = photos[photos.length - 1].file_id;

      // Case A: Customer uploading payment receipt screenshot
      if (session.state === 'AWAITING_RECEIPT') {
        const code = session.activeTicket;
        session.state = 'IDLE';
        await ctx.replyWithHTML(`
✅ <b>የክፍያ ደረሰኝዎ ደርሶናል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(code)}</code>
ሰራተኛችን ክፍያውን አረጋግጦ ወዲያውኑ መልዕክት ይልክልዎታል!
`, getMainMenuKeyboard());

        if (WORKER_CHAT_ID) {
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, fileId, {
            caption: `💰 <b>የክፍያ ደረሰኝ ደርሷል!</b>\n🏷️ <b>ኮድ:</b> <code>${code}</code>\n\n👉 ለማረጋገጥ፡ <code>/confirm ${code} በ10-14 ቀን</code>`,
            parse_mode: 'HTML'
          }).catch(() => {});
        }
        return;
      }

      // Case B: Customer uploading product screenshots (Multiple supported)
      session.data.photoFileIds = session.data.photoFileIds || [];
      session.data.photoFileIds.push(fileId);
      session.data.sourceType = 'screenshot';
      session.state = 'AWAITING_SPECS';

      const count = session.data.photoFileIds.length;
      await ctx.replyWithHTML(
        `📸 <b>ፎቶ #${count} ተቀብለናል!</b>\n\nተጨማሪ ፎቶ ካለዎት መላክ መቀጠል ይችላሉ።\nከጨረሱ በኋላ <b>ብዛት፣ መጠን እና ቀለም</b> ጽፈው ይላኩልን (ወይም ከታች <b>"✅ ፎቶዎችን ጨርሻለሁ"</b> የሚለውን ይጫኑ) 👇`,
        Markup.keyboard([
          ['✅ ፎቶዎችን ጨርሻለሁ (Done)'],
          ['❌ ሰርዝ (Cancel)']
        ]).resize()
      );
    });

    // Text Handler
    bot.on('text', async (ctx, next) => {
      const text = ctx.message.text.trim();
      const userId = ctx.from.id;
      const session = getSession(userId);

      if (text === '❌ ሰርዝ (Cancel)' || text === '/cancel') {
        clearSession(userId);
        return ctx.reply('✅ ተሰርዟል።', getMainMenuKeyboard());
      }

      if (text === '✅ ፎቶዎችን ጨርሻለሁ (Done)' || text === 'ፎቶ ጨርሻለሁ' || text === '/done') {
        session.state = 'AWAITING_SPECS';
        const count = session.data.photoFileIds?.length || 0;
        return ctx.replyWithHTML(
          `✅ <b>${count} ፎቶዎች ተመዝግበዋል!</b>\n\nአሁን <b>ብዛት፣ መጠን እና ቀለም</b> (ወይም ተጨማሪ ዝርዝር) ጽፈው ይላኩልን 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      if (session.state === 'AWAITING_TRACKING_CODE') {
        const query = text.trim();
        const cleanPhone = normalizeEthiopianPhone(query);
        let foundItems = [];

        // 1. Try code lookup
        const resolved = await resolveTrackingTarget(query);
        if (resolved && resolved.target) {
          foundItems.push({ item: resolved.target, type: resolved.type, code: query });
        }

        // 2. Try phone lookup if it looks like a phone
        if (cleanPhone) {
          const quotes = await getQuotesByPhone(cleanPhone);
          const orders = await getOrdersByPhone(cleanPhone);
          if (quotes) quotes.forEach(q => foundItems.push({ item: q, type: 'quote', code: q.quote_code || q.quoteCode }));
          if (orders) orders.forEach(o => foundItems.push({ item: o, type: 'order', code: o.order_code || o.orderCode }));
        }

        if (foundItems.length === 0) {
          return ctx.replyWithHTML(`
⚠️ <b>ምንም የተገኘ ትዕዛዝ ወይም ጥያቄ የለም!</b>
የገቡት ኮድ ወይም ስልክ ቁጥር (<code>${escapeHtml(query)}</code>) በመረጃ ቋታችን ውስጥ አልተገኘም።

እባክዎ ኮዱን አረጋግጠው እንደገና ይሞክሩ፣ ወይም ከታች ካለው ሰራተኛ ጋር ይገናኙ 👇
`, Markup.inlineKeyboard([
            [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)],
            [Markup.button.webApp('🛍️ ሱቅ ክፈት', MINI_APP_URL)]
          ]));
        }

        clearSession(userId);

        for (const entry of foundItems.slice(0, 3)) {
          const item = entry.item;
          const isOrder = entry.type === 'order';
          const code = entry.code;
          const status = item.status || 'pending_review';
          const statusMap = {
            'pending_review': '🔍 በሰራተኛ ግምገማ ላይ',
            'priced': '💵 ዋጋ ተሰጥቷል (ቅድመ ክፍያ ይጠበቃል)',
            'pending_deposit': '💳 ክፍያ ማረጋገጫ በመጠባበቅ ላይ',
            'deposit_verified': '✅ ቅድመ ክፍያ ተረጋግጧል (በግዢ ሂደት ላይ)',
            'in_transit': '✈️ በጉዞ ላይ ወደ ኢትዮጵያ',
            'delivered': '🎉 ደርሷል (ተጠናቋል)'
          };

          const statusAmharic = statusMap[status] || status;
          const priceText = item.total_price_etb || item.totalPriceEtb ? `${Number(item.total_price_etb || item.totalPriceEtb).toLocaleString()} ETB` : 'በስሌት ላይ';
          const depositText = item.deposit_amount_etb || item.depositAmountEtb ? `${Number(item.deposit_amount_etb || item.depositAmountEtb).toLocaleString()} ETB` : null;
          const workerNote = item.latest_worker_note || item.worker_notes || item.worker_response || '';

          let replyMsg = `
📦 <b>የትዕዛዝ ሁኔታ መረጃ (Order Status):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ኮድ:</b> <code>${escapeHtml(code)}</code>
📊 <b>ሁኔታ:</b> <b>${statusAmharic}</b>
💰 <b>ዋጋ:</b> <b>${priceText}</b>
`;
          if (depositText) {
            replyMsg += `💳 <b>ቅድመ ክፍያ (40%):</b> <b>${depositText}</b>\n`;
          }
          if (workerNote) {
            replyMsg += `📝 <b>የሰራተኛ ማስታወሻ:</b> <i>"${escapeHtml(workerNote)}"</i>\n`;
          }
          replyMsg += `━━━━━━━━━━━━━━━━━━━━\n💬 <i>${AUTO_TRACKING_RESPONSE}</i>`;

          await ctx.replyWithHTML(replyMsg, Markup.inlineKeyboard([
            [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)],
            [Markup.button.webApp('📱 በስልክ አፕ ክፈት', MINI_APP_URL)]
          ]));
        }

        // Notify worker that customer looked up tracking
        if (WORKER_CHAT_ID) {
          const customerTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
          await bot.telegram.sendMessage(WORKER_CHAT_ID, `🔔 <b>ደንበኛ ${customerTag} ስለ ኮድ/ስልክ <code>${escapeHtml(query)}</code> ሁኔታ ጠይቋል!</b>`, { parse_mode: 'HTML' }).catch(() => {});
        }

        
      }

      if (session.state === 'AWAITING_SUPPORT_MESSAGE') {
        const customerMsg = text.trim();
        const customerTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
        const ticketCode = session.activeTicket || `TC-${Math.floor(100000 + Math.random() * 900000)}`;

        clearSession(userId);

        await addTicketMessage({
          ticketCode,
          senderRole: 'customer',
          senderName: customerTag,
          messageText: customerMsg,
        });

        if (WORKER_CHAT_ID) {
          const alert = `
💬 <b>አዲስ የቀጥታ መልዕክት ከደንበኛ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>ደንበኛ:</b> ${customerTag} (Telegram ID: <code>${userId}</code>)
🏷️ <b>ትኬት ኮድ:</b> <code>${ticketCode}</code>
📝 <b>መልዕክት:</b> "${escapeHtml(customerMsg)}"
━━━━━━━━━━━━━━━━━━━━
👉 <b>ምላሽ ለመስጠት፡</b>
<code>/reply ${ticketCode} ...</code>
`;
          await bot.telegram.sendMessage(WORKER_CHAT_ID, alert, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.url(`💬 ለደንበኛው በቴሌግራም መልስ`, ctx.from.username ? `https://t.me/${ctx.from.username}` : `tg://user?id=${userId}`)]
            ])
          }).catch(() => {});
        }

        await ctx.replyWithHTML(`
✅ <b>መልዕክትዎ ለኮርቻ ሰራተኛ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
ሰራተኛችን ጥያቄዎን ተመልክቶ እዚሁ ቦት ላይ ወይም በቴሌግራም ወዲያውኑ ምላሽ ይሰጥዎታል።

💬 በቀጥታም ለሰራተኛው መጻፍ ከፈለጉ፡
👉 <a href="https://t.me/${WORKER_USERNAME}">@${WORKER_USERNAME}</a>
`, Markup.inlineKeyboard([
          [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)],
          [Markup.button.webApp('🛍️ ሱቅ ክፈት', MINI_APP_URL)]
        ]));

        
      }


      if (session.state === 'AWAITING_LINK') {
        session.data.productUrl = text;
        session.state = 'AWAITING_SPECS';
        return ctx.replyWithHTML(
          `✅ <b>ሊንኩ ተመዝግቧል!</b>\\n\\nአሁን <b>ብዛት፣ መጠን እና ቀለም</b> ጽፈው ይላኩልን 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      if (session.state === 'AWAITING_SPECS') {
        session.data.specs = text;
        session.state = 'AWAITING_PHONE';
        return ctx.replyWithHTML(
          `✅ <b>ዝርዝሩ ተመዝግቧል!</b>\\n\\nየመጨረሻ ደረጃ፡ <b>የመገናኛ ስልክ ቁጥርዎን</b> ያስገቡ 📱 (ምሳሌ፡ <code>0912345678</code>)፡`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      if (session.state === 'AWAITING_PHONE') {
        if (!isValidEthiopianPhone(text)) {
          return ctx.reply('⚠️ እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)፡');
        }
        const cleanPhone = normalizeEthiopianPhone(text) || text;
        const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
        session.state = 'IDLE';
        session.activeTicket = quoteCode;

        await createQuote({
          quoteCode,
          customerTelegramId: userId,
          customerPhone: cleanPhone,
          productUrl: session.data.productUrl || null,
          details: `[መነሻ: ${session.data.origin || 'China'}] ${session.data.specs || 'Standard'}`,
        });

        await ctx.replyWithHTML(`
🎉 <b>ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የጥያቄ ኮድ:</b> <code>${escapeHtml(quoteCode)}</code>
📱 <b>ስልክ ቁጥር:</b> <code>${escapeHtml(cleanPhone)}</code>
🌍 <b>መነሻ:</b> <b>${escapeHtml(session.data.origin || 'International')}</b>
━━━━━━━━━━━━━━━━━━━━
ሰራተኛችን ወጪውን አስልቶ ወዲያውኑ ዋጋ ይልክልዎታል!
`, getMainMenuKeyboard());

        if (WORKER_CHAT_ID) {
          const photoCount = session.data.photoFileIds?.length || 0;
          const alert = `
🔔 <b>አዲስ ጥያቄ ከቦት ደርሷል!</b>
🏷️ <b>ኮድ:</b> <code>${quoteCode}</code>
📱 <b>ስልክ:</b> <code>${cleanPhone}</code>
🌍 <b>መነሻ:</b> <b>${session.data.origin || 'N/A'}</b>
📝 <b>ዝርዝር:</b> ${session.data.specs || 'N/A'}
🔗 <b>ሊንክ:</b> ${session.data.productUrl || (photoCount > 0 ? `${photoCount} ፎቶዎች ተያይዘዋል` : 'N/A')}
👉 <b>ዋጋ ለመመለስ፡</b> <code>/reply ${quoteCode} ዋጋው ... ብር ነው።</code>
`;
          await bot.telegram.sendMessage(WORKER_CHAT_ID, alert, { parse_mode: 'HTML' }).catch(() => {});

          if (session.data.photoFileIds && session.data.photoFileIds.length > 0) {
            if (session.data.photoFileIds.length === 1) {
              await bot.telegram.sendPhoto(WORKER_CHAT_ID, session.data.photoFileIds[0], {
                caption: `📸 ጥያቄ ${quoteCode}`
              }).catch(() => {});
            } else {
              const media = session.data.photoFileIds.slice(0, 10).map((fId, i) => ({
                type: 'photo',
                media: fId,
                caption: i === 0 ? `📸 ጥያቄ ${quoteCode} (${session.data.photoFileIds.length} ፎቶዎች)` : undefined
              }));
              await bot.telegram.sendMediaGroup(WORKER_CHAT_ID, media).catch(() => {});
            }
          }
        }
        return;
      }

      return next();
    });

  } catch (err) {
    console.warn('[Bot Init Warning]', err.message);
  }
}

// Express Server
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health
app.get(['/health', '/HEALTH', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Korcha Unified Backend with Shopping Cart & Sourcing Hubs',
    worker: WORKER_USERNAME,
    timestamp: new Date().toISOString(),
  });
});

// APIs
app.get('/api/shelf', async (req, res) => {
  const products = await getShelfProducts(req.query.category || null);
  const categories = await getShelfCategories();
  res.json({ success: true, products, categories });
});

app.post('/api/shelf/order', async (req, res) => {
  const orderCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
  const order = await createOrder({
    orderCode,
    customerPhone: req.body.phone,
    productSummary: req.body.productName,
    totalPriceEtb: req.body.priceEtb,
    depositAmountEtb: Math.round(Number(req.body.priceEtb) * 0.4),
    paymentMethod: req.body.paymentMethod || 'telebirr',
  });
  res.json({ success: true, orderCode, order });
});

app.post('/api/quotes', upload.any(), async (req, res) => {
  const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
  const files = req.files || [];
  const photoUrls = files.map(f => `/uploads/${f.filename}`);
  const origin = req.body.origin || 'International';
  const categoryType = req.body.categoryType || 'General';
  const details = `[መነሻ: ${origin}] [ምድብ: ${categoryType}] ${req.body.details || req.body.specs || 'Standard'}`;

  const quote = await createQuote({
    quoteCode,
    customerPhone: req.body.phone,
    productUrl: req.body.productUrl || null,
    details,
    photoUrl: photoUrls[0] || null,
    photoUrls: photoUrls
  });

  if (WORKER_CHAT_ID && bot) {
    let alertMsg = `
🔔 <b>አዲስ ጥያቄ ከሚኒ አፕ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ኮድ:</b> <code>${quoteCode}</code>
📱 <b>ስልክ:</b> <code>${req.body.phone}</code>
🌍 <b>መነሻ:</b> <b>${origin} (${categoryType})</b>
📝 <b>ዝርዝር:</b> ${details}
`;
    if (req.body.productUrl) alertMsg += `🔗 <b>ሊንክ:</b> ${req.body.productUrl}\n`;
    if (photoUrls.length > 0) alertMsg += `📷 <b>ፎቶዎች:</b> ${photoUrls.length} ስክሪንሾቶች ተያይዘዋል\n`;
    alertMsg += `━━━━━━━━━━━━━━━━━━━━\n👉 <b>ዋጋ ለመመለስ፡</b> <code>/reply ${quoteCode} ዋጋው ... ብር ነው</code>`;

    await bot.telegram.sendMessage(WORKER_CHAT_ID, alertMsg, { parse_mode: 'HTML' }).catch(() => {});

    if (files.length > 0) {
      if (files.length === 1) {
        await bot.telegram.sendPhoto(WORKER_CHAT_ID, { source: files[0].path }, { caption: `📸 ጥያቄ ${quoteCode}` }).catch(() => {});
      } else {
        const media = files.slice(0, 10).map((f, i) => ({
          type: 'photo',
          media: { source: f.path },
          caption: i === 0 ? `📸 ጥያቄ ${quoteCode} (${files.length} ፎቶዎች)` : undefined
        }));
        await bot.telegram.sendMediaGroup(WORKER_CHAT_ID, media).catch(() => {});
      }
    }
  }

  res.json({ success: true, quoteCode, photoUrls });
});

app.get('/api/messages/customer', async (req, res) => {
  const conversations = await getCustomerConversations({
    phone: req.query.phone,
    codes: req.query.codes ? String(req.query.codes).split(',') : []
  });
  res.json({ success: true, conversations });
});

app.get('/api/worker/overview', async (req, res) => {
  const pendingQuotes = await getPendingQuotes();
  const pendingOrders = await getPendingOrders();
  const conversations = await getAllConversationsForWorker();
  res.json({ success: true, pendingQuotes, pendingOrders, conversations });
});

app.get('/api/worker/merchant-submissions', async (req, res) => {
  const submissions = await getAllMerchantSubmissionsForWorker();
  res.json({ success: true, submissions });
});

app.post('/api/merchant/submissions', async (req, res) => {
  const ticketCode = `MC-${Math.floor(100000 + Math.random() * 900000)}`;
  const submission = await createMerchantSubmission({ ticketCode, ...req.body });
  res.json({ success: true, ticketCode, submission });
});

// Serve static
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  const idx = path.join(distPath, 'index.html');
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen
let server = null;
async function start() {
  const isNumericPort = !isNaN(PORT) && !isNaN(parseFloat(PORT));
  const isPassenger = typeof PhusionPassenger !== 'undefined' || Boolean(process.env.PASSENGER_APP_ENV);
  const cb = () => console.log(`⚡ [Korcha Server Ready] Listening on ${isPassenger ? 'Passenger' : PORT}`);

  if (isPassenger) server = app.listen('passenger', cb);
  else if (isNumericPort) server = app.listen(Number(PORT), cb);
  else server = app.listen(PORT, cb);

  if (bot) {
    const launch = async (retries = 3) => {
      try {
        await bot.launch({ dropPendingUpdates: false });
        console.log(`🤖 [Bot Online] Korcha Bot active.`);
      } catch (err) {
        if (err.message && err.message.includes('409') && retries > 0) {
          setTimeout(() => launch(retries - 1), 2000);
        }
      }
    };
    launch();
  }
}

start();
