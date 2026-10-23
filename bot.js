// bot.js: Telegram Korcha Bot with Guided Step-by-Step Quote Wizard, Web Server, DB Persistence, Worker Notification, Direct Responses & Abuse Protection
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
  createOrder,
  getOrderByCode,
  getOrdersByPhone,
  updateOrderStatus,
  recordCustomerPing,
  recordOrderLookup,
  respondToCustomerPing,
  getCustomerPings,
  syncFallbackToPostgres,
  startReconciliationWorker
} from './db.js';

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
const WORKER_USERNAME = (process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support').replace(/^@/, '');
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;

// Helper: Escape HTML entities to prevent Telegram parse errors
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Bulletproof Ethiopian Phone Number Normalizer & Validator
function normalizeEthiopianPhone(phoneInput) {
  if (!phoneInput) return null;
  let digits = String(phoneInput).trim().replace(/[^\d+]/g, '');

  if (digits.startsWith('+251')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('251')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Accepts 9 digits starting with 9 (EthioTelecom) or 7 (Safaricom)
  if (/^(9|7)\d{8}$/.test(digits)) {
    return '0' + digits; // Standard 10-digit format (09... or 07...)
  }
  return null;
}

function isValidEthiopianPhone(phone) {
  return Boolean(normalizeEthiopianPhone(phone));
}

function normalizePhone(phone) {
  return normalizeEthiopianPhone(phone) || phone;
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

// Main Reply Keyboard with Payment Marketing Button
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከአስተናጋጅ ጋር አውራ (@' + WORKER_USERNAME + ')'],
    [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት (Open Mini App)', WEB_APP_URL)],
  ]).resize();
}

// Helper: Finalize and Save Quote Request to DB & Notify Worker
async function finalizeQuoteRequest(ctx, data, phone) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'Customer');
  const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
  const cleanPhone = normalizePhone(phone);
  const safeData = data || {};
  const sourceType = (safeData.sourceType === 'screenshot' || safeData.photoFileId) ? 'screenshot' : 'link';

  try {
    // 1. Save customer to DB (fail-safe)
    let customer = null;
    try {
      customer = await upsertCustomer({
        telegramId: userId,
        telegramUsername: ctx.from?.username || null,
        firstName: ctx.from?.first_name || null,
        phone: cleanPhone,
      });
    } catch (custErr) {
      console.warn('[Customer Upsert Warning]', custErr.message);
    }

    // 2. Save quote to DB with customer telegram ID (fail-safe)
    try {
      await createQuote({
        quoteCode,
        customerId: customer ? customer.id : null,
        customerTelegramId: userId,
        customerPhone: cleanPhone,
        sourceType,
        productUrl: safeData.productUrl || null,
        screenshotUrl: safeData.photoFileId || null,
        details: safeData.details || (safeData.marketplace ? `[ገበያ: ${safeData.marketplace}]` : 'N/A'),
      });
    } catch (quoteErr) {
      console.warn('[Quote Creation Warning]', quoteErr.message);
    }

    // 3. User Confirmation Message
    const confirmationText = `
🎉 <b>ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የጥያቄ ኮድ:</b> <code>${escapeHtml(quoteCode)}</code>
📱 <b>ስልክ ቁጥር:</b> <code>${escapeHtml(cleanPhone)}</code>
🛍️ <b>ዓይነት:</b> ${sourceType === 'link' ? 'የእቃ ሊንክ' : 'ስክሪንሾት / ፎቶ'}
${safeData.marketplace ? `🌐 <b>ገበያ (Marketplace):</b> ${escapeHtml(safeData.marketplace)}\n` : ''}📝 <b>ዝርዝር:</b> ${escapeHtml(safeData.details || 'ያልተገለጸ')}
━━━━━━━━━━━━━━━━━━━━

👨‍💼 <b>ቀጣይ ሂደት፡</b>
1. አስተናጋጃችን እቃውን ገምግሞ አጠቃላይ ዋጋ በብር ያሰላል።
2. የዋጋ ዝርዝሩ በቴሌግራም ወይም በስልክዎ ይላክልዎታል።
3. 40% ቅድመ ክፍያ በቴሌብር ወይም በንግድ ባንክ (CBE) ከፍለው ትዕዛዝዎ ይረጋገጣል!

👉 ጥያቄ ካለዎት በቀጥታ ከአስተናጋጅ ጋር ይገናኙ፡
<b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>
`.trim();

    try {
      await ctx.replyWithHTML(
        confirmationText,
        Markup.inlineKeyboard([
          Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
        ])
      );
    } catch (htmlErr) {
      console.warn('[Confirmation HTML Send Warning]', htmlErr.message);
      await ctx.reply(
        `🎉 ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!\n\n🏷️ የጥያቄ ኮድ: ${quoteCode}\n📱 ስልክ ቁጥር: ${cleanPhone}\n\nአስተናጋጃችን በቅርቡ ያነጋግርዎታል: @${WORKER_USERNAME}`
      );
    }

    await ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());
    clearSession(userId);

    // 4. Notify Worker in TELEGRAM_WORKER_CHAT_ID (SAFELY ISOLATED)
    // Internal worker notifications MUST NEVER throw into the customer-facing flow
    if (WORKER_CHAT_ID && bot) {
      try {
        const linkHtml = safeData.productUrl 
          ? `<a href="${escapeHtml(safeData.productUrl)}">${escapeHtml(safeData.productUrl)}</a>` 
          : 'N/A';

        const workerNotification = `
🔔 <b>አዲስ የእቃ ዋጋ ጥያቄ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Quote Code:</b> <code>${escapeHtml(quoteCode)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone)}</code>
📌 <b>ዓይነት:</b> ${escapeHtml(sourceType.toUpperCase())}
${safeData.marketplace ? `🌐 <b>የተመረጠ ገበያ:</b> ${escapeHtml(safeData.marketplace)}\n` : ''}📝 <b>ዝርዝር:</b> ${escapeHtml(safeData.details || 'N/A')}
🔗 <b>ሊንክ:</b> ${linkHtml}
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡</b>
<code>/reply ${quoteCode} ዋጋው 1,500 ብር ነው። 40% ቅድመ ክፍያ 600 ብር በቴሌብር ይክፈሉ።</code>
`.trim();

        // Note: Telegram inline keyboard buttons only accept http/https/tg links (never tel: or invalid links)
        const workerButtons = [];
        if (ctx.from?.username) {
          workerButtons.push([
            Markup.button.url('💬 በቴሌግራም መልስ (Reply)', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)
          ]);
        }
        const workerKeyboard = workerButtons.length > 0 ? Markup.inlineKeyboard(workerButtons) : undefined;

        if (safeData.photoFileId) {
          // Telegram photo caption limit is 1024 characters
          const safeCaption = workerNotification.length > 1000 
            ? workerNotification.substring(0, 997) + '...' 
            : workerNotification;

          await bot.telegram.sendPhoto(WORKER_CHAT_ID, safeData.photoFileId, {
            caption: safeCaption,
            parse_mode: 'HTML',
            ...(workerKeyboard || {})
          });
        } else {
          await bot.telegram.sendMessage(WORKER_CHAT_ID, workerNotification, {
            parse_mode: 'HTML',
            ...(workerKeyboard || {})
          });
        }
      } catch (workerErr) {
        console.warn('[Worker Notification Delivery Warning] Could not send to worker chat:', workerErr.message);
      }
    }
  } catch (err) {
    console.error('[Finalize Quote Error]', err);
    await ctx.reply('ይቅርታ፣ ጥያቄውን በመመዝገብ ላይ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', getMainMenuKeyboard());
  }
}

// Initialize Telegraf Bot instance safely
let bot = null;
if (BOT_TOKEN && BOT_TOKEN !== '123456789:ABCdefghIJKlmnopQRstuvwxYZ') {
  try {
    bot = new Telegraf(BOT_TOKEN);
    bot.use(session());

    // /start Command Handler with Payment Promotion
    bot.start(async (ctx) => {
      const userId = ctx.from.id;
      clearSession(userId);

      const welcomeMessage = `
👋 <b>እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!</b>
<i>የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</i>

ከ <b>Shein, Amazon, ወይም AliExpress</b> ላይ የፈለጉትን እቃ ይዘዙ። አስተናጋጆቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

💳 <b>ልዩ የክፍያ ዋስትና፡</b>
• 100% በብር በ <b>Telebirr</b> ወይም <b>CBE Birr</b> ይክፈሉ
• 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% ሲረከቡ የሚከፈል (COD)
• 0% የውጭ ምንዛሪ ተጨማሪ ክፍያ

📌 <b>እንዴት ማዘዝ ይችላሉ?</b>
1️⃣ <b>ሊንክ ወይም ፎቶ ያስገቡ</b> (የእቃውን ሊንክ ወይም ስክሪንሾት ይላኩ)
2️⃣ <b>ዝርዝሩን ይሙሉ</b> (መጠን፣ ቀለም፣ ብዛት)
3️⃣ <b>ስልክ ቁጥርዎን ያስገቡ</b> (ዋጋው ሲሰላ በአስተናጋጅ ይደርስዎታል)

ከታች ያሉትን ምርጫዎች ይጠቀሙ 👇
`;
      await ctx.replyWithHTML(welcomeMessage, getMainMenuKeyboard());
    });

    // FEATURE 2: 💳 የክፍያ አማራጮች (Telebirr & CBE Birr Marketing Promotion)
    bot.hears(['💳 የክፍያ አማራጮች (Telebirr/CBE)', '💳 የክፍያ አማራጮች', '/payment', '/promo', 'ቴሌብር', 'ንግድ ባንክ'], async (ctx) => {
      const promoMessage = `
🔥 <b>ልዩ የክፍያ አማራጭ ማስታወቂያ (Payment Marketing)!</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>100% በኢትዮጵያ ብር (ETB) ይክፈሉ!</b>
የውጭ ሀገር ቪዛ/ማስተርካርድ ካርድ አያስፈልግዎትም።

⚡ <b>የክፍያ አማራጮች፡</b>
1️⃣ <b>ቴሌብር (Telebirr):</b>
📱 ስልክ፡ <code>+251-996237800</code>
🔹 40% ቅድመ ክፍያ • ፈጣን ማረጋገጫ

2️⃣ <b>የኢትዮጵያ ንግድ ባንክ (CBE / CBE Birr):</b>
🏦 ሂሳብ ቁጥር፡ <code>10001116390</code>
🔹 በሞባይል ባንኪንግ ወይም በቅርንጫፍ • አስተማማኝ

🛡️ <b>የኮርቻ የክፍያ ዋስትና፡</b>
✅ 0% የውጭ ምንዛሪ ጭማሪ ክፍያ (Zero Forex Markup)
✅ 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% እቃው አዲስ አበባ ሲደርስ
✅ ቀጥታ የኤስኤምኤስና የቦት ደረሰኝ
━━━━━━━━━━━━━━━━━━━━
👉 እቃ ለማዘዝ ሊንክ ወይም ስክሪንሾት ይላኩልን!
`;
      await ctx.replyWithHTML(
        promoMessage,
        Markup.inlineKeyboard([
          [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት', WEB_APP_URL)],
          [Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
        ])
      );
    });

    // FEATURE 1 & 3: Worker Direct Reply Command (/reply <code> <message...>)
    bot.hears(/^\/reply\s+([A-Za-z0-9\-]+)\s+([\s\S]+)$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);

      if (WORKER_CHAT_ID && senderChatId !== String(WORKER_CHAT_ID) && senderId !== String(WORKER_CHAT_ID)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለአስተናጋጆች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }

      const code = ctx.match[1].trim();
      const replyMessage = ctx.match[2].trim();
      const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');

      try {
        const order = await getOrderByCode(code);
        const quote = await getQuoteByCode(code);

        if (!order && !quote) {
          return ctx.replyWithHTML(`⚠️ <b>የትዕዛዝ ወይም የጥያቄ ኮድ አልተገኘም:</b> <code>${escapeHtml(code)}</code>`);
        }

        // 1. Record response in database (visible in Mini App tracking)
        await respondToCustomerPing({
          referenceCode: code,
          responseText: replyMessage,
          workerUsername: workerName,
        });

        // 2. Direct message customer on Telegram Bot if customer telegram ID exists
        let deliveredToTelegram = false;
        const targetTelegramId = order?.customer_telegram_id || quote?.customer_telegram_id;

        if (targetTelegramId) {
          const directMsg = `
📩 <b>ከኮርቻ አስተናጋጅ የተሰጠ ምላሽ (Message from Support):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ኮድ:</b> <code>${escapeHtml(code)}</code>
📝 <b>መልዕክት:</b> ${escapeHtml(replyMessage)}
━━━━━━━━━━━━━━━━━━━━
👉 ተጨማሪ ጥያቄ ካለዎት እዚህ መልስ መላክ ይችላሉ።
`;
          await bot.telegram.sendMessage(targetTelegramId, directMsg, { parse_mode: 'HTML' });
          deliveredToTelegram = true;
        }

        await ctx.replyWithHTML(`
✅ <b>ምላሽዎ ተመዝግቧል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ኮድ:</b> <code>${escapeHtml(code)}</code>
📝 <b>መልዕክት:</b> ${escapeHtml(replyMessage)}
📱 <b>በቴሌግራም ቦት ደርሷል:</b> ${deliveredToTelegram ? '✅ አዎ (Direct message sent to customer)' : '🌐 በሚኒ አፕ መከታተያ ላይ ተመዝግቧል (Visible in Mini App)'}
━━━━━━━━━━━━━━━━━━━━
`);
      } catch (err) {
        console.error('[Worker Reply Error]', err);
        await ctx.reply(`❌ ስህተት ተከስቷል: ${err.message}`);
      }
    });

    // Trigger: 🔗 ሊንክ ያስገቡ
    bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '/link', 'ሊንክ ያስገቡ'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_LINK';
      session.data = { sourceType: 'link' };

      await ctx.replyWithHTML(
        `🔗 <b>የእቃውን ሊንክ ያስገቡ፡</b>\n\n📌 <b>ምሳሌ (Placeholder):</b>\n<code>https://www.shein.com/item/12345...</code>\nወይም\n<code>https://www.amazon.com/dp/...</code>\n\nእባክዎ ሊንኩን እዚህ ይላኩልን 👇`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Trigger: 📸 ፎቶ / ስክሪንሾት ላክ
    bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '/photo', 'ፎቶ ላክ', 'ስክሪንሾት ላክ'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_PHOTO';
      session.data = { sourceType: 'screenshot' };

      await ctx.replyWithHTML(
        `📸 <b>የእቃውን ፎቶ ወይም ስክሪንሾት ይላኩ፡</b>\n\nከ Shein, Amazon ወይም AliExpress ላይ የተነሳውን ግልጽ ፎቶ/ስክሪንሾት እዚህ ይላኩልን 👇`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Trigger: 💬 ከአስተናጋጅ ጋር አውራ
    bot.hears([new RegExp(`ከአስተናጋጅ ጋር አውራ`, 'i'), '/support'], async (ctx) => {
      await ctx.replyWithHTML(
        `💬 <b>የኮርቻ ቀጥታ አስተናጋጅ (Direct Support):</b>\n\nጥያቄ፣ እርዳታ ወይም የክፍያ ማረጋገጫ ለመላክ በቀጥታ ከአስተናጋጃችን ጋር ይገናኙ፡\n👉 <b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>`,
        Markup.inlineKeyboard([
          Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
        ])
      );
    });

    // Trigger: 📦 የትዕዛዝ ሁኔታ መከታተያ
    bot.hears(['📦 የትዕዛዝ ሁኔታ መከታተያ', '/track'], async (ctx) => {
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_TRACKING_INPUT';

      await ctx.replyWithHTML(
        `📦 <b>የትዕዛዝ ሁኔታ መከታተያ፡</b>\n\nእባክዎ የትዕዛዝ ኮድዎን (ምሳሌ፡ <code>KC-102948</code>) ወይም በትዕዛዝ ወቅት የተጠቀሙትን <b>ስልክ ቁጥር</b> (<code>09**** / 07****</code>) ያስገቡ፡`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Trigger: ❌ ሰርዝ (Cancel)
    bot.hears(['❌ ሰርዝ (Cancel)', '/cancel'], async (ctx) => {
      clearSession(ctx.from.id);
      await ctx.reply('ተሰርዟል። ወደ ዋናው ሜኑ ተመልሰዋል።', getMainMenuKeyboard());
    });

    // Action: 🔔 Customer Ping / Follow-up from Inline Button
    bot.action(/^ping_order:(.+)$/, async (ctx) => {
      const orderCode = ctx.match[1];
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');

      try {
        const order = await getOrderByCode(orderCode);
        const phone = order ? order.customer_phone : null;

        await recordCustomerPing({
          referenceCode: orderCode,
          customerPhone: phone || String(userId),
          customerName: username,
          customerTelegramId: userId,
          pingType: 'status_followup',
          customerNote: 'ደንበኛ በቦት በኩል ወቅታዊ ሁኔታ እንዲገለጽለት ጠይቋል (Bot follow-up ping)',
          assignedWorker: order?.assigned_worker || WORKER_USERNAME,
        });

        await ctx.answerCbQuery('ጥያቄዎ ለአስተናጋጅ ደርሷል!');
        await ctx.replyWithHTML(
          `✅ <b>ጥያቄዎ ለአስተናጋጃችን ደርሷል!</b>\n\nየትዕዛዝ ኮድ <code>${escapeHtml(orderCode)}</code> ወቅታዊ ሁኔታ እንዲጣራልዎት ለአስተናጋጃችን ማሳወቂያ ተልኳል። በአጭር ጊዜ ውስጥ አጣርተው ያሳውቁዎታል።`
        );

        if (WORKER_CHAT_ID && bot) {
          const intlPhone = phone && phone.startsWith('0') ? `+251${phone.slice(1)}` : phone;
          const pingAlert = `
🚨 <b>አስቸኳይ፡ ደንበኛ ሁኔታ እንዲጣራለት ጠየቀ! (Bot Follow-up Ping)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(orderCode)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📱 <b>ስልክ:</b> <code>${escapeHtml(phone || 'N/A')}</code>
📊 <b>የአሁን ሁኔታ:</b> <code>${escapeHtml(order ? order.status : 'N/A')}</code>
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${orderCode} እቃዎ አዲስ አበባ ኤርፖርት ደርሷል</code>
`;
          const buttons = [];
          if (ctx.from.username) {
            buttons.push([Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
          }

          await bot.telegram.sendMessage(WORKER_CHAT_ID, pingAlert, {
            parse_mode: 'HTML',
            ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
          }).catch(e => console.warn('[Ping Alert Warning]', e.message));
        }
      } catch (err) {
        console.error('[Bot Ping Order Error]', err);
        await ctx.answerCbQuery('ስህተት ተከስቷል');
      }
    });

    // Photo Message Handler: Customer sends screenshot, then chooses marketplace
    bot.on('photo', async (ctx) => {
      const session = getSession(ctx.from.id);
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileId = highestResPhoto.file_id;

      session.state = 'AWAITING_MARKETPLACE';
      session.data = {
        ...session.data,
        sourceType: 'screenshot',
        photoFileId: fileId,
      };

      await ctx.replyWithHTML(
        `✅ <b>ፎቶው/ስክሪንሾቱ ደርሶናል!</b>\n\n📌 <b>ይህ ስክሪንሾት ከየትኛው ገበያ የተወሰደ ነው?</b>\n(Which marketplace is this screenshot from?)`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🛍️ Shein', 'market:Shein'),
            Markup.button.callback('📦 Amazon', 'market:Amazon')
          ],
          [
            Markup.button.callback('🌐 AliExpress', 'market:AliExpress'),
            Markup.button.callback('✨ ሌላ / Other', 'market:Other')
          ]
        ])
      );
    });

    // Marketplace selection callback handler (triggers after screenshot insertion)
    bot.action(/^market:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch (e) {}

      const market = ctx.match[1];
      const session = getSession(ctx.from.id);
      session.data.marketplace = market;
      session.state = 'AWAITING_DETAILS';

      await ctx.replyWithHTML(
        `✅ ገበያ ተመርጧል፡ <b>${escapeHtml(market)}</b>\n\nአሁን <b>የእቃውን ዝርዝር መረጃ</b> ይጻፉልን፡\n\n🔹 <b>መጠን / ሳይዝ (Size)</b> (ምሳሌ: M, L, 42, 100ml)\n🔹 <b>ቀለም (Color)</b> (ምሳሌ: ጥቁር, ነጭ, Black)\n🔹 <b>ብዛት / ቁጥር (Quantity)</b> (ምሳሌ: 1, 2)\n🔹 <b>ተጨማሪ ማስታወሻ</b> ካለ\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Text Message Handler
    bot.on('text', async (ctx, next) => {
      const text = ctx.message.text.trim();
      const session = getSession(ctx.from.id);

      // Check if text is a direct URL
      if (session.state === 'IDLE' && (text.startsWith('http://') || text.startsWith('https://'))) {
        session.state = 'AWAITING_DETAILS';
        session.data = {
          sourceType: 'link',
          productUrl: text,
        };

        return ctx.replyWithHTML(
          `✅ <b>ሊንኩ ደርሶናል!</b>\n\nአሁን <b>የእቃውን ዝርዝር መረጃ</b> ይጻፉልን፡\n\n🔹 <b>መጠን / ሳይዝ (Size)</b> (ምሳሌ: M, L, 42)\n🔹 <b>ቀለም (Color)</b> (ምሳሌ: ጥቁር, ነጭ)\n🔹 <b>ብዛት / ቁጥር (Quantity)</b> (ምሳሌ: 1)\n🔹 <b>ተጨማሪ ማስታወሻ</b> ካለ\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      // Fallback: Awaiting Marketplace via Text
      if (session.state === 'AWAITING_MARKETPLACE') {
        session.data.marketplace = text;
        session.state = 'AWAITING_DETAILS';
        return ctx.replyWithHTML(
          `✅ ገበያ ተመርጧል፡ <b>${escapeHtml(session.data.marketplace)}</b>\n\nአሁን <b>የእቃውን ዝርዝር መረጃ</b> ይጻፉልን፡\n\n🔹 <b>መጠን / ሳይዝ (Size)</b> (ምሳሌ: M, L, 42)\n🔹 <b>ቀለም (Color)</b> (ምሳሌ: ጥቁር, ነጭ)\n🔹 <b>ብዛት / ቁጥር (Quantity)</b> (ምሳሌ: 1)\n🔹 <b>ተጨማሪ ማስታወሻ</b> ካለ\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      // 1. Awaiting Link
      if (session.state === 'AWAITING_LINK') {
        if (!text.startsWith('http://') && !text.startsWith('https://')) {
          return ctx.reply('⚠️ እባክዎ ትክክለኛ የድረ-ገጽ ሊንክ ያስገቡ (በ https:// የሚጀምር)፡');
        }

        session.data.productUrl = text;
        session.state = 'AWAITING_DETAILS';

        return ctx.replyWithHTML(
          `✅ <b>ሊንኩ ተመዝግቧል!</b>\n\nቀጣይ ደረጃ፡ እባክዎ <b>የእቃውን ዝርዝር መረጃ</b> ይጻፉልን፡\n\n🔹 <b>መጠን / ሳይዝ (Size)</b> (ምሳሌ: M, L, 42)\n🔹 <b>ቀለም (Color)</b>\n🔹 <b>ብዛት / ቁጥር (Quantity)</b>\n🔹 <b>ተጨማሪ ማስታወሻ</b>\n\nእባክዎ ዝርዝሩን ጽፈው ይላኩ 👇`,
          Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
        );
      }

      // 2. Awaiting Product Details
      if (session.state === 'AWAITING_DETAILS') {
        session.data.details = text;
        session.state = 'AWAITING_PHONE';

        return ctx.replyWithHTML(
          `✅ <b>የእቃው ዝርዝር ተመዝግቧል!</b>\n\nየመጨረሻ ደረጃ፡ <b>የመገናኛ ስልክ ቁጥርዎን</b> ያስገቡ 📱\n\n📌 <b>ምሳሌ፡</b> <code>09**** / 07****</code> (ምሳሌ: 0912345678 ወይም 0712345678)\n\nአስተናጋጃችን ዋጋውን አስልቶ በቴሌግራም ወይም በስልክ ያሳውቅዎታል!`,
          Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥሬን ላክ (Share Contact)')],
            ['❌ ሰርዝ (Cancel)']
          ]).resize()
        );
      }

      // 3. Awaiting Phone Number
      if (session.state === 'AWAITING_PHONE') {
        if (!isValidEthiopianPhone(text)) {
          return ctx.replyWithHTML(
            `⚠️ <b>ትክክለኛ ያልሆነ ስልክ ቁጥር!</b>\n\nእባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (<code>09**** / 07****</code>):\nምሳሌ: <code>0912345678</code> ወይም <code>0712345678</code>`
          );
        }

        const cleanPhone = normalizePhone(text);
        return finalizeQuoteRequest(ctx, session.data, cleanPhone);
      }

      // 4. Awaiting Tracking Input: Instant Worker Notification + Interactive Ping Button
      if (session.state === 'AWAITING_TRACKING_INPUT') {
        clearSession(ctx.from.id);
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');

        try {
          let orders = [];
          if (isValidEthiopianPhone(text)) {
            orders = await getOrdersByPhone(normalizePhone(text));
          } else {
            const order = await getOrderByCode(text);
            if (order) orders = [order];
          }

          // Record lookup
          await recordOrderLookup(text, orders.length);

          // Notify worker immediately
          if (WORKER_CHAT_ID && bot) {
            const lookupAlert = `
🔔 <b>ደንበኛ በቴሌግራም ቦት የትዕዛዝ ሁኔታ ፈለገ! (Bot Tracking Lookup)</b>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>የተፈለገው:</b> <code>${escapeHtml(text)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📦 <b>የተገኙ ትዕዛዞች:</b> ${orders.length}
${orders.length > 0 ? `📊 <b>ሁኔታ:</b> <code>${escapeHtml(orders[0].status)}</code>\n🛍️ <b>እቃ:</b> ${escapeHtml(orders[0].product_summary || 'N/A')}` : '⚠️ ትዕዛዝ አልተገኘም'}
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡</b>
<code>/reply ${orders.length > 0 ? orders[0].order_code : text} ሰላም፣ እቃዎ ...</code>
`;
            const buttons = [];
            if (ctx.from.username) {
              buttons.push([Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
            }

            await bot.telegram.sendMessage(WORKER_CHAT_ID, lookupAlert, {
              parse_mode: 'HTML',
              ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
            }).catch(e => console.warn('[Lookup Alert Warning]', e.message));
          }

          if (orders.length === 0) {
            return ctx.replyWithHTML(
              `🔍 <b>ምንም የተገኘ ትዕዛዝ የለም!</b>\n\nያስገቡት መረጃ አልተገኘም። እባክዎ እንደገና ይሞክሩ ወይም በቀጥታ ከአስተናጋጃችን ጋር ይገናኙ፡\n👉 <b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>`,
              getMainMenuKeyboard()
            );
          }

          for (const ord of orders) {
            const workerNoteDisplay = (ord.latest_worker_note || ord.worker_response)
              ? `\n💬 <b>ከአስተናጋጅ የተሰጠ የቀጥታ ምላሽ:</b>\n"${escapeHtml(ord.latest_worker_note || ord.worker_response)}"\n`
              : '';

            const msg = `
📦 <b>የትዕዛዝ መረጃ (Order Details)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(ord.order_code)}</code>
📊 <b>ሁኔታ (Status):</b> <code>${escapeHtml(ord.status)}</code>
🛍️ <b>እቃ:</b> ${escapeHtml(ord.product_summary || 'የተዘዘ እቃ')}
💰 <b>ጠቅላላ ዋጋ:</b> ${escapeHtml(ord.total_price_etb)} ETB
💳 <b>የክፍያ ዘዴ:</b> ${ord.payment_method === 'cbe_birr' ? 'CBE Birr / ንግድ ባንክ' : 'Telebirr (ቴሌብር)'}
💳 <b>የተከፈለ ቅድመ ክፍያ:</b> ${escapeHtml(ord.deposit_amount_etb)} ETB
🚚 <b>ቀሪ ክፍያ (ሲረከቡ):</b> ${escapeHtml(ord.cod_balance_etb)} ETB
${workerNoteDisplay}━━━━━━━━━━━━━━━━━━━━
ጥያቄ ካለዎት ከአስተናጋጅ ጋር ይገናኙ 👉 @${escapeHtml(WORKER_USERNAME)}
`;
            await ctx.replyWithHTML(
              msg,
              Markup.inlineKeyboard([
                [Markup.button.callback('🔔 ሁኔታ እንዲጣራልኝ እፈልጋለሁ (Ping Support)', `ping_order:${ord.order_code}`)],
                [Markup.button.url(`💬 ከአስተናጋጅ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
              ])
            );
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

  } catch (err) {
    console.warn('[Bot Warning] Could not initialize Telegraf with token:', err.message);
  }
} else {
  console.log('[Bot Info] Running without active Telegram Bot Token. API & Web App operational.');
}

// ----------------------------------------------------
// ABUSE PROTECTION & RATE LIMITING MIDDLEWARE
// ----------------------------------------------------
function createRateLimiter({ windowMs, maxRequests, message }) {
  const requestHistory = new Map();

  // Periodic cleanup of stale IP records
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestHistory.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        requestHistory.delete(ip);
      } else {
        requestHistory.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();
    const timestamps = requestHistory.get(ip) || [];

    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
      const retryAfterSeconds = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message || 'Too many requests. Please slow down and try again later.',
        retryAfterSeconds,
      });
    }

    recent.push(now);
    requestHistory.set(ip, recent);
    next();
  };
}

// 1. Quote Submission Limiter: Max 10 submissions per 15 minutes per IP
const quoteSubmissionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'ብዙ የእቃ ጥያቄዎችን በተከታታይ ልከዋል። እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ (Rate limit exceeded: 10 requests per 15 minutes).',
});

// 2. Order Lookup Limiter: Max 30 lookups per 5 minutes per IP
const orderLookupLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'የትዕዛዝ ፍለጋ ገደብ ላይ ደርሰዋል። እባክዎ ትንሽ ቆይተው ይሞክሩ (Lookup rate limit: 30 per 5 minutes).',
});

// 3. Customer Ping Limiter: Max 5 pings per 10 minutes per IP
const customerPingLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  message: 'አስተናጋጁን ለማነጋገር አጭር ጊዜ ይጠብቁ (Ping limit: 5 per 10 minutes).',
});

// REST API for Web & Telegram Mini App
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload Middleware with Abuse Protection (10MB limit, image mime type verification)
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum upload size
    files: 1, // Only 1 file per request
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('ልክ ያልሆነ የፋይል ዓይነት! JPG, PNG ወይም WEBP ፎቶ ብቻ ይጫኑ (Only JPEG, PNG, and WEBP images are allowed).'));
    }
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Korcha Unified Backend with Direct Responses, Abuse Protection & Reconciliation',
    worker: WORKER_USERNAME,
    paymentOptions: ['telebirr', 'cbe_birr'],
    rateLimiting: 'active',
    timestamp: new Date().toISOString(),
  });
});

// Manual trigger for reconciliation sync
app.post('/api/admin/reconcile', async (req, res) => {
  try {
    const result = await syncFallbackToPostgres();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test notification delivery to worker chat
app.get('/api/test-notify', async (req, res) => {
  if (!WORKER_CHAT_ID) {
    return res.status(400).json({
      success: false,
      error: 'TELEGRAM_WORKER_CHAT_ID is not configured in .env',
    });
  }
  if (!bot) {
    return res.status(400).json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN is not configured or bot is inactive',
    });
  }
  try {
    const testMsg = `
🔔 <b>የሙከራ ማሳወቂያ (Test Notification)</b>
━━━━━━━━━━━━━━━━━━━━
✅ የቴሌግራም ኮርቻ ማሳወቂያ ስርዓት በትክክል እየሰራ ነው። (Notification operational)
⏰ ሰዓት፡ <code>${new Date().toISOString()}</code>
🛠️ ሰራተኛ፡ @${escapeHtml(WORKER_USERNAME)}
━━━━━━━━━━━━━━━━━━━━
`;
    await bot.telegram.sendMessage(WORKER_CHAT_ID, testMsg, { parse_mode: 'HTML' });
    res.json({ success: true, message: 'Test notification sent to worker chat' });
  } catch (err) {
    console.error('[Test Notify Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotes with Abuse Protection (Rate limiting + Multer validation)
app.post('/api/quotes', quoteSubmissionLimiter, (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'የፎቶው መጠን ከ10MB መብለጥ የለበትም (Image size exceeds 10MB limit).' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { sourceType, productUrl, size, color, quantity, details, phone, telegramId, marketplace } = req.body;
    const screenshotFile = req.file;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({ success: false, error: 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)' });
    }

    const cleanPhone = normalizePhone(phone);
    const combinedDetails = `${marketplace ? `[ገበያ: ${marketplace}] ` : ''}መጠን: ${size || 'N/A'} | ቀለም: ${color || 'N/A'} | ብዛት: ${quantity || '1'} | ማስታወሻ: ${details || 'N/A'}`;
    const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    await createQuote({
      quoteCode,
      customerPhone: cleanPhone,
      customerTelegramId: telegramId ? parseInt(telegramId, 10) : null,
      sourceType: sourceType || 'link',
      productUrl: productUrl || null,
      screenshotUrl: screenshotFile ? screenshotFile.filename : null,
      size,
      color,
      quantity: parseInt(quantity || '1', 10),
      details: combinedDetails,
    });

    if (WORKER_CHAT_ID && bot) {
      const linkHtml = productUrl 
        ? `<a href="${escapeHtml(productUrl)}">${escapeHtml(productUrl)}</a>` 
        : 'N/A';

      const workerMsg = `
🔔 <b>አዲስ ጥያቄ ከ Web / Mini App ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Quote:</b> <code>${escapeHtml(quoteCode)}</code>
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone)}</code>
${marketplace ? `🌐 <b>ገበያ (Marketplace):</b> ${escapeHtml(marketplace)}\n` : ''}📝 <b>ዝርዝር:</b> ${escapeHtml(combinedDetails)}
🔗 <b>ሊንክ:</b> ${linkHtml}
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡</b>
<code>/reply ${quoteCode} ዋጋው ... ብር ነው።</code>
`;
      try {
        const workerButtons = [];
        if (req.body.telegramUsername) {
          workerButtons.push([
            Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${req.body.telegramUsername.replace(/^@/, '')}`)
          ]);
        }
        const workerKeyboard = workerButtons.length > 0 ? Markup.inlineKeyboard(workerButtons) : undefined;

        if (screenshotFile) {
          const safeCaption = workerMsg.length > 1000 ? workerMsg.substring(0, 997) + '...' : workerMsg;
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, { source: screenshotFile.path }, {
            caption: safeCaption,
            parse_mode: 'HTML',
            ...(workerKeyboard || {}),
          });
        } else {
          await bot.telegram.sendMessage(WORKER_CHAT_ID, workerMsg, {
            parse_mode: 'HTML',
            ...(workerKeyboard || {}),
          });
        }
      } catch (workerErr) {
        console.warn('[API Quote Worker Notify Warning]', workerErr.message);
      }
    }

    res.json({ success: true, quoteCode });
  } catch (err) {
    console.error('[API Quote Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/lookup with Rate Limiter
app.get('/api/orders/lookup', orderLookupLimiter, async (req, res) => {
  try {
    const { phone, code } = req.query;
    let orders = [];
    const searchTarget = code || phone;

    if (!searchTarget) {
      return res.status(400).json({ success: false, error: 'Phone number or order code required' });
    }

    if (code) {
      const order = await getOrderByCode(code);
      if (order) orders = [order];
    } else if (phone) {
      orders = await getOrdersByPhone(normalizePhone(phone));
    }

    // Record lookup event
    await recordOrderLookup(normalizePhone(phone) || code, orders.length);

    // Notify assigned workers immediately when customer checks status
    if (WORKER_CHAT_ID && bot) {
      if (orders.length > 0) {
        const ord = orders[0];
        const customerPhone = ord.customer_phone;
        const intlPhone = customerPhone.startsWith('0') ? `+251${customerPhone.slice(1)}` : customerPhone;

        const lookupAlert = `
🔔 <b>ደንበኛ የትዕዛዝ ሁኔታ ፈለገ (Customer Status Lookup)!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የተፈለገው:</b> <code>${escapeHtml(code || phone)}</code>
👤 <b>ስልክ ቁጥር:</b> <code>${escapeHtml(customerPhone)}</code>
📦 <b>የተገኙ ትዕዛዞች:</b> ${orders.length}
📊 <b>የአሁን ሁኔታ:</b> <code>${escapeHtml(ord.status)}</code>
🛍️ <b>እቃ:</b> ${escapeHtml(ord.product_summary || 'N/A')}
💰 <b>ጠቅላላ ክፍያ:</b> ${escapeHtml(ord.total_price_etb)} ETB
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡</b>
<code>/reply ${ord.order_code} ሰላም፣ እቃዎ ...</code>
`;
        bot.telegram.sendMessage(WORKER_CHAT_ID, lookupAlert, { parse_mode: 'HTML' }).catch(() => {});
      } else {
        const lookupMissingAlert = `
⚠️ <b>ያልተገኘ የትዕዛዝ ፍለጋ ሙከራ (Unmatched Status Lookup)!</b>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>የተፈለገው ኮድ/ስልክ:</b> <code>${escapeHtml(searchTarget)}</code>
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 ደንበኛው ትዕዛዝ አላገኘም፤ እርዳታ ሊያስፈልገው ይችላል።
`;
        bot.telegram.sendMessage(WORKER_CHAT_ID, lookupMissingAlert, {
          parse_mode: 'HTML'
        }).catch(() => {});
      }
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/:code/ping with Customer Ping Rate Limiter
app.post('/api/orders/:code/ping', customerPingLimiter, async (req, res) => {
  try {
    const code = req.params.code;
    const { phone, note, customerName, telegramId } = req.body;

    const order = await getOrderByCode(code);
    const cleanPhone = normalizePhone(phone || (order ? order.customer_phone : null));

    if (!cleanPhone && !order) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number or order code required for follow-up ping',
      });
    }

    const recordedPing = await recordCustomerPing({
      referenceCode: code,
      customerPhone: cleanPhone || 'Unknown',
      customerName: customerName || null,
      customerTelegramId: telegramId || order?.customer_telegram_id || null,
      pingType: 'status_followup',
      customerNote: note || 'ደንበኛ ወቅታዊ ሁኔታ ማወቅ ይፈልጋል (Customer requested status update)',
      assignedWorker: order?.assigned_worker || WORKER_USERNAME,
    });

    // Notify assigned workers immediately
    if (WORKER_CHAT_ID && bot) {
      const intlPhone = cleanPhone && cleanPhone.startsWith('0') ? `+251${cleanPhone.slice(1)}` : cleanPhone;
      const pingAlert = `
🚨 <b>አስቸኳይ፡ ደንበኛ ሁኔታ እንዲጣራለት ጠየቀ! (Customer Inquiry Follow-up / Ping)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(code)}</code>
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone || 'N/A')}</code>
📊 <b>የአሁን ሁኔታ:</b> <code>${escapeHtml(order ? order.status : 'Inquiry')}</code>
📝 <b>የደንበኛው መልዕክት:</b> ${escapeHtml(note || 'ወቅታዊ ሁኔታ እንዲገለጽለት ጠይቋል')}
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡</b>
<code>/reply ${code} የእርስዎ ምላሽ እዚህ ይጻፉ</code>
`;

      bot.telegram.sendMessage(WORKER_CHAT_ID, pingAlert, {
        parse_mode: 'HTML'
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: 'ጥያቄዎ ለአስተናጋጅ ደርሷል! በአጭር ጊዜ ውስጥ ምላሽ ይሰጡዎታል።',
      ping: recordedPing,
    });
  } catch (err) {
    console.error('[Order Ping Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/:code/respond: Worker responds to customer inquiry or updates status with response note
// Direct push to customer on Telegram Bot + Mini App visibility
app.post('/api/orders/:code/respond', async (req, res) => {
  try {
    const code = req.params.code;
    const { responseText, newStatus, workerUsername } = req.body;

    if (!responseText) {
      return res.status(400).json({ success: false, error: 'Response text is required' });
    }

    const order = await getOrderByCode(code);
    const quote = await getQuoteByCode(code);

    const result = await respondToCustomerPing({
      referenceCode: code,
      responseText,
      newStatus: newStatus || null,
      workerUsername: workerUsername || WORKER_USERNAME,
    });

    // Direct push to customer on Telegram Bot if customer telegram ID exists
    let deliveredDirectlyToTelegram = false;
    const targetTelegramId = order?.customer_telegram_id || quote?.customer_telegram_id;

    if (bot && targetTelegramId) {
      try {
        const directCustomerMsg = `
📩 <b>ከአስተናጋጅ የተሰጠ የቀጥታ ምላሽ (Message from Support):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ/የጥያቄ ኮድ:</b> <code>${escapeHtml(code)}</code>
📝 <b>መልዕክት:</b> ${escapeHtml(responseText)}
${newStatus ? `📊 <b>አዲስ ሁኔታ:</b> <code>${escapeHtml(newStatus)}</code>\n` : ''}━━━━━━━━━━━━━━━━━━━━
👉 ጥያቄ ካለዎት እዚህ መልስ መላክ ይችላሉ።
`;
        await bot.telegram.sendMessage(targetTelegramId, directCustomerMsg, { parse_mode: 'HTML' });
        deliveredDirectlyToTelegram = true;
      } catch (err) {
        console.warn('[Telegram Direct Dispatch Warning]', err.message);
      }
    }

    res.json({
      success: true,
      message: 'Response recorded and visible to customer in Mini App tracking',
      deliveredDirectlyToTelegram,
      result,
    });
  } catch (err) {
    console.error('[Worker Response Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:code/pings: Get follow-up inquiry history
app.get('/api/orders/:code/pings', async (req, res) => {
  try {
    const pings = await getCustomerPings(req.params.code);
    res.json({ success: true, pings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve compiled static assets from dist/
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Serve uploaded screenshots
app.use('/uploads', express.static(uploadsDir));

// SPA fallback for frontend client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send(`
<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Korcha (ኮርቻ) - Ethiopia Cross-Border E-Commerce</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafaf9; color: #1c1917; margin: 0; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; text-align: center; }
    .card { background: white; border: 1px solid #e7e5e4; border-radius: 20px; padding: 32px; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .logo { width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; margin: 0 auto 16px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 13px; color: #78716c; line-height: 1.5; margin: 0 0 20px; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
    .links a { display: block; background: #d97706; color: white; text-decoration: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 13px; margin: 8px 0; }
    .links a.secondary { background: #f5f5f4; color: #292524; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ኮ</div>
    <span class="badge">KORCHA ETHIOPIA</span>
    <h1>ኮርቻ የውጭ ገበያ ድልድይ</h1>
    <p>Unified Server is running with Worker Notification, Direct Responses, Abuse Protection & Fallback Reconciliation active.</p>
    <div class="links">
      <a href="/health">የሰርቨር ጤና (API Health)</a>
      <a href="https://t.me/${escapeHtml(WORKER_USERNAME)}" target="_blank" class="secondary">ከአስተናጋጅ ጋር አውራ (@${escapeHtml(WORKER_USERNAME)})</a>
    </div>
  </div>
</body>
</html>
  `);
});

// Start Server & Launch Bot
async function start() {
  try {
    // 1. Run ACID Database Migrations
    await runMigrations();
  } catch (dbErr) {
    console.warn('[DB Warning] Migrations could not run. Continuing in fail-safe mode.', dbErr.message);
  }

  // 2. Start HTTP Server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Korcha Unified Server listening on http://0.0.0.0:${PORT}`);
  });

  // 3. Launch Telegraf Bot if available
  if (bot) {
    bot.launch()
      .then(() => console.log(`[Bot] Korcha Telegram Bot launched successfully. Worker: @${WORKER_USERNAME}`))
      .catch((err) => console.warn('[Bot Launch Warning] Telegraf launch deferred:', err.message));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

start();