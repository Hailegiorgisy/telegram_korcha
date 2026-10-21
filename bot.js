// bot.js: Telegram Korcha Bot with Guided Step-by-Step Quote Wizard & DB Persistence
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

// Environment Variables & Dynamic Configurations
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;
const WORKER_USERNAME = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('[Bot Warning] TELEGRAM_BOT_TOKEN is not defined in your .env file.');
}

const bot = new Telegraf(BOT_TOKEN || 'dummy_token');
bot.use(session());

// Helper: Ethiopian Phone Number Validator
function isValidEthiopianPhone(phone) {
  const cleaned = (phone || '').replace(/[\s-]/g, '');
  return /^(\+251|0)(9|7)\d{8}$/.test(cleaned);
}

// Helper: Normalize Ethiopian Phone Number
function normalizePhone(phone) {
  let cleaned = (phone || '').replace(/[\s-]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  }
  return cleaned;
}

// In-memory conversation state for multi-step quote wizard
const userSessions = new Map();

function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { state: 'IDLE', data: {} });
  }
  return userSessions.get(userId);
}

function clearSession(userId) {
  userSessions.set(userId, { state: 'IDLE', data: {} });
}

// Main Reply Keyboard
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከአስተናጋጅ ጋር አውራ (@' + WORKER_USERNAME + ')'],
    [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት (Open Mini App)', WEB_APP_URL)],
  ]).resize();
}

// /start Command Handler
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  clearSession(userId);

  const welcomeMessage = `
👋 **እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!**
*የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ*

ከ **Shein, Temu, ወይም AliExpress** ላይ የፈለጉትን እቃ ይዘዙ። አስተናጋጆቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

📌 **እንዴት ማዘዝ ይችላሉ?**
1️⃣ **ሊንክ ወይም ፎቶ ያስገቡ** (የእቃውን ሊንክ ወይም ስክሪንሾት ይላኩ)
2️⃣ **ዝርዝሩን ይሙሉ** (መጠን፣ ቀለም፣ ብዛት)
3️⃣ **ስልክ ቁጥርዎን ያስገቡ** (ዋጋው ሲሰላ በአስተናጋጅ ይደርስዎታል)

ከታች ያሉትን ምርጫዎች ይጠቀሙ 👇
`;

  await ctx.replyWithMarkdown(welcomeMessage, getMainMenuKeyboard());
});

// Trigger: 🔗 ሊንክ ያስገቡ
bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '/link', 'ሊንክ ያስገቡ'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_LINK';
  session.data = { sourceType: 'link' };

  await ctx.replyWithMarkdown(
    `🔗 **የእቃውን ሊንክ ያስገቡ፡**\n\n📌 **ምሳሌ (Placeholder):**\n\`https://www.shein.com/item/12345...\`\nወይም\n\`https://www.temu.com/goods...\`\n\nእባክዎ ሊንኩን እዚህ ይላኩልን 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: 📸 ፎቶ / ስክሪንሾት ላክ
bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '/photo', 'ፎቶ ላክ', 'ስክሪንሾት ላክ'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_PHOTO';
  session.data = { sourceType: 'screenshot' };

  await ctx.replyWithMarkdown(
    `📸 **የእቃውን ፎቶ ወይም ስክሪንሾት ይላኩ፡**\n\nከ Shein, Temu ወይም AliExpress ላይ የተነሳውን ግልጽ ፎቶ/ስክሪንሾት እዚህ ይላኩልን 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: 💬 ከአስተናጋጅ ጋር አውራ
bot.hears([new RegExp(`ከአስተናጋጅ ጋር አውራ`, 'i'), '/support'], async (ctx) => {
  await ctx.replyWithMarkdown(
    `💬 **የኮርቻ ቀጥታ አስተናጋጅ (Direct Support):**\n\nጥያቄ፣ እርዳታ ወይም የክፍያ ማረጋገጫ ለመላክ በቀጥታ ከአስተናጋጃችን ጋር ይገናኙ፡\n👉 **[@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})**`,
    Markup.inlineKeyboard([
      Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
    ])
  );
});

// Trigger: 📦 የትዕዛዝ ሁኔታ መከታተያ
bot.hears(['📦 የትዕዛዝ ሁኔታ መከታተያ', '/track'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_TRACKING_INPUT';

  await ctx.replyWithMarkdown(
    `📦 **የትዕዛዝ ሁኔታ መከታተያ፡**\n\nእባክዎ የትዕዛዝ ኮድዎን (ምሳሌ፡ \`KC-102948\`) ወይም በትዕዛዝ ወቅት የተጠቀሙትን **ስልክ ቁጥር** (\`09**** / 07****\`) ያስገቡ፡`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: ❌ ሰርዝ (Cancel)
bot.hears(['❌ ሰርዝ (Cancel)', '/cancel'], async (ctx) => {
  clearSession(ctx.from.id);
  await ctx.reply('ተሰርዟል። ወደ ዋናው ሜኑ ተመልሰዋል።', getMainMenuKeyboard());
});

// Photo Message Handler
bot.on('photo', async (ctx) => {
  const session = getSession(ctx.from.id);
  const photos = ctx.message.photo;
  const highestResPhoto = photos[photos.length - 1];
  const fileId = highestResPhoto.file_id;

  session.state = 'AWAITING_DETAILS';
  session.data = {
    ...session.data,
    sourceType: 'screenshot',
    photoFileId: fileId,
  };

  await ctx.replyWithMarkdown(
    `✅ **ፎቶው ደርሶናል!**\n\nአሁን **የእቃውን ዝርዝር መረጃ** ይጻፉልን፡\n\n🔹 **መጠን / ሳይዝ (Size)** (ምሳሌ: M, L, 42)\n🔹 **ቀለም (Color)** (ምሳሌ: ጥቁር, ነጭ)\n🔹 **ብዛት / ቁጥር (Quantity)** (ምሳሌ: 1)\n🔹 **ተጨማሪ ማስታወሻ** ካለ\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Text Message Handler
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();
  const session = getSession(ctx.from.id);

  if (session.state === 'IDLE' && (text.startsWith('http://') || text.startsWith('https://'))) {
    session.state = 'AWAITING_DETAILS';
    session.data = { sourceType: 'link', productUrl: text };

    return ctx.replyWithMarkdown(
      `✅ **ሊንኩ ደርሶናል!**\n\nአሁን **የእቃውን ዝርዝር መረጃ** ይጻፉልን፡\n\n🔹 **መጠን / ሳይዝ (Size)** (ምሳሌ: M, L, 42)\n🔹 **ቀለም (Color)**\n🔹 **ብዛት / ቁጥር (Quantity)**\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (session.state === 'AWAITING_LINK') {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      return ctx.reply('⚠️ እባክዎ ትክክለኛ የድረ-ገጽ ሊንክ ያስገቡ (በ https:// የሚጀምር)፡');
    }
    session.data.productUrl = text;
    session.state = 'AWAITING_DETAILS';

    return ctx.replyWithMarkdown(
      `✅ **ሊንኩ ተመዝግቧል!**\n\nቀጣይ ደረጃ፡ እባክዎ **የእቃውን ዝርዝር መረጃ** ይጻፉልን፡\n\n🔹 **መጠን / ሳይዝ (Size)** (ምሳሌ: M, L, 42)\n🔹 **ቀለም (Color)**\n🔹 **ብዛት / ቁጥር (Quantity)**\n\nእባክዎ ዝርዝሩን ጽፈው ይላኩ 👇`,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (session.state === 'AWAITING_DETAILS') {
    session.data.details = text;
    session.state = 'AWAITING_PHONE';

    return ctx.replyWithMarkdown(
      `✅ **የእቃው ዝርዝር ተመዝግቧል!**\n\nየመጨረሻ ደረጃ፡ **የመገናኛ ስልክ ቁጥርዎን** ያስገቡ 📱\n\n📌 **ምሳሌ፡** \`09**** / 07****\` (ምሳሌ: 0912345678 ወይም 0712345678)\n\nአስተናጋጃችን ዋጋውን አስልቶ በቴሌግራም ወይም በስልክ ያሳውቅዎታል!`,
      Markup.keyboard([
        [Markup.button.contactRequest('📱 ስልክ ቁጥሬን ላክ (Share Contact)')],
        ['❌ ሰርዝ (Cancel)']
      ]).resize()
    );
  }

  if (session.state === 'AWAITING_PHONE') {
    if (!isValidEthiopianPhone(text)) {
      return ctx.replyWithMarkdown(
        `⚠️ **ትክክለኛ ያልሆነ ስልክ ቁጥር!**\n\nእባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (\`09**** / 07****\`):\nምሳሌ: \`0912345678\` ወይም \`0712345678\``
      );
    }
    const cleanPhone = normalizePhone(text);
    return finalizeQuoteRequest(ctx, session.data, cleanPhone);
  }

  if (session.state === 'AWAITING_TRACKING_INPUT') {
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
        return ctx.replyWithMarkdown(
          `🔍 **ምንም የተገኘ ትዕዛዝ የለም!**\n\nያስገቡት መረጃ አልተገኘም። እባክዎ እንደገና ይሞክሩ ወይም በቀጥታ ከአስተናጋጃችን ጋር ይገናኙ፡\n👉 **[@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})**`,
          getMainMenuKeyboard()
        );
      }

      for (const ord of orders) {
        const msg = `
📦 **የትዕዛዝ መረጃ (Order Details)**
━━━━━━━━━━━━━━━━━━━━
🏷️ **የትዕዛዝ ኮድ:** \`${ord.order_code}\`
📊 **ሁኔታ (Status):** \`${ord.status}\`
🛍️ **እቃ:** ${ord.product_summary || 'የተዘዘ እቃ'}
💰 **ጠቅላላ ዋጋ:** ${ord.total_price_etb} ETB
💳 **የተከፈለ ቅድመ ክፍያ:** ${ord.deposit_amount_etb} ETB
🚚 **ቀሪ ክፍያ (ሲረከቡ):** ${ord.cod_balance_etb} ETB
━━━━━━━━━━━━━━━━━━━━
ጥያቄ ካለዎት 👉 [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})
`;
        await ctx.replyWithMarkdown(msg);
      }
      return ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());
    } catch (err) {
      console.error('[Track Error]', err);
      return ctx.reply('ስህተት ተከስቷል። እባክዎ ትንሽ ቆይተው ይሞክሩ።', getMainMenuKeyboard());
    }
  }

  return next();
});

// Contact Sharing Handler
bot.on('contact', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (session.state === 'AWAITING_PHONE') {
    const rawPhone = ctx.message.contact.phone_number;
    const cleanPhone = normalizePhone(rawPhone);
    return finalizeQuoteRequest(ctx, session.data, cleanPhone);
  }
});

// Finalize Quote Request
async function finalizeQuoteRequest(ctx, data, phone) {
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
  const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const customer = await upsertCustomer({
      telegramId: userId,
      telegramUsername: ctx.from.username,
      firstName: ctx.from.first_name,
      phone: phone,
    });

    await createQuote({
      quoteCode,
      customerId: customer.id,
      customerPhone: phone,
      sourceType: data.sourceType,
      productUrl: data.productUrl,
      screenshotUrl: data.photoFileId,
      details: data.details,
    });

    clearSession(userId);

    const confirmationText = `
🎉 **ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!**
━━━━━━━━━━━━━━━━━━━━
🏷️ **የጥያቄ ኮድ:** \`${quoteCode}\`
📱 **ስልክ ቁጥር:** \`${phone}\`
🛍️ **ዓይነት:** ${data.sourceType === 'link' ? 'የእቃ ሊንክ' : 'ስክሪንሾት / ፎቶ'}
📝 **ዝርዝር:** ${data.details || 'ያልተገለጸ'}
━━━━━━━━━━━━━━━━━━━━

👨‍💼 **ቀጣይ ሂደት፡**
1. አስተናጋጃችን እቃውን ገምግሞ አጠቃላይ ዋጋ በብር ያሰላል።
2. የዋጋ ዝርዝሩ በቴሌግራም ወይም በስልክዎ ይላክልዎታል።
3. 40% ቅድመ ክፍያ በቴሌብር ከፍለው ትዕዛዝዎ ይረጋገጣል!

👉 ጥያቄ ካለዎት በቀጥታ ከአስተናጋጅ ጋር ይገናኙ፡
**[@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})**
`;

    await ctx.replyWithMarkdown(
      confirmationText,
      Markup.inlineKeyboard([
        Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
      ])
    );
    await ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());

    if (WORKER_CHAT_ID) {
      const workerNotification = `
🔔 **አዲስ የእቃ ዋጋ ጥያቄ ደርሷል!**
━━━━━━━━━━━━━━━━━━━━
🏷️ **Quote Code:** \`${quoteCode}\`
👤 **ደንበኛ:** ${username} (ID: \`${userId}\`)
📱 **ስልክ:** \`${phone}\`
📌 **ዓይነት:** ${data.sourceType.toUpperCase()}
📝 **ዝርዝር:** ${data.details}
🔗 **ሊንክ:** ${data.productUrl || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
`;
      if (data.photoFileId) {
        await ctx.telegram.sendPhoto(WORKER_CHAT_ID, data.photoFileId, {
          caption: workerNotification,
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.telegram.sendMessage(WORKER_CHAT_ID, workerNotification, {
          parse_mode: 'Markdown',
        });
      }
    }
  } catch (err) {
    console.error('[Finalize Quote Error]', err);
    await ctx.reply('ይቅርታ፣ ጥያቄውን በመመዝገብ ላይ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', getMainMenuKeyboard());
  }
}

// REST API for Web & Mini App
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    res.json({ success: true, quoteCode });
  } catch (err) {
    console.error('[API Quote Error]', err);
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

async function start() {
  try {
    await runMigrations();
  } catch (dbErr) {
    console.warn('[DB Warning] Migrations deferred:', dbErr.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Korcha API listening on port ${PORT}`);
  });

  if (BOT_TOKEN && BOT_TOKEN !== 'dummy_token') {
    bot.launch()
      .then(() => console.log(`[Bot] Korcha Bot launched. Worker: @${WORKER_USERNAME}`))
      .catch((err) => console.error('[Bot Launch Error]', err.message));
  }
}

start();