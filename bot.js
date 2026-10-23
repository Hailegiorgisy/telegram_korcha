// bot.js: Telegram Korcha Bot with Guided Step-by-Step Quote Wizard, Marketplace Choice, Two-Way Staff Bridge & On-Hand Shelf
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
  getOrderByCode,
  getOrdersByPhone,
  createShelfProduct,
  getShelfProducts,
  updateShelfProduct,
  deleteShelfProduct,
} from './db.js';

// Canonical category definitions from repository
import { CATEGORIES } from './src/data/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----------------------------------------------------
// ENVIRONMENT & RATE CONFIGURATIONS (SPEC SECTION 3.1)
// ----------------------------------------------------
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID?.trim();
const WORKER_USERNAME = (process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support').replace(/^@/, '');
const WEB_APP_URL = process.env.TELEGRAM_WEB_APP_URL || 'https://telegram.korcha.com.et';
const PORT = process.env.PORT || 3000;

// Dynamic Foreign Exchange & Cargo Rate Parameters (Spec Section 3.1)
const HKD_EXCHANGE_RATE = parseFloat(process.env.HKD_EXCHANGE_RATE || '30.0');
const USD_TO_HKD = parseFloat(process.env.USD_TO_HKD || '7.8');
const KG_CARGO_RATE_ETB = parseFloat(process.env.KG_CARGO_RATE_ETB || '1000.0');
const ADVANCE_PERCENT = parseInt(process.env.ADVANCE_PAYMENT_PERCENT || '40', 10);
const COD_PERCENT = parseInt(process.env.COD_PAYMENT_PERCENT || '60', 10);

// Dynamic list of authorized worker usernames (comma-separated, case-insensitive)
const WORKER_USERNAMES = (process.env.WORKER_USERNAMES || WORKER_USERNAME)
  .split(',')
  .map((u) => u.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

if (!BOT_TOKEN) {
  console.error('[Bot Error] TELEGRAM_BOT_TOKEN is not defined in environment variables.');
}

const bot = new Telegraf(BOT_TOKEN || 'dummy_token');
bot.use(session());

let botInfo = null;
if (BOT_TOKEN && BOT_TOKEN.length > 20) {
  bot.telegram
    .getMe()
    .then((info) => {
      botInfo = info;
      console.log(`[Telegram Auth] Connected as @${info.username} (ID: ${info.id})`);
    })
    .catch((err) => console.error('[Telegram Auth Error]', err.message));
}

// ----------------------------------------------------
// SHELF CATEGORIES & ON-HAND INVENTORY STORE (6 EXACT CATEGORIES)
// ----------------------------------------------------
export const PREDEFINED_CATEGORIES = Array.isArray(CATEGORIES)
  ? CATEGORIES.filter((c) => c.id !== 'all')
  : [
      { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Fashion", icon: '👗' },
      { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸' },
      { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄' },
      { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱' },
      { id: 'home', nameAm: 'የቤት ውስጥ መገልገያዎች', nameEn: 'Home & Kitchen', icon: '🍳' },
      { id: 'misc', nameAm: 'ሌሎች', nameEn: 'Miscellaneous', icon: '📦' },
    ];

// On-Hand Shelf Storage (seeded from DB on startup, empty by default)
let shelfItems = [];

// Helper: Seed or refresh memory shelf from DB
async function syncShelfFromDB() {
  try {
    if (typeof getShelfProducts === 'function') {
      const dbItems = await getShelfProducts();
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        shelfItems = dbItems;
        console.log(`[DB Shelf] Loaded ${shelfItems.length} in-stock products from DB.`);
      }
    }
  } catch (err) {
    console.warn('[DB Shelf Warning] Running in fail-safe memory shelf mode:', err.message);
  }
}

// ----------------------------------------------------
// PHONE NORMALIZATION & VALIDATION (ETHIOPIA)
// ----------------------------------------------------
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

  // Accepts any 9 digits starting with 9 (EthioTelecom) or 7 (Safaricom)
  if (/^(9|7)\d{8}$/.test(digits)) {
    return '0' + digits; // Standard 10-digit format: 09XXXXXXXX or 07XXXXXXXX
  }
  return null;
}

function isValidEthiopianPhone(phone) {
  return Boolean(normalizeEthiopianPhone(phone));
}

function normalizePhone(phone) {
  return normalizeEthiopianPhone(phone) || phone;
}

// ----------------------------------------------------
// ROLE CHECK & CONVERSATION SESSIONS
// ----------------------------------------------------
function isWorker(ctx) {
  const username = ctx.from?.username?.toLowerCase();
  const chatId = ctx.chat?.id?.toString();
  const userId = ctx.from?.id?.toString();

  if (WORKER_CHAT_ID && (chatId === WORKER_CHAT_ID || userId === WORKER_CHAT_ID)) {
    return true;
  }
  if (username && WORKER_USERNAMES.includes(username)) {
    return true;
  }
  return false;
}

const userSessions = new Map();
const ticketCustomerMap = new Map();

function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { state: 'IDLE', data: {} });
  }
  return userSessions.get(userId);
}

function clearSession(userId) {
  userSessions.set(userId, { state: 'IDLE', data: {} });
}

// ----------------------------------------------------
// KEYBOARDS (STRICT ROLE SEPARATION)
// ----------------------------------------------------

// 1. Customer Main Keyboard (Never accessible by workers upon start)
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['🔗 ሊንክ ያስገቡ (Insert Link)', '📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)'],
    ['📦 የትዕዛዝ ሁኔታ መከታተያ', `💬 ከኮርቻ ሰራተኛ ጋር ለማውራት (@${WORKER_USERNAME})`],
    [Markup.button.webApp('🛍️ ሚኒ አፑን ክፈት (Open Mini App)', WEB_APP_URL)],
  ]).resize();
}

// 2. Staff Worker Portal Keyboard (Exclusive to Korcha Support Staff)
function getWorkerMenuKeyboard() {
  return Markup.keyboard([
    ['➕ አዲስ እቃ መዝግብ (Add Shelf Item)', '📋 መደርደሪያ ተመልከት (View Shelf)'],
    ['📥 ክፍት የዋጋ ጥያቄዎች (Quotes)', '📦 የትዕዛዝ ሁኔታ (Orders)'],
    ['ℹ️ ሰራተኛ መረጃ (Worker Profile)', '❌ ሰርዝ (Cancel)'],
  ]).resize();
}

// 3. Category Selection Keyboard for Worker Item Uploader (6 Categories)
function getCategorySelectionKeyboard() {
  const rows = [];
  for (let i = 0; i < PREDEFINED_CATEGORIES.length; i += 2) {
    const pair = [
      `${PREDEFINED_CATEGORIES[i].icon} ${PREDEFINED_CATEGORIES[i].nameAm}`,
    ];
    if (PREDEFINED_CATEGORIES[i + 1]) {
      pair.push(`${PREDEFINED_CATEGORIES[i + 1].icon} ${PREDEFINED_CATEGORIES[i + 1].nameAm}`);
    }
    rows.push(pair);
  }
  rows.push(['❌ ሰርዝ (Cancel)']);
  return Markup.keyboard(rows).resize();
}

// 4. Step 5 Marketplace Selection Inline Keyboard
function getMarketplaceSelectionInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛍️ Shein', 'mkt_shein'),
      Markup.button.callback('📦 AliExpress', 'mkt_aliexpress'),
    ],
    [
      Markup.button.callback('🛒 Amazon', 'mkt_amazon'),
      Markup.button.callback('🌐 ሌላ (Else / Other)', 'mkt_else'),
    ],
  ]);
}

// ----------------------------------------------------
// TELEGRAM COMMAND & INTERACTION HANDLERS
// ----------------------------------------------------

// /myid: Display user or chat numeric ID
bot.command('myid', (ctx) => {
  ctx.reply(`Your numeric Telegram Chat ID is: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

// /start Command: Strict Role-Based Routing
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  clearSession(userId);

  // If sender is an authorized Korcha Worker, open Worker Portal
  if (isWorker(ctx)) {
    const workerHandle = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const workerPortalGreeting = `
🛠️ *እንኳን ወደ ኮርቻ ሰራተኛ ፖርታል በደህና መጡ!* (Worker Portal)
━━━━━━━━━━━━━━━━━━━━
👤 *የሰራተኛ አካውንት:* ${workerHandle} (ID: \`${userId}\`)
💼 *ሚና (Role):* የኮርቻ ሰራተኛ / Inventory & Support Admin
━━━━━━━━━━━━━━━━━━━━
ከታች ያሉትን አማራጮች በመጠቀም በእጅ ላይ ያሉ እቃዎችን ያስተዳድሩ ወይም የደንበኛ ጥያቄዎችን ይመልሱ 👇
`;
    return ctx.replyWithMarkdown(workerPortalGreeting, getWorkerMenuKeyboard());
  }

  // Standard Customer Welcome Flow
  const customerWelcome = `
👋 *እንኳን ወደ ኮርቻ (KORCHA) በደህና መጡ!*
_የውጭ ገበያ እቃ አቅራቢ — ቀጥታ ከዓለም አቀፍ ገበያዎች ወደ ኢትዮጵያ_

ከ *Shein, AliExpress, Amazon ወይም Temu* ላይ የፈለጉትን እቃ ይዘዙ ወይም በመደርደሪያችን ያሉ በእጅ ላይ ያሉ እቃዎችን ይምረጡ። የኮርቻ ሰራተኞች ወጪውን አስልተው በርዎ ድረስ ያደርሳሉ!

📌 *እንዴት ማዘዝ ይችላሉ?*
1️⃣ *ሊንክ ወይም ፎቶ ያስገቡ* (የእቃውን ሊንክ ወይም ስክሪንሾት ይላኩ)
2️⃣ *ድረ-ገጹንና ዝርዝሩን ይምረጡ* (Shein, AliExpress, Amazon... መጠን፣ ቀለም፣ ብዛት)
3️⃣ *ስልክ ቁጥርዎን ያስገቡ* (ዋጋው ሲሰላ በኮርቻ ሰራተኛ ይደርስዎታል)

ከታች ያሉትን ምርጫዎች ይጠቀሙ 👇
`;

  await ctx.replyWithMarkdown(customerWelcome, getMainMenuKeyboard());
});

// Cancel Handler
bot.hears(['❌ ሰርዝ (Cancel)', '/cancel'], async (ctx) => {
  clearSession(ctx.from.id);
  if (isWorker(ctx)) {
    return ctx.reply('ተሰርዟል። ወደ ሰራተኛ ፖርታል ተመልሰዋል።', getWorkerMenuKeyboard());
  }
  return ctx.reply('ተሰርዟል። ወደ ዋናው ሜኑ ተመልሰዋል።', getMainMenuKeyboard());
});

// ----------------------------------------------------
// WORKER PORTAL: INVENTORY WIZARD & MANAGEMENT
// ----------------------------------------------------

// Worker Trigger: Start Item Upload Wizard
bot.hears(['➕ አዲስ እቃ መዝግብ (Add Shelf Item)', '/additem'], async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  const session = getSession(ctx.from.id);
  session.state = 'WORKER_ADD_PHOTO';
  session.data = {};

  await ctx.replyWithMarkdown(
    `📸 *ደረጃ 1 ከ 5፡ የእቃውን ፎቶ ይላኩ*\n\nእባክዎ በእጅ ላይ ያለውን እቃ ጥራት ያለው ፎቶ እዚህ ይላኩ 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Worker Trigger: View Current Shelf Inventory (with Edit shortcuts)
bot.hears(['📋 መደርደሪያ ተመልከት (View Shelf)', '/viewshelf'], async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  if (shelfItems.length === 0) {
    return ctx.replyWithMarkdown(
      `📦 *መደርደሪያው ባዶ ነው!*\n\nበአሁኑ ሰዓት በእጅ ላይ ያለ ምንም እቃ አልተመዘገበም። '➕ አዲስ እቃ መዝግብ' የሚለውን በመጫን እቃ ማከል ይችላሉ።`,
      getWorkerMenuKeyboard()
    );
  }

  let summary = `📦 *በእጅ ላይ ያሉ እቃዎች ዝርዝር (ጠቅላላ: ${shelfItems.length}):*\n━━━━━━━━━━━━━━━━━━━━\n`;
  shelfItems.slice(0, 15).forEach((item, idx) => {
    summary += `${idx + 1}. *${item.titleAm || item.titleEn}*\n` +
      `   📂 ምድብ: \`${item.category}\` | 💰 ዋጋ: *${item.priceEtb} ETB*` +
      (item.size ? ` | 📏 ሳይዝ: \`${item.size}\`` : '') + '\n' +
      `   🏷️ ኮድ: \`${item.id}\` | 📦 ብዛት: ${item.stockQuantity || 1}\n` +
      `   ✏️ ለማረም: \`/editshelf ${item.id}\`\n` +
      `   🗑️ ለማጥፋት: \`/delshelf ${item.id}\`\n\n`;
  });
  summary += `━━━━━━━━━━━━━━━━━━━━\n_ለማረም ወይም ለማጥፋት ከላይ ያሉትን ኮዶች ይንኩ።_`;

  await ctx.replyWithMarkdown(summary, getWorkerMenuKeyboard());
});

// Worker Command: Edit Shelf Item
bot.command('editshelf', async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.replyWithMarkdown(
      `📌 *የማረሚያ አጠቃቀም፡* \`/editshelf <shelf_id>\`\nምሳሌ፡ \`/editshelf shelf-1698000000\`\n\nወይም ሙሉውን ዝርዝር ለማየት '📋 መደርደሪያ ተመልከት' የሚለውን ይጫኑ።`
    );
  }

  const targetId = parts[1];
  const item = shelfItems.find((i) => i.id === targetId);

  if (!item) {
    return ctx.replyWithMarkdown(`⚠️ እቃው በመደርደሪያው ላይ አልተገኘም (ID: \`${targetId}\`)`);
  }

  const itemCard = `
✏️ *እቃውን እያረሙ ነው:*
━━━━━━━━━━━━━━━━━━━━
📦 *ስም:* ${item.titleAm || item.titleEn}
📂 *ምድብ:* ${item.category}
💰 *ዋጋ:* ${item.priceEtb} ETB
📏 *መጠን (Size):* ${item.size || 'ያልተገለጸ'}
📦 *ብዛት:* ${item.stockQuantity || 1}
━━━━━━━━━━━━━━━━━━━━
ምን መቀየር ይፈልጋሉ? ከታች አንዱን ይምረጡ 👇
`;

  const editKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🏷️ ስም (Title)', `edit_title_${item.id}`),
      Markup.button.callback('📏 ሳይዝ (Size)', `edit_size_${item.id}`),
    ],
    [
      Markup.button.callback('💰 ዋጋ (Price)', `edit_price_${item.id}`),
      Markup.button.callback('📸 ፎቶ (Photo)', `edit_photo_${item.id}`),
    ],
    [
      Markup.button.callback('📦 ብዛት (Stock)', `edit_stock_${item.id}`),
      Markup.button.callback('❌ ሰርዝ (Cancel)', 'cancel_edit'),
    ],
  ]);

  await ctx.replyWithMarkdown(itemCard, editKeyboard);
});

// Inline Callback Actions for Shelf Editing
bot.action(/^edit_(title|size|price|photo|stock)_(.+)$/, async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.answerCbQuery('⚠️ ይህ ለኮርቻ ሰራተኛ ብቻ ነው');
  }

  const field = ctx.match[1];
  const targetId = ctx.match[2];
  const item = shelfItems.find((i) => i.id === targetId);

  if (!item) {
    await ctx.answerCbQuery('እቃው አልተገኘም');
    return ctx.reply('⚠️ እቃው አልተገኘም።');
  }

  await ctx.answerCbQuery();
  const session = getSession(ctx.from.id);
  session.data = { editTargetId: targetId, currentItem: item };

  if (field === 'title') {
    session.state = 'WORKER_EDIT_TITLE';
    return ctx.replyWithMarkdown(
      `🏷️ *አዲሱን የእቃ ስም (Title) ያስገቡ፡*\n\nየአሁኑ ስም: \`${item.titleAm || item.titleEn}\``,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (field === 'size') {
    session.state = 'WORKER_EDIT_SIZE';
    return ctx.replyWithMarkdown(
      `📏 *አዲሱን መጠን (Size) ያስገቡ፡*\n\nየአሁኑ ሳይዝ: \`${item.size || 'N/A'}\`\nምሳሌ: \`M\`, \`L\`, \`42\`, \`Free Size\``,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (field === 'price') {
    session.state = 'WORKER_EDIT_PRICE';
    return ctx.replyWithMarkdown(
      `💰 *አዲሱን ዋጋ በብር (Price in ETB) ያስገቡ፡*\n\nየአሁኑ ዋጋ: \`${item.priceEtb} ETB\`\nምሳሌ: \`4500\``,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (field === 'photo') {
    session.state = 'WORKER_EDIT_PHOTO';
    return ctx.replyWithMarkdown(
      `📸 *አዲሱን የእቃ ፎቶ እዚህ ይላኩ፡*`,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }

  if (field === 'stock') {
    session.state = 'WORKER_EDIT_STOCK';
    return ctx.replyWithMarkdown(
      `📦 *ያለውን የእቃ ብዛት (Stock Quantity) ያስገቡ፡*\n\nየአሁኑ ብዛት: \`${item.stockQuantity || 1}\`\n(እቃው ካለቀ 0 ያስገቡ)`,
      Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
    );
  }
});

// Cancel Edit Inline Callback
bot.action('cancel_edit', async (ctx) => {
  await ctx.answerCbQuery('ተሰርዟል');
  clearSession(ctx.from.id);
  await ctx.reply('ማረም ተሰርዟል።', getWorkerMenuKeyboard());
});

// Worker Command: Delete Shelf Item
bot.command('delshelf', async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('📌 አጠቃቀም፡ `/delshelf <shelf_id>`\nምሳሌ፡ `/delshelf shelf-1698000000`', { parse_mode: 'Markdown' });
  }

  const targetId = parts[1];
  const initialCount = shelfItems.length;
  shelfItems = shelfItems.filter((i) => i.id !== targetId);

  try {
    if (typeof deleteShelfProduct === 'function') {
      await deleteShelfProduct(targetId);
    }
  } catch (err) {
    console.warn('[DB Delete Warning]', err.message);
  }

  if (shelfItems.length === initialCount) {
    return ctx.reply(`⚠️ እቃው አልተገኘም (ID: \`${targetId}\`)`, { parse_mode: 'Markdown' });
  }

  await ctx.reply(`✅ እቃው ከመደርደሪያ ተሰርዟል! (ID: ${targetId})`, getWorkerMenuKeyboard());
});

// Worker Trigger: View Pending Quotes Summary
bot.hears(['📥 ክፍት የዋጋ ጥያቄዎች (Quotes)', '/quotes'], async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  await ctx.replyWithMarkdown(
    `📥 *ክፍት የዋጋ ጥያቄዎች:*\n\nአዳዲስ ጥያቄዎች ሲገቡ ወዲያውኑ ወደዚህ ቦት ማሳወቂያ ይላክልዎታል። ያንን መልዕክት በቀጥታ *Reply* በማድረግ ለደንበኛው ዋጋውን መመለስ ይችላሉ።\n\nወይም በኮድ ለመመለስ፡\n\`/reply <KC-Code> <መልስዎ>\``,
    getWorkerMenuKeyboard()
  );
});

// Worker Trigger: Worker Profile & Info
bot.hears(['ℹ️ ሰራተኛ መረጃ (Worker Profile)', '/workerinfo'], async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኞች ብቻ የተፈቀደ ነው');
  }

  const profileInfo = `
💼 *የኮርቻ ሰራተኛ መረጃ:*
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* @${ctx.from.username || 'None'}
🆔 *Telegram ID:* \`${ctx.from.id}\`
🏢 *Support Desk:* @${WORKER_USERNAME}
👥 *የተፈቀደላቸው ሰራተኞች:* ${WORKER_USERNAMES.map((u) => '@' + u).join(', ')}
━━━━━━━━━━━━━━━━━━━━
`;
  await ctx.replyWithMarkdown(profileInfo, getWorkerMenuKeyboard());
});

// Worker Command: /reply <customerId_or_quoteCode> <message>
bot.command('reply', async (ctx) => {
  if (!isWorker(ctx)) {
    return ctx.reply('⚠️ ይህ ትዕዛዝ ለኮርቻ ሰራተኛ ብቻ የተፈቀደ ነው');
  }

  const text = ctx.message.text;
  const match = text.match(/^\/reply\s+(\S+)\s+(.+)$/s);
  if (!match) {
    return ctx.reply('📌 አጠቃቀም፡ `/reply <customer_id_or_KC_code> <መልስዎ>`\nምሳሌ፡ `/reply KC-123456 የእቃው ዋጋ 3,500 ብር ነው`', { parse_mode: 'Markdown' });
  }

  const target = match[1];
  const replyMessage = match[2];

  let targetChatId = target;
  if (ticketCustomerMap.has(target)) {
    targetChatId = ticketCustomerMap.get(target);
  }

  try {
    await bot.telegram.sendMessage(
      targetChatId,
      `💬 <b>መልስ ከኮርቻ ሰራተኛ (@${WORKER_USERNAME})፦</b>\n━━━━━━━━━━━━━━━━━━━━\n${replyMessage}\n━━━━━━━━━━━━━━━━━━━━\n👉 ለዚህ መልስ ለመስጠት በቀጥታ እዚህ መጻፍ ይችላሉ።`,
      { parse_mode: 'HTML' }
    );
    await ctx.reply(`✅ መልዕክትዎ ለደንበኛው (${targetChatId}) በቦቱ ደርሷል!`);
  } catch (err) {
    await ctx.reply(`❌ ለደንበኛው መላክ አልተቻለም፡ ${err.message}`);
  }
});

// ----------------------------------------------------
// CUSTOMER BOT TRIGGERS (QUOTE WIZARD & SUPPORT)
// ----------------------------------------------------

// Trigger: 🔗 ሊንክ ያስገቡ
bot.hears(['🔗 ሊንክ ያስገቡ (Insert Link)', '/link', 'ሊንክ ያስገቡ'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_LINK';
  session.data = { sourceType: 'link' };

  await ctx.replyWithMarkdown(
    `🔗 *የእቃውን ሊንክ ያስገቡ፡*\n\n📌 *ምሳሌ:*\n\`https://www.shein.com/item/12345...\`\nወይም\n\`https://www.aliexpress.com/item/...\`\n\`https://www.amazon.com/dp/...\`\n\nእባክዎ ሊንኩን እዚህ ይላኩልን 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: 📸 ፎቶ / ስክሪንሾት ላክ
bot.hears(['📸 ፎቶ / ስክሪንሾት ላክ (Send Photo)', '/photo', 'ፎቶ ላክ', 'ስክሪንሾት ላክ'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_PHOTO';
  session.data = { sourceType: 'screenshot' };

  await ctx.replyWithMarkdown(
    `📸 *የእቃውን ፎቶ ወይም ስክሪንሾት ይላኩ፡*\n\nከ Shein, AliExpress, Amazon ወይም Temu ላይ የተነሳውን ግልጽ ፎቶ/ስክሪንሾት እዚህ ይላኩልን 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: 💬 ከኮርቻ ሰራተኛ ጋር ለማውራት
bot.hears([new RegExp(`(ከኮርቻ ሰራተኛ ጋር|ከአስተናጋጅ ጋር|ድጋፍ)`, 'i'), '/support'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'CHATTING_WITH_SUPPORT';

  await ctx.replyWithMarkdown(
    `💬 *የኮርቻ ሰራተኛ ድጋፍ መስመር:*\n\nየሚፈልጉትን ጥያቄ ወይም መልዕክት እዚህ ይጻፉልን። የኮርቻ ሰራተኛ ወዲያውኑ እዚሁ ቦት ላይ ይመልስልዎታል!\n\nወይም በቀጥታ በቴሌግራም ለማውራት፡\n👉 [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// Trigger: 📦 የትዕዛዝ ሁኔታ መከታተያ
bot.hears(['📦 የትዕዛዝ ሁኔታ መከታተያ', '/track'], async (ctx) => {
  const session = getSession(ctx.from.id);
  session.state = 'AWAITING_TRACKING_INPUT';

  await ctx.replyWithMarkdown(
    `📦 *የትዕዛዝ ሁኔታ መከታተያ፡*\n\nእባክዎ የትዕዛዝ ኮድዎን (ምሳሌ፡ \`KC-102948\`) ወይም በትዕዛዝ ወቅት የተጠቀሙትን *ስልክ ቁጥር* (\`09**** / 07****\`) ያስገቡ፡`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// ----------------------------------------------------
// STEP 5: MARKETPLACE SELECTION CALLBACK HANDLER
// ----------------------------------------------------
bot.action(/^mkt_(shein|aliexpress|amazon|else)$/, async (ctx) => {
  const mktChoice = ctx.match[1];
  const session = getSession(ctx.from.id);
  session.data.marketplace = mktChoice;

  await ctx.answerCbQuery();
  session.state = 'AWAITING_DETAILS';

  const mktLabels = {
    shein: 'Shein 🛍️',
    aliexpress: 'AliExpress 📦',
    amazon: 'Amazon 🛒',
    else: 'ሌላ (Else / Other) 🌐',
  };

  await ctx.replyWithMarkdown(
    `✅ *የተመረጠው ገበያ:* ${mktLabels[mktChoice] || mktChoice.toUpperCase()}\n\nአሁን *የእቃውን ዝርዝር መረጃ* ይጻፉልን፡\n\n🔹 *መጠን / ሳይዝ (Size)* (ምሳሌ: M, L, 42)\n🔹 *ቀለም (Color)* (ምሳሌ: ጥቁር, ነጭ)\n🔹 *ብዛት / ቁጥር (Quantity)* (ምሳሌ: 1)\n🔹 *ተጨማሪ ማስታወሻ* ካለ\n\nእባክዎ ዝርዝሩን በአንድ መልዕክት ጽፈው ይላኩ 👇`,
    Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
  );
});

// ----------------------------------------------------
// PHOTO MESSAGE HANDLER
// ----------------------------------------------------
bot.on('photo', async (ctx, next) => {
  const photos = ctx.message.photo;
  const highestResPhoto = photos[photos.length - 1];
  const fileId = highestResPhoto.file_id;
  const session = getSession(ctx.from.id);

  // 1. Worker Replying to a Customer with a Photo
  if (isWorker(ctx) && ctx.message.reply_to_message) {
    const originalText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '';
    const idMatch = originalText.match(/ID:\s*<code>(\d+)<\/code>/) || originalText.match(/ID:\s*`(\d+)`/);
    if (idMatch) {
      const targetChatId = idMatch[1];
      const caption = ctx.message.caption || 'ፎቶ ከኮርቻ ሰራተኛ';
      try {
        await bot.telegram.sendPhoto(targetChatId, fileId, {
          caption: `💬 <b>ፎቶ ከኮርቻ ሰራተኛ (@${WORKER_USERNAME})፦</b>\n${caption}`,
          parse_mode: 'HTML',
        });
        return ctx.reply('✅ ፎቶው ለደንበኛው በቦቱ ደርሷል!');
      } catch (err) {
        return ctx.reply(`❌ ፎቶውን ለደንበኛ መላክ አልተቻለም፡ ${err.message}`);
      }
    }
  }

  // 2. Worker Editing Item Photo
  if (isWorker(ctx) && session.state === 'WORKER_EDIT_PHOTO') {
    const targetId = session.data.editTargetId;
    let newImageUrl = null;
    try {
      const linkObj = await bot.telegram.getFileLink(fileId);
      newImageUrl = linkObj.href;
    } catch (e) {
      console.warn('[Edit Photo Link Error]', e.message);
    }

    const item = shelfItems.find((i) => i.id === targetId);
    if (item) {
      item.photoFileId = fileId;
      if (newImageUrl) item.image = newImageUrl;
    }

    try {
      await updateShelfProduct(targetId, {
        photo_file_id: fileId,
        image_url: newImageUrl,
      });
    } catch (dbErr) {
      console.warn('[DB Edit Photo Error]', dbErr.message);
    }

    clearSession(ctx.from.id);
    return ctx.replyWithMarkdown(`✅ *የእቃው ፎቶ በተሳካ ሁኔታ ተቀይሯል!* (ኮድ: \`${targetId}\`)`, getWorkerMenuKeyboard());
  }

  // 3. Worker Uploading a Product to the Shelf
  if (isWorker(ctx) && session.state === 'WORKER_ADD_PHOTO') {
    session.data.photoFileId = fileId;
    try {
      const linkObj = await bot.telegram.getFileLink(fileId);
      session.data.imageUrl = linkObj.href;
    } catch (linkErr) {
      console.warn('[Photo Link Fetch]', linkErr.message);
    }

    session.state = 'WORKER_SELECT_CATEGORY';

    return ctx.replyWithMarkdown(
      `✅ *ፎቶው ተቀብለናል!*\n\n📂 *ደረጃ 2 ከ 5፡ የእቃውን ምድብ (Category) ይምረጡ፡*\n\nከታች ካሉት አማራጮች አንዱን ይምረጡ ወይም አዲስ የምድብ ስም ይጻፉ 👇`,
      getCategorySelectionKeyboard()
    );
  }

  // 4. Customer Uploading Screenshot (Step 5: Ask for Marketplace)
  if (session.state === 'AWAITING_PHOTO' || session.state === 'IDLE') {
    session.state = 'AWAITING_MARKETPLACE';
    session.data = {
      ...session.data,
      sourceType: 'screenshot',
      photoFileId: fileId,
    };

    return ctx.replyWithMarkdown(
      `✅ *ፎቶው ደርሶናል!*\n\n🏬 *ደረጃ 1.5፡ እቃው የተመረጠበትን ድረ-ገጽ (Marketplace) ይምረጡ፡*`,
      getMarketplaceSelectionInlineKeyboard()
    );
  }

  return next();
});

// ----------------------------------------------------
// TEXT MESSAGE HANDLER
// ----------------------------------------------------
bot.on('text', async (ctx, next) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  const session = getSession(userId);

  // --------------------------------------------------
  // A. WORKER CONVERSATIONS & ACTIONS
  // --------------------------------------------------
  if (isWorker(ctx)) {
    if (ctx.message.reply_to_message) {
      const originalText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || '';
      const idMatch = originalText.match(/ID:\s*<code>(\d+)<\/code>/) || originalText.match(/ID:\s*`(\d+)`/);
      const codeMatch = originalText.match(/Quote Code:\s*<code>(\S+)<\/code>/) || originalText.match(/Quote:\s*`(\S+)`/);

      let targetCustomerId = idMatch ? idMatch[1] : null;
      if (!targetCustomerId && codeMatch && ticketCustomerMap.has(codeMatch[1])) {
        targetCustomerId = ticketCustomerMap.get(codeMatch[1]);
      }

      if (targetCustomerId) {
        try {
          await bot.telegram.sendMessage(
            targetCustomerId,
            `💬 <b>መልስ ከኮርቻ ሰራተኛ (@${WORKER_USERNAME})፦</b>\n━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━\n👉 ለዚህ መልስ ለመስጠት በቀጥታ እዚህ መጻፍ ይችላሉ።`,
            { parse_mode: 'HTML' }
          );
          return ctx.reply(`✅ መልስዎ ለደንበኛው በቦቱ ደርሷል!`);
        } catch (err) {
          return ctx.reply(`❌ ለደንበኛው መላክ አልተቻለም፡ ${err.message}`);
        }
      }
    }

    if (session.state === 'WORKER_EDIT_TITLE') {
      const targetId = session.data.editTargetId;
      const item = shelfItems.find((i) => i.id === targetId);
      if (item) {
        item.titleAm = text;
        item.titleEn = text;
      }
      try {
        await updateShelfProduct(targetId, { title_am: text, title_en: text });
      } catch (dbErr) {
        console.warn('[DB Edit Title Error]', dbErr.message);
      }
      clearSession(userId);
      return ctx.replyWithMarkdown(`✅ *የእቃው ስም ተቀይሯል:* \`${text}\``, getWorkerMenuKeyboard());
    }

    if (session.state === 'WORKER_EDIT_SIZE') {
      const targetId = session.data.editTargetId;
      const item = shelfItems.find((i) => i.id === targetId);
      if (item) {
        item.size = text.toUpperCase();
      }
      try {
        await updateShelfProduct(targetId, { size: text.toUpperCase() });
      } catch (dbErr) {
        console.warn('[DB Edit Size Error]', dbErr.message);
      }
      clearSession(userId);
      return ctx.replyWithMarkdown(`✅ *የእቃው መጠን (Size) ተቀይሯል:* \`${text.toUpperCase()}\``, getWorkerMenuKeyboard());
    }

    if (session.state === 'WORKER_EDIT_PRICE') {
      const price = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(price) || price <= 0) {
        return ctx.reply('⚠️ እባክዎ ትክክለኛ የቁጥር ዋጋ ያስገቡ (ምሳሌ: 4500)፦');
      }
      const targetId = session.data.editTargetId;
      const item = shelfItems.find((i) => i.id === targetId);
      if (item) {
        item.priceEtb = price;
      }
      try {
        await updateShelfProduct(targetId, { price_etb: price });
      } catch (dbErr) {
        console.warn('[DB Edit Price Error]', dbErr.message);
      }
      clearSession(userId);
      return ctx.replyWithMarkdown(`✅ *የእቃው ዋጋ ተቀይሯል:* \`${price} ETB\``, getWorkerMenuKeyboard());
    }

    if (session.state === 'WORKER_EDIT_STOCK') {
      const stock = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(stock) || stock < 0) {
        return ctx.reply('⚠️ እባክዎ ትክክለኛ የብዛት ቁጥር ያስገቡ (ምሳሌ: 5 ወይም 0)፦');
      }
      const targetId = session.data.editTargetId;
      const item = shelfItems.find((i) => i.id === targetId);
      const inStock = stock > 0;
      if (item) {
        item.stockQuantity = stock;
        item.inStock = inStock;
      }
      try {
        await updateShelfProduct(targetId, { stock_quantity: stock, in_stock: inStock });
      } catch (dbErr) {
        console.warn('[DB Edit Stock Error]', dbErr.message);
      }
      clearSession(userId);
      return ctx.replyWithMarkdown(
        `✅ *የእቃው ብዛት ተቀይሯል:* \`${stock}\` ${inStock ? '(በእጅ ላይ ያለ)' : '(አልቋል)'}`,
        getWorkerMenuKeyboard()
      );
    }

    if (session.state === 'WORKER_SELECT_CATEGORY') {
      let matchedCategory = text;
      const cleanText = text.replace(/^[^\w\s\u1200-\u137F]+/u, '').trim();
      const found = PREDEFINED_CATEGORIES.find(
        (c) => text.includes(c.nameAm) || text.toLowerCase().includes(c.nameEn.toLowerCase())
      );
      if (found) {
        matchedCategory = found.id;
      } else {
        matchedCategory = cleanText;
      }

      session.data.category = matchedCategory;
      session.state = 'WORKER_ENTER_TITLE';

      return ctx.replyWithMarkdown(
        `✅ *ምድብ:* \`${matchedCategory}\`\n\n🏷️ *ደረጃ 3 ከ 5፡ የእቃውን ስም (Title) ያስገቡ፡*\n\nምሳሌ: \`የሴቶች ጃኬት (ጥቁር)\` ወይም \`AirPods Pro 2\``,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    }

    if (session.state === 'WORKER_ENTER_TITLE') {
      session.data.title = text;
      session.state = 'WORKER_ENTER_PRICE';

      return ctx.replyWithMarkdown(
        `✅ *የእቃ ስም:* ${text}\n\n💰 *ደረጃ 4 ከ 5፡ የእቃውን የመሸጫ ዋጋ በብር (Price in ETB) ያስገቡ፡*\n\nምሳሌ: \`3500\``,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    }

    if (session.state === 'WORKER_ENTER_PRICE') {
      const price = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (isNaN(price) || price <= 0) {
        return ctx.reply('⚠️ እባክዎ ትክክለኛ የቁጥር ዋጋ ያስገቡ (ምሳሌ: 3500)፦');
      }

      session.data.priceEtb = price;
      session.state = 'WORKER_ENTER_DETAILS';

      return ctx.replyWithMarkdown(
        `✅ *ዋጋ:* ${price} ETB\n\n📝 *ደረጃ 5 ከ 5፡ የእቃውን ማብራሪያ፣ መጠን (Size) እና ያለውን ብዛት ያስገቡ፡*\n\nምሳሌ: \`ሳይዝ: M, ቀለም: ጥቁር፣ 2 ፍሬ በእጅ ላይ አለ\``,
        Markup.keyboard([['❌ ሰርዝ (Cancel)']]).resize()
      );
    }

    if (session.state === 'WORKER_ENTER_DETAILS') {
      session.data.description = text;

      const sizeMatch = text.match(/(?:ሳይዝ|size)\s*[:፡]?\s*([a-zA-Z0-9]+)/i);
      const parsedSize = sizeMatch ? sizeMatch[1].toUpperCase() : null;

      const newItem = {
        id: `shelf-${Date.now()}`,
        titleAm: session.data.title,
        titleEn: session.data.title,
        category: session.data.category,
        priceEtb: session.data.priceEtb,
        size: parsedSize,
        description: session.data.description,
        photoFileId: session.data.photoFileId,
        image: session.data.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
        stockQuantity: 1,
        inStock: true,
        badge: 'በእጅ ላይ ያለ (In Stock)',
        deliveryTime: 'ዛሬውኑ ወይም በ24 ሰዓት ውስጥ ይረከቡ',
        addedBy: ctx.from.username || String(ctx.from.id),
        createdAt: new Date().toISOString(),
      };

      shelfItems.unshift(newItem);
      clearSession(userId);

      try {
        if (typeof createShelfProduct === 'function') {
          await createShelfProduct(newItem);
        }
      } catch (dbErr) {
        console.warn('[DB Shelf Save Warning]', dbErr.message);
      }

      return ctx.replyWithMarkdown(
        `🎉 *አዲስ እቃ በተሳካ ሁኔታ ወደ መደርደሪያ ተጨምሯል!*\n━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 *እቃ:* ${newItem.titleAm}\n` +
          `📂 *ምድብ:* ${newItem.category}\n` +
          `💰 *ዋጋ:* ${newItem.priceEtb} ETB\n` +
          (newItem.size ? `📏 *መጠን (Size):* ${newItem.size}\n` : '') +
          `📝 *ዝርዝር:* ${newItem.description}\n` +
          `🆔 *መለያ ኮድ:* \`${newItem.id}\`\n━━━━━━━━━━━━━━━━━━━━\n` +
          `_ለወደፊት ለማረም፦_ \`/editshelf ${newItem.id}\``,
        getWorkerMenuKeyboard()
      );
    }
  }

  // --------------------------------------------------
  // B. CUSTOMER CONVERSATIONS & ORDER FLOWS
  // --------------------------------------------------
  if (session.state === 'CHATTING_WITH_SUPPORT') {
    const notifyId = WORKER_CHAT_ID;
    if (notifyId) {
      const staffMsg = `
💬 <b>ጥያቄ ከደንበኛ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>ደንበኛ:</b> ${ctx.from.first_name || 'Customer'} (ID: <code>${userId}</code>)
📝 <b>መልዕክት:</b> ${text}
━━━━━━━━━━━━━━━━━━━━
👉 ይህን መልዕክት Reply በማድረግ በቀጥታ ለደንበኛው በቦቱ መልስ ይላኩ።
`;
      await bot.telegram.sendMessage(notifyId, staffMsg, { parse_mode: 'HTML' }).catch(() => {});
      return ctx.reply('✅ መልዕክትዎ ለኮርቻ ሰራተኛ ደርሷል። ወዲያውኑ እዚሁ ቦት ላይ መልስ ይላክልዎታል!', getMainMenuKeyboard());
    } else {
      return ctx.reply(`✅ መልዕክትዎ ተመዝግቧል። በቀጥታ ሰራተኛውን ለማነጋገር፡ @${WORKER_USERNAME}`, getMainMenuKeyboard());
    }
  }

  // Auto-detect pasted URL (Step 5: Ask for Marketplace)
  if (session.state === 'IDLE' && (text.startsWith('http://') || text.startsWith('https://'))) {
    session.state = 'AWAITING_MARKETPLACE';
    session.data = {
      sourceType: 'link',
      productUrl: text,
    };

    return ctx.replyWithMarkdown(
      `✅ *ሊንኩ ደርሶናል!*\n\n🏬 *ደረጃ 1.5፡ እቃው የተመረጠበትን ድረ-ገጽ (Marketplace) ይምረጡ፡*`,
      getMarketplaceSelectionInlineKeyboard()
    );
  }

  // Awaiting Product Link
  if (session.state === 'AWAITING_LINK') {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      return ctx.reply('⚠️ እባክዎ ትክክለኛ የድረ-ገጽ ሊንክ ያስገቡ (በ https:// የሚጀምር)፡');
    }

    session.data.productUrl = text;
    session.state = 'AWAITING_MARKETPLACE';

    return ctx.replyWithMarkdown(
      `✅ *ሊንኩ ተመዝግቧል!*\n\n🏬 *ደረጃ 1.5፡ እቃው የተመረጠበትን ድረ-ገጽ (Marketplace) ይምረጡ፡*`,
      getMarketplaceSelectionInlineKeyboard()
    );
  }

  // Awaiting Product Details
  if (session.state === 'AWAITING_DETAILS') {
    session.data.details = text;
    session.state = 'AWAITING_PHONE';

    return ctx.replyWithMarkdown(
      `✅ *የእቃው ዝርዝር ተመዝግቧል!*\n\nየመጨረሻ ደረጃ፡ *የመገናኛ ስልክ ቁጥርዎን* ያስገቡ 📱\n\n📌 *ምሳሌ:* \`0911223344\` ወይም \`0712345678\`\n\nየኮርቻ ሰራተኛ ዋጋውን አስልቶ በቴሌግራም ወይም በስልክ ያሳውቅዎታል!`,
      Markup.keyboard([
        [Markup.button.contactRequest('📱 ስልክ ቁጥሬን ላክ (Share Contact)')],
        ['❌ ሰርዝ (Cancel)'],
      ]).resize()
    );
  }

  // Awaiting Phone Number
  if (session.state === 'AWAITING_PHONE') {
    if (!isValidEthiopianPhone(text)) {
      return ctx.replyWithMarkdown(
        `⚠️ *ትክክለኛ ያልሆነ ስልክ ቁጥር!*\n\nእባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (\`09**** / 07****\`):\nምሳሌ: \`0911223344\` ወይም \`0712345678\``
      );
    }

    const cleanPhone = normalizePhone(text);
    return finalizeQuoteRequest(ctx, session.data, cleanPhone);
  }

  // Awaiting Tracking Code or Phone
  if (session.state === 'AWAITING_TRACKING_INPUT') {
    clearSession(userId);
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
          `🔍 *ምንም የተገኘ ትዕዛዝ የለም!*\n\nጥያቄ ካለዎት 👉 [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})`,
          getMainMenuKeyboard()
        );
      }

      for (const ord of orders) {
        const msg = `
📦 *የትዕዛዝ መረጃ (Order Details)*
━━━━━━━━━━━━━━━━━━━━
🏷️ *የትዕዛዝ ኮድ:* \`${ord.order_code}\`
📊 *ሁኔታ (Status):* \`${ord.status}\`
🛍️ *እቃ:* ${ord.product_summary || 'የተዘዘ እቃ'}
💰 *ጠቅላላ ዋጋ:* ${ord.total_price_etb} ETB
💳 *የተከፈለ ቅድመ ክፍያ:* ${ord.deposit_amount_etb} ETB
🚚 *ቀሪ ክፍያ (ሲረከቡ):* ${ord.cod_balance_etb} ETB
━━━━━━━━━━━━━━━━━━━━
ጥያቄ ካለዎት 👉 [@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})
`;
        await ctx.replyWithMarkdown(msg);
      }
      return ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());
    } catch {
      return ctx.reply('ስህተት ተከስቷል። እባክዎ ትንሽ ቆይተው ይሞክሩ።', getMainMenuKeyboard());
    }
  }

  return next();
});

// ----------------------------------------------------
// CONTACT SHARING HANDLER
// ----------------------------------------------------
bot.on('contact', async (ctx) => {
  const session = getSession(ctx.from.id);
  if (session.state === 'AWAITING_PHONE') {
    const rawPhone = ctx.message.contact.phone_number;
    const cleanPhone = normalizePhone(rawPhone);
    return finalizeQuoteRequest(ctx, session.data, cleanPhone);
  }
});

// ----------------------------------------------------
// HELPER: FINALIZE QUOTE REQUEST & DISPATCH ALERTS (SPEC 3.3)
// ----------------------------------------------------
async function finalizeQuoteRequest(ctx, data, phone) {
  const userId = ctx.from.id;
  const username = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
  const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;
  const marketplace = data.marketplace || 'SHEIN';

  // Store mapping for two-way worker replies
  ticketCustomerMap.set(quoteCode, userId);
  ticketCustomerMap.set(String(userId), userId);

  // 1. Fail-Safe DB Persistence
  try {
    const customer = await upsertCustomer({
      telegramId: userId,
      telegramUsername: ctx.from.username,
      firstName: ctx.from.first_name,
      phone: phone,
    });

    await createQuote({
      quoteCode,
      customerId: customer?.id || null,
      customerPhone: phone,
      sourceType: data.sourceType,
      productUrl: data.productUrl,
      screenshotUrl: data.photoFileId,
      details: `[${marketplace.toUpperCase()}] ${data.details || ''}`,
    });
  } catch (dbErr) {
    console.warn(`[DB Offline] Quote ${quoteCode} saved without DB:`, dbErr.message);
  }

  clearSession(userId);

  // 2. Customer Confirmation
  const confirmationText = `
🎉 *ጥያቄዎ በተሳካ ሁኔታ ተመዝግቧል!*
━━━━━━━━━━━━━━━━━━━━
🏷️ *የጥያቄ ኮድ:* \`${quoteCode}\`
🏬 *ድረ-ገጽ (Marketplace):* \`${marketplace.toUpperCase()}\`
📱 *ስልክ ቁጥር:* \`${phone}\`
🛍️ *ዓይነት:* ${data.sourceType === 'link' ? 'የእቃ ሊንክ' : 'ስክሪንሾት / ፎቶ'}
📝 *ዝርዝር:* ${data.details || 'ያልተገለጸ'}
━━━━━━━━━━━━━━━━━━━━

👨‍💼 *ቀጣይ ሂደት፡*
1. የኮርቻ ሰራተኛ እቃውን ገምግሞ አጠቃላይ ዋጋ በብር ያሰላል።
2. የዋጋ ዝርዝሩ በቴሌግራም እዚሁ ቦት ላይ ወይም በስልክዎ ይላክልዎታል።
3. ${ADVANCE_PERCENT}% ቅድመ ክፍያ በቴሌብር ከፍለው ትዕዛዝዎ ይረጋገጣል! (ቀሪው ${COD_PERCENT}% ሲረከቡ)

👉 ጥያቄ ካለዎት በቀጥታ ከኮርቻ ሰራተኛ ጋር ይገናኙ፡
[@${WORKER_USERNAME}](https://t.me/${WORKER_USERNAME})
`;

  await ctx.replyWithMarkdown(
    confirmationText,
    Markup.inlineKeyboard([
      Markup.button.url(`💬 ከኮርቻ ሰራተኛ ጋር አውራ (@${WORKER_USERNAME})`, `https://t.me/${WORKER_USERNAME}`),
    ])
  );
  await ctx.reply('ዋና ሜኑ፡', getMainMenuKeyboard());

  // 3. Dispatch Notification to Worker in HTML Format
  const notifyTarget = WORKER_CHAT_ID;
  if (notifyTarget) {
    const workerNotification = `
🔔 <b>አዲስ የእቃ ዋጋ ጥያቄ ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Quote Code:</b> <code>${quoteCode}</code>
🏬 <b>Marketplace:</b> <code>${marketplace.toUpperCase()}</code>
👤 <b>ደንበኛ:</b> ${username} (ID: <code>${userId}</code>)
📱 <b>ስልክ:</b> <code>${phone}</code>
📌 <b>ዓይነት:</b> ${data.sourceType.toUpperCase()}
📝 <b>ዝርዝር:</b> ${data.details || 'N/A'}
🔗 <b>ሊንክ:</b> ${data.productUrl || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
💬 <i>ይህን መልዕክት Reply በማድረግ በቀጥታ ለደንበኛው በቦቱ መልስ መስጠት ይችላሉ!</i>
`;
    try {
      if (data.photoFileId) {
        await bot.telegram.sendPhoto(notifyTarget, data.photoFileId, {
          caption: workerNotification,
          parse_mode: 'HTML',
        });
      } else {
        await bot.telegram.sendMessage(notifyTarget, workerNotification, {
          parse_mode: 'HTML',
        });
      }
      console.log(`[Notification Dispatched] ${quoteCode} sent to ${notifyTarget}`);
    } catch (sendErr) {
      console.error('[Notification Failed]', sendErr.message);
    }
  }
}

// ----------------------------------------------------
// REST API FOR WEB & TELEGRAM MINI APP
// ----------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve built frontend assets
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`[Static] Serving frontend from ${distPath}`);
}

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Health check with full connection diagnostics
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Korcha Unified Backend',
    worker: WORKER_USERNAME,
    authorizedWorkers: WORKER_USERNAMES,
    hasToken: Boolean(BOT_TOKEN && BOT_TOKEN.length > 20),
    botConnected: Boolean(botInfo),
    botUsername: botInfo ? `@${botInfo.username}` : 'Not connected',
    workerChatIdConfigured: Boolean(WORKER_CHAT_ID),
    rates: {
      hkdExchangeRate: HKD_EXCHANGE_RATE,
      usdToHkd: USD_TO_HKD,
      kgCargoRateEtb: KG_CARGO_RATE_ETB,
      advancePercent: ADVANCE_PERCENT,
      codPercent: COD_PERCENT,
    },
    shelfCount: shelfItems.length,
  });
});

// GET /api/shelf
app.get('/api/shelf', async (req, res) => {
  if (shelfItems.length === 0) {
    await syncShelfFromDB();
  }

  const categorizedCatalog = PREDEFINED_CATEGORIES.map((cat) => {
    const items = shelfItems.filter(
      (item) =>
        item.category?.toLowerCase() === cat.id?.toLowerCase() ||
        item.category?.toLowerCase() === cat.nameEn?.toLowerCase() ||
        item.category === cat.nameAm
    );
    return {
      categoryId: cat.id,
      categoryNameAm: cat.nameAm,
      categoryNameEn: cat.nameEn,
      icon: cat.icon,
      itemCount: items.length,
      items: items,
    };
  });

  res.json({
    success: true,
    totalItems: shelfItems.length,
    catalog: categorizedCatalog,
    rawItems: shelfItems,
  });
});

// POST /api/shelf/add
app.post('/api/shelf/add', async (req, res) => {
  const { titleAm, titleEn, category, priceEtb, size, image, stockQuantity, description } = req.body;
  if (!titleAm || !priceEtb) {
    return res.status(400).json({ success: false, error: 'titleAm and priceEtb are required' });
  }

  const newItem = {
    id: `shelf-${Date.now()}`,
    titleAm,
    titleEn: titleEn || titleAm,
    category: category || 'womens',
    priceEtb: parseInt(priceEtb, 10),
    size: size || null,
    description: description || '',
    image: image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
    stockQuantity: parseInt(stockQuantity || '1', 10),
    badge: 'በእጅ ላይ ያለ (In Stock)',
    deliveryTime: 'ዛሬውኑ ወይም በ24 ሰዓት ውስጥ ይረከቡ',
    createdAt: new Date().toISOString(),
  };

  shelfItems.unshift(newItem);

  try {
    if (typeof createShelfProduct === 'function') {
      await createShelfProduct(newItem);
    }
  } catch (dbErr) {
    console.warn('[DB Shelf API Save Warning]', dbErr.message);
  }

  res.json({ success: true, item: newItem });
});

// PATCH /api/shelf/:id
app.patch('/api/shelf/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const itemIndex = shelfItems.findIndex((i) => i.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  shelfItems[itemIndex] = { ...shelfItems[itemIndex], ...updates };

  try {
    if (typeof updateShelfProduct === 'function') {
      await updateShelfProduct(id, updates);
    }
  } catch (dbErr) {
    console.warn('[DB Shelf API Update Warning]', dbErr.message);
  }

  res.json({ success: true, item: shelfItems[itemIndex] });
});

// DELETE /api/shelf/:id
app.delete('/api/shelf/:id', async (req, res) => {
  const { id } = req.params;
  const initialCount = shelfItems.length;
  shelfItems = shelfItems.filter((i) => i.id !== id);

  try {
    if (typeof deleteShelfProduct === 'function') {
      await deleteShelfProduct(id);
    }
  } catch (dbErr) {
    console.warn('[DB Shelf API Delete Warning]', dbErr.message);
  }

  if (shelfItems.length === initialCount) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  res.json({ success: true, message: `Item ${id} deleted` });
});

// GET /api/test-notify
app.get('/api/test-notify', async (req, res) => {
  if (!WORKER_CHAT_ID) {
    return res.status(400).json({ error: 'TELEGRAM_WORKER_CHAT_ID is missing in your .env' });
  }
  try {
    await bot.telegram.sendMessage(
      WORKER_CHAT_ID,
      '🔔 <b>Test Notification:</b> Korcha የኮርቻ ሰራተኛ notification pipeline is working properly!',
      { parse_mode: 'HTML' }
    );
    res.json({ success: true, message: `Notification sent successfully to chat ID: ${WORKER_CHAT_ID}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotes
app.post('/api/quotes', upload.single('screenshot'), async (req, res) => {
  try {
    const {
      sourceType,
      marketplace,
      productUrl,
      size,
      color,
      quantity,
      details,
      phone,
      telegramUsername,
      telegramId,
      telegramFirstName,
    } = req.body;
    const screenshotFile = req.file;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({ success: false, error: 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)' });
    }

    const cleanPhone = normalizePhone(phone);
    const mkt = (marketplace || 'SHEIN').toUpperCase();
    const combinedDetails = `[ገበያ: ${mkt}] | መጠን: ${size || 'N/A'} | ቀለም: ${color || 'N/A'} | ብዛት: ${quantity || '1'} | ማስታወሻ: ${details || 'N/A'}`;
    const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    if (telegramId) {
      ticketCustomerMap.set(quoteCode, telegramId);
      ticketCustomerMap.set(String(telegramId), telegramId);
    }

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
        details: `${combinedDetails} | ቴሌግራም: ${telegramUsername || 'N/A'}`,
      });
    } catch (dbErr) {
      console.log(`[DB Offline] Quote ${quoteCode} generated without DB:`, cleanPhone);
    }

    const cleanUser = (telegramUsername || '').replace(/^@/, '').trim();
    const userDisplay = cleanUser
      ? `<a href="https://t.me/${cleanUser}">@${cleanUser}</a>`
      : (telegramFirstName ? `${telegramFirstName} (ID: <code>${telegramId || 'N/A'}</code>)` : 'ያልተገለጸ');

    if (WORKER_CHAT_ID) {
      const workerMsg = `
🔔 <b>አዲስ ጥያቄ ከ Mini App ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Quote:</b> <code>${quoteCode}</code>
🏬 <b>Marketplace:</b> <code>${mkt}</code>
👤 <b>ደንበኛ:</b> ${userDisplay}
📱 <b>ስልክ:</b> <code>${cleanPhone}</code>
📝 <b>ዝርዝር:</b> ${combinedDetails}
🔗 <b>ሊንክ:</b> ${productUrl || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
💬 <i>ይህን መልዕክት Reply በማድረግ ወይም የደንበኛውን ቴሌግራም በመንካት በቀጥታ ማነጋገር ይችላሉ!</i>
`;
      try {
        if (screenshotFile) {
          await bot.telegram.sendPhoto(WORKER_CHAT_ID, { source: screenshotFile.path }, {
            caption: workerMsg,
            parse_mode: 'HTML',
          });
        } else {
          await bot.telegram.sendMessage(WORKER_CHAT_ID, workerMsg, { parse_mode: 'HTML' });
        }
        console.log(`[Mini App Dispatch] Sent ${quoteCode} to ${WORKER_CHAT_ID}`);
      } catch (err) {
        console.error('[Mini App Dispatch Error]', err.message);
      }
    }

    res.json({ success: true, quoteCode });
  } catch (err) {
    console.error('[API Quote Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/lookup
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

// Single Page Application Fallback for Mini App
app.get('*', (req, res) => {
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Korcha Mini App: Run `npm run build` to compile frontend.');
  }
});

// ----------------------------------------------------
// START SERVER & LAUNCH TELEGRAM BOT
// ----------------------------------------------------
async function start() {
  try {
    await runMigrations();
    await syncShelfFromDB();
  } catch {
    console.warn('[DB Warning] Migrations deferred (running in fail-safe mode).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Korcha API listening on port ${PORT}`);
  });

  if (bot && BOT_TOKEN && BOT_TOKEN.length > 20) {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    } catch (e) {
      console.warn('[Webhook Cleanup]', e.message);
    }

    bot.launch()
      .then(() => {
        const activeUsername = botInfo?.username ? `@${botInfo.username}` : 'KorchaBot';
        console.log(`[Bot] Korcha Bot launched successfully as ${activeUsername}`);
        console.log(`[Bot] Authorized Staff: ${WORKER_USERNAMES.map((u) => '@' + u).join(', ')}`);
      })
      .catch((err) => console.error('[Bot Launch Error]', err.message));
  } else {
    console.warn('[Bot Warning] Bot skipped. Check TELEGRAM_BOT_TOKEN.');
  }

  process.once('SIGINT', () => bot && bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot && bot.stop('SIGTERM'));
}

start();