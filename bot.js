// bot.js: Unified Telegram Bot, API & Mini App Web Server
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, Markup, session } from 'telegraf';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runMigrations, upsertCustomer, createQuote, getQuoteByCode, getOrderByCode, getOrdersByPhone } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Environment Configurations
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;
const WORKER_USERNAME = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper: Phone Validators
function isValidEthiopianPhone(phone) {
  const cleaned = (phone || '').replace(/[\s-]/g, '');
  return /^(\+251|0)(9|7)\d{8}$/.test(cleaned);
}

function normalizePhone(phone) {
  let cleaned = (phone || '').replace(/[\s-]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  }
  return cleaned;
}

// ----------------------------------------------------
// 1. TELEGRAM BOT LOGIC & SESSION SETUP
// ----------------------------------------------------
const userSessions = new Map();
function getSession(id) {
  if (!userSessions.has(id)) userSessions.set(id, { state: 'IDLE', data: {} });
  return userSessions.get(id);
}
function clearSession(id) {
  userSessions.set(id, { state: 'IDLE', data: {} });
}

function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከአስተናጋጅ ጋር አውራ (@' + WORKER_USERNAME + ')'],
    [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት (Open Mini App)', WEB_APP_URL)],
  ]).resize();
}

let bot = null;
if (BOT_TOKEN && BOT_TOKEN.length > 20) {
  bot = new Telegraf(BOT_TOKEN);
  bot.use(session());

  bot.start(async (ctx) => {
    clearSession(ctx.from.id);
    const welcome = `
👋 *እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!*
_የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ_

ከ *Shein, Temu, ወይም AliExpress* የመረጡትን እቃ ሊንክ ወይም ፎቶ ይላኩልን። አስተናጋጆቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!
`;
    await ctx.replyWithMarkdown(welcome, getMainMenuKeyboard());
  });

  bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '/link', 'ሊንክ ያስገቡ'], async (ctx) => {
    const s = getSession(ctx.from.id);
    s.state = 'AWAITING_LINK';
    s.data = { sourceType: 'link' };
    await ctx.replyWithMarkdown('🔗 *የእቃውን ሊንክ ያስገቡ፡*\n\n📌 *ምሳሌ:*\n`https://www.shein.com/item/12345...`', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
  });

  bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '/photo', 'ፎቶ ላክ'], async (ctx) => {
    const s = getSession(ctx.from.id);
    s.state = 'AWAITING_PHOTO';
    s.data = { sourceType: 'screenshot' };
    await ctx.replyWithMarkdown('📸 *የእቃውን ፎቶ ወይም ስክሪንሾት ይላኩ፡*', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
  });

  bot.hears([new RegExp('ከአስተናጋጅ ጋር አውራ', 'i'), '/support'], async (ctx) => {
    await ctx.replyWithMarkdown(`💬 *የኮርቻ ቀጥታ አስተናጋጅ:* [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})`, Markup.inlineKeyboard([
      Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
    ]));
  });

  bot.hears(['📦 የትዕዛዝ ሁኔታ መከታተያ', '/track'], async (ctx) => {
    const s = getSession(ctx.from.id);
    s.state = 'AWAITING_TRACKING_INPUT';
    await ctx.replyWithMarkdown('📦 *የትዕዛዝ ሁኔታ መከታተያ፡*\n\nእባክዎ የትዕዛዝ ኮድዎን (ምሳሌ፡ `KC-102948`) ወይም ስልክ ቁጥርዎን (`09**** / 07****`) ያስገቡ፡', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
  });

  bot.hears(['❌ ሰርዝ (Cancel)', '/cancel'], async (ctx) => {
    clearSession(ctx.from.id);
    await ctx.reply('ተሰርዟል። ወደ ዋናው ሜኑ ተመልሰዋል።', getMainMenuKeyboard());
  });

  bot.on('photo', async (ctx) => {
    const s = getSession(ctx.from.id);
    const photos = ctx.message.photo;
    s.state = 'AWAITING_DETAILS';
    s.data = { ...s.data, sourceType: 'screenshot', photoFileId: photos[photos.length - 1].file_id };
    await ctx.replyWithMarkdown('✅ *ፎቶው ደርሶናል!*\n\nአሁን *የእቃውን ዝርዝር* (መጠን፣ ቀለም፣ ብዛት) ጽፈው ይላኩ 👇', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const s = getSession(ctx.from.id);

    if (s.state === 'IDLE' && (text.startsWith('http://') || text.startsWith('https://'))) {
      s.state = 'AWAITING_DETAILS';
      s.data = { sourceType: 'link', productUrl: text };
      return ctx.replyWithMarkdown('✅ *ሊንኩ ደርሶናል!*\n\nአሁን *የእቃውን ዝርዝር* (መጠን፣ ቀለም፣ ብዛት) ጽፈው ይላኩ 👇', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
    }

    if (s.state === 'AWAITING_LINK') {
      if (!text.startsWith('http')) return ctx.reply('⚠️ እባክዎ ትክክለኛ የድረ-ገጽ ሊንክ ያስገቡ (በ https:// የሚጀምር)፡');
      s.data.productUrl = text;
      s.state = 'AWAITING_DETAILS';
      return ctx.replyWithMarkdown('✅ *ሊንኩ ተመዝግቧል!*\n\nአሁን *የእቃውን ዝርዝር* (መጠን፣ ቀለም፣ ብዛት) ጽፈው ይላኩ 👇', Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize());
    }

    if (s.state === 'AWAITING_DETAILS') {
      s.data.details = text;
      s.state = 'AWAITING_PHONE';
      return ctx.replyWithMarkdown('✅ *የእቃው ዝርዝር ተመዝግቧል!*\n\nየመጨረሻ ደረጃ፡ *የመገናኛ ስልክ ቁጥርዎን* ያስገቡ 📱\n\n📌 *ምሳሌ:* `0911223344` ወይም `0712345678`');
    }

    if (s.state === 'AWAITING_PHONE') {
      if (!isValidEthiopianPhone(text)) {
        return ctx.replyWithMarkdown('⚠️ *ትክክለኛ ያልሆነ ስልክ ቁጥር!* እባክዎ `09****` ወይም `07****` ያስገቡ፡');
      }
      const phone = normalizePhone(text);
      const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
      clearSession(ctx.from.id);

      await ctx.replyWithMarkdown(`
🎉 *ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!*
━━━━━━━━━━━━━━━━━━━━
🏷️ *የጥያቄ ኮድ:* \`${quoteCode}\`
📱 *ስልክ:* \`${phone}\`
📝 *ዝርዝር:* ${s.data.details || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
አስተናጋጃችን ወጪውን አስልቶ ያነጋግርዎታል።
`, Markup.inlineKeyboard([
        Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
      ]));
      return ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());
    }

    if (s.state === 'AWAITING_TRACKING_INPUT') {
      clearSession(ctx.from.id);
      try {
        let orders = [];
        if (isValidEthiopianPhone(text)) {
          orders = await getOrdersByPhone(normalizePhone(text));
        } else {
          const order = await getOrderByCode(text);
          if (order) orders = [order];
        }

        if (orders.length === 0) {
          return ctx.replyWithMarkdown(`🔍 *ምንም የተገኘ ትዕዛዝ የለም!*\n\nጥያቄ ካለዎት 👉 [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})`, getMainMenuKeyboard());
        }

        for (const ord of orders) {
          await ctx.replyWithMarkdown(`
📦 *የትዕዛዝ መረጃ:* \`${ord.order_code}\`
📊 *ሁኔታ:* \`${ord.status}\`
🛍️ *እቃ:* ${ord.product_summary || 'የተዘዘ እቃ'}
💰 *ጠቅላላ ዋጋ:* ${ord.total_price_etb} ETB
`);
        }
        return ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());
      } catch (err) {
        return ctx.reply('ስህተት ተከስቷል። እባክዎ ትንሽ ቆይተው ይሞክሩ።', getMainMenuKeyboard());
      }
    }

    return next();
  });
}

// ----------------------------------------------------
// 2. WEBHOOK STATUS ENDPOINT
// ----------------------------------------------------
const webhookPath = '/api/telegram-webhook';

app.get(webhookPath, (req, res) => {
  res.json({
    status: 'active',
    service: 'Korcha Telegram Webhook',
    worker: WORKER_USERNAME,
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// 3. FRONTEND & REST API ENDPOINTS
// ----------------------------------------------------
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`[Static] Serving frontend from ${distPath}`);
}

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Korcha Unified Backend', worker: WORKER_USERNAME });
});

app.post('/api/quotes', upload.single('screenshot'), async (req, res) => {
  try {
    const { sourceType, productUrl, size, color, quantity, details, phone } = req.body;
    const screenshotFile = req.file;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({ success: false, error: 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)' });
    }

    const cleanPhone = normalizePhone(phone);
    const combinedDetails = `መጠን: ${size || 'N/A'} | ቀለም: ${color || 'N/A'} | ብዛት: ${quantity || '1'} | ማስታወሻ: ${details || 'N/A'}`;
    const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      await createQuote({
        quoteCode,
        customerPhone: cleanPhone,
        sourceType: sourceType || 'link',
        productUrl: productUrl || null,
        screenshotUrl: screenshotFile ? screenshotFile.filename : null,
        size,
        color,
        quantity: parseInt(quantity || '1', 10),
        details: combinedDetails,
      });
    } catch (dbErr) {
      console.log(`[DB Offline] Quote ${quoteCode} generated without DB:`, cleanPhone);
    }

    if (WORKER_CHAT_ID && bot) {
      const workerMsg = `
🔔 *አዲስ ጥያቄ ከ Mini App ደርሷል!*
━━━━━━━━━━━━━━━━━━━━
🏷️ *Quote:* \`${quoteCode}\`
📱 *ስልክ:* \`${cleanPhone}\`
📝 *ዝርዝር:* ${combinedDetails}
🔗 *ሊንክ:* ${productUrl || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
`;
      if (screenshotFile) {
        bot.telegram.sendPhoto(WORKER_CHAT_ID, { source: screenshotFile.path }, { caption: workerMsg, parse_mode: 'Markdown' }).catch(() => {});
      } else {
        bot.telegram.sendMessage(WORKER_CHAT_ID, workerMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }

    res.json({ success: true, quoteCode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders/lookup', async (req, res) => {
  try {
    const { phone, code } = req.query;
    let orders = [];
    if (code) {
      const order = await getOrderByCode(code);
      if (order) orders = [order];
    } else if (phone) {
      orders = await getOrdersByPhone(normalizePhone(phone));
    }
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. SPA FALLBACK (KEEP AT VERY BOTTOM)
// ----------------------------------------------------
app.get('*', (req, res) => {
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Korcha Mini App: Run `npm run build` to compile frontend files.');
  }
});

// ----------------------------------------------------
// 5. SERVER BOOTSTRAP
// ----------------------------------------------------
async function start() {
  try {
    await runMigrations();
  } catch (err) {
    console.warn('[DB] Migrations deferred (running in fail-safe mode).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Korcha listening on port ${PORT}`);
  });

  if (bot) {
    bot.launch()
      .then(() => console.log(`[Bot] Polling launched as @${WORKER_USERNAME}`))
      .catch((err) => console.error('[Bot Launch Error]', err.message));
  } else {
    console.warn('[Bot Warning] TELEGRAM_BOT_TOKEN missing in .env. Bot skipped.');
  }

  process.once('SIGINT', () => bot && bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));
}

start();