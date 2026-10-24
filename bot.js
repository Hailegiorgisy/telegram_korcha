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
  addTicketMessage,
  getTicketMessages,
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
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;
const TELEBIRR_PHONE = process.env.TELEBIRR_PHONE || process.env.VITE_TELEBIRR_PHONE || '+251-996237800';
const CBE_ACCOUNT = process.env.CBE_ACCOUNT || process.env.VITE_CBE_ACCOUNT || '10001116390';

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

    // Activate continuous two-way ticket chat session for this customer
    const userSession = getSession(userId);
    userSession.activeTicket = quoteCode;
    userSession.data.phone = cleanPhone;

    await ctx.reply(
      `💬 ለትኬት ${quoteCode} ተጨማሪ መልዕክት ወይም ጥያቄ ለመላክ በቀጥታ እዚህ መጻፍ ይችላሉ። ሰራተኛችን ወዲያውኑ መልስ ይሰጥዎታል። (ውይይቱን ለመጨረስ /menu ይጫኑ)፡`,
      Markup.keyboard([
        [`💬 ለትኬት ${quoteCode} መልስ ጻፍ`],
        ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
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
✅ ቀጥታ የኤስኤምኤስና የቦት ደረሰኝ
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

        // 2. Append worker message to ticket chat thread for continuous history
        await addTicketMessage({
          ticketCode: code,
          senderRole: 'worker',
          senderName: workerName,
          messageText: replyMessage,
        });

        // 3. Direct message customer on Telegram Bot with active reply session
        let deliveredToTelegram = false;
        const targetTelegramId = order?.customer_telegram_id || quote?.customer_telegram_id;

        if (targetTelegramId) {
          const targetSession = getSession(targetTelegramId);
          targetSession.activeTicket = code;

          const directMsg = `
💬 <b>ከኮርቻ ሰራተኛ የተሰጠ መልዕክት (Support Reply):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>ትኬት (Ticket):</b> <code>${escapeHtml(code)}</code>
📝 "${escapeHtml(replyMessage)}"
━━━━━━━━━━━━━━━━━━━━
👉 ለሰራተኛው መልስ ለመስጠት እዚህ በቀጥታ ይጻፉ። ውይይቱ ያለማቋረጥ የሚቀጥል ሲሆን ለመጨረስ /menu ይጫኑ።
`.trim();
          await bot.telegram.sendMessage(targetTelegramId, directMsg, {
            parse_mode: 'HTML',
            ...Markup.keyboard([
              [`💬 ለትኬት ${code} መልስ ጻፍ`],
              ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
            ]).resize()
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

    // WORKER COMMAND: Add Product to Shelf (/addproduct <category> | <name> | <price> | <size> | [photo_url])
    bot.hears(/^\/addproduct(?:\s+([\s\S]+))?$/, async (ctx) => {
      const senderId = String(ctx.from.id);
      const senderChatId = String(ctx.chat.id);
      const senderUsername = ctx.from.username ? ctx.from.username.replace(/^@/, '') : '';

      const isAuthorized = (WORKER_CHAT_ID && (senderChatId === String(WORKER_CHAT_ID) || senderId === String(WORKER_CHAT_ID))) ||
                           (senderUsername.toLowerCase() === WORKER_USERNAME.toLowerCase());

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

      const isAuthorized = (WORKER_CHAT_ID && (senderChatId === String(WORKER_CHAT_ID) || senderId === String(WORKER_CHAT_ID))) ||
                           (senderUsername.toLowerCase() === WORKER_USERNAME.toLowerCase());

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

      const isAuthorized = (WORKER_CHAT_ID && (senderChatId === String(WORKER_CHAT_ID) || senderId === String(WORKER_CHAT_ID))) ||
                           (senderUsername.toLowerCase() === WORKER_USERNAME.toLowerCase());

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

      const isAuthorized = (WORKER_CHAT_ID && (senderChatId === String(WORKER_CHAT_ID) || senderId === String(WORKER_CHAT_ID))) ||
                           (senderUsername.toLowerCase() === WORKER_USERNAME.toLowerCase());

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
          [Markup.button.callback('💬 በዚህ ትኬት መልስ ጻፍ', `chat_ticket:${ticketCode}`)]
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

    // Trigger: 💬 ከሰራተኛ ጋር አውራ
    bot.hears([new RegExp(`ከሰራተኛ ጋር አውራ`, 'i'), '/support'], async (ctx) => {
      await ctx.replyWithHTML(
        `💬 <b>የኮርቻ ቀጥታ ሰራተኛ (Direct Support):</b>\n\nጥያቄ፣ እርዳታ ወይም የክፍያ ማረጋገጫ ለመላክ በቀጥታ ከሰራተኛችን ጋር ይገናኙ፡\n👉 <b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>`,
        Markup.inlineKeyboard([
          Markup.button.url(`💬 ከሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`)
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
          [`💬 ለትኬት ${code} መልስ ጻፍ`],
          ['🏠 ወደ ዋና ገጽ (Main Menu)']
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
          [`💬 ለትኬት ${code} መልስ ጻፍ`],
          ['🏠 ወደ ዋና ገጽ (Main Menu)']
        ]).resize()
      );
    });

    // Trigger: 🏠 ወደ ዋና ሜኑ / ዋና ገጽ (Point 6)
    bot.hears(['ወደ ዋና ሜኑ', 'ዋና ሜኑ', 'ዋና ገጽ', '/menu', 'menu', 'home', 'Home'], async (ctx) => {
      resetSessionCompletely(ctx.from.id);
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

      // CONTINUOUS TWO-WAY TICKET CHAT: Route message directly to worker if customer is in an active ticket
      if (session.activeTicket && session.state === 'IDLE') {
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
              [`💬 ለትኬት ${ticketCode} መልስ ጻፍ`],
              ['📦 የትዕዛዝ ሁኔታ መከታተያ', '🏠 ወደ ዋና ገጽ (Main Menu)']
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
              `⏳ <b>Our worker will let you know the status soon.</b>\nሰራተኛችን በቅርቡ ወቅታዊውን የትዕዛዝ ሁኔታ ያሳውቅዎታል!\n\n👉 <b><a href="https://t.me/${escapeHtml(WORKER_USERNAME)}">@${escapeHtml(WORKER_USERNAME)}</a></b>`,
              getMainMenuKeyboard()
            );
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
                [Markup.button.callback('💬 ከሰራተኛ ጋር በዚህ ትኬት አውራ (Chat on Ticket)', `chat_ticket:${ord.order_code}`)],
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
      message: 'ጥያቄዎ ለሰራተኛ ደርሷል! በአጭር ጊዜ ውስጥ ምላሽ ይሰጡዎታል።',
      ping: recordedPing,
    });
  } catch (err) {
    console.error('[Order Ping Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/shelf: Fetch shelf products & best sellers for TMA
app.get('/api/shelf', async (req, res) => {
  try {
    const { category } = req.query;
    const products = await getShelfProducts(category || null);
    const bestsellers = await getBestSellerProducts();
    const categories = await getShelfCategories();
    res.json({ success: true, products, bestsellers, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/shelf: Add new product (korcha_support edit/add)
app.post('/api/shelf', async (req, res) => {
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
app.put('/api/shelf/:id', async (req, res) => {
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
app.put('/api/shelf/categories/:id', async (req, res) => {
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
app.delete('/api/shelf/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await deleteShelfProduct(id);
    res.json({ success: true, result });
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

    // 1. Save customer message to ticket chat thread
    const savedMsg = await addTicketMessage({
      ticketCode: code,
      senderRole: 'customer',
      senderName: senderName || 'Customer',
      senderTelegramId: telegramId || order?.customer_telegram_id || quote?.customer_telegram_id || null,
      customerPhone: cleanPhone,
      messageText: messageText.trim(),
    });

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

    bot.launch()
      .then(() => console.log(`[Bot] Korcha Telegram Bot launched successfully. Worker: @${WORKER_USERNAME}`))
      .catch((err) => console.warn('[Bot Launch Warning] Telegraf launch deferred:', err.message));

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

start();
