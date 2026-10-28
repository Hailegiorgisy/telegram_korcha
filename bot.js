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
  getQuotesByPhone,
  resolveTrackingTarget,
  createOrder,
  getOrderByCode,
  getOrdersByPhone,
  getPendingQuotes,
  getPendingOrders,
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

// RBAC Helper: Strictly verify that the user's Telegram username is @korcha_support
function isAuthorizedWorkerUsername(username) {
  if (!username) return false;
  return String(username).replace(/^@/, '').trim().toLowerCase() === WORKER_USERNAME.toLowerCase();
}

// Express RBAC Middleware for Shelf & Category Editing APIs
function requireWorkerRBAC(req, res, next) {
  const reqUsername =
    req.headers['x-telegram-username'] ||
    req.body?.workerUsername ||
    req.body?.createdBy ||
    req.query?.workerUsername;

  if (!isAuthorizedWorkerUsername(reqUsername)) {
    return res.status(403).json({
      success: false,
      error: `⛔ Access Denied (RBAC): ይህ ፈቃድ ለ @${WORKER_USERNAME} ብቻ የተሰጠ ነው።`,
    });
  }
  next();
}
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;
const TELEBIRR_PHONE = process.env.TELEBIRR_PHONE || process.env.VITE_TELEBIRR_PHONE || '+251-996237800';
const CBE_ACCOUNT = process.env.CBE_ACCOUNT || process.env.VITE_CBE_ACCOUNT || '10001116390';
const AUTO_TRACKING_RESPONSE = 'ዕቃዎ የደረሰበትን ቦታ/ሁኔታ ሰራተኛችኝ ያሳውቅዎታል። ትንሽ ይጠብቁ።';

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
    userSessions.set(userId, { state: 'IDLE', data: {}, activeTicket: null });
  }
  return userSessions.get(userId);
}

function clearSession(userId) {
  const existing = userSessions.get(userId);
  userSessions.set(userId, { state: 'IDLE', data: {}, activeTicket: existing?.activeTicket || null });
}

function resetSessionCompletely(userId) {
  userSessions.set(userId, { state: 'IDLE', data: {}, activeTicket: null });
}

// Main Reply Keyboard with Payment Marketing Button
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
    [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት (Open Mini App)', WEB_APP_URL)],
  ]).resize();
}

// Dedicated Worker Operations Menu Keyboard (Exclusively for @korcha_support)
function getWorkerMenuKeyboard() {
  return Markup.keyboard([
    ['📋 ያልተመለሱ ጥያቄዎች (Pending Quotes)', '💰 የክፍያ ማረጋገጫዎች (Pending Deposits)'],
    ['🛒 የመደርደሪያ እቃዎች አስተዳድር', '💬 የደንበኞች መልዕክቶች'],
    [Markup.button.webApp('🛠️ የሰራተኛ ሚኒ አፕ (Worker TMA)', WEB_APP_URL)],
  ]).resize();
}

function isWorkerContext(ctx) {
  const username = ctx.from?.username;
  const chatId = String(ctx.chat?.id || '');
  const userId = String(ctx.from?.id || '');
  return isAuthorizedWorkerUsername(username) || 
         (WORKER_CHAT_ID && (chatId === String(WORKER_CHAT_ID) || userId === String(WORKER_CHAT_ID)));
}

async function sendWorkerHub(ctx) {
  const workerHubMsg = `
👨‍💼 <b>የኮርቻ ሰራተኛ መቆጣጠሪያ ማዕከል (Korcha Support Operations Hub)</b>
━━━━━━━━━━━━━━━━━━━━
ሰላም <b>@${escapeHtml(WORKER_USERNAME)}</b>! ለእርስዎ የሚያስፈልጉ የስራ ተግባራት ብቻ ተዘጋጅተዋል፡

📋 <b>ዋጋ ያልተሰጣቸው ጥያቄዎች:</b> <code>/quotes</code>
💰 <b>የክፍያ ማረጋገጫ የሚጠብቁ:</b> <code>/orders</code>
🛒 <b>የመደርደሪያ እቃዎች አስተዳደር:</b> <code>/shelf</code> ወይም <code>/addproduct</code>
💬 <b>ለደንበኛ መልስ ለመስጠት:</b> <code>/reply &lt;ትኬት/ስልክ&gt; &lt;መልዕክት&gt;</code>
✅ <b>ክፍያ አረጋግጦ ማድረሻ ቀን ለመላክ:</b> <code>/confirm &lt;ኮድ&gt; &lt;ቀን&gt;</code>
━━━━━━━━━━━━━━━━━━━━
👉 ከታች ያሉትን የሰራተኛ ቁልፎች ይጫኑ 👇
`.trim();

  return ctx.replyWithHTML(workerHubMsg, getWorkerMenuKeyboard());
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

      // Record initial customer message in continuous ticket chat thread
      await addTicketMessage({
        ticketCode: quoteCode,
        senderRole: 'customer',
        senderName: username,
        senderTelegramId: userId,
        customerPhone: cleanPhone,
        messageText: safeData.details || (safeData.marketplace ? `[ገበያ: ${safeData.marketplace}]` : 'የእቃ ዋጋ ጥያቄ ተመዝግቧል'),
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
1. ሰራተኛችን እቃውን ገምግሞ አጠቃላይ ዋጋ በብር ያሰላል።
2. የዋጋ ዝርዝሩ በቴሌግራም ወይም በስልክዎ ይላክልዎታል።
3. 40% ቅድመ ክፍያ በቴሌብር ወይም በንግድ ባንክ (CBE) ከፍለው ትዕዛዝዎ ይረጋገጣል!

👉 ጥያቄ ካለዎት በቀጥታ ከሰራተኛ ጋር ይገናኙ፡
<b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>
`.trim();

    try {
      await ctx.replyWithHTML(
        confirmationText,
        Markup.inlineKeyboard([
          Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
        ])
      );
    } catch (htmlErr) {
      console.warn('[Confirmation HTML Send Warning]', htmlErr.message);
      await ctx.reply(
        `🎉 ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!\n\n🏷️ የጥያቄ ኮድ: ${quoteCode}\n📱 ስልክ ቁጥር: ${cleanPhone}\n\nሰራተኛችን በቅርቡ ያነጋግርዎታል: @${WORKER_USERNAME}`
      );
    }

    // Activate continuous two-way ticket chat session for this customer (Reset state to IDLE so all follow-up messages route to chat!)
    const userSession = getSession(userId);
    userSession.state = 'IDLE';
    userSession.activeTicket = quoteCode;
    userSession.data = { phone: cleanPhone };

    await ctx.reply(
      `💬 ማንኛውም ተጨማሪ ጥያቄ ወይም መልዕክት ካለዎት እዚህ በቀጥታ መጻፍ ይችላሉ። ሰራተኛችን ወዲያውኑ መልስ ይሰጥዎታል። (ውይይቱን ለመጨረስ /menu ይጫኑ)፡`,
      Markup.keyboard([
        ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
        ['🏠 ወደ ዋና ገጽ (Main Menu)']
      ]).resize()
    );

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
<code>/reply ${quoteCode} ዋጋው 3,000 ብር ነው። 40% ቅድመ ክፍያ 1,200 ብር ነው። ከተስማሙ የዋጋው 40% በቴሌብር (${escapeHtml(TELEBIRR_PHONE)}) ወይንም በ CBE (${escapeHtml(CBE_ACCOUNT)}) ያስገቡ:: ዕቃዎት በ10-14 ቀን ይደርሳል:: (እቃው ከ Shelf ከሆነ በአንድ ቀን ውስጥ ይደርሳል)::</code>
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

      if (isWorkerContext(ctx)) {
        return sendWorkerHub(ctx);
      }

      const welcomeMessage = `
👋 <b>እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!</b>
<i>የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</i>

ከ <b>Shein, Amazon, ወይም AliExpress</b> ላይ የፈለጉትን እቃ ይዘዙ። ሰራተኞቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

💳 <b>ልዩ የክፍያ ዋስትና፡</b>
• 100% በብር በ <b>Telebirr</b> ወይም <b>CBE Birr</b> ይክፈሉ
• 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% ሲረከቡ የሚከፈል (COD)
• 0% የውጭ ምንዛሪ ተጨማሪ ክፍያ

📌 <b>እንዴት ማዘዝ ይችላሉ?</b>
1️⃣ <b>ሊንክ ወይም ፎቶ ያስገቡ</b> (የእቃውን ሊንክ ወይም ስክሪንሾት ይላኩ)
2️⃣ <b>ዝርዝሩን ይሙሉ</b> (መጠን፣ ቀለም፣ ብዛት)
3️⃣ <b>ስልክ ቁጥርዎን ያስገቡ</b> (ዋጋው ሲሰላ በሰራተኛ ይደርስዎታል)

ከታች ያሉትን ምርጫዎች ይጠቀሙ 👇
`;
      await ctx.replyWithHTML(welcomeMessage, getMainMenuKeyboard());
    });

    // FEATURE 2: 💳 የክፍያ አማራጮች (Telebirr & CBE Birr Marketing Promotion)
    bot.hears(['/payment', '/promo', 'ቴሌብር', 'ንግድ ባንክ'], async (ctx) => {
      const promoMessage = `
🔥 <b>ልዩ የክፍያ አማራጭ ማስታወቂያ (Payment Marketing)!</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>100% በኢትዮጵያ ብር (ETB) ይክፈሉ!</b>
የውጭ ሀገር ቪዛ/ማስተርካርድ ካርድ አያስፈልግዎትም።

⚡ <b>የክፍያ አማራጮች፡</b>
1️⃣ <b>ቴሌብር (Telebirr):</b>
📱 ስልክ፡ <code>${escapeHtml(TELEBIRR_PHONE)}</code>
🔹 40% ቅድመ ክፍያ • ፈጣን ማረጋገጫ

2️⃣ <b>የኢትዮጵያ ንግድ ባንክ (CBE / CBE Birr):</b>
🏦 ሂሳብ ቁጥር፡ <code>${escapeHtml(CBE_ACCOUNT)}</code>
🔹 በሞባይል ባንኪንግ ወይም በቅርንጫፍ • አስተማማኝ

🛡️ <b>የኮርቻ የክፍያ ዋስትና፡</b>
✅ 0% የውጭ ምንዛሪ ጭማሪ ክፍያ (Zero Forex Markup)
✅ 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% እቃው አዲስ አበባ ሲደርስ
━━━━━━━━━━━━━━━━━━━━
👉 እቃ ለማዘዝ ሊንክ ወይም ስክሪንሾት ይላኩልን!
`;
      await ctx.replyWithHTML(
        promoMessage,
        Markup.inlineKeyboard([
          [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት', WEB_APP_URL)],
          [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
        ])
      );
    });

    // FEATURE 1 & 3: Worker Direct Reply Command (/reply <code> <message...>)
    bot.hears(/^\/reply\s+([A-Za-z0-9\-]+)\s+([\s\S]+)$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);

      if (WORKER_CHAT_ID && senderChatId !== String(WORKER_CHAT_ID) && senderId !== String(WORKER_CHAT_ID)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }

      const code = ctx.match[1].trim();
      const replyMessage = ctx.match[2].trim();
      const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');

      try {
        const normalizedTarget = isValidEthiopianPhone(code) ? normalizePhone(code) : code;
        const resolved = await resolveTrackingTarget(normalizedTarget);
        const canonicalCode = resolved?.canonicalCode || normalizedTarget;

        // 1. Record response in database (visible in Mini App tracking under both searched target & canonical code)
        await respondToCustomerPing({
          referenceCode: canonicalCode,
          responseText: replyMessage,
          workerUsername: workerName,
        });
        if (normalizedTarget !== canonicalCode) {
          await respondToCustomerPing({
            referenceCode: normalizedTarget,
            responseText: replyMessage,
            workerUsername: workerName,
          });
        }

        // 2. Append worker message to ticket chat thread for continuous history
        await addTicketMessage({
          ticketCode: canonicalCode,
          senderRole: 'worker',
          senderName: workerName,
          customerPhone: resolved?.customerPhone || null,
          messageText: replyMessage,
        });
        if (normalizedTarget !== canonicalCode) {
          await addTicketMessage({
            ticketCode: normalizedTarget,
            senderRole: 'worker',
            senderName: workerName,
            customerPhone: resolved?.customerPhone || null,
            messageText: replyMessage,
          });
        }

        // 3. Direct message customer on Telegram Bot with active reply session
        let deliveredToTelegram = false;
        const targetTelegramId = resolved?.customerTelegramId;

        if (targetTelegramId) {
          const targetSession = getSession(targetTelegramId);
          targetSession.activeTicket = code;

          const directMsg = `
💬 <b>ከኮርቻ ሰራተኛ የተሰጠ መልዕክት (Support Reply):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(canonicalCode)}</code>
📝 "${escapeHtml(replyMessage)}"
━━━━━━━━━━━━━━━━━━━━
👉 በዋጋው ከተስማሙ <b>"✅ በዋጋው ተስማምቻለሁ"</b> የሚለውን ይጫኑ ወይም ለሰራተኛው እዚህ በቀጥታ ይጻፉ።
`.trim();
          await bot.telegram.sendMessage(targetTelegramId, directMsg, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ በዋጋው ተስማምቻለሁ', `agree_price:${canonicalCode}`),
                Markup.button.callback('❌ ዋጋው አልተስማማሁም', `decline_price:${canonicalCode}`)
              ],
              [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
            ])
          });
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

    // FEATURE: Worker Confirm Payment Command (/confirm <code> [delivery_window])
    // Sends exact required confirmation: "ክፍያዎ ተፈጽሟል። ዕቃዎ በ ... ይደርሳል።"
    bot.hears(/^\/confirm\s+([A-Za-z0-9\-]+)(?:\s+([\s\S]+))?$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      if (WORKER_CHAT_ID && senderChatId !== String(WORKER_CHAT_ID) && senderId !== String(WORKER_CHAT_ID)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }

      const code = ctx.match[1].trim();
      const rawDelivery = ctx.match[2] ? ctx.match[2].trim() : '10-14 ቀን';
      const cleanDelivery = rawDelivery.replace(/^በ\s*/, '').replace(/ይደርሳል\.?$/, '').trim();
      const deliveryText = cleanDelivery.startsWith('በ') ? cleanDelivery : `በ${cleanDelivery}`;
      const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');

      const resolved = await resolveTrackingTarget(code);
      const canonicalCode = resolved?.canonicalCode || code;

      // Update status to deposit_verified
      try {
        await updateOrderStatus(canonicalCode, 'deposit_verified', workerName, `ክፍያ ተረጋግጧል — እቃው ${deliveryText} ይደርሳል`);
      } catch (_) {}

      const confirmMessage = `ክፍያዎ ተፈጽሟል። ዕቃዎ ${deliveryText} ይደርሳል።`;

      // Record in ticket chat
      await addTicketMessage({
        ticketCode: canonicalCode,
        senderRole: 'worker',
        senderName: workerName,
        customerPhone: resolved?.customerPhone || null,
        messageText: confirmMessage,
      });

      // Send to customer on Bot
      let delivered = false;
      const targetTelegramId = resolved?.customerTelegramId;
      if (targetTelegramId) {
        const directCustomerMsg = `
🎉 <b>ክፍያዎ ተፈጽሟል። ዕቃዎ ${escapeHtml(deliveryText)} ይደርሳል።</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(canonicalCode)}</code>
📊 <b>ሁኔታ:</b> ክፍያ ተረጋግጧል (Deposit Verified)
🚚 <b>የሚደርስበት ጊዜ:</b> <b>${escapeHtml(deliveryText)}</b>
━━━━━━━━━━━━━━━━━━━━
👉 የትዕዛዝዎን ሁኔታ በማንኛውም ጊዜ <b>📦 የትዕዛዝ ሁኔታ መከታተያ</b> በመጠቀም መከታተል ይችላሉ!
`.trim();

        await bot.telegram.sendMessage(targetTelegramId, directCustomerMsg, {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
            ['🏠 ወደ ዋና ገጽ (Main Menu)']
          ]).resize()
        }).catch(() => {});
        delivered = true;
      }

      await ctx.replyWithHTML(`
✅ <b>ክፍያ ተረጋግጦ ለደንበኛው ማረጋገጫ ተልኳል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ኮድ:</b> <code>${escapeHtml(canonicalCode)}</code>
📝 <b>መልዕክት:</b> ${escapeHtml(confirmMessage)}
📱 <b>በቦት ደርሷል:</b> ${delivered ? '✅ አዎ (Direct push sent to customer)' : '🌐 በሚኒ አፕ መከታተያ ላይ ተመዝግቧል'}
━━━━━━━━━━━━━━━━━━━━
`);
    });


    // WORKER COMMAND: Add Product to Shelf (/addproduct <category> | <name> | <price> | <size> | [photo_url])
    bot.hears(/^\/addproduct(?:\s+([\s\S]+))?$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      const senderUsername = ctx.from.username ? ctx.from.username.replace(/^@/, '') : '';

      const isAuthorized = isAuthorizedWorkerUsername(senderUsername);

      if (!isAuthorized) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኛ (@' + WORKER_USERNAME + ') ብቻ የተፈቀደ ነው (Authorized workers only).');
      }

      const input = ctx.match[1] ? ctx.match[1].trim() : '';
      let photoUrl = '';

      // Check if sent as a reply to a photo message
      if (ctx.message.reply_to_message && ctx.message.reply_to_message.photo) {
        const photos = ctx.message.reply_to_message.photo;
        const fileId = photos[photos.length - 1].file_id;
        try {
          const link = await ctx.telegram.getFileLink(fileId);
          photoUrl = link.href;
        } catch (_) {
          photoUrl = fileId;
        }
      }

      if (!input) {
        return ctx.replyWithHTML(
          `📌 <b>መደርደሪያ ላይ አዲስ እቃ ለመጨመር (Add Product):</b>\n\n` +
          `<b>አጠቃቀም:</b>\n<code>/addproduct &lt;ምድብ&gt; | &lt;የእቃ ስም&gt; | &lt;ዋጋ በብር&gt; | &lt;መጠን/ሳይዝ&gt; | [የፎቶ ሊንክ]</code>\n\n` +
          `<b>የምድብ ኮዶች (6 Categories):</b>\n` +
          `• <code>womens</code> (የሴቶች አልባሳት)\n` +
          `• <code>kids</code> (የህጻናት)\n` +
          `• <code>beauty</code> (የመዋቢያ ዕቃዎች)\n` +
          `• <code>electronics</code> (ኤሌክትሮኒክስ)\n` +
          `• <code>home</code> (የቤት ውስጥ መገልገያዎች)\n` +
          `• <code>miscellaneous</code> (ሌሎች)\n\n` +
          `<b>ምሳሌ:</b>\n<code>/addproduct womens | የሴቶች የሚያምር ቀሚስ | 2800 | M, L, XL | https://...</code>\n\n` +
          `💡 <i>ምክር: ፎቶውን በቴሌግራም ልከው ፎቶው ላይ reply በማድረግ /addproduct መጠቀም ይችላሉ!</i>`
        );
      }

      const parts = input.split('|').map(p => p.trim());
      const rawCat = parts[0] || 'miscellaneous';
      const name = parts[1] || 'የተመረጠ እቃ';
      const price = parseFloat(parts[2]) || 0;
      const size = parts[3] || 'Standard';
      if (!photoUrl && parts[4]) photoUrl = parts[4];

      // Map category ID
      let categoryId = 'miscellaneous';
      const catLower = rawCat.toLowerCase();
      if (catLower.includes('women') || catLower.includes('ሴት')) categoryId = 'womens';
      else if (catLower.includes('kid') || catLower.includes('ህጻን') || catLower.includes('ልጅ')) categoryId = 'kids';
      else if (catLower.includes('beauty') || catLower.includes('መዋቢያ') || catLower.includes('ውበት')) categoryId = 'beauty';
      else if (catLower.includes('elect') || catLower.includes('ስልክ') || catLower.includes('ኤሌክትሮ')) categoryId = 'electronics';
      else if (catLower.includes('home') || catLower.includes('kitchen') || catLower.includes('ቤት')) categoryId = 'home';

      if (!photoUrl) {
        photoUrl = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80';
      }

      try {
        const prod = await addShelfProduct({
          categoryId,
          name,
          size,
          priceEtb: price,
          photoUrl,
          isBestseller: false,
          createdBy: senderUsername || WORKER_USERNAME,
        });

        await ctx.replyWithHTML(
          `✅ <b>እቃው በተሳካ ሁኔታ መደርደሪያው ላይ ተጨምሯል!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>ID:</b> <code>${prod.id}</code>\n` +
          `📁 <b>ምድብ:</b> <code>${prod.category_id}</code>\n` +
          `📦 <b>ስም:</b> ${escapeHtml(prod.name)}\n` +
          `📏 <b>ሳይዝ:</b> ${escapeHtml(prod.size)}\n` +
          `💰 <b>ዋጋ:</b> ${prod.price_etb} ETB\n━━━━━━━━━━━━━━━━━━━━\n` +
          `👉 ደንበኞች በሚኒ አፑ ላይ ወዲያውኑ ማየትና መግዛት ይችላሉ!`
        );
      } catch (err) {
        ctx.reply(`❌ ስህተት ተከስቷል: ${err.message}`);
      }
    });

    // WORKER COMMAND: Edit Product on Shelf (/editproduct <id> | <field> | <value>)
    bot.hears(/^\/editproduct\s+(\d+)\s*\|\s*([A-Za-z_]+)\s*\|\s*([\s\S]+)$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      const senderUsername = ctx.from.username ? ctx.from.username.replace(/^@/, '') : '';

      const isAuthorized = isAuthorizedWorkerUsername(senderUsername);

      if (!isAuthorized) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኛ ብቻ የተፈቀደ ነው።');
      }

      const id = ctx.match[1].trim();
      const field = ctx.match[2].trim().toLowerCase();
      const value = ctx.match[3].trim();

      const updates = {};
      if (field === 'name') updates.name = value;
      else if (field === 'size') updates.size = value;
      else if (field === 'price' || field === 'price_etb') updates.priceEtb = parseFloat(value);
      else if (field === 'photo' || field === 'photo_url') updates.photoUrl = value;
      else if (field === 'category' || field === 'category_id') updates.categoryId = value;
      else if (field === 'bestseller') updates.isBestseller = (value === 'true' || value === '1' || value === 'yes');
      else {
        return ctx.reply('⚠️ ልክ ያልሆነ ፊልድ! የሚፈቀዱት: name, size, price, photo, category, bestseller');
      }

      try {
        const updated = await updateShelfProduct(id, updates);
        if (!updated) {
          return ctx.reply(`⚠️ እቃ ቁጥር ${id} አልተገኘም።`);
        }
        await ctx.replyWithHTML(
          `✅ <b>እቃ ቁጥር ${id} ተስተካክሏል!</b>\n` +
          `📦 ስም: ${escapeHtml(updated.name)}\n` +
          `📏 ሳይዝ: ${escapeHtml(updated.size)}\n` +
          `💰 ዋጋ: ${updated.price_etb} ETB`
        );
      } catch (err) {
        ctx.reply(`❌ ስህተት: ${err.message}`);
      }
    });

    // WORKER COMMAND: Delete Product (/deleteproduct <id>)
    bot.hears(/^\/deleteproduct\s+(\d+)$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      const senderUsername = ctx.from.username ? ctx.from.username.replace(/^@/, '') : '';

      const isAuthorized = isAuthorizedWorkerUsername(senderUsername);

      if (!isAuthorized) return ctx.reply('⚠️ ለአስተዳዳሪ ብቻ የተፈቀደ ነው።');

      const id = ctx.match[1].trim();
      try {
        await deleteShelfProduct(id);
        ctx.reply(`✅ እቃ ቁጥር ${id} ከመደርደሪያው ተሰርዟል።`);
      } catch (err) {
        ctx.reply(`❌ ስህተት: ${err.message}`);
      }
    });

    // WORKER COMMAND: Edit Shelf Category (/editcategory <id> | <nameAm> | [nameEn] | [icon])
    bot.hears(/^\/editcategory(?:\s+([\s\S]+))?$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      const senderUsername = ctx.from.username ? ctx.from.username.replace(/^@/, '') : '';

      const isAuthorized = isAuthorizedWorkerUsername(senderUsername);

      if (!isAuthorized) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኛ (@' + WORKER_USERNAME + ') ብቻ የተፈቀደ ነው።');
      }

      const input = ctx.match[1] ? ctx.match[1].trim() : '';
      if (!input) {
        return ctx.replyWithHTML(
          `📌 <b>የመደርደሪያ ምድብ ለማስተካከል (Edit Category):</b>\n\n` +
          `<b>አጠቃቀም:</b>\n<code>/editcategory &lt;id&gt; | &lt;የአማርኛ ስም&gt; | [የእንግሊዝኛ ስም] | [አይከን]</code>\n\n` +
          `<b>የምድብ ኮዶች (6 Categories):</b> <code>womens</code>, <code>kids</code>, <code>beauty</code>, <code>electronics</code>, <code>home</code>, <code>miscellaneous</code>\n\n` +
          `<b>ምሳሌ:</b>\n<code>/editcategory womens | የሴቶች አልባሳት | Women's Clothing | 👗</code>`
        );
      }

      const parts = input.split('|').map(p => p.trim());
      const catId = parts[0]?.toLowerCase();
      const nameAm = parts[1];
      const nameEn = parts[2];
      const icon = parts[3];

      const updated = await updateShelfCategory(catId, { nameAm, nameEn, icon });
      if (!updated) {
        return ctx.reply(`⚠️ ምድብ "${catId}" አልተገኘም። የሚፈቀዱት: womens, kids, beauty, electronics, home, miscellaneous`);
      }

      await ctx.replyWithHTML(
        `✅ <b>ምድብ ተስተካክሏል (Category Updated)!</b>\n` +
        `🆔 <b>ID:</b> <code>${escapeHtml(updated.id)}</code>\n` +
        `🏷️ <b>ስም (Amharic):</b> ${escapeHtml(updated.nameAm)}\n` +
        `🌐 <b>ስም (English):</b> ${escapeHtml(updated.nameEn)}\n` +
        `✨ <b>Icon:</b> ${escapeHtml(updated.icon)}`
      );
    });

    // WORKER & CUSTOMER: View Shelf Products (/shelf or /products)
    bot.hears(['/shelf', '/products', 'መደርደሪያ', 'የሚሸጡ እቃዎች'], async (ctx) => {
      try {
        const products = await getShelfProducts();
        if (products.length === 0) {
          return ctx.reply('በዚህ ዝርዝር ውስጥ የሚሸጥ ዕቃ ጨርሰናል። እባክዎ በቴሌግራም ቦት ወይንም በሚኒ አፕ ይዘዙን።');
        }

        await ctx.replyWithHTML(`🛍️ <b>በኮርቻ መደርደሪያ ላይ ያሉ እቃዎች (${products.length} እቃዎች):</b>`);
        for (const p of products.slice(0, 5)) {
          const buyMsg = `
📦 <b>${escapeHtml(p.name)}</b>
📁 ምድብ: <code>${escapeHtml(p.category_id)}</code>
📏 መጠን/ሳይዝ: <code>${escapeHtml(p.size || 'Standard')}</code>
💰 ዋጋ: <b>${p.price_etb} ETB</b>
━━━━━━━━━━━━━━━━━━━━
👉 ይህን እቃ ለመግዛት ከታች ያለውን ይጫኑ 👇
`.trim();

          const buttons = [
            [Markup.button.callback(`🛒 ይግዙ (${p.price_etb} ETB)`, `buy_product:${p.id}`)],
            [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ`, `https://t.me/${WORKER_USERNAME}`)]
          ];

          if (p.photo_url && (p.photo_url.startsWith('http://') || p.photo_url.startsWith('https://'))) {
            await ctx.replyWithPhoto(p.photo_url, {
              caption: buyMsg,
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard(buttons)
            }).catch(() => ctx.replyWithHTML(buyMsg, Markup.inlineKeyboard(buttons)));
          } else {
            await ctx.replyWithHTML(buyMsg, Markup.inlineKeyboard(buttons));
          }
        }
      } catch (err) {
        console.error('[Shelf View Error]', err);
        ctx.reply('በዚህ ዝርዝር ውስጥ የሚሸጥ ዕቃ ጨርሰናል። እባክዎ በቴሌግራም ቦት ወይንም በሚኒ አፕ ይዘዙን።');
      }
    });

    // CUSTOMER ACTION: Direct Buy from Shelf (buy_product:<id>)
    bot.action(/^buy_product:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const prodId = ctx.match[1];
      const products = await getShelfProducts();
      const product = products.find(p => String(p.id) === String(prodId));

      if (!product) {
        return ctx.reply('በዚህ ዝርዝር ውስጥ የሚሸጥ ዕቃ ጨርሰናል። እባክዎ በቴሌግራም ቦት ወይንም በሚኒ አፕ ይዘዙን።');
      }

      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const ticketCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Create quote record for this purchase
      await createQuote({
        quoteCode: ticketCode,
        customerTelegramId: userId,
        customerPhone: 'Awaiting Phone',
        sourceType: 'link',
        productUrl: product.photo_url,
        details: `[የቀጥታ መደርደሪያ ግዢ] እቃ: ${product.name} | መጠን: ${product.size || 'N/A'} | ዋጋ: ${product.price_etb} ETB`,
      });

      // 2. Set active ticket
      const session = getSession(userId);
      session.activeTicket = ticketCode;

      // 3. User purchase details & payment prompt
      const depositAmount = Math.round(product.price_etb * 0.4);
      const buyText = `
🎉 <b>የእቃ ግዢ ጥያቄዎ ተመዝግቧል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(ticketCode)}</code>
📦 <b>እቃ:</b> ${escapeHtml(product.name)}
📏 <b>ሳይዝ:</b> ${escapeHtml(product.size || 'Standard')}
💰 <b>ጠቅላላ ዋጋ:</b> <b>${product.price_etb} ETB</b>
💵 <b>40% ቅድመ ክፍያ:</b> <b>${depositAmount} ETB</b>
━━━━━━━━━━━━━━━━━━━━
💳 <b>የክፍያ አማራጮች፡</b>
1️⃣ <b>ቴሌብር (Telebirr):</b> <code>+251-996237800</code>
2️⃣ <b>የኢትዮጵያ ንግድ ባንክ (CBE):</b> <code>10001116390</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ቀጣይ እርምጃ:</b>
40% ቅድመ ክፍያ ${depositAmount} ብር ከፍለው የደረሰኙን ስክሪንሾት እዚህ ይላኩልን ወይም በቀጥታ ከሰራተኛችን (@${WORKER_USERNAME}) ጋር ያረጋግጡ!
`.trim();

      await ctx.replyWithHTML(
        buyText,
        Markup.inlineKeyboard([
          [Markup.button.url(`💬 ከሰራተኛ ጋር አረጋግጥ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)],
          [Markup.button.callback('💬 ከሰራተኛ ጋር አውራ', `chat_ticket:${ticketCode}`)]
        ])
      );

      // 4. Alert worker immediately
      if (WORKER_CHAT_ID && bot) {
        const workerBuyAlert = `
🚨 <b>አዲስ የመደርደሪያ እቃ ግዢ ጥያቄ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(ticketCode)}</code>
📦 <b>እቃ:</b> ${escapeHtml(product.name)}
📏 <b>ሳይዝ:</b> ${escapeHtml(product.size || 'Standard')}
💰 <b>ዋጋ:</b> ${product.price_etb} ETB (ቅድመ ክፍያ: ${depositAmount} ETB)
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${ticketCode} ሰላም፣ እቃዎ ተይዞልዎታል። ክፍያዎን ...</code>
`.trim();

        await bot.telegram.sendMessage(WORKER_CHAT_ID, workerBuyAlert, { parse_mode: 'HTML' }).catch(() => {});
      }
    });



    // WORKER COMMAND: 📋 ያልተመለሱ ጥያቄዎች (Pending Quotes)
    bot.hears(['📋 ያልተመለሱ ጥያቄዎች (Pending Quotes)', '/quotes', '/pending'], async (ctx) => {
      if (!isWorkerContext(ctx)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }
      const quotes = await getPendingQuotes(5);
      if (!quotes || quotes.length === 0) {
        return ctx.replyWithHTML('✅ <b>በአሁኑ ሰዓት ዋጋ ያልተሰላለት አዲስ የእቃ ጥያቄ የለም!</b>', getWorkerMenuKeyboard());
      }

      let text = `📋 <b>ዋጋ ያልተሰጣቸው አዳዲስ የእቃ ጥያቄዎች (${quotes.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      for (const q of quotes) {
        text += `🏷️ <b>ኮድ:</b> <code>${q.quote_code}</code>\n`;
        text += `📱 <b>ስልክ:</b> <code>${q.customer_phone || 'N/A'}</code>\n`;
        text += `🛍️ <b>ዓይነት:</b> ${q.source_type === 'link' ? 'ሊንክ' : 'ስክሪንሾት'}\n`;
        if (q.product_url) text += `🔗 <b>ሊንክ:</b> ${q.product_url}\n`;
        text += `📝 <b>ዝርዝር:</b> ${escapeHtml(q.details || 'N/A')}\n`;
        text += `👉 <b>ዋጋ ለመመለስ፡</b>\n<code>/reply ${q.quote_code} ዋጋው ... ብር ነው። 40% ቅድመ ክፍያ ... ብር በቴሌብር/CBE ይክፈሉ።</code>\n━━━━━━━━━━━━━━━━━━━━\n`;
      }
      return ctx.replyWithHTML(text, getWorkerMenuKeyboard());
    });

    // WORKER COMMAND: 💰 የክፍያ ማረጋገጫዎች (Pending Deposits)
    bot.hears(['💰 የክፍያ ማረጋገጫዎች (Pending Deposits)', '/orders', '/unconfirmed'], async (ctx) => {
      if (!isWorkerContext(ctx)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }
      const orders = await getPendingOrders(5);
      if (!orders || orders.length === 0) {
        return ctx.replyWithHTML('✅ <b>ማረጋገጫ የሚጠብቅ የክፍያ ትዕዛዝ የለም!</b>', getWorkerMenuKeyboard());
      }

      let text = `💰 <b>ክፍያ ማረጋገጫ የሚጠብቁ ትዕዛዞች (${orders.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      for (const o of orders) {
        text += `🏷️ <b>ትዕዛዝ:</b> <code>${o.order_code}</code>\n`;
        text += `📱 <b>ስልክ:</b> <code>${o.customer_phone}</code>\n`;
        text += `💵 <b>ጠቅላላ ዋጋ:</b> ${o.total_price_etb || 'N/A'} ETB\n`;
        text += `💳 <b>የ40% ቅድመ ክፍያ:</b> ${o.deposit_amount_etb || 'N/A'} ETB\n`;
        text += `👉 <b>ክፍያውን ለማረጋገጥ፡</b>\n<code>/confirm ${o.order_code} በ10-14 ቀን</code>\n━━━━━━━━━━━━━━━━━━━━\n`;
      }
      return ctx.replyWithHTML(text, getWorkerMenuKeyboard());
    });

    // WORKER COMMAND: 🛒 የመደርደሪያ እቃዎች አስተዳድር
    bot.hears(['🛒 የመደርደሪያ እቃዎች አስተዳድር', 'የመደርደሪያ እቃዎች አስተዳድር'], async (ctx) => {
      if (!isWorkerContext(ctx)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }
      const shelfHelp = `
🛒 <b>የመደርደሪያ እቃዎች አስተዳደር (Shelf Operations)</b>
━━━━━━━━━━━━━━━━━━━━
🔹 <b>አዲስ እቃ ለመጨመር፡</b>
<code>/addproduct ስም | ሳይዝ | ዋጋ | ምድብ | ፎቶ_URL</code>
(ምድቦች: <code>womens, mens, electronics, beauty, shoes, home</code>)

🔹 <b>የእቃ ዋጋ ወይም ሁኔታ ለማስተካከል፡</b>
<code>/editproduct &lt;ID&gt; | price_etb | 2500</code>

🔹 <b>እቃ ለማጥፋት፡</b>
<code>/deleteproduct &lt;ID&gt;</code>

🔹 <b>ሁሉንም እቃዎች ለማየት፡</b>
<code>/shelf</code>
━━━━━━━━━━━━━━━━━━━━
💡 <i>በቀላሉ በፎቶና በቅጽ ለማስተካከል ሚኒ አፑን መክፈት ይችላሉ።</i>
`.trim();

      return ctx.replyWithHTML(shelfHelp, Markup.inlineKeyboard([
        [Markup.button.webApp('🛠️ ሚኒ አፕ ላይ አስተካክል (Open Mini App)', WEB_APP_URL)]
      ]));
    });

    // WORKER COMMAND: 💬 የደንበኞች መልዕክቶች
    bot.hears(['💬 የደንበኞች መልዕክቶች', 'የደንበኞች መልዕክቶች'], async (ctx) => {
      if (!isWorkerContext(ctx)) {
        return ctx.reply('⚠️ ይህ ትዕዛዝ ለሰራተኞች ብቻ የተፈቀደ ነው (Authorized workers only).');
      }
      const msgTips = `
💬 <b>የደንበኞች መልዕክትና ጥያቄዎች አያያዝ</b>
━━━━━━━━━━━━━━━━━━━━
ደንበኞች በሚኒ አፕ ወይም በቦት መልዕክት ሲልኩ በቀጥታ እዚህ ቴሌግራም ላይ ይደርስዎታል!

👉 <b>ለማንኛውም ደንበኛ መልስ ለመስጠት፡</b>
1. የደረሰዎትን መልዕክት <b>Swipe አድርገው ቴሌግራም ላይ Reply</b> ያድርጉ (ቦቱ ራሱ ይልካል)
ወይም
2. <code>/reply &lt;ትኬት_ኮድ&gt; &lt;የእርስዎ መልዕክት&gt;</code> ብለው ይጻፉ።
━━━━━━━━━━━━━━━━━━━━
`.trim();
      return ctx.replyWithHTML(msgTips, getWorkerMenuKeyboard());
    });

    // Trigger: 🔗 ሊንክ ያስገቡ
    bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '/link', 'ሊንክ ያስገቡ'], async (ctx) => {
      if (isWorkerContext(ctx)) {
        return sendWorkerHub(ctx);
      }
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
      if (isWorkerContext(ctx)) {
        return sendWorkerHub(ctx);
      }
      const session = getSession(ctx.from.id);
      session.state = 'AWAITING_PHOTO';
      session.data = { sourceType: 'screenshot' };

      await ctx.replyWithHTML(
        `📸 <b>የእቃውን ፎቶ ወይም ስክሪንሾት ይላኩ፡</b>\n\nከ Shein, Amazon ወይም AliExpress ላይ የተነሳውን ግልጽ ፎቶ/ስክሪንሾት እዚህ ይላኩልን 👇`,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    });

    // Trigger: 💬 ከሰራተኛ ጋር አውራ — Activates continuous two-way chat right inside the Bot!
    bot.hears([new RegExp(`ከሰራተኛ ጋር አውራ`, 'i'), '/support', '/chat'], async (ctx) => {
      if (isWorkerContext(ctx)) {
        return ctx.replyWithHTML(
          `👨‍💼 እርስዎ ራሶት ዋናው ሰራተኛ <b>@${escapeHtml(WORKER_USERNAME)}</b> ነዎት! የደንበኞችን ጥያቄዎች ለማየትና ለመመለስ <code>/quotes</code> ወይም <code>/reply</code> ይጠቀሙ።`,
          getWorkerMenuKeyboard()
        );
      }
      const userId = ctx.from.id;
      const session = getSession(userId);
      session.state = 'IDLE';

      let activeCode = session.activeTicket || (await getLatestCustomerTicketByTelegramId(userId));
      if (!activeCode) {
        activeCode = `KC-${String(userId).slice(-6)}`;
      }
      session.activeTicket = activeCode;

      const messages = await getTicketMessages(activeCode);
      let historyText = '';
      if (messages.length > 0) {
        historyText = '\n\n📜 <b>የቀደሙ መልዕክቶች (Recent Messages):</b>\n' + messages.slice(-4).map(m =>
          `${m.sender_role === 'worker' ? '👨‍💼 ሰራተኛ' : '👤 እርስዎ'}: "${escapeHtml(m.message_text)}"`
        ).join('\n');
      }

      await ctx.replyWithHTML(
        `💬 <b>ከኮርቻ ሰራተኛ (@${escapeHtml(WORKER_USERNAME)}) ጋር የቀጥታ ውይይት ተከፍቷል!</b>\n` +
        `🏷️ <b>የውይይት ኮድ (Ticket):</b> <code>${escapeHtml(activeCode)}</code>${historyText}\n\n` +
        `✍️ <b>ጥያቄዎን፣ የዋጋ ግምት ወይም የትዕዛዝ ክትትል መልዕክትዎን እዚህ በቀጥታ ይጻፉ።</b> የፈለጉትን ያህል መልዕክት መጻፍና መነጋገር ይችላሉ! (ውይይቱን ለመጨረስ 🏠 ወደ ዋና ገጽ ይጫኑ) 👇`,
        Markup.keyboard([
          ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
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

    // Trigger: Resume / Continue Chat on Specific Ticket (/chat <ticketCode>)
    bot.hears(/^\/chat\s+([A-Za-z0-9\-]+)$/, async (ctx) => {
      const code = ctx.match[1].trim();
      const session = getSession(ctx.from.id);
      session.activeTicket = code;

      const messages = await getTicketMessages(code);
      let historyText = '';
      if (messages.length > 0) {
        historyText = '\n\n📜 <b>የቀደሙ መልዕክቶች (Recent Chat):</b>\n' + messages.slice(-3).map(m => 
          `${m.sender_role === 'worker' ? '👨‍💼 ሰራተኛ' : '👤 እርስዎ'}: "${escapeHtml(m.message_text)}"`
        ).join('\n');
      }

      await ctx.replyWithHTML(
        `💬 ከሰራተኛ ጋር በትኬት <code>${escapeHtml(code)}</code> የቀጥታ ውይይት ተጀምሯል!${historyText}\n\nመልዕክትዎን እዚህ ይጻፉልን 👇`,
        Markup.keyboard([
          ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
      );
    });

    // Action: Chat on this ticket button from tracking card
    bot.action(/^chat_ticket:(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const code = ctx.match[1];
      const session = getSession(ctx.from.id);
      session.activeTicket = code;

      const messages = await getTicketMessages(code);
      let historyText = '';
      if (messages.length > 0) {
        historyText = '\n\n📜 <b>የቀደሙ መልዕክቶች (Recent Chat):</b>\n' + messages.slice(-3).map(m => 
          `${m.sender_role === 'worker' ? '👨‍💼 ሰራተኛ' : '👤 እርስዎ'}: "${escapeHtml(m.message_text)}"`
        ).join('\n');
      }

      await ctx.replyWithHTML(
        `💬 ከሰራተኛ ጋር በትኬት <code>${escapeHtml(code)}</code> የቀጥታ ውይይት ተጀምሯል!${historyText}\n\nመልዕክትዎን እዚህ ይጻፉልን 👇`,
        Markup.keyboard([
          ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
      );
    });

    // Trigger: 🏠 ወደ ዋና ሜኑ / ዋና ገጽ (Point 6)
    bot.hears(['ወደ ዋና ሜኑ', 'ዋና ሜኑ', 'ዋና ገጽ', '/menu', 'menu', 'home', 'Home'], async (ctx) => {
      resetSessionCompletely(ctx.from.id);
      if (isWorkerContext(ctx)) {
        return sendWorkerHub(ctx);
      }
      await ctx.reply('🏠 ወደ ዋና ገጽ ተመልሰዋል (Main Menu) — ከታች ካሉት አማራጮች ይምረጡ፡', getMainMenuKeyboard());
    });

    // Trigger: ❌ ሰርዝ (Cancel)
    bot.hears(['❌ ሰርዝ (Cancel)', '/cancel'], async (ctx) => {
      clearSession(ctx.from.id);
      await ctx.reply('✅ ተሰርዟል። ወደ ዋና ገጽ ተመልሰዋል (Main Menu) — ከታች ካሉት አማራጮች ይምረጡ፡', getMainMenuKeyboard());
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

        await ctx.answerCbQuery('ጥያቄዎ ለሰራተኛ ደርሷል!');
        await ctx.replyWithHTML(
          `✅ <b>ጥያቄዎ ለሰራተኛችን ደርሷል!</b>\n\nየትዕዛዝ ኮድ <code>${escapeHtml(orderCode)}</code> ወቅታዊ ሁኔታ እንዲጣራልዎት ለሰራተኛችን ማሳወቂያ ተልኳል። በአጭር ጊዜ ውስጥ አጣርተው ያሳውቁዎታል።`
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

    // Robust Photo Handler: Supports Payment Receipts, Support Chat attachments & New Product Quotes
    bot.on('photo', async (ctx) => {
      const session = getSession(ctx.from.id);
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileId = highestResPhoto.file_id;
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');

      // 1. PAYMENT RECEIPT SCREENSHOT HANDLER
      if (session.state === 'AWAITING_PAYMENT_RECEIPT' || (session.activeTicket && session.state === 'CHATTING_WITH_SUPPORT')) {
        const code = session.data?.ticketCode || session.activeTicket;
        session.state = 'CHATTING_WITH_SUPPORT';

        // Record receipt in continuous ticket thread
        await addTicketMessage({
          ticketCode: code,
          senderRole: 'customer',
          senderName: username,
          senderTelegramId: userId,
          customerPhone: session.data?.phone || null,
          messageText: '📸 [የክፍያ ደረሰኝ ስክሪንሾት ተልኳል / Payment Receipt Screenshot]',
        });

        await ctx.replyWithHTML(
          `✅ <b>የክፍያ ደረሰኝዎ ደርሶናል!</b>\n\n🏷️ <b>ትኬት / ትዕዛዝ:</b> <code>${escapeHtml(code)}</code>\n⏳ ሰራተኛችን ክፍያውን አረጋግጦ የማድረሻ ቀኑን ያሳውቅዎታል! ጥቂት ደቂቃ ይጠብቁ።`,
          Markup.keyboard([
            ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
            ['🏠 ወደ ዋና ገጽ (Main Menu)']
          ]).resize()
        );

        if (WORKER_CHAT_ID && bot) {
          const receiptAlert = `
💰 <b>አዲስ የክፍያ ደረሰኝ ስክሪንሾት ደርሷል! (Payment Receipt Submitted)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት / ትዕዛዝ:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📱 <b>ስልክ:</b> <code>${escapeHtml(session.data?.phone || 'N/A')}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ክፍያውን አረጋግጠው ለደንበኛው የማድረሻ ቀን ለመላክ፡</b>
<code>/confirm ${code} በ10-14 ቀን</code>
ወይም
<code>/reply ${code} ክፍያዎ ተፈጽሟል። ዕቃዎ በ ... ይደርሳል።</code>
`.trim();

          const buttons = [];
          if (ctx.from?.username) {
            buttons.push([Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
          }

          await bot.telegram.sendPhoto(WORKER_CHAT_ID, fileId, {
            caption: receiptAlert,
            parse_mode: 'HTML',
            ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
          }).catch(() => {});
        }
        return;
      }

      // 2. SUPPORT CHAT PHOTO ATTACHMENT
      if (session.activeTicket) {
        const code = session.activeTicket;
        await addTicketMessage({
          ticketCode: code,
          senderRole: 'customer',
          senderName: username,
          senderTelegramId: userId,
          customerPhone: session.data?.phone || null,
          messageText: '📸 [ፎቶ ተልኳል / Attached Photo]',
        });

        await ctx.replyWithHTML(
          `✅ <b>ፎቶው ለሰራተኛ ደርሷል!</b> ሰራተኛችን አይቶ መልስ ይሰጥዎታል።`,
          Markup.keyboard([
            ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
          ]).resize()
        );

        if (WORKER_CHAT_ID && bot) {
          const alert = `
📸 <b>አዲስ የደንበኛ ፎቶ ለትኬት ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)}
━━━━━━━━━━━━━━━━━━━━
👉 <b>መልስ ለመስጠት፡</b>
<code>/reply ${code} ...</code>
`.trim();
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, fileId, {
            caption: alert,
            parse_mode: 'HTML',
          }).catch(() => {});
        }
        return;
      }

      // 3. NEW PRODUCT QUOTE SCREENSHOT
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

    // Robust Document Handler: Supports PDF receipts (e.g., CBE / Telebirr PDF exports), files & support attachments
    bot.on('document', async (ctx) => {
      const session = getSession(ctx.from.id);
      const doc = ctx.message.document;
      const fileId = doc.file_id;
      const fileName = doc.file_name || 'document.pdf';
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');

      // 1. PAYMENT RECEIPT DOCUMENT (e.g., CBE Birr / Bank PDF Receipt)
      if (session.state === 'AWAITING_PAYMENT_RECEIPT' || (session.activeTicket && session.state === 'CHATTING_WITH_SUPPORT')) {
        const code = session.data?.ticketCode || session.activeTicket;
        session.state = 'CHATTING_WITH_SUPPORT';

        await addTicketMessage({
          ticketCode: code,
          senderRole: 'customer',
          senderName: username,
          senderTelegramId: userId,
          customerPhone: session.data?.phone || null,
          messageText: `📄 [የክፍያ ሰነድ/ደረሰኝ ተልኳል: ${fileName}]`,
        });

        await ctx.replyWithHTML(
          `✅ <b>የክፍያ ሰነድዎ/ደረሰኝዎ ደርሶናል!</b>\n\n📄 <b>ፋይል:</b> <code>${escapeHtml(fileName)}</code>\n🏷️ <b>ትኬት / ትዕዛዝ:</b> <code>${escapeHtml(code)}</code>\n⏳ ሰራተኛችን ክፍያውን አረጋግጦ የማድረሻ ቀኑን ያሳውቅዎታል! ጥቂት ደቂቃ ይጠብቁ።`,
          Markup.keyboard([
            ['📦 የትዕዛዝ ሁኔታ መከታተያ', '💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
            ['🏠 ወደ ዋና ገጽ (Main Menu)']
          ]).resize()
        );

        if (WORKER_CHAT_ID && bot) {
          const receiptAlert = `
💰 <b>አዲስ የክፍያ ሰነድ/ደረሰኝ (PDF/Doc) ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት / ትዕዛዝ:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📱 <b>ስልክ:</b> <code>${escapeHtml(session.data?.phone || 'N/A')}</code>
📄 <b>ፋይል:</b> ${escapeHtml(fileName)}
━━━━━━━━━━━━━━━━━━━━
👉 <b>ክፍያውን አረጋግጠው ለደንበኛው የማድረሻ ቀን ለመላክ፡</b>
<code>/confirm ${code} በ10-14 ቀን</code>
ወይም
<code>/reply ${code} ክፍያዎ ተፈጽሟል። ዕቃዎ በ ... ይደርሳል።</code>
`.trim();

          const buttons = [];
          if (ctx.from?.username) {
            buttons.push([Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
          }

          await bot.telegram.sendDocument(WORKER_CHAT_ID, fileId, {
            caption: receiptAlert,
            parse_mode: 'HTML',
            ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
          }).catch(() => {});
        }
        return;
      }

      // 2. SUPPORT CHAT DOCUMENT ATTACHMENT
      if (session.activeTicket) {
        const code = session.activeTicket;
        await addTicketMessage({
          ticketCode: code,
          senderRole: 'customer',
          senderName: username,
          senderTelegramId: userId,
          customerPhone: session.data?.phone || null,
          messageText: `📄 [ሰነድ ተልኳል: ${fileName}]`,
        });

        await ctx.replyWithHTML(
          `✅ <b>ሰነዱ ለሰራተኛ ደርሷል!</b> ሰራተኛችን አይቶ መልስ ይሰጥዎታል።`,
          Markup.keyboard([
            ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
          ]).resize()
        );

        if (WORKER_CHAT_ID && bot) {
          const alert = `
📄 <b>አዲስ የደንበኛ ሰነድ/ፋይል ለትኬት ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)}
📄 <b>ፋይል:</b> ${escapeHtml(fileName)}
━━━━━━━━━━━━━━━━━━━━
👉 <b>መልስ ለመስጠት፡</b>
<code>/reply ${code} ...</code>
`.trim();
          await bot.telegram.sendDocument(WORKER_CHAT_ID, fileId, {
            caption: alert,
            parse_mode: 'HTML',
          }).catch(() => {});
        }
        return;
      }

      // 3. Fallback: general document received outside ticket
      const recoveredTicket = await getLatestCustomerTicketByTelegramId(userId);
      const code = recoveredTicket || `KC-${String(userId).slice(-6)}`;
      session.activeTicket = code;
      session.state = 'CHATTING_WITH_SUPPORT';

      await addTicketMessage({
        ticketCode: code,
        senderRole: 'customer',
        senderName: username,
        senderTelegramId: userId,
        customerPhone: session.data?.phone || null,
        messageText: `📄 [ሰነድ ተልኳል: ${fileName}]`,
      });

      await ctx.replyWithHTML(
        `✅ <b>ሰነዱ/ፋይሉ ደርሶናል!</b> ለሰራተኛችን ተልኳል (ትኬት <code>${escapeHtml(code)}</code>)።`,
        Markup.keyboard([
          ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')'],
          ['🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
      );

      if (WORKER_CHAT_ID && bot) {
        await bot.telegram.sendDocument(WORKER_CHAT_ID, fileId, {
          caption: `📄 <b>አዲስ ሰነድ ከደንበኛ ደርሷል!</b>\nትኬት: <code>${code}</code>\nደንበኛ: ${escapeHtml(username)}\nፋይል: ${escapeHtml(fileName)}\n\n👉 መልስ ለመስጠት: <code>/reply ${code} ...</code>`,
          parse_mode: 'HTML',
        }).catch(() => {});
      }
    });

    // Robust Voice Handler: Supports Voice Notes for customers who prefer speaking in Amharic
    bot.on('voice', async (ctx) => {
      const session = getSession(ctx.from.id);
      const voice = ctx.message.voice;
      const fileId = voice.file_id;
      const duration = voice.duration || 0;
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');

      // Recover active ticket if not in session
      if (!session.activeTicket && session.state === 'IDLE') {
        const recoveredTicket = await getLatestCustomerTicketByTelegramId(userId);
        session.activeTicket = recoveredTicket || `KC-${String(userId).slice(-6)}`;
      }

      const code = session.activeTicket || `KC-${String(userId).slice(-6)}`;
      session.state = 'CHATTING_WITH_SUPPORT';
      session.activeTicket = code;

      await addTicketMessage({
        ticketCode: code,
        senderRole: 'customer',
        senderName: username,
        senderTelegramId: userId,
        customerPhone: session.data?.phone || null,
        messageText: `🎤 [የድምጽ መልዕክት ተልኳል (${duration} ሰከንድ)]`,
      });

      await ctx.replyWithHTML(
        `✅ <b>የድምጽ መልዕክትዎ ለሰራተኛ ደርሷል!</b>\n\n🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>\n⏱️ <b>ርዝመት:</b> ${duration} ሰከንድ\n\n👉 ሰራተኛችን አዳምጦ በአጭር ጊዜ ውስጥ መልስ ይሰጥዎታል።`,
        Markup.keyboard([
          ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
          ['🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
      );

      if (WORKER_CHAT_ID && bot) {
        const voiceAlert = `
🎤 <b>አዲስ የደንበኛ የድምጽ መልዕክት ደርሷል (Voice Note)!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
⏱️ <b>ርዝመት:</b> ${duration} ሰከንድ
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${code} <የእርስዎ ምላሽ></code>
`.trim();

        const buttons = [];
        if (ctx.from?.username) {
          buttons.push([Markup.button.url('💬 የደንበኛ ቴሌግራም', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
        }

        await bot.telegram.sendVoice(WORKER_CHAT_ID, fileId, {
          caption: voiceAlert,
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
        }).catch(() => {});
      }
    });

    // Marketplace selection callback handler (triggers after screenshot insertion)
    
    // Action: ✅ በዋጋው ተስማምቻለሁ (Customer Agrees with Price & Prompts for Receipt)
    bot.action(/^agree_price:(.+)$/, async (ctx) => {
      try { await ctx.answerCbQuery('በዋጋው ስለተስማሙ እናመሰግናለን!'); } catch (_) {}
      const code = ctx.match[1].trim();
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const session = getSession(userId);
      session.state = 'AWAITING_PAYMENT_RECEIPT';
      session.activeTicket = code;
      session.data.ticketCode = code;

      // Persist customer decision in ticket chat thread
      await addTicketMessage({
        ticketCode: code,
        senderRole: 'customer',
        senderName: username,
        senderTelegramId: userId,
        customerPhone: session.data?.phone || null,
        messageText: '✅ በዋጋው ተስማምቻለሁ። የክፍያ ደረሰኝ ስክሪንሾት ለመላክ ተዘጋጅቻለሁ።',
      });

      const agreeText = `
🎉 <b>በዋጋው ስለተስማሙ እናመሰግናለን!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት / ትዕዛዝ:</b> <code>${escapeHtml(code)}</code>

💳 <b>እባክዎ የ40% ቅድመ ክፍያዎን ያስገቡ፡</b>
1️⃣ <b>ቴሌብር (Telebirr):</b>
📱 <code>${escapeHtml(TELEBIRR_PHONE)}</code>

2️⃣ <b>የኢትዮጵያ ንግድ ባንክ (CBE / CBE Birr):</b>
🏦 <code>${escapeHtml(CBE_ACCOUNT)}</code>
━━━━━━━━━━━━━━━━━━━━
📸 <b>አሁን የከፈሉበትን የባንክ ወይም የቴሌብር ደረሰኝ ስክሪንሾት (Photo/Screenshot) እዚህ ይላኩልን 👇</b>
<i>ሰራተኛችን ክፍያውን አረጋግጦ የማድረሻ ቀኑን ያሳውቅዎታል።</i>
`.trim();

      await ctx.replyWithHTML(agreeText, Markup.keyboard([
        ['❌ ሰርዝ (Cancel)', '🏠 ወደ ዋና ገጽ (Main Menu)']
      ]).resize());

      // Notify worker in worker chat
      if (WORKER_CHAT_ID && bot) {
        const workerNotice = `
✅ <b>ደንበኛ በዋጋው ተስማምቷል! (Customer Agreed with Price)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
⏳ ደንበኛው አሁን የክፍያ ደረሰኝ ስክሪንሾት እየላከ ነው...
`;
        await bot.telegram.sendMessage(WORKER_CHAT_ID, workerNotice, { parse_mode: 'HTML' }).catch(() => {});
      }
    });

    // Action: ❌ ዋጋው አልተስማማሁም (Customer Does Not Agree with Price)
    bot.action(/^decline_price:(.+)$/, async (ctx) => {
      try { await ctx.answerCbQuery('ምላሽዎ ተመዝግቧል'); } catch (_) {}
      const code = ctx.match[1].trim();
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const session = getSession(userId);
      session.state = 'CHATTING_WITH_SUPPORT';
      session.activeTicket = code;

      // Persist decline in ticket chat
      await addTicketMessage({
        ticketCode: code,
        senderRole: 'customer',
        senderName: username,
        senderTelegramId: userId,
        customerPhone: session.data?.phone || null,
        messageText: '❌ ዋጋው አልተስማማሁም።',
      });

      const declineText = `
🤝 <b>ዋጋው ስላልተስማማዎት እናዝናለን።</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>

እኛ ዘንድ አማራጭ አይታጣም!
🔹 ርካሽ አማራጭ እቃ ከሌላ ገበያ (ከ AliExpress ወይም Shein) እንድንፈልግልዎት ይፈልጋሉ?
🔹 ወይስ ዋጋው እንዲስተካከልልዎት?

👉 የሚፈልጉትን እዚህ በቀጥታ መጻፍ ይችላሉ፣ ሰራተኛችን አማራጮችን ያቀርብልዎታል።
`.trim();

      await ctx.replyWithHTML(declineText, Markup.keyboard([
        ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
        ['🏠 ወደ ዋና ገጽ (Main Menu)']
      ]).resize());

      // Alert worker
      if (WORKER_CHAT_ID && bot) {
        const workerDeclineAlert = `
⚠️ <b>ደንበኛ በዋጋው አልተስማማም (Price Declined)!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት:</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው የተሻለ ወይም ርካሽ አማራጭ ለማቅረብ፡</b>
<code>/reply ${code} ሰላም፣ ከሌላ ገበያ ርካሽ አማራጭ ...</code>
`;
        await bot.telegram.sendMessage(WORKER_CHAT_ID, workerDeclineAlert, { parse_mode: 'HTML' }).catch(() => {});
      }
    });

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
      const userId = ctx.from.id;
      const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const session = getSession(userId);

      // WORKER NATIVE REPLY SUPPORT: Allow worker to simply swipe-reply to any notification message in Telegram
      const senderChatId = String(ctx.chat.id);
      const isWorkerSender =
        isAuthorizedWorkerUsername(ctx.from?.username) ||
        (WORKER_CHAT_ID && (senderChatId === String(WORKER_CHAT_ID) || String(userId) === String(WORKER_CHAT_ID)));

      if (isWorkerSender && ctx.message.reply_to_message && !text.startsWith('/')) {
        const repliedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '';
        const codeMatch =
          repliedText.match(/(?:Quote Code|Quote|ትኬት \(Ticket\)|ትኬት|የመከታተያ ኮድ|የትዕዛዝ ኮድ):\s*([A-Za-z0-9\-]+)/i) ||
          repliedText.match(/\/reply\s+([A-Za-z0-9\-]+)/i) ||
          repliedText.match(/\b(KC-[A-Za-z0-9\-]+)\b/);

        if (codeMatch && codeMatch[1]) {
          const replyCode = codeMatch[1].trim();
          const workerName = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Worker');
          const resolved = await resolveTrackingTarget(replyCode);
          const canonicalCode = resolved?.canonicalCode || replyCode;

          await respondToCustomerPing({
            referenceCode: canonicalCode,
            responseText: text,
            workerUsername: workerName,
          });
          await addTicketMessage({
            ticketCode: canonicalCode,
            senderRole: 'worker',
            senderName: workerName,
            customerPhone: resolved?.customerPhone || null,
            messageText: text,
          });

          let deliveredToTelegram = false;
          const targetTelegramId = resolved?.customerTelegramId;
          if (targetTelegramId) {
            const targetSession = getSession(targetTelegramId);
            targetSession.state = 'IDLE';
            targetSession.activeTicket = canonicalCode;

            const directMsg = `
💬 <b>ከኮርቻ ሰራተኛ የተሰጠ መልዕክት (Support Reply):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(canonicalCode)}</code>
📝 "${escapeHtml(text)}"
━━━━━━━━━━━━━━━━━━━━
👉 በዋጋው ከተስማሙ <b>"✅ በዋጋው ተስማምቻለሁ"</b> የሚለውን ይጫኑ ወይም ለሰራተኛው እዚህ በቀጥታ ይጻፉ።
`.trim();
            await bot.telegram.sendMessage(targetTelegramId, directMsg, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ በዋጋው ተስማምቻለሁ', `agree_price:${canonicalCode}`),
                  Markup.button.callback('❌ ዋጋው አልተስማማሁም', `decline_price:${canonicalCode}`)
                ],
                [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
              ])
            }).catch(() => {});
            deliveredToTelegram = true;
          }

          return ctx.replyWithHTML(
            `✅ <b>ምላሽዎ ለ <code>${escapeHtml(canonicalCode)}</code> ተልኳል!</b> (${deliveredToTelegram ? 'በቦት እና በሚኒ አፕ ደርሷል' : 'በሚኒ አፕ መልዕክት ላይ ተመዝግቧል'})`
          );
        }
      }

      // Auto-recover activeTicket from DB if customer is in IDLE state and types a message/question
      if (!session.activeTicket && session.state === 'IDLE') {
        const isGreetingOrMenu = /^(?:\/start|\/menu|menu|home|hi|hello|ሰላም|ዋና ገጽ|ዋና ሜኑ|ወደ ዋና ሜኑ)$/i.test(text);
        const isMenuBtn = [
          '🔗 ሊንክ ያስገቡ (Insert Link)',
          '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)',
          '📦 የትዕዛዝ ሁኔታ መከታተያ',
        ].includes(text);

        if (!isGreetingOrMenu && !isMenuBtn && !text.startsWith('http://') && !text.startsWith('https://')) {
          const recoveredTicket = await getLatestCustomerTicketByTelegramId(userId);
          session.activeTicket = recoveredTicket || `KC-${String(userId).slice(-6)}`;
        }
      }

      // CONTINUOUS TWO-WAY TICKET CHAT: Route message directly to worker if customer is in an active ticket
      if (session.activeTicket && (session.state === 'IDLE' || session.state === 'CHATTING_WITH_SUPPORT')) {
        // Exit ticket chat on menu or cancel commands
        if (text === '🏠 ወደ ዋና ገጽ (Main Menu)' || text === 'ወደ ዋና ሜኑ' || text === 'ዋና ሜኑ' || text === 'ዋና ገጽ' || text === '/menu' || text === 'menu' || text === '❌ ሰርዝ (Cancel)' || text === '/cancel') {
          const exitingCode = session.activeTicket;
          resetSessionCompletely(ctx.from.id);
          return ctx.reply(`✅ ከትኬት ${exitingCode} ውይይት ወጥተዋል። ወደ ዋና ገጽ ተመልሰዋል።`, getMainMenuKeyboard());
        }

        // Quick reply prompt button pressed
        if (text.startsWith('💬 ለትኬት')) {
          return ctx.replyWithHTML(
            `✍️ እባክዎ ለትኬት <code>${escapeHtml(session.activeTicket)}</code> የሚልኩትን መልዕክት ጽፈው ይላኩልን 👇`
          );
        }

        // Only handle as ticket message if not submitting a new link or tracking
        if (!text.startsWith('http://') && !text.startsWith('https://') && text !== '🔗 ሊንክ ያስገቡ (Insert Link)' && text !== '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)' && text !== '📦 የትዕዛዝ ሁኔታ መከታተያ') {
          const ticketCode = session.activeTicket;
          const custPhone = session.data?.phone || null;

          // 1. Record customer message in continuous ticket thread
          await addTicketMessage({
            ticketCode,
            senderRole: 'customer',
            senderName: username,
            senderTelegramId: userId,
            customerPhone: custPhone,
            messageText: text,
          });

          // 2. Acknowledge receipt to customer
          await ctx.replyWithHTML(
            `✅ <b>መልዕክትዎ ለትኬት <code>${escapeHtml(ticketCode)}</code> ለሰራተኛ ተልኳል!</b>\n\n📝 "${escapeHtml(text)}"\n\n👉 ሰራተኛችን በአጭር ጊዜ ውስጥ መልስ ይሰጥዎታል። መልዕክት መጻፍዎን መቀጠል ይችላሉ (ውይይቱን ለመጨረስ /menu ይጫኑ)።`,
            Markup.keyboard([
              ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
              ['🏠 ወደ ዋና ገጽ (Main Menu)']
            ]).resize()
          );

          // 3. Dispatch alert to worker chat with direct /reply command
          if (WORKER_CHAT_ID && bot) {
            const workerTicketAlert = `
💬 <b>አዲስ የደንበኛ መልዕክት ለትኬት (Customer Ticket Reply)!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(ticketCode)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📝 <b>መልዕክት:</b> "${escapeHtml(text)}"
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${ticketCode} <የእርስዎ ምላሽ እዚህ ይጻፉ></code>
`.trim();

            const buttons = [];
            if (ctx.from?.username) {
              buttons.push([Markup.button.url('💬 የደንበኛ ቴሌግራም', `https://t.me/${ctx.from.username.replace(/^@/, '')}`)]);
            }

            await bot.telegram.sendMessage(WORKER_CHAT_ID, workerTicketAlert, {
              parse_mode: 'HTML',
              ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
            }).catch(() => {});
          }
          return;
        }
      }

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

      // Point 5: Auto-start if user sends greetings or any text while IDLE
      if (session.state === 'IDLE') {
        clearSession(ctx.from.id);
        const autoWelcome = `
👋 <b>እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!</b>
<i>የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ</i>

ከ <b>Shein, Amazon, ወይም AliExpress</b> ላይ የፈለጉትን እቃ ይዘዙ። ሰራተኞቻችን ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

💳 <b>ልዩ የክፍያ ዋስትና፡</b>
• 100% በብር በ <b>Telebirr</b> ወይም <b>CBE Birr</b> ይክፈሉ
• 40% ቅድመ ክፍያ ብቻ — ቀሪ 60% ሲረከቡ የሚከፈል (COD)
• 0% የውጭ ምንዛሪ ተጨማሪ ክፍያ

📌 <b>እንዴት ማዘዝ ይችላሉ?</b>
1️⃣ <b>ሊንክ ወይም ፎቶ ያስገቡ</b> (የእቃውን ሊንክ ወይም ስክሪንሾት ይላኩ)
2️⃣ <b>ዝርዝሩን ይሙሉ</b> (መጠን፣ ቀለም፣ ብዛት)
3️⃣ <b>ስልክ ቁጥርዎን ያስገቡ</b> (ዋጋው ሲሰላ በሰራተኛ ይደርስዎታል)

ከታች ያሉትን ምርጫዎች ይጠቀሙ 👇
`.trim();
        return ctx.replyWithHTML(autoWelcome, getMainMenuKeyboard());
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
          `✅ <b>የእቃው ዝርዝር ተመዝግቧል!</b>\n\nየመጨረሻ ደረጃ፡ <b>የመገናኛ ስልክ ቁጥርዎን</b> ያስገቡ 📱\n\n📌 <b>ምሳሌ፡</b> <code>09**** / 07****</code> (ምሳሌ: 0912345678 ወይም 0712345678)\n\nሰራተኛችን ዋጋውን አስልቶ በቴሌግራም ወይም በስልክ ያሳውቅዎታል!`,
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

      // 4. Awaiting Tracking Input: Automatic Response + Instant Worker Notification + Direct Reply Routing
      if (session.state === 'AWAITING_TRACKING_INPUT') {
        clearSession(ctx.from.id);
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
        const isPhoneInput = isValidEthiopianPhone(text);
        const cleanTarget = isPhoneInput ? normalizePhone(text) : text.trim();

        try {
          let orders = [];
          let quotes = [];
          if (isPhoneInput) {
            orders = await getOrdersByPhone(cleanTarget);
            quotes = await getQuotesByPhone(cleanTarget);
          } else {
            const order = await getOrderByCode(cleanTarget);
            if (order) orders = [order];
            const quote = await getQuoteByCode(cleanTarget);
            if (quote) quotes = [quote];
          }

          const trackingTicketCode = orders[0]?.order_code || quotes[0]?.quote_code || cleanTarget;
          const resolvedPhone = isPhoneInput
            ? cleanTarget
            : (orders[0]?.customer_phone || quotes[0]?.customer_phone || String(userId));

          // 1. Record lookup & ping with customerTelegramId so /reply routes back to this customer on Bot & TMA
          await recordOrderLookup(cleanTarget, orders.length);
          await recordCustomerPing({
            referenceCode: trackingTicketCode,
            customerPhone: resolvedPhone,
            customerName: username,
            customerTelegramId: userId,
            pingType: 'order_lookup',
            customerNote: `ደንበኛ በቦት የትዕዛዝ ሁኔታ ጠይቋል (${text})`,
            assignedWorker: WORKER_USERNAME,
          });

          // Activate continuous two-way chat session for this tracking request
          const userSession = getSession(userId);
          userSession.activeTicket = trackingTicketCode;
          userSession.data.phone = resolvedPhone;

          // 2. Immediately send the exact required automatic response to the customer
          await ctx.replyWithHTML(
            `⏳ <b>${escapeHtml(AUTO_TRACKING_RESPONSE)}</b>

` +
            `🏷️ <b>የመከታተያ ቁጥር / ስልክ:</b> <code>${escapeHtml(trackingTicketCode)}</code>
` +
            `💬 ሰራተኛችን (<b>@${escapeHtml(WORKER_USERNAME)}</b>) ወዲያውኑ አጣርቶ መልስ ሲሰጥዎት እዚህ በቀጥታ ይደርስዎታል!`,
            Markup.keyboard([
              ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
              ['🏠 ወደ ዋና ገጽ (Main Menu)']
            ]).resize()
          );

          // 3. Notify worker (@korcha_support) immediately
          if (WORKER_CHAT_ID && bot) {
            const lookupAlert = `
🔔 <b>ደንበኛ በቴሌግራም ቦት የትዕዛዝ ሁኔታ ጠየቀ! (Bot Order Tracking Request)</b>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>የተፈለገው (Phone/Tracker):</b> <code>${escapeHtml(text)}</code>
🏷️ <b>የመከታተያ ኮድ:</b> <code>${escapeHtml(trackingTicketCode)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)
📱 <b>ስልክ:</b> <code>${escapeHtml(resolvedPhone)}</code>
${orders.length > 0 ? `📊 <b>የአሁን ሁኔታ:</b> <code>${escapeHtml(orders[0].status)}</code>
🛍️ <b>እቃ:</b> ${escapeHtml(orders[0].product_summary || 'N/A')}` : quotes.length > 0 ? `📊 <b>የጥያቄ ሁኔታ:</b> <code>${escapeHtml(quotes[0].status)}</code>
📝 <b>ዝርዝር:</b> ${escapeHtml(quotes[0].details || 'N/A')}` : '📌 <b>ሁኔታ:</b> አዲስ የሁኔታ ጥያቄ (Awaiting Worker Status Update)'}
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ ወደ ቦት ወይም ሚኒ አፕ መልስ ለመስጠት፡</b>
<code>/reply ${trackingTicketCode} ዕቃዎ ... ላይ ደርሷል።</code>
`.trim();
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
            return;
          }

          for (const ord of orders) {
            const workerNoteDisplay = (ord.latest_worker_note || ord.worker_response)
              ? `\n💬 <b>ከሰራተኛ የተሰጠ የቀጥታ ምላሽ:</b>\n"${escapeHtml(ord.latest_worker_note || ord.worker_response)}"\n`
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
ጥያቄ ካለዎት ከሰራተኛ ጋር ይገናኙ 👉 @${escapeHtml(WORKER_USERNAME)}
`;
            await ctx.replyWithHTML(
              msg,
              Markup.inlineKeyboard([
                [Markup.button.callback('💬 ከሰራተኛ ጋር በቀጥታ አውራ (Chat with Support)', `chat_ticket:${ord.order_code}`)],
                [Markup.button.callback('🔔 ሁኔታ እንዲጣራልኝ እፈልጋለሁ (Ping Support)', `ping_order:${ord.order_code}`)],
                [Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)]
              ])
            );
          }
          return ctx.reply('🏠 ወደ ዋና ገጽ ተመልሰዋል (Main Menu) — ከታች ካሉት አማራጮች ይምረጡ፡', getMainMenuKeyboard());
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

    const parsedTgId = telegramId ? parseInt(telegramId, 10) : null;
    await createQuote({
      quoteCode,
      customerPhone: cleanPhone,
      customerTelegramId: parsedTgId,
      sourceType: sourceType || 'link',
      productUrl: productUrl || null,
      screenshotUrl: screenshotFile ? screenshotFile.filename : null,
      size,
      color,
      quantity: parseInt(quantity || '1', 10),
      details: combinedDetails,
    });

    // Record initial quote request in continuous ticket chat thread so customer sees it in TMA Messages tab
    await addTicketMessage({
      ticketCode: quoteCode,
      senderRole: 'customer',
      senderName: req.body.telegramUsername ? `@${String(req.body.telegramUsername).replace(/^@/, '')}` : cleanPhone,
      senderTelegramId: parsedTgId,
      customerPhone: cleanPhone,
      messageText: `🛍️ የዋጋ ግምት ጥያቄ (${sourceType === 'screenshot' ? 'Screenshot' : 'Link'}): ${productUrl ? productUrl + ' | ' : ''}${combinedDetails}`,
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
<code>/reply ${quoteCode} ዋጋው 3,000 ብር ነው። 40% ቅድመ ክፍያ 1,200 ብር ነው። ከተስማሙ የዋጋው 40% በቴሌብር (${escapeHtml(TELEBIRR_PHONE)}) ወይንም በ CBE (${escapeHtml(CBE_ACCOUNT)}) ያስገቡ:: ዕቃዎት በ10-14 ቀን ይደርሳል:: (እቃው ከ Shelf ከሆነ በአንድ ቀን ውስጥ ይደርሳል)::</code>
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

// GET /api/orders/lookup with Rate Limiter (Notifies @korcha_support & returns Automatic Response)
app.get('/api/orders/lookup', orderLookupLimiter, async (req, res) => {
  try {
    const { phone, code, silent, telegramId, telegramUsername, firstName } = req.query;
    const rawSearch = String(code || phone || '').trim();

    if (!rawSearch) {
      return res.status(400).json({ success: false, error: 'Phone number or order code required' });
    }

    const isPhoneSearch = isValidEthiopianPhone(rawSearch) || Boolean(phone && !code);
    const cleanPhone = isPhoneSearch ? normalizePhone(rawSearch) : null;
    const searchTarget = cleanPhone || rawSearch;

    let orders = [];
    let quotes = [];

    if (code && !isValidEthiopianPhone(code)) {
      const order = await getOrderByCode(code.trim());
      if (order) orders = [order];
      const quote = await getQuoteByCode(code.trim());
      if (quote) quotes = [quote];
    } else {
      orders = await getOrdersByPhone(searchTarget);
      quotes = await getQuotesByPhone(searchTarget);
      if (orders.length === 0 && quotes.length === 0) {
        const orderByCode = await getOrderByCode(rawSearch);
        if (orderByCode) orders = [orderByCode];
        const quoteByCode = await getQuoteByCode(rawSearch);
        if (quoteByCode) quotes = [quoteByCode];
      }
    }

    const trackingTicketCode = orders[0]?.order_code || quotes[0]?.quote_code || searchTarget;
    const resolvedPhone = cleanPhone || orders[0]?.customer_phone || quotes[0]?.customer_phone || rawSearch;
    const parsedTgId = telegramId ? parseInt(String(telegramId), 10) : (orders[0]?.customer_telegram_id || quotes[0]?.customer_telegram_id || null);
    const customerDisplay = telegramUsername
      ? `@${String(telegramUsername).replace(/^@/, '')}`
      : (firstName || resolvedPhone || 'Customer');

    // If no row in `orders` exists yet, synthesize a live tracking ticket card so the customer sees the automatic response & worker chat thread in the Mini App
    if (orders.length === 0) {
      const pings = await getCustomerPings(trackingTicketCode);
      const latestWorkerPing = pings.find(p => p.worker_response);
      const matchedQuote = quotes[0] || null;

      orders = [
        {
          id: matchedQuote?.id || Date.now(),
          order_code: trackingTicketCode,
          customer_phone: resolvedPhone,
          customer_telegram_id: parsedTgId,
          product_summary: matchedQuote?.details || `የትዕዛዝ ክትትል (${searchTarget})`,
          total_price_etb: matchedQuote?.total_price_etb || 'በመሰላት ላይ (Pending)',
          payment_method: 'telebirr',
          status: latestWorkerPing ? 'ሰራተኛ ምላሽ ሰጥቷል (Updated)' : 'በሰራተኛ እየተጣራ ነው (Checking Status)',
          latest_worker_note: latestWorkerPing?.worker_response || null,
          worker_response: latestWorkerPing?.worker_response || null,
        }
      ];
    }

    // Only record lookup ping & notify worker when customer actively clicks Search (not during 12s background refresh)
    if (!silent) {
      await recordOrderLookup(searchTarget, orders.length);
      await recordCustomerPing({
        referenceCode: trackingTicketCode,
        customerPhone: resolvedPhone,
        customerName: customerDisplay,
        customerTelegramId: parsedTgId,
        pingType: 'order_lookup',
        customerNote: `ደንበኛ በሚኒ አፕ (Mini App) የትዕዛዝ ሁኔታ ጠይቋል: ${rawSearch}`,
        assignedWorker: WORKER_USERNAME,
      });

      if (WORKER_CHAT_ID && bot) {
        const lookupAlert = `
🔔 <b>ደንበኛ በሚኒ አፕ (Mini App) የትዕዛዝ ሁኔታ ጠየቀ!</b>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>የተፈለገው (Phone/Tracker):</b> <code>${escapeHtml(rawSearch)}</code>
🏷️ <b>የመከታተያ ኮድ:</b> <code>${escapeHtml(trackingTicketCode)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(customerDisplay)}${parsedTgId ? ` (ID: <code>${escapeHtml(parsedTgId)}</code>)` : ''}
📱 <b>ስልክ ቁጥር:</b> <code>${escapeHtml(resolvedPhone)}</code>
🛍️ <b>እቃ/ዝርዝር:</b> ${escapeHtml(orders[0]?.product_summary || 'N/A')}
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ ወደ ሚኒ አፕ ወይም ቦት መልስ ለመስጠት፡</b>
<code>/reply ${trackingTicketCode} ዕቃዎ ... ላይ ደርሷል።</code>
`.trim();

        const buttons = [];
        if (telegramUsername) {
          buttons.push([
            Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${String(telegramUsername).replace(/^@/, '')}`)
          ]);
        }

        bot.telegram.sendMessage(WORKER_CHAT_ID, lookupAlert, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {})
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      autoMessage: AUTO_TRACKING_RESPONSE,
      trackingCode: trackingTicketCode,
      orders,
    });
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
      message: 'ጥያቄዎ ለሰራተኛ ደርሷል! በአጭር ጊዜ ውስጥ ምላሽ ይሰጡዎታል።',
      ping: recordedPing,
    });
  } catch (err) {
    console.error('[Order Ping Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shelf: Fetch shelf products, best sellers, categories & payment account config for TMA
app.get('/api/shelf', async (req, res) => {
  try {
    const { category } = req.query;
    const products = await getShelfProducts(category || null);
    const bestsellers = await getBestSellerProducts();
    const categories = await getShelfCategories();
    res.json({
      success: true,
      products,
      bestsellers,
      categories,
      paymentConfig: {
        telebirrPhone: TELEBIRR_PHONE,
        cbeAccount: CBE_ACCOUNT,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shelf/order: Direct Shelf Checkout (No screenshot/bot wizard — only Payment Choice + Phone & Scraped Username, 40% now / 60% in 1-2 days)
app.post('/api/shelf/order', quoteSubmissionLimiter, async (req, res) => {
  try {
    const {
      productId,
      productName,
      size,
      priceEtb,
      photoUrl,
      paymentMethod,
      phone,
      telegramUsername,
      telegramId,
      firstName,
    } = req.body;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)',
      });
    }

    const cleanPhone = normalizePhone(phone);
    const cleanUsername = telegramUsername ? String(telegramUsername).replace(/^@/, '').trim() : '';
    const parsedTgId = telegramId ? parseInt(String(telegramId), 10) : null;
    const chosenMethod = paymentMethod === 'cbe_birr' ? 'cbe_birr' : 'telebirr';
    const paymentLabel = chosenMethod === 'cbe_birr' ? 'CBE / የኢትዮጵያ ንግድ ባንክ' : 'ቴሌብር (Telebirr)';
    const paymentAccount = chosenMethod === 'cbe_birr' ? CBE_ACCOUNT : TELEBIRR_PHONE;

    const totalPrice = Math.max(1, Math.round(Number(priceEtb) || 0));
    const deposit40 = Math.round(totalPrice * 0.40);
    const balance60 = totalPrice - deposit40;
    const orderCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
    const productSummary = `[Shelf] ${productName || 'የShelf እቃ'}${size ? ` (መጠን: ${size})` : ''}`;
    const customerDisplay = cleanUsername ? `@${cleanUsername}` : (firstName || cleanPhone);

    // 1. Upsert customer with scraped Telegram username & phone
    let customer = null;
    try {
      customer = await upsertCustomer({
        telegramId: parsedTgId,
        telegramUsername: cleanUsername || null,
        firstName: firstName || null,
        phone: cleanPhone,
      });
    } catch (custErr) {
      console.warn('[Shelf Order Customer Upsert Warning]', custErr.message);
    }

    // 2. Create Shelf Order directly in DB (40% now, 60% in 1-2 days on delivery)
    const createdOrder = await createOrder({
      orderCode,
      quoteId: null,
      customerId: customer ? customer.id : null,
      customerTelegramId: parsedTgId,
      customerPhone: cleanPhone,
      productSummary,
      totalPriceEtb: totalPrice,
      depositAmountEtb: deposit40,
      codBalanceEtb: balance60,
      paymentMethod: chosenMethod,
      deliveryAddress: 'Shelf Order (1-2 ቀን አቅርቦት)',
      assignedWorker: WORKER_USERNAME,
    });

    // 3. Record initial order message in continuous ticket chat thread so customer & worker can chat in TMA/Bot
    await addTicketMessage({
      ticketCode: orderCode,
      senderRole: 'customer',
      senderName: customerDisplay,
      senderTelegramId: parsedTgId,
      customerPhone: cleanPhone,
      messageText: `🛍️ የShelf ቀጥታ ትዕዛዝ: ${productName || 'እቃ'}${size ? ` (${size})` : ''} | ጠቅላላ ዋጋ: ${totalPrice.toLocaleString()} ብር | አሁን የሚከፈል 40%: ${deposit40.toLocaleString()} ብር በ${paymentLabel} (${paymentAccount}) | ቀሪ 60% (${balance60.toLocaleString()} ብር) በ1-2 ቀን እቃው ሲደርስ የሚከፈል | ስልክ: ${cleanPhone}${cleanUsername ? ` | @${cleanUsername}` : ''}`,
    });

    // 4. Notify Worker (@korcha_support) immediately
    if (WORKER_CHAT_ID && bot) {
      const workerShelfAlert = `
🛍️ <b>አዲስ የShelf ቀጥታ ትዕዛዝ ደርሷል! (Direct Shelf Order)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(orderCode)}</code>
📦 <b>እቃ:</b> ${escapeHtml(productName || 'Shelf Product')}${size ? ` (መጠን: <b>${escapeHtml(size)}</b>)` : ''}
👤 <b>ደንበኛ (Username):</b> ${escapeHtml(customerDisplay)}${parsedTgId ? ` (ID: <code>${escapeHtml(parsedTgId)}</code>)` : ''}
📱 <b>ስልክ ቁጥር:</b> <code>${escapeHtml(cleanPhone)}</code>
💳 <b>የተመረጠ የክፍያ ዘዴ:</b> <b>${escapeHtml(paymentLabel)}</b> (<code>${escapeHtml(paymentAccount)}</code>)
💰 <b>ጠቅላላ ዋጋ:</b> <b>${escapeHtml(totalPrice.toLocaleString())} ብር</b>
✅ <b>አሁን የሚከፈል (40%):</b> <b>${escapeHtml(deposit40.toLocaleString())} ብር</b>
🚚 <b>ሲረከቡ የሚከፈል (60% በ1-2 ቀን):</b> <b>${escapeHtml(balance60.toLocaleString())} ብር</b>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${orderCode} ትዕዛዝዎ ደርሶናል! የ40% ቅድመ ክፍያ (${deposit40.toLocaleString()} ብር) በ${paymentLabel} (${escapeHtml(paymentAccount)}) ሲፈጽሙ እቃዎ በ1-2 ቀን ውስጥ በርዎ ይደርሳል።</code>
`.trim();

      const workerButtons = [];
      if (cleanUsername) {
        workerButtons.push([
          Markup.button.url('💬 በቴሌግራም መልስ', `https://t.me/${cleanUsername}`)
        ]);
      }
      const workerKeyboard = workerButtons.length > 0 ? Markup.inlineKeyboard(workerButtons) : undefined;

      try {
        if (photoUrl && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, photoUrl, {
            caption: workerShelfAlert.length > 1000 ? workerShelfAlert.substring(0, 997) + '...' : workerShelfAlert,
            parse_mode: 'HTML',
            ...(workerKeyboard || {}),
          });
        } else {
          await bot.telegram.sendMessage(WORKER_CHAT_ID, workerShelfAlert, {
            parse_mode: 'HTML',
            ...(workerKeyboard || {}),
          });
        }
      } catch (notifyErr) {
        await bot.telegram.sendMessage(WORKER_CHAT_ID, workerShelfAlert, {
          parse_mode: 'HTML',
          ...(workerKeyboard || {}),
        }).catch(() => {});
      }
    }

    // 5. If customer has a Telegram ID, also send direct confirmation on the Telegram Bot & activate chat session
    if (bot && parsedTgId) {
      const targetSession = getSession(parsedTgId);
      targetSession.state = 'IDLE';
      targetSession.activeTicket = orderCode;
      targetSession.data.phone = cleanPhone;

      const customerBotReceipt = `
🎉 <b>የShelf ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(orderCode)}</code>
📦 <b>እቃ:</b> ${escapeHtml(productName || 'Shelf Product')}${size ? ` (${escapeHtml(size)})` : ''}
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone)}</code>
${cleanUsername ? `👤 <b>Username:</b> @${escapeHtml(cleanUsername)}
` : ''}━━━━━━━━━━━━━━━━━━━━
💳 <b>የክፍያ ዝርዝር (${escapeHtml(paymentLabel)}):</b>
• <b>ጠቅላላ ዋጋ:</b> ${escapeHtml(totalPrice.toLocaleString())} ብር
• <b>አሁን የሚከፈል (40% ቅድመ ክፍያ):</b> <b>${escapeHtml(deposit40.toLocaleString())} ብር</b>
• <b>የክፍያ ሂሳብ/ስልክ:</b> <code>${escapeHtml(paymentAccount)}</code>
• <b>ቀሪ ክፍያ (60%):</b> <b>${escapeHtml(balance60.toLocaleString())} ብር</b> <i>(እቃው በ1-2 ቀን ውስጥ ሲደርስዎት የሚከፈል)</i>
━━━━━━━━━━━━━━━━━━━━
💬 የ40% ክፍያውን ካስገቡ በኋላ ወይም ማንኛውም ጥያቄ ካለዎት እዚህ በቀጥታ መጻፍ ይችላሉ!
`.trim();

      bot.telegram.sendMessage(parsedTgId, customerBotReceipt, {
        parse_mode: 'HTML',
        ...Markup.keyboard([
          ['💬 ከሰራተኛ ጋር አውራ (@' + WORKER_USERNAME + ')', '📦 የትዕዛዝ ሁኔታ መከታተያ'],
          ['🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize(),
      }).catch(() => {});
    }

    res.json({
      success: true,
      orderCode,
      order: createdOrder,
      paymentDetails: {
        method: chosenMethod,
        methodLabel: paymentLabel,
        accountNumber: paymentAccount,
        totalPriceEtb: totalPrice,
        deposit40Etb: deposit40,
        balance60Etb: balance60,
        deliveryWindow: 'ከ1 እስከ 2 ቀን (1-2 Days)',
      },
    });
  } catch (err) {
    console.error('[Shelf Order Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shelf: Add new product (korcha_support edit/add)
app.post('/api/shelf', requireWorkerRBAC, async (req, res) => {
  try {
    const { categoryId, name, size, priceEtb, photoUrl, isBestseller, createdBy } = req.body;
    if (!name || !priceEtb || !photoUrl) {
      return res.status(400).json({ success: false, error: 'Name, price, and photoUrl are required' });
    }
    const product = await addShelfProduct({
      categoryId: categoryId || 'miscellaneous',
      name,
      size: size || null,
      priceEtb: parseFloat(priceEtb),
      photoUrl,
      isBestseller: Boolean(isBestseller),
      createdBy: createdBy || 'korcha_support',
    });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shelf/:id: Update existing product (korcha_support edit)
app.put('/api/shelf/:id', requireWorkerRBAC, async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await updateShelfProduct(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shelf/categories/:id: Edit category details (korcha_support edit access)
app.put('/api/shelf/categories/:id', requireWorkerRBAC, async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await updateShelfCategory(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/shelf/:id: Remove product
app.delete('/api/shelf/:id', requireWorkerRBAC, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await deleteShelfProduct(id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/messages/customer: Fetch all customer conversation threads (price quotes, tracker updates, support) for TMA
app.get('/api/messages/customer', async (req, res) => {
  try {
    const { telegramId, phone, codes } = req.query;
    const codeList = codes
      ? String(codes)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];
    const cleanPhone = phone && isValidEthiopianPhone(phone) ? normalizePhone(phone) : (phone ? String(phone).trim() : null);
    const conversations = await getCustomerConversations({
      telegramId: telegramId || null,
      phone: cleanPhone,
      codes: codeList,
    });
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:code/messages: Fetch full continuous chat thread for this ticket
app.get('/api/orders/:code/messages', async (req, res) => {
  try {
    const code = req.params.code;
    const messages = await getTicketMessages(code);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/:code/messages: Send customer message from TMA
app.post('/api/orders/:code/messages', async (req, res) => {
  try {
    const code = req.params.code;
    const { messageText, senderName, telegramId, phone } = req.body;

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    const order = await getOrderByCode(code);
    const quote = await getQuoteByCode(code);
    const cleanPhone = normalizePhone(phone || order?.customer_phone || quote?.customer_phone || null);

    const isWorkerSender = isAuthorizedWorkerUsername(senderName) || isAuthorizedWorkerUsername(req.headers['x-telegram-username']);
    const senderRole = isWorkerSender ? 'worker' : 'customer';

    // 1. Save message to ticket chat thread
    const savedMsg = await addTicketMessage({
      ticketCode: code,
      senderRole,
      senderName: senderName || (isWorkerSender ? `@${WORKER_USERNAME}` : 'Customer'),
      senderTelegramId: telegramId || order?.customer_telegram_id || quote?.customer_telegram_id || null,
      customerPhone: cleanPhone,
      messageText: messageText.trim(),
    });

    if (isWorkerSender) {
      // Direct push to customer on Telegram Bot if customer telegram ID exists
      const targetTelegramId = order?.customer_telegram_id || quote?.customer_telegram_id;
      if (bot && targetTelegramId) {
        const directCustomerMsg = `
💬 <b>ከኮርቻ ሰራተኛ የተሰጠ መልዕክት (Support Reply):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(code)}</code>
📝 "${escapeHtml(messageText.trim())}"
━━━━━━━━━━━━━━━━━━━━
👉 በዋጋው ከተስማሙ <b>"✅ በዋጋው ተስማምቻለሁ"</b> የሚለውን ይጫኑ ወይም ለሰራተኛው እዚህ በቀጥታ ይጻፉ።
`.trim();
        bot.telegram.sendMessage(targetTelegramId, directCustomerMsg, {
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
      return res.json({ success: true, message: savedMsg });
    }

    // 2. Also record in inquiry_pings for history audit
    await recordCustomerPing({
      referenceCode: code,
      customerPhone: cleanPhone || 'TMA User',
      customerName: senderName || null,
      customerTelegramId: telegramId || null,
      pingType: 'direct_chat',
      customerNote: messageText.trim(),
      assignedWorker: order?.assigned_worker || WORKER_USERNAME,
    });

    // 3. Notify worker in TELEGRAM_WORKER_CHAT_ID with direct /reply command
    if (WORKER_CHAT_ID && bot) {
      const workerAlert = `
💬 <b>አዲስ የደንበኛ መልዕክት ከ Mini App (TMA Chat)!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(code)}</code>
👤 <b>ደንበኛ:</b> ${escapeHtml(senderName || 'Customer')}
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone || 'N/A')}</code>
📝 <b>መልዕክት:</b> "${escapeHtml(messageText.trim())}"
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 <b>ለደንበኛው በቀጥታ መልስ ለመስጠት፡</b>
<code>/reply ${code} <የእርስዎ ምላሽ እዚህ ይጻፉ></code>
`.trim();

      await bot.telegram.sendMessage(WORKER_CHAT_ID, workerAlert, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, message: savedMsg });
  } catch (err) {
    console.error('[TMA Ticket Message Error]', err);
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

    // Save worker response to ticket chat thread
    await addTicketMessage({
      ticketCode: code,
      senderRole: 'worker',
      senderName: workerUsername || WORKER_USERNAME,
      messageText: responseText,
    });

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
📩 <b>ከሰራተኛ የተሰጠ የቀጥታ ምላሽ (Message from Support):</b>
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
      <a href="https://t.me/${escapeHtml(WORKER_USERNAME)}" target="_blank" class="secondary">ከሰራተኛ ጋር አውራ (@${escapeHtml(WORKER_USERNAME)})</a>
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
    bot.telegram.setMyCommands([
      { command: 'start', description: 'ቦቱን አስጀምር / Start Korcha' },
      { command: 'menu', description: 'ዋና ገጽ / Main Menu' },
      { command: 'link', description: 'የእቃ ሊንክ ያስገቡ / Submit Link' },
      { command: 'photo', description: 'ስክሪንሾት ላክ / Send Photo' },
      { command: 'track', description: 'የትዕዛዝ ሁኔታ መከታተያ / Track Order' },
      { command: 'support', description: 'ከሰራተኛ ጋር አውራ / Contact Worker' },
    ]).catch(err => console.warn('[Bot Commands Setup Warning]', err.message));

    // Configure Persistent Bottom-Left Menu Button (MenuButtonWebApp) next to the chat input field
    bot.telegram.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🛍️ ገበያ (Shop)',
        web_app: { url: WEB_APP_URL }
      }
    }).catch(err => console.warn('[Chat Menu Button Setup Warning]', err.message));

    bot.launch()
      .then(() => console.log(`[Bot] Korcha Telegram Bot launched successfully. Worker: @${WORKER_USERNAME}`))
      .catch((err) => console.warn('[Bot Launch Warning] Telegraf launch deferred:', err.message));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

start();
