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

function isAuthorizedWorkerUsername(username) {
  if (!username) return false;
  return String(username).replace(/^@/, '').trim().toLowerCase() === WORKER_USERNAME.toLowerCase();
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
function getMainMenuKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp('🛍️ ሱቅ ይክፈቱ (Open Mini App)', MINI_APP_URL)],
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
    ['💳 የክፍያ አማራጮች (Telebirr & CBE)', 'ℹ️ ስለ ኮርቻ (About Us)']
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
      const welcome = `
👋 <b>እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!</b>
<i>የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</i>

ከ <b>Arabian Mart, USA Mart ወይም China Direct</b> ላይ የፈለጉትን እቃ ይዘዙ። ሰራተኞቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

💳 <b>ልዩ የክፍያ ዋስትና፡</b>
• 100% በብር በ <b>Telebirr</b> ወይም <b>CBE Birr</b> ይክፈሉ
• 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% ሲረከቡ የሚከፈል (COD)
• 0% ተጨማሪ የውጭ ምንዛሪ ክፍያ

ከታች ካሉት አማራጮች ይጀምሩ 👇
`;
      await ctx.replyWithHTML(welcome, getMainMenuKeyboard());
    });

    // 3 Sourcing Origin prompt
    const promptOrigin = async (ctx, actionType) => {
      const promptText = `
🌍 <b>የእቃውን መነሻ ሀገር/ገበያ ይምረጡ (Select Sourcing Hub):</b>
━━━━━━━━━━━━━━━━━━━━
1️⃣ 🇸🇦/🇦🇪 <b>Arabian Mart (ሳውዲ / ኤምሬትስ)</b> — Noon, Amazon AE (5-8 ቀናት)
2️⃣ 🇺🇸 <b>USA Mart (አሜሪካ)</b> — Amazon US, eBay (10-14 ቀናት)
3️⃣ 🇨🇳 <b>China Direct (ቻይና)</b> — Pinduoduo, Shein, AliExpress (የፋብሪካ ዋጋ)
━━━━━━━━━━━━━━━━━━━━
👉 ከታች ካሉት አንዱን ይምረጡ 👇
`;
      await ctx.replyWithHTML(promptText, Markup.inlineKeyboard([
        [Markup.button.callback('🇸🇦 🇦🇪 Arabian Mart (5-8 ቀናት)', `orig:KSA_UAE:${actionType}`)],
        [Markup.button.callback('🇺🇸 USA Mart (አሜሪካ • 10-14 ቀናት)', `orig:USA:${actionType}`)],
        [Markup.button.callback('🇨🇳 China Direct (ቻይና • የፋብሪካ ዋጋ)', `orig:CHINA:${actionType}`)]
      ]));
    };

    bot.hears(['🛍️ ሱቅ ይክፈቱ (Open Mini App)', '🛍️ Open Mini App', 'Open the Mini App', '/app', '/shop'], async (ctx) => {
      await ctx.replyWithHTML(
        '🛍️ <b>የኮርቻ ሚኒ አፕ (Korcha Mini App) ለመክፈት ከታች ያለውን ይጫኑ፡</b>',
        Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 ሱቁን ይክፈቱ (Open Mini App)', MINI_APP_URL)]
        ])
      );
    });

    bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '🔗 ሊንክ አስገባ', '/link'], async (ctx) => {
      await promptOrigin(ctx, 'link');
    });

    bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '📸 ፎቶ ላክ', '/photo'], async (ctx) => {
      await promptOrigin(ctx, 'photo');
    });

    bot.action(/^orig:([A-Za-z_]+):([A-Za-z]+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch (_) {}
      const origin = ctx.match[1];
      const action = ctx.match[2];
      const session = getSession(ctx.from.id);
      session.data = { origin };

      const labels = {
        KSA_UAE: '🇸🇦/🇦🇪 Arabian Mart (ሳውዲ / ኤምሬትስ)',
        USA: '🇺🇸 USA Mart (አሜሪካ)',
        CHINA: '🇨🇳 China Direct (ቻይና)'
      };

      if (action === 'link') {
        session.state = 'AWAITING_LINK';
        await ctx.replyWithHTML(
          `✅ <b>መነሻ ገበያ፡ ${labels[origin] || origin}</b>\\n\\n🔗 አሁን የእቃውን ድረ-ገጽ ሊንክ እዚህ ይላኩልን 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      } else {
        session.state = 'AWAITING_PHOTO';
        await ctx.replyWithHTML(
          `✅ <b>መነሻ ገበያ፡ ${labels[origin] || origin}</b>\\n\\n📸 አሁን የእቃውን ፎቶ ወይም ስክሪንሾት እዚህ ይላኩልን 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }
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

    // Photo Handler
    bot.on('photo', async (ctx) => {
      const session = getSession(ctx.from.id);
      const photos = ctx.message.photo;
      const fileId = photos[photos.length - 1].file_id;

      if (session.state === 'AWAITING_RECEIPT') {
        const code = session.activeTicket;
        session.state = 'IDLE';
        await ctx.replyWithHTML(`✅ <b>የክፍያ ደረሰኝዎ ደርሶናል!</b>\\nኮድ: <code>${code}</code>\\nሰራተኛችን አረጋግጦ ያሳውቅዎታል!`);
        if (WORKER_CHAT_ID) {
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, fileId, {
            caption: `💰 <b>የክፍያ ደረሰኝ ደርሷል!</b>\\nኮድ: <code>${code}</code>\\n\\n👉 ለማረጋገጥ፡ <code>/confirm ${code} በ10-14 ቀን</code>`,
            parse_mode: 'HTML'
          }).catch(() => {});
        }
        return;
      }

      session.state = 'AWAITING_SPECS';
      session.data = { ...session.data, sourceType: 'screenshot', photoFileId: fileId };
      await ctx.replyWithHTML(
        `✅ <b>ፎቶው ደርሶናል!</b>\\n\\nአሁን <b>ብዛት፣ መጠን እና ቀለም</b> ጽፈው ይላኩልን 👇`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Text Handler
    bot.on('text', async (ctx, next) => {
      const text = ctx.message.text.trim();
      const userId = ctx.from.id;
      const session = getSession(userId);

      if (text === '❌ ሰርዝ (Cancel)' || text === '/cancel') {
        clearSession(userId);
        return ctx.reply('✅ ተሰርዟል። ወደ ዋና ገጽ ተመልሰዋል፡', getMainMenuKeyboard());
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
          const alert = `
🔔 <b>አዲስ ጥያቄ ከቦት ደርሷል!</b>
🏷️ <b>ኮድ:</b> <code>${quoteCode}</code>
📱 <b>ስልክ:</b> <code>${cleanPhone}</code>
🌍 <b>መነሻ:</b> <b>${session.data.origin || 'N/A'}</b>
📝 <b>ዝርዝር:</b> ${session.data.specs || 'N/A'}
🔗 <b>ሊንክ:</b> ${session.data.productUrl || 'ፎቶ/ስክሪንሾት'}
👉 <b>ዋጋ ለመመለስ፡</b> <code>/reply ${quoteCode} ዋጋው ... ብር ነው።</code>
`;
          await bot.telegram.sendMessage(WORKER_CHAT_ID, alert, { parse_mode: 'HTML' }).catch(() => {});
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

app.post('/api/quotes', (req, res) => {
  const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
  createQuote({ quoteCode, customerPhone: req.body.phone, details: req.body.details });
  res.json({ success: true, quoteCode });
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
