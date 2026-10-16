import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import multer from "multer";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

// Environment Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;
const WORKER_USERNAME = (process.env.WORKER_TELEGRAM_USERNAME || "korcha_support").replace("@", "");
const HKD_EXCHANGE_RATE = parseFloat(process.env.HKD_EXCHANGE_RATE || "30.0");
const USD_TO_HKD = 7.8;
const KG_CARGO_RATE_ETB = parseFloat(process.env.KG_CARGO_RATE_ETB || "1000.0");
const TELEBIRR_PHONE = process.env.TELEBIRR_PHONE || "+251-996237800";
const CBE_ACCOUNT = process.env.CBE_ACCOUNT || "10001116390";
const TELEGRAM_WEB_APP_URL = "https://telegram.korcha.com.et/?v=2";
const PORT = process.env.PORT || process.env.WORKER_PORT || 3000;
const WORKER_PORT = PORT;

// Dynamic Payment Ratios from .env (Default: 40% advance payment, 60% cash-on-delivery)
const ADVANCE_PAYMENT_PERCENT = parseInt(process.env.ADVANCE_PAYMENT_PERCENT || process.env.VITE_ADVANCE_PAYMENT_PERCENT || "40", 10) || 40;
const COD_PAYMENT_PERCENT = parseInt(process.env.COD_PAYMENT_PERCENT || process.env.VITE_COD_PAYMENT_PERCENT || String(100 - ADVANCE_PAYMENT_PERCENT), 10) || (100 - ADVANCE_PAYMENT_PERCENT);

if (!BOT_TOKEN) {
  console.error("FATAL: TELEGRAM_BOT_TOKEN is missing in environment variables (.env).");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// In-Memory Data Stores
const quotes = new Map(); // ticketId -> Quote object
const orders = new Map(); // orderId -> Order object
const userStates = new Map(); // userId -> { step, ticketId, phone, landmark }

// Seed sample orders for live tracking by phone or order ID
orders.set("KC-849102", {
  orderId: "KC-849102",
  phone: "+2519000000",
  userTag: "@____",
  itemTitle: "የሼይን ፋሽን አበባማ የበጋ ቀሚስ (Shein Floral Dress)",
  landmark: "ቦሌ መድኃኒዓለም፣ ከአትላስ ሆቴል አጠገብ",
  status: "freight_in_transit",
  depositStatus: "verified",
  totalPriceEtb: 4250,
  depositEtb: 1100,
  codEtb: 3150,
  createdAt: new Date(Date.now() - 1000 * 60 * 35),
});

// Persistent Main Reply Keyboard with "Return to Main"
const replyButtons = [
  [Markup.button.webApp("👉 እዚህ ይጫኑት (ኮርቻ አፕ ክፈት) 🚀", TELEGRAM_WEB_APP_URL)],
  ["🏠 ዋና ማውጫ", "📦 የእኔ ትዕዛዞች"],
  ["💬 ሰራተኛ አናግር", "📖 መመሪያ"]
];

if (TELEGRAM_WEB_APP_URL) {
  replyButtons.unshift([Markup.button.webApp("🚀 ኮርቻ አፕ ክፈት (Open Mini App)", TELEGRAM_WEB_APP_URL)]);
}

const mainReplyKeyboard = Markup.keyboard(replyButtons).resize();

// OFFICIAL STORE LINKS FOR SHEIN, TEMU & ALIEXPRESS (Android Play Store & iOS App Store)
const MARKETPLACE_APPS = {
  shein: {
    key: "shein",
    name: "Shein (ሺኢን)",
    description: "ዘመናዊ የሴቶች፣ የወንዶችና የህፃናት አልባሳት፣ ጫማዎች፣ ቦርሳዎችና ጌጣጌጦች",
    android: "https://play.google.com/store/apps/details?id=com.zzkko",
    ios: "https://apps.apple.com/app/shein-shopping-online/id878577184",
    web: "https://m.shein.com",
    badge: "👗 Shein"
  },
  temu: {
    key: "temu",
    name: "Temu (ቴሙ)",
    description: "ጥራት ያላቸው የቤትና የኩሽና እቃዎች፣ መገልገያዎችና ኤሌክትሮኒክስ (VPN ያብሩ)",
    android: "https://play.google.com/store/apps/details?id=com.einnovation.temu",
    ios: "https://apps.apple.com/app/temu-shop-like-a-billionaire/id1641486558",
    web: "https://www.temu.com",
    badge: "🛍️ Temu"
  },
  aliexpress: {
    key: "aliexpress",
    name: "AliExpress (አሊኤክስፕረስ)",
    description: "በጅምላና በችርቻሮ የሚቀርቡ የቴክኖሎጂ እቃዎች፣ መለዋወጫዎችና መገልገያዎች",
    android: "https://play.google.com/store/apps/details?id=com.alibaba.aliexpresshd",
    ios: "https://apps.apple.com/app/aliexpress-shopping-app/id436672029",
    web: "https://www.aliexpress.com",
    badge: "📦 AliExpress"
  }
};

// Map to track worker group alert messages to customer userId, ticketId, and orderId
const workerAlertToCustomer = new Map();

// Helper: App Store Download Payload for a specific marketplace
function getAppDownloadPayload(key = "shein") {
  const app = MARKETPLACE_APPS[key] || MARKETPLACE_APPS.shein;
  const text =
    `📲 **${app.name} አፕሊኬሽን ያውርዱ (Download App)**\n\n` +
    `📌 **መግለጫ፦** ${app.description}\n\n` +
    `የስልክዎን አይነት ይምረጡ፤ በቀጥታ ወደ ስቶር (PlayStore ወይም AppStore) በመግባት አፕሊኬሽኑን በስልክዎ ላይ ይጫኑ፦`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url("📱 Google Play Store (ለ Android)", app.android)],
    [Markup.button.url("🍎 Apple App Store (ለ iPhone)", app.ios)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
  ]);

  return { text, keyboard };
}

// Helper: Standard Welcome Message & Main Inline Keyboard (Download Marketplace Apps & In-Bot Worker Chat)
function getMainWelcomePayload(name = "ውድ ደንበኛ") {
  const welcomeText =
    `👋 ሰላም ${name}! እንኳን ወደ ኮርቻ (Korcha) በደህና መጡ።\n\n` +
    `ከ **Shein**፣ **Temu** እና **AliExpress** እቃዎችን በቀላሉ ለመምረጥ፣ ዋጋ ለማስላትና ለማዘዝ ከታች ያለውን ቁልፍ **ይጫኑት**፦`;

  const inlineRows = [
    [
      Markup.button.webApp("👉 እዚህ ይጫኑት (ኮርቻ አፕ ክፈት) 🚀", TELEGRAM_WEB_APP_URL),
    ],
    [
      Markup.button.callback("📦 የእኔ ትዕዛዞች", "menu_orders"),
      Markup.button.callback("💬 ሰራተኛ አናግር", "chat_worker_general"),
    ],
    [
      Markup.button.callback("📖 አጭር መመሪያ (Help)", "menu_help"),
    ]
  ];

  return { text: welcomeText, keyboard: Markup.inlineKeyboard(inlineRows) };
}

// Helper: User Guide & Help Message (Friendly instructions, Store App links & In-Bot Support)
function getHelpPayload() {
  const helpText =
    `📖 **የአጠቃቀም መመሪያ (User Guide)**\n\n` +
    `📌 **እንዴት ማዘዝ ይችላሉ?**\n` +
    `• ከታች ካሉት የገበያ ቦታዎች አፖች እቃ ይምረጡ\n` +
    `• የእቃውን ሊንክ (URL) ወይም ስክሪንሾት (Screenshot) እዚህ ይላኩልን\n` +
    `• የሚፈልጉትን መጠን (Size) እና ቀለም (Color) እና ሌሎች መረጃዎች አብረው ይግለጹ\n` +
    `• ሰራተኛችን ዋጋውን በ 5 ደቂቃ ውስጥ አስልቶ በቀጥታ እዚህ በቦቱ ይልክልዎታል\n` +
    `• በ ${ADVANCE_PAYMENT_PERCENT}% የቴሌብር ወይም የባንክ ቅድመ ክፍያ ያዛሉ፤ ቀሪ ${COD_PAYMENT_PERCENT}% እቃው ደጃፍዎ ሲደርስ ይከፍላሉ!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛍️ **የገበያ ቦታዎች አፕሊኬሽኖች (PlayStore / AppStore)፦**\n` +
    `1. 👗 Shein (ሺኢን)\n` +
    `2. 📦 AliExpress (አሊኤክስፕረስ)\n` +
    `3. 🛍️ Temu (ቴሙ) (በስልክዎ VPN ያብሩ)\n\n` +
    `✈️ **የማድረሻ ጊዜ፦** በአየር ጭነት በ 10 እስከ 14 የስራ ቀናት ውስጥ አዲስ አበባና አካባቢው ደጃፍዎ ይደርሳል።\n\n` +
    `📦 **ትዕዛዝ መከታተል፦** የትዕዛዝዎን ሁኔታ በማንኛውም ሰዓት በስልክ ቁጥርዎ ወይም በቲኬት ቁጥርዎ ለማየት **"📦 የእኔ ትዕዛዞች"** የሚለውን ይጫኑ ወይም \`/track <ስልክ>\` ብለው ይጻፉ።`;

  const helpButtons = Markup.inlineKeyboard([
    ...(TELEGRAM_WEB_APP_URL
      ? [[Markup.button.webApp("🚀 ኮርቻ አፕ ክፈት (Open Mini App)", TELEGRAM_WEB_APP_URL)]]
      : []),
    [
      Markup.button.callback("📲 የገበያ ቦታዎች አፖች (Download Apps)", "menu_marketplaces"),
      Markup.button.callback("📦 የእኔ ትዕዛዞች (My Orders)", "menu_orders"),
    ],
    [
      Markup.button.callback("💬 ሰራተኛ እዚህ በቦቱ አናግር (Live Support)", "chat_worker_general"),
    ],
    [
      Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main"),
    ],
  ]);

  return { text: helpText, keyboard: helpButtons };
}

// WORKER CALCULATION HELPER ENGINE
function calculateDoorPrice(usdPrice, weightKg = 0.4, lengthCm = 30, widthCm = 30) {
  const usd = Math.max(0, parseFloat(usdPrice || 0));
  const weight = Math.max(0.1, parseFloat(weightKg || 0.4));
  const priceHkd = usd * USD_TO_HKD;
  const baseEtb = priceHkd * HKD_EXCHANGE_RATE;

  const supplierFee = Math.round(baseEtb * 0.27);
  const deliveryFee = Math.round(baseEtb * 0.54);
  const cargoCost = Math.round(weight * KG_CARGO_RATE_ETB);

  const totalDoorPrice = Math.round(baseEtb + supplierFee + deliveryFee + cargoCost);
  const depositPercent = ADVANCE_PAYMENT_PERCENT / 100;
  const depositEtb = Math.max(100, Math.round((totalDoorPrice * depositPercent) / 100) * 100);
  const codEtb = Math.max(0, totalDoorPrice - depositEtb);
  const isOversized = lengthCm > 50 || widthCm > 50;

  return {
    usd,
    weight,
    baseEtb: Math.round(baseEtb),
    supplierFee,
    deliveryFee,
    cargoCost,
    totalDoorPrice,
    depositEtb,
    codEtb,
    depositPercent: ADVANCE_PAYMENT_PERCENT,
    codPercent: COD_PAYMENT_PERCENT,
    deposit25: depositEtb,
    cod75: codEtb,
    isOversized,
  };
}

// Helper: Run python scraper
function runScraper(args) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "scraper.py");
    execFile("python3", [scriptPath, ...args], (error, stdout, stderr) => {
      if (error || !stdout) {
        console.warn("Scraper warning:", stderr || error?.message);
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (err) {
        console.warn("JSON parse error from scraper:", err.message);
        resolve(null);
      }
    });
  });
}

// --- Worker Portal & Mini App Static Hosting ---
function startWorkerPortal() {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const getPortalStyles = () => `
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; line-height: 1.5; }
      .container { max-width: 720px; margin: 0 auto; }
      .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
      .title { font-size: 22px; font-weight: 800; color: #f59e0b; display: flex; align-items: center; gap: 8px; }
      .badge { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
      .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
      .card-title { font-size: 15px; font-weight: 700; color: #e2e8f0; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media(max-width: 600px) { .grid { grid-template-columns: 1fr; } }
      .form-group { margin-bottom: 12px; }
      label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }
      input, select, textarea { width: 100%; background: #0f172a; border: 1px solid #475569; border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 13px; outline: none; }
      input:focus, textarea:focus { border-color: #f59e0b; }
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: #f59e0b; color: #0f172a; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
      .btn:hover { background: #fbbf24; }
      .btn-outline { background: transparent; color: #94a3b8; border: 1px solid #334155; }
      .btn-outline:hover { color: #fff; border-color: #f59e0b; }
      .result-box { background: #0b1329; border: 1px solid #1e3a8a; border-radius: 12px; padding: 18px; margin-top: 16px; }
      .stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
      .stat-row:last-child { border-bottom: none; font-size: 15px; font-weight: 800; color: #10b981; }
      .pill { display: inline-block; background: #334155; color: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 11px; margin-right: 4px; }
    </style>
  `;

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', app: 'Korcha Unified Web & Bot' });
  });

  app.get("/worker-portal", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Korcha Worker Portal</title>
          ${getPortalStyles()}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">
                <span>🛠️ Korcha Worker Portal</span>
              </div>
              <span class="badge">Live 1.88× Engine</span>
            </div>

            <!-- Form 1: Product Link with Options -->
            <div class="card">
              <div class="card-title">🔗 1. Scrape Link with Options (Shein, Temu, AliExpress)</div>
              <form method="POST" action="/worker-portal/link">
                <div class="form-group">
                  <label>Product URL *</label>
                  <input type="url" required name="url" placeholder="https://m.shein.com/... or temu / aliexpress" />
                </div>
                <div class="grid">
                  <div class="form-group">
                    <label>📏 Size / Option (መጠን)</label>
                    <input type="text" name="size" placeholder="e.g. S, M, L, XL, 38, 42" />
                  </div>
                  <div class="form-group">
                    <label>🎨 Color / Style (ቀለም)</label>
                    <input type="text" name="color" placeholder="e.g. Black, White, Red" />
                  </div>
                </div>
                <div class="form-group">
                  <label>📝 Other Choices / Specifications (ተጨማሪ ምርጫዎች / ማስታወሻ)</label>
                  <input type="text" name="notes" placeholder="e.g. 128GB version, Set of 2, Model B" />
                </div>
                <button type="submit" class="btn">⚡ Scrape & Estimate Landed Price</button>
              </form>
            </div>

            <!-- Form 2: Upload Screenshot with Options -->
            <div class="card">
              <div class="card-title">📸 2. Upload Screenshot with Options</div>
              <form method="POST" action="/worker-portal/screenshot" enctype="multipart/form-data">
                <div class="form-group">
                  <label>Product Screenshot *</label>
                  <input type="file" required name="screenshot" accept="image/*" />
                </div>
                <div class="grid">
                  <div class="form-group">
                    <label>💵 USD Price (optional)</label>
                    <input type="number" step="0.01" name="usd" placeholder="e.g. 16.50" />
                  </div>
                  <div class="form-group">
                    <label>⚖️ Weight kg (optional)</label>
                    <input type="number" step="0.05" name="weight" value="0.4" />
                  </div>
                </div>
                <div class="grid">
                  <div class="form-group">
                    <label>📏 Size / Option (መጠን)</label>
                    <input type="text" name="size" placeholder="e.g. Medium, 41" />
                  </div>
                  <div class="form-group">
                    <label>🎨 Color / Style (ቀለም)</label>
                    <input type="text" name="color" placeholder="e.g. Blue" />
                  </div>
                </div>
                <div class="form-group">
                  <label>📝 Other Choices / Notes</label>
                  <input type="text" name="notes" placeholder="e.g. With Box, Option 3" />
                </div>
                <button type="submit" class="btn">📊 Estimate Screenshot</button>
              </form>
            </div>

            <!-- Form 3: Direct Response to Customer in Bot -->
            <div class="card">
              <div class="card-title">💬 3. Direct Message to Customer via Bot (በቦቱ በቀጥታ መልስ ይላኩ)</div>
              <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
                መልዕክትዎ በቀጥታ ለደንበኛው በቴሌግራም ቦቱ ውስጥ ይደርሰዋል። ደንበኛው ወደ ግል ቻት መሄድ ሳያስፈልገው እዚያው በቦቱ ይነጋገራል።
              </p>
              <form method="POST" action="/worker-portal/send-customer-message">
                <div class="form-group">
                  <label>Customer Telegram ID or Ticket # or Order # *</label>
                  <input type="text" required name="target" placeholder="e.g. 123456789 or KORCHA-123456 or ORD-123456" />
                </div>
                <div class="form-group">
                  <label>Support Response Message *</label>
                  <textarea required name="message" rows="3" placeholder="ደንበኛው የሚፈልገውን መረጃ እዚህ ይጻፉ..."></textarea>
                </div>
                <button type="submit" class="btn" style="background: #10b981; color: #022c22;">🚀 Send to Customer via Bot</button>
              </form>
            </div>

            <div style="text-align: center; color: #64748b; font-size: 12px; margin-top: 20px;">
              Korcha Concierge • Unified Bot & Worker Helper • Port ${WORKER_PORT}
            </div>
          </div>
        </body>
      </html>
    `);
  });

  app.post("/worker-portal/link", async (req, res) => {
    const { url, size, color, notes } = req.body;
    if (!url) return res.status(400).send("Missing url");

    const meta = await runScraper(["--url", url]);
    let detectedPrice = meta?.worker_helper?.detected_price || meta?.price || null;
    let suggestedWeight = meta?.worker_helper?.suggested_weight_kg || 0.4;
    const title = meta?.title || "Product";

    const optionsSummary = [
      size ? `Size: ${size}` : null,
      color ? `Color: ${color}` : null,
      notes ? `Choices: ${notes}` : null,
    ].filter(Boolean).join(" • ") || "Default / As shown in link";

    if (!detectedPrice) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Input Price - Korcha</title>${getPortalStyles()}</head>
          <body>
            <div class="container">
              <div class="card">
                <div class="card-title">⚠️ No automatic price detected (Anti-bot protected)</div>
                <p style="font-size:13px; color:#cbd5e1; margin-bottom:12px;">Title: <b>${title}</b></p>${meta?.image_url ? `<p style="margin-bottom:12px;"><img src="${meta.image_url}" style="max-width:240px; border-radius:8px;"/></p>` : ""}
                <p style="font-size:12px; color:#94a3b8; margin-bottom:16px;">Selected Options: <span class="pill">${optionsSummary}</span></p>

                <form method="POST" action="/worker-portal/estimate">
                  <input type="hidden" name="url" value="${url}" />
                  <input type="hidden" name="size" value="${size || ''}" />
                  <input type="hidden" name="color" value="${color || ''}" />
                  <input type="hidden" name="notes" value="${notes || ''}" />
                  <div class="grid">
                    <div class="form-group">
                      <label>USD Price *</label>
                      <input type="number" step="0.01" required name="usd" placeholder="e.g. 14.99" />
                    </div>
                    <div class="form-group">
                      <label>Weight (kg)</label>
                      <input type="number" step="0.05" name="weight" value="${suggestedWeight}" />
                    </div>
                  </div>
                  <button type="submit" class="btn">Calculate Door Price</button>
                </form>
              </div>
              <p style="text-align:center;"><a href="/worker-portal" style="color:#f59e0b; font-size:13px;">← Back to Worker Portal</a></p>
            </div>
          </body>
        </html>
      `);
    }

    const pricing = calculateDoorPrice(detectedPrice, suggestedWeight);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Estimation Result - Korcha</title>${getPortalStyles()}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="card-title">✅ Landed Estimation Result</div>
              <p style="font-size:14px; font-weight:700; color:#fff; margin-bottom:6px;">${title}</p>
              <div style="margin-bottom:14px;">
                <span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border-color:rgba(245,158,11,0.4);">
                  Options: ${optionsSummary} </span> </div> <div class="result-box"> <div class="stat-row"><span>USD Price:</span><span style="font-family:monospace; color:#38bdf8;">$${detectedPrice} USD</span></div>
                <div class="stat-row"><span>Weight:</span><span>${suggestedWeight} kg</span></div>
                <div class="stat-row"><span>Base (ETB @ 30):</span><span>${pricing.baseEtb.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>Supplier Fee (+27%):</span><span>+${pricing.supplierFee.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>Cargo Cost:</span><span>+${pricing.cargoCost.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>Delivery Service (+54%):</span><span>+${pricing.deliveryFee.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${ADVANCE_PAYMENT_PERCENT}% Advance Deposit:</span><span style="color:#f59e0b;">${pricing.depositEtb.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${COD_PAYMENT_PERCENT}\% Door COD:</span><span>${pricing.codEtb.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>Total Landed Price:</span><span>${pricing.totalDoorPrice.toLocaleString()} ETB</span></div>
              </div>
              <div style="margin-top:16px;">
                <a href="/worker-portal" class="btn btn-outline" style="text-decoration:none;">← Estimate Another Item</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  app.post("/worker-portal/screenshot", upload.single("screenshot"), async (req, res) => {
    const usd = req.body.usd ? parseFloat(req.body.usd) : null;
    const weight = req.body.weight ? parseFloat(req.body.weight) : 0.4;
    const { size, color, notes } = req.body;

    const optionsSummary = [
      size ? `Size: ${size}` : null,
      color ? `Color: ${color}` : null,
      notes ? `Choices: ${notes}` : null,
    ].filter(Boolean).join(" • ") || "Default / From screenshot";

    if (!usd) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Input Price - Korcha</title>${getPortalStyles()}</head>
          <body>
            <div class="container">
              <div class="card">
                <div class="card-title">📸 Screenshot Received - Enter USD Price</div>
                <p style="font-size:12px; color:#94a3b8; margin-bottom:16px;">Selected Options: <span class="pill">${optionsSummary}</span></p>
                <form method="POST" action="/worker-portal/estimate">
                  <input type="hidden" name="size" value="${size || ''}" />
                  <input type="hidden" name="color" value="${color || ''}" />
                  <input type="hidden" name="notes" value="${notes || ''}" />
                  <div class="grid">
                    <div class="form-group">
                      <label>USD Price *</label>
                      <input type="number" step="0.01" required name="usd" placeholder="e.g. 19.90" />
                    </div>
                    <div class="form-group">
                      <label>Weight (kg)</label>
                      <input type="number" step="0.05" name="weight" value="${weight}" />
                    </div>
                  </div>
                  <button type="submit" class="btn">Calculate Door Price</button>
                </form>
              </div>
              <p style="text-align:center;"><a href="/worker-portal" style="color:#f59e0b; font-size:13px;">← Back to Worker Portal</a></p>
            </div>
          </body>
        </html>
      `);
    }

    const pricing = calculateDoorPrice(usd, weight);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Estimation Result - Korcha</title>${getPortalStyles()}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="card-title">✅ Screenshot Landed Estimation</div>
              <div style="margin-bottom:14px;">
                <span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border-color:rgba(245,158,11,0.4);">
                  Options: ${optionsSummary} </span> </div> <div class="result-box"> <div class="stat-row"><span>USD Price:</span><span style="font-family:monospace; color:#38bdf8;">$${usd} USD</span></div>
                <div class="stat-row"><span>Weight:</span><span>${weight} kg</span></div>
                <div class="stat-row"><span>Total Landed Price:</span><span>${pricing.totalDoorPrice.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${ADVANCE_PAYMENT_PERCENT}% Advance Deposit:</span><span style="color:#f59e0b;">${pricing.depositEtb.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${COD_PAYMENT_PERCENT}\% COD on Delivery:</span><span>${pricing.codEtb.toLocaleString()} ETB</span></div>
              </div>
              <div style="margin-top:16px;">
                <a href="/worker-portal" class="btn btn-outline" style="text-decoration:none;">← Estimate Another Item</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  app.post("/worker-portal/estimate", async (req, res) => {
    const usd = parseFloat(req.body.usd || 0);
    const weight = parseFloat(req.body.weight || 0.4);
    const { size, color, notes } = req.body;
    if (!usd || usd <= 0) return res.status(400).send("Invalid USD price");

    const pricing = calculateDoorPrice(usd, weight);
    const optionsSummary = [
      size ? `Size: ${size}` : null,
      color ? `Color: ${color}` : null,
      notes ? `Choices: ${notes}` : null,
    ].filter(Boolean).join(" • ") || "Default";

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Estimation Result - Korcha</title>${getPortalStyles()}</head>
        <body>
          <div class="container">
            <div class="card">
              <div class="card-title">✅ Manual Landed Estimation</div>
              <div style="margin-bottom:14px;">
                <span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border-color:rgba(245,158,11,0.4);">
                  Options: ${optionsSummary} </span> </div> <div class="result-box"> <div class="stat-row"><span>USD Price:</span><span style="font-family:monospace; color:#38bdf8;">$${usd} USD</span></div>
                <div class="stat-row"><span>Weight:</span><span>${weight} kg</span></div>
                <div class="stat-row"><span>Total Landed Price:</span><span>${pricing.totalDoorPrice.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${ADVANCE_PAYMENT_PERCENT}% Advance Deposit:</span><span style="color:#f59e0b;">${pricing.depositEtb.toLocaleString()} ETB</span></div>
                <div class="stat-row"><span>${COD_PAYMENT_PERCENT}\% COD on Delivery:</span><span>${pricing.codEtb.toLocaleString()} ETB</span></div>
              </div>
              <div style="margin-top:16px;">
                <a href="/worker-portal" class="btn btn-outline" style="text-decoration:none;">← Estimate Another Item</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  });

  // Direct message from worker portal into customer's Telegram bot chat
  app.post("/worker-portal/send-customer-message", async (req, res) => {
    const { target, message } = req.body;
    if (!target || !message) {
      return res.status(400).send("Target and message are required.");
    }

    const cleanTarget = target.replace("#", "").trim();
    let targetUserId = null;
    let targetTicket = null;

    if (/^\d+$/.test(cleanTarget)) {
      targetUserId = parseInt(cleanTarget, 10);
    } else {
      const quote = quotes.get(cleanTarget);
      if (quote) {
        targetUserId = quote.userId;
        targetTicket = quote.ticketId;
      } else {
        const order = orders.get(cleanTarget);
        if (order) {
          targetUserId = order.userId;
          targetTicket = order.ticketId || order.orderId;
        }
      }
    }

    if (!targetUserId) {
      return res.status(404).send(`Customer identifier (#${cleanTarget}) not found. Please provide valid Telegram User ID, Ticket ID, or Order ID.`);
    }

    const customerMsg =
      `👨💼 **የኮርቻ ሰራተኛ ምላሽ (Korcha Support Reply)፦**\n\n` +
      `${message}\n\n` +
      `*(መልስ ለመስጠት ወይም ሌላ ጥያቄ ለመጠየቅ እዚህ መጻፍ ይችላሉ)*`;

    try {
      await bot.telegram.sendMessage(targetUserId, customerMsg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("💬 መልስ ለመስጠት (Reply to Worker)", `chat_worker_${targetTicket || "general"}`)],
          [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
        ]),
      });

      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Message Sent - Korcha</title>${getPortalStyles()}</head>
          <body>
            <div class="container">
              <div class="card">
                <div class="card-title">✅ መልዕክቱ ለደንበኛው በቦቱ ደርሷል! (Message Sent via Bot)</div>
                <p style="font-size:14px; color:#fff; margin-bottom:12px;"><b>ተቀባይ (Recipient ID):</b> ${targetUserId}</p>
                <div class="result-box">
                  <p style="color:#38bdf8; font-size:13px; font-style:italic;">"${message}"</p>
                </div>
                <div style="margin-top:16px;">
                  <a href="/worker-portal" class="btn">← Back to Worker Portal</a>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      return res.status(500).send(`Failed to deliver message via bot: ${err.message}`);
    }
  });

  // Smart App Store Redirect based on client phone OS
  app.get(["/app/:marketplace", "/store/:marketplace", "/download/:marketplace"], (req, res) => {
    const key = (req.params.marketplace || "").toLowerCase();
    const appData = MARKETPLACE_APPS[key] || MARKETPLACE_APPS.shein;
    const ua = (req.headers["user-agent"] || "").toLowerCase();

    if (/iphone|ipad|ipod/i.test(ua)) {
      return res.redirect(302, appData.ios);
    }
    if (/android/i.test(ua)) {
      return res.redirect(302, appData.android);
    }
    return res.redirect(302, appData.web);
  });

  // Dynamic QR Code Generator Endpoint for Telebirr & CBE
  app.get("/api/qr/:method", async (req, res) => {
    const method = (req.params.method || "telebirr").toLowerCase();
    const amount = parseInt(req.query.amount || "0", 10);
    const order = req.query.order || "KC-ORDER";
    const telebirrPhone = req.query.phone || TELEBIRR_PHONE;
    const cbeAccount = req.query.account || CBE_ACCOUNT;
    const receiver = req.query.receiver || "Korcha Logistics (ኮርቻ ሎጂስቲክስ)";

    let payload = "";
    if (method === "cbe" || method === "cbe_birr") {
      payload = `cbebirr://pay?account=${encodeURIComponent(cbeAccount)}&amount=${amount}&order=${encodeURIComponent(order)}&receiver=${encodeURIComponent(receiver)}`;
    } else {
      payload = `telebirr://pay?phone=${encodeURIComponent(telebirrPhone)}&amount=${amount}&order=${encodeURIComponent(order)}&receiver=${encodeURIComponent(receiver)}`;
    }

    try {
      const qrBuffer = await QRCode.toBuffer(payload, {
        width: 400,
        margin: 2,
        color: {
          dark: method === "cbe" || method === "cbe_birr" ? "#581c87" : "#065f46",
          light: "#ffffff",
        },
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(qrBuffer);
    } catch (err) {
      return res.status(500).json({ error: "Failed to generate QR code", details: err.message });
    }
  });

  // Serve static Web Version & TMA frontend if dist directory exists
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/worker-portal")) return next();
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.listen(WORKER_PORT, () => {
    console.log(`🚀 Korcha Server listening on port ${WORKER_PORT}`);
    console.log(`🌐 Web App / TMA: http://localhost:${WORKER_PORT}/`);
    console.log(`🛠️ Worker Portal: http://localhost:${WORKER_PORT}/worker-portal`);
  });
}

// 1. /start & /menu Commands
bot.command(["start", "menu"], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const name = ctx.from.first_name || "ውድ ደንበኛ";
  const payload = getMainWelcomePayload(name);

  await ctx.reply("👋 እንኳን ደህና መጡ!", mainReplyKeyboard);
  return ctx.replyWithMarkdown(payload.text, payload.keyboard);
});

// 2. Action: Return to Main Menu (🔙 ወደ ዋና ማውጫ)
bot.action(["return_to_main", "menu_main"], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  await ctx.answerCbQuery("ወደ ዋና ማውጫ ተመልሰዋል");
  const name = ctx.from.first_name || "ውድ ደንበኛ";
  const payload = getMainWelcomePayload(name);

  try {
    await ctx.editMessageText(payload.text, {
      parse_mode: "Markdown",
      ...payload.keyboard,
    });
  } catch {
    await ctx.replyWithMarkdown(payload.text, payload.keyboard);
  }
});

// 3. Text triggers for Return to Main Menu
bot.hears([/ወደ ዋና ማውጫ/i, /main menu/i, /ተመለስ/i, /ዋና ሜኑ/i], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const name = ctx.from.first_name || "ውድ ደንበኛ";
  const payload = getMainWelcomePayload(name);
  return ctx.replyWithMarkdown(payload.text, payload.keyboard);
});

// 4. Marketplaces Trigger (Official PlayStore & AppStore downloads)
bot.hears([/የገበያ ቦታዎች/i, /marketplaces/i, /\/marketplaces/i, /\/apps/i, /\/download/i], async (ctx) => {
  const marketplacesText =
    `🛍️ **የገበያ ቦታዎች አፕሊኬሽኖች (Marketplace Apps)**\n\n` +
    `እቃዎችን በቀላሉ ለመምረጥ፣ ለማየትና ሊንኩን ኮፒ አድርጎ ወደዚህ ለመላክ የስልክዎን አፕሊኬሽን ያውርዱ፦\n\n` +
    `1️⃣ **Shein (ሼይን)** — ዘመናዊ የሴቶች፣ የወንዶችና የህፃናት አልባሳት፣ ጫማና ጌጣጌጥ\n` +
    `2️⃣ **Temu (ቴሙ)** — ጥራት ያላቸው የቤትና የኩሽና እቃዎች፣ መገልገያዎችና ኤሌክትሮኒክስ\n` +
    `3️⃣ **AliExpress (አሊኤክስፕረስ)** — በጅምላና በችርቻሮ የሚቀርቡ የቴክኖሎጂ እቃዎችና መገልገያዎች\n\n` +
    `👇 ለማውረድ የሚፈልጉትን አፕ ይምረጡ፦`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("👗 Shein አፕ (PlayStore / AppStore)", "getapp_shein"),
      Markup.button.callback("🛍️ Temu አፕ (PlayStore / AppStore)", "getapp_temu"),
    ],
    [
      Markup.button.callback("📦 AliExpress አፕ (PlayStore / AppStore)", "getapp_aliexpress"),
    ],
    [
      Markup.button.callback("💬 ሰራተኛ እዚህ በቦቱ ያነጋግሩ", "chat_worker_general"),
      Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main"),
    ],
  ]);

  return ctx.replyWithMarkdown(marketplacesText, keyboard);
});

// Action: Download App handlers for each marketplace
bot.action(/getapp_(shein|temu|aliexpress)/, async (ctx) => {
  await ctx.answerCbQuery();
  const key = ctx.match[1];
  const payload = getAppDownloadPayload(key);
  try {
    await ctx.editMessageText(payload.text, { parse_mode: "Markdown", ...payload.keyboard });
  } catch {
    await ctx.replyWithMarkdown(payload.text, payload.keyboard);
  }
});

// Action: In-Bot Live Support & Question initiation (General)
bot.action("chat_worker_general", async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  userStates.set(userId, { step: "AWAITING_WORKER_CHAT", ticketId: null });

  return ctx.replyWithMarkdown(
    `💬 **ለኮርቻ ሰራተኞች ጥያቄዎን ወይም ማስታወሻዎን እዚህ ይጻፉ፦**\n\n` +
    `ስለ እቃ ዋጋ፣ ስለ ክብደት፣ ስለ ማድረሻ ጊዜ ወይም ሌላ ማንኛውም ጥያቄ ካለዎት እዚህ ቻት ላይ ይጻፉልን። ሰራተኛችን **በቀጥታ እዚህ በቦቱ** ይመልስልዎታል!\n\n` +
    `*(ለመሰረዝ ወይም ወደ ዋና ገጽ ለመመለስ "ተመለስ" ብለው ይጻፉ)*`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ተመለስ (Back)", "return_to_main")]
    ])
  );
});

// Action: In-Bot Chat related to specific quote/ticket
bot.action(/chat_worker_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const ticketId = ctx.match[1];
  const userId = ctx.from.id;

  userStates.set(userId, {
    step: "AWAITING_WORKER_CHAT",
    ticketId: ticketId !== "general" ? ticketId : null,
  });

  const quote = quotes.get(ticketId);
  const title = quote?.title || quote?.caption || "";

  return ctx.replyWithMarkdown(
    `💬 **ለኮርቻ ሰራተኛ ጥያቄዎን ወይም ማስታወሻዎን እዚህ ይጻፉ፦**\n\n` +
    (ticketId !== "general" ? `🎫 **ቲኬት፦** \`#${ticketId}\`\n` : "") +
    (title ? `📦 **እቃ፦** ${title}\n\n` : "\n") +
    `የሚፈልጉትን መጠን፣ ቀለም፣ የማድረሻ ጊዜ ወይም ሌላ ማንኛውንም ጥያቄ እዚህ ይጻፉልን። ሰራተኛችን **በቀጥታ እዚህ በቦቱ** ይመልስልዎታል!\n\n` +
    `*(ለመሰረዝ "ተመለስ" ብለው ይጻፉ)*`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ተመለስ (Back)", "return_to_main")]
    ])
  );
});

// Action: In-Bot Chat related to confirmed order
bot.action(/chat_order_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const orderId = ctx.match[1];
  const userId = ctx.from.id;

  userStates.set(userId, {
    step: "AWAITING_WORKER_CHAT",
    orderId,
  });

  return ctx.replyWithMarkdown(
    `💬 **ስለ ትዕዛዝ #${orderId} ለሰራተኛ ጥያቄዎን ይጻፉ፦**\n\n` +
    `ስለ እቃው ጉዞ፣ ስለ ቅድመ ክፍያ ወይም ሌላ ማንኛውም ጉዳይ እዚህ ይጻፉልን። ሰራተኛችን **በቀጥታ እዚህ በቦቱ** ይመልስልዎታል!\n\n` +
    `*(ለመሰረዝ "ተመለስ" ብለው ይጻፉ)*`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ተመለስ (Back)", "return_to_main")]
    ])
  );
});

// Action: Prompt for receipt upload right in bot
bot.action(/upload_receipt_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const orderId = ctx.match[1];
  const userId = ctx.from.id;

  userStates.set(userId, {
    step: "AWAITING_RECEIPT_UPLOAD",
    orderId,
  });

  return ctx.replyWithMarkdown(
    `🧾 **የክፍያ ደረሰኝ ማስገቢያ (Order #${orderId})**\n\n` +
    `እባክዎን የቴሌብር ወይም የኢትዮጵያ ንግድ ባንክ የከፈሉበትን **ስክሪንሾት (ፎቶ)** ወይም የግብይት ቁጥር (Transaction Number) እዚህ ቻት ላይ ይላኩ።\n\n` +
    `ሰራተኞቻችን ወዲያውኑ አይተው ክፍያዎን ያረጋግጣሉ!`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ተመለስ", "return_to_main")]
    ])
  );
});

// Action: Generate and send dynamic high-resolution QR code for Telebirr or CBE
bot.action(/show_qr_(telebirr|cbe)_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const method = ctx.match[1];
  const orderId = ctx.match[2];

  const order = orders.get(orderId) || orders.get(`KC-${orderId}`);
  const quote = quotes.get(orderId);
  const depositAmount =
    order?.depositEtb ||
    order?.pricing?.depositEtb ||
    quote?.pricing?.depositEtb ||
    1500;

  const receiverName = "Korcha Logistics (ኮርቻ ሎጂስቲክስ)";
  const cleanPhone = TELEBIRR_PHONE.replace(/[^0-9]/g, "");
  const telebirrUssd = `*127*1*${cleanPhone.slice(-9)}*${Math.round(depositAmount)}#`;

  let payload = "";
  if (method === "cbe") {
    payload = `cbebirr://pay?account=${encodeURIComponent(CBE_ACCOUNT)}&amount=${Math.round(depositAmount)}&order=${encodeURIComponent(orderId)}&receiver=${encodeURIComponent(receiverName)}`;
  } else {
    payload = `telebirr://pay?phone=${encodeURIComponent(TELEBIRR_PHONE)}&amount=${Math.round(depositAmount)}&order=${encodeURIComponent(orderId)}&receiver=${encodeURIComponent(receiverName)}`;
  }

  try {
    const qrBuffer = await QRCode.toBuffer(payload, {
      width: 450,
      margin: 2,
      color: {
        dark: method === "cbe" ? "#581c87" : "#065f46",
        light: "#ffffff",
      },
    });

    const isTelebirr = method === "telebirr";
    const caption =
      `📱 **${isTelebirr ? "የቴሌብር (Telebirr)" : "የኢትዮጵያ ንግድ ባንክ (CBE)"} የክፍያ QR ኮድ**\n\n` +
      `📦 **የትዕዛዝ ቁጥር፦** \`#${orderId}\`\n` +
      `💰 **የሚከፈል መጠን፦** **${depositAmount.toLocaleString()} ETB**\n` +
      `📌 **${isTelebirr ? "ስልክ ቁጥር፦" : "ሒሳብ ቁጥር፦"}** \`${isTelebirr ? TELEBIRR_PHONE : CBE_ACCOUNT}\`\n` +
      `👤 **ተቀባይ፦** ${receiverName}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💡 **በስልክዎ በቀላሉ ለመክፈል፦**\n` +
      `1. ይህን የ QR ምስል ወደ ስልክዎ Save ያድርጉ (ወይም Screenshot ያንሱ)\n` +
      `2. የ **${isTelebirr ? "ቴሌብር (Telebirr)" : "CBE"}** አፕሊኬሽንዎን ይክፈቱ\n` +
      `3. **Scan** የሚለውን መርጠው ከስልክዎ **Gallery** ፎቶውን ያስገቡ፤ መረጃው ወዲያውኑ ይሞላል!\n` +
      (isTelebirr ? `\n📞 **USSD ፈጣን መክፈያ ኮድ፦** \`${telebirrUssd}\`` : "");

    const kb = Markup.inlineKeyboard([
      [
        isTelebirr
          ? Markup.button.callback("🏛️ የንግድ ባንክ (CBE) QR ኮድ አሳይ", `show_qr_cbe_${orderId}`)
          : Markup.button.callback("📱 የቴሌብር (Telebirr) QR ኮድ አሳይ", `show_qr_telebirr_${orderId}`),
      ],
      [Markup.button.callback("🧾 ደረሰኝ እዚህ በቦቱ ይላኩ", `upload_receipt_${orderId}`)],
      [Markup.button.callback("💬 ስለ ትዕዛዙ ሰራተኛ እዚህ ይጠይቁ", `chat_order_${orderId}`)],
      [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
    ]);

    return ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption,
        parse_mode: "Markdown",
        ...kb,
      }
    );
  } catch (err) {
    return ctx.reply(`⚠️ የ QR ኮድ ማመንጨት አልተቻለም፦ ${err.message}`);
  }
});

// WORKER REPLY INTERCEPTOR: When a worker in WORKER_CHAT_ID swipes and replies to any customer message/alert
bot.use(async (ctx, next) => {
  if (
    WORKER_CHAT_ID &&
    String(ctx.chat?.id) === String(WORKER_CHAT_ID) &&
    ctx.message?.reply_to_message &&
    ctx.message?.text &&
    !ctx.message.text.startsWith("/")
  ) {
    const repliedMsg = ctx.message.reply_to_message;
    const workerText = ctx.message.text.trim();

    let targetInfo = workerAlertToCustomer.get(repliedMsg.message_id);

    if (!targetInfo) {
      const srcText = repliedMsg.text || repliedMsg.caption || "";
      const idMatch = srcText.match(/ID:\s*`?(\d+)`?/i);
      const ticketMatch = srcText.match(/Ticket:\s*`?#?([A-Za-z0-9-]+)`?/i);
      const orderMatch = srcText.match(/Order(?:\s*ID)?:\s*`?#?([A-Za-z0-9-]+)`?/i);
      if (idMatch) {
        targetInfo = {
          userId: parseInt(idMatch[1], 10),
          ticketId: ticketMatch ? ticketMatch[1] : null,
          orderId: orderMatch ? orderMatch[1] : null,
        };
      }
    }

    if (targetInfo && targetInfo.userId) {
      const customerMsg =
        `👨💼 **የኮርቻ ሰራተኛ ምላሽ (Korcha Support Reply)፦**\n\n` +
        `${workerText}\n\n` +
        `*(መልስ ለመስጠት ወይም ሌላ ጥያቄ ለመጠየቅ እዚህ መጻፍ ይችላሉ)*`;

      const customerKb = Markup.inlineKeyboard([
        [Markup.button.callback("💬 መልስ ለመስጠት (Reply to Worker)", `chat_worker_${targetInfo.ticketId || targetInfo.orderId || "general"}`)],
        [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
      ]);

      try {
        await ctx.telegram.sendMessage(targetInfo.userId, customerMsg, {
          parse_mode: "Markdown",
          ...customerKb,
        });

        return ctx.reply(
          `✅ መልስዎ በቀጥታ ለደንበኛው (ID: ${targetInfo.userId}) በቦቱ ተልኳል!`,
          { reply_to_message_id: ctx.message.message_id }
        );
      } catch (err) {
        return ctx.reply(
          `⚠️ ለደንበኛው መላክ አልተቻለም (ID: ${targetInfo.userId})፦ ${err.message}`,
          { reply_to_message_id: ctx.message.message_id }
        );
      }
    }
  }

  return next();
});

// WORKER COMMAND: /reply <userId_or_ticketId> <message>
bot.command(["reply", "send", "msg", "answer"], async (ctx) => {
  if (WORKER_CHAT_ID && String(ctx.chat.id) !== String(WORKER_CHAT_ID)) {
    return ctx.reply("❌ ይህ ትዕዛዝ የሚሰራው በኮርቻ ሰራተኞች ግሩፕ ውስጥ ብቻ ነው።");
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) {
    return ctx.replyWithMarkdown(
      `⚠️ **ትክክለኛ አጠቃቀም፦**\n\`/reply <USER_ID_or_TICKET> <የመልስ ጽሑፍ>\`\n\n` +
      `ምሳሌ፦ \`/reply 123456789 ሰላም! የእቃው መጠን 42 አለ።\``
    );
  }

  const targetIdentifier = parts[1].replace("#", "").trim();
  const workerText = parts.slice(2).join(" ").trim();

  let targetUserId = null;
  let targetTicketId = null;

  if (/^\d+$/.test(targetIdentifier)) {
    targetUserId = parseInt(targetIdentifier, 10);
  } else {
    const quote = quotes.get(targetIdentifier);
    if (quote) {
      targetUserId = quote.userId;
      targetTicketId = quote.ticketId;
    } else {
      const order = orders.get(targetIdentifier);
      if (order) {
        targetUserId = order.userId;
        targetTicketId = order.ticketId || order.orderId;
      }
    }
  }

  if (!targetUserId) {
    return ctx.reply(`❌ ደንበኛውን ወይም ቲኬቱን (#${targetIdentifier}) ማግኘት አልተቻለም።`);
  }

  const customerMsg =
    `👨💼 **የኮርቻ ሰራተኛ ምላሽ (Korcha Support Reply)፦**\n\n` +
    `${workerText}\n\n` +
    `*(መልስ ለመስጠት ወይም ሌላ ጥያቄ ለመጠየቅ እዚህ መጻፍ ይችላሉ)*`;

  const customerKb = Markup.inlineKeyboard([
    [Markup.button.callback("💬 መልስ ለመስጠት (Reply to Worker)", `chat_worker_${targetTicketId || "general"}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
  ]);

  try {
    await ctx.telegram.sendMessage(targetUserId, customerMsg, {
      parse_mode: "Markdown",
      ...customerKb,
    });
    return ctx.reply(`✅ መልሱ ለደንበኛው (ID: ${targetUserId}) በቦቱ ተልኳል!`);
  } catch (err) {
    return ctx.reply(`⚠️ ለደንበኛው መላክ አልተቻለም፦ ${err.message}`);
  }
});

// 5. /search command across all 3 marketplaces
bot.command("search", async (ctx) => {
  const query = ctx.message.text.replace("/search", "").trim();
  if (!query) {
    return ctx.replyWithMarkdown(
      `🔍 **እቃዎችን መፈለጊያ**\n\n` +
      `ለመፈለግ የሚፈልጉትን እቃ ስም ጽፈው ይላኩ።\n` +
      `ምሳሌ፦ \`/search sneaker\` ወይም \`/search dress\``
    );
  }

  const encoded = encodeURIComponent(query);
  const searchMsg =
    `🔍 **"${query}" ፍለጋ በሁሉም 3 የገበያ ቦታዎች፦**\n\n` +
    `ከታች ያሉትን ሊንኮች በመጫን በShein፣ Temu ወይም AliExpress ላይ የተገኙትን እቃዎች ይመልከቱ፦`;

  const searchButtons = Markup.inlineKeyboard([
    [Markup.button.url(`👗 Shein ላይ "${query}" ፈልግ`, `https://m.shein.com/us/search/${encoded}.html`)],
    [Markup.button.url(`🛍️ Temu ላይ "${query}" ፈልግ`, `https://www.temu.com/search_result.html?search_key=${encoded}`)],
    [Markup.button.url(`📦 AliExpress ላይ "${query}" ፈልግ`, `https://www.aliexpress.com/wholesale?SearchText=${encoded}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
  ]);

  return ctx.replyWithMarkdown(searchMsg, searchButtons);
});

// 6. Worker calculation helper command
bot.command("calc", async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.replyWithMarkdown(
      `🧮 **የሰራተኛ ዋጋ ማስያ ረዳት (Worker Calculation Helper)**\n\n` +
      `አጠቃቀም፦ \`/calc <USD_PRICE> [WEIGHT_KG]\`\n\n` +
      `ምሳሌ፦ \`/calc 14.50 0.35\` ወይም \`/calc 25\``
    );
  }

  const usd = parseFloat(parts[1]);
  const weight = parseFloat(parts[2] || "0.40");

  if (isNaN(usd) || usd <= 0) {
    return ctx.reply("❌ እባክዎን ትክክለኛ የዶላር ዋጋ (USD Price) ያስገቡ።");
  }

  const calc = calculateDoorPrice(usd, weight);
  const reply =
    `🧮 **የዋጋ ስሌት ረዳት ውጤት (Calculation Breakdown)**\n\n` +
    `💵 **የእቃ ዋጋ፦** $${calc.usd.toFixed(2)} USD (~${calc.baseEtb.toLocaleString()} ETB)\n` +
    `📦 **ክብደት፦** ${calc.weight.toFixed(2)} kg (ጭነት፦ ${calc.cargoCost.toLocaleString()} ETB)\n` +
    `🏢 **የአቅራቢ ወጪ (+27%)፦** ${calc.supplierFee.toLocaleString()} ETB\n` +
    `🚚 **የማድረሻ አገልግሎት (+54%)፦** ${calc.deliveryFee.toLocaleString()} ETB\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `💰 **ጠቅላላ የደጃፍ ዋጋ፦** **${calc.totalDoorPrice.toLocaleString()} ብር**\n` +
    `💳 **${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ፦** **${calc.depositEtb.toLocaleString()} ብር**\n` +
    `🚚 **${COD_PAYMENT_PERCENT}% ቀሪ ክፍያ (COD)፦** **${calc.codEtb.toLocaleString()} ብር**`;

  return ctx.replyWithMarkdown(reply);
});

// 6b. /orders, /track, /myorders commands and live tracking
async function handleTrackingResponse(ctx, rawQuery = "") {
  const query = rawQuery.trim().replace(/\D/g, "");
  const textQuery = rawQuery.trim().toLowerCase();

  let matched = [];
  if (query.length >= 4 || textQuery.length >= 3) {
    for (const [id, ord] of orders.entries()) {
      const cleanPhone = (ord.phone || "").replace(/\D/g, "");
      const cleanId = (ord.orderId || id).toLowerCase();
      if ((query.length >= 4 && cleanPhone.includes(query)) || cleanId.includes(textQuery)) {
        matched.push(ord);
      }
    }
  }

  if (matched.length === 0) {
    return ctx.replyWithMarkdown(
      `📦 **የእኔ ትዕዛዞችና የቀጥታ ክትትል (My Orders & Live Tracking)**\n\n` +
      `ያዘዟቸውን እቃዎች፣ የቅድመ ክፍያ ማረጋገጫ እና ከቻይና እስከ ደጃፍዎ ያለውን የቀጥታ የጉዞ ሁኔታ ለመከታተል **ስልክ ቁጥርዎን** ወይም **የትዕዛዝ ቁጥርዎን** ይላኩልን።\n\n` +
      `💡 *ምሳሌ፦ \`/track 0911445566\` ወይም \`/track KC-849102\` ወይም በቀጥታ ስልክዎን እዚህ ቻት ላይ ይጻፉ።*`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🔍 በናሙና ስልክ ሞክር (0911445566)", "track_demo_0911"),
        ],
        [
          Markup.button.callback("💬 ሰራተኛ እዚህ በቦቱ ያነጋግሩ", "chat_worker_general"),
          Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main"),
        ],
      ])
    );
  }

  for (const ord of matched.slice(0, 3)) {
    const statusMap = {
      pending_deposit: "1/7 ⏳ የቅድመ ክፍያ ማረጋገጫ በመጠባበቅ ላይ",
      deposit_verified: "2/7 ✅ ክፍያ ተረጋግቷል፤ ወደ ግዢ ክፍል ተላልፏል",
      procured_in_china: "3/7 🛍️ ከቻይና ተገዝቷል (ጓንግዡ መጋዘን ገብቷል)",
      freight_in_transit: "4/7 ✈️ በአየር ጭነት በረራ ላይ ወደ አዲስ አበባ",
      customs_clearing: "5/7 🛃 ቦሌ ጉምሩክ ክሊራንስ በመከናወን ላይ",
      out_for_delivery: "6/7 🚚 ወደ ደጃፍዎ በመጓዝ ላይ",
      delivered: "7/7 🏠 ደጃፍዎ ደርሷል (ቀሪ ክፍያ ተጠናቋል)",
    };

    const statusText = statusMap[ord.status] || "📦 በሂደት ላይ";
    const depositBadge = ord.depositStatus === "verified" ? "✅ ተረጋግቷል (Verified)" : "⏳ ማረጋገጫ በመጠበቅ ላይ (Pending)";

    const msg =
      `📦 **የትዕዛዝ መረጃ፦** \`#${ord.orderId}\`\n\n` +
      `🛍️ **እቃ፦** ${ord.itemTitle || ord.itemUrl || "የኮርቻ እቃ"}\n` +
      `📍 **የማድረሻ አድራሻ፦** ${ord.landmark || "አዲስ አበባ"}\n` +
      `📞 **ስልክ፦** \`${ord.phone}\`\n\n` +
      `🚀 **የቀጥታ ጉዞ ሁኔታ፦**\n` +
      `👉 **${statusText}**\n\n` +
      `💰 **የዋጋ ዝርዝር፦**\n` +
      `• ጠቅላላ ዋጋ፦ ${ord.totalPriceEtb ? ord.totalPriceEtb.toLocaleString() : (ord.pricing?.totalDoorPrice?.toLocaleString() || "")} ETB\n` +
      `• ${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ፦ ${ord.depositEtb ? ord.depositEtb.toLocaleString() : (ord.pricing?.depositEtb?.toLocaleString() || ord.pricing?.deposit25?.toLocaleString() || "")} ETB (${depositBadge})\n` +
      `• ${COD_PAYMENT_PERCENT}% በር ላይ፦ ${ord.codEtb ? ord.codEtb.toLocaleString() : (ord.pricing?.codEtb?.toLocaleString() || ord.pricing?.cod75?.toLocaleString() || "")} ETB\n\n` +
      `✈️ የማድረሻ ጊዜ፦ ከ 10 እስከ 14 የስራ ቀናት`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("💬 ስለ እቃው እዚህ በቦቱ ጠይቅ (Ask in Bot)", `chat_order_${ord.orderId}`)],
      [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
    ]);

    await ctx.replyWithMarkdown(msg, kb);
  }
}

bot.command(["orders", "myorders", "track"], async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const q = parts.slice(1).join(" ");
  return handleTrackingResponse(ctx, q);
});

bot.action("menu_orders", async (ctx) => {
  await ctx.answerCbQuery();
  return handleTrackingResponse(ctx, "");
});

bot.action("track_demo_0911", async (ctx) => {
  await ctx.answerCbQuery();
  return handleTrackingResponse(ctx, "0911445566");
});

bot.hears([/የእኔ ትዕዛዞች/i, /ትዕዛዞቼ/i, /ክትትል/i, /^track/i], async (ctx) => {
  const text = ctx.message.text.replace(/የእኔ ትዕዛዞች|ትዕዛዞቼ|ክትትል|track/gi, "").trim();
  return handleTrackingResponse(ctx, text);
});

// 6c. Guide & Help Handlers
bot.action("menu_help", async (ctx) => {
  await ctx.answerCbQuery();
  const payload = getHelpPayload();
  try {
    await ctx.editMessageText(payload.text, {
      parse_mode: "Markdown",
      ...payload.keyboard,
    });
  } catch {
    await ctx.replyWithMarkdown(payload.text, payload.keyboard);
  }
});

bot.action("menu_marketplaces", async (ctx) => {
  await ctx.answerCbQuery();
  const marketplacesText =
    `🛍️ **የገበያ ቦታዎች አፕሊኬሽኖች (Marketplace Apps)**\n\n` +
    `እቃዎችን በቀላሉ ለመምረጥ፣ ለማየትና ሊንኩን ኮፒ አድርጎ ወደዚህ ለመላክ የስልክዎን አፕሊኬሽን ያውርዱ፦\n\n` +
    `1️⃣ **Shein (ሼይን)** — ዘመናዊ የሴቶች፣ የወንዶችና የህፃናት አልባሳት፣ ጫማና ጌጣጌጥ\n` +
    `2️⃣ **Temu (ቴሙ)** — ጥራት ያላቸው የቤትና የኩሽና እቃዎች፣ መገልገያዎችና ኤሌክትሮኒክስ\n` +
    `3️⃣ **AliExpress (አሊኤክስፕረስ)** — በጅምላና በችርቻሮ የሚቀርቡ የቴክኖሎጂ እቃዎችና መገልገያዎች\n\n` +
    `👇 ለማውረድ የሚፈልጉትን አፕ ይምረጡ፦`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("👗 Shein አፕ (PlayStore / AppStore)", "getapp_shein"),
      Markup.button.callback("🛍️ Temu አፕ (PlayStore / AppStore)", "getapp_temu"),
    ],
    [
      Markup.button.callback("📦 AliExpress አፕ (PlayStore / AppStore)", "getapp_aliexpress"),
    ],
    [
      Markup.button.callback("💬 ሰራተኛ እዚህ በቦቱ ያነጋግሩ", "chat_worker_general"),
      Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main"),
    ],
  ]);

  try {
    await ctx.editMessageText(marketplacesText, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch {
    await ctx.replyWithMarkdown(marketplacesText, keyboard);
  }
});

bot.command(["help", "guide"], async (ctx) => {
  const payload = getHelpPayload();
  return ctx.replyWithMarkdown(payload.text, payload.keyboard);
});

bot.hears([/መመሪያ/i, /help/i, /\/help/i, /አጠቃቀም/i, /guide/i, /እንዴት ልዘዝ/i], async (ctx) => {
  const payload = getHelpPayload();
  return ctx.replyWithMarkdown(payload.text, payload.keyboard);
});

// 7. Handling incoming links (Shein, Temu, AliExpress)
bot.hears(/(https?:\/\/[^\s]+)/g, async (ctx) => {
  const fullText = ctx.message.text.trim();
  const urlMatch = fullText.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[0] : fullText;
  const extraText = fullText.replace(url, "").trim();
  const initialOptions = extraText || "አልተመረጠም (Not specified)";

  const userId = ctx.from.id;
  const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
  const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;
  const ticketId = `KORCHA-${Date.now().toString().slice(-6)}`;

  const waitMsg = await ctx.reply("🔍 የእቃውን መረጃ በመቀበል ላይ... እባክዎ ትንሽ ይጠብቁ...");

  const meta = await runScraper(["--url", url]);
  const title = meta?.title || "የተመረጠ እቃ (Selected Product)";
  const imageUrl = meta?.image_url || null;
  const marketplace = meta?.marketplace || "Marketplace";
  const helper = meta?.worker_helper || null;

  quotes.set(ticketId, {
    ticketId,
    userId,
    userTag,
    url,
    title,
    imageUrl,
    marketplace,
    options: initialOptions,
    workerHelper: helper,
    status: "pending_worker_estimation",
    createdAt: new Date(),
  });

  try {
    await ctx.deleteMessage(waitMsg.message_id);
  } catch {}

  const customerReply =
    `🛍️ **የእቃው መረጃ ደርሶናል!**\n\n` +
    `📦 **እቃ፦** ${title}\n` +
    `🌐 **ገበያ፦** ${marketplace.toUpperCase()}\n` +
    `🎨 **መጠንና ቀለም (Size/Color)፦** ${initialOptions !== "አልተመረጠም (Not specified)" ? `**${initialOptions}**` : "አልተመረጠም"}\n` +
    `🎫 **የጥያቄ ቲኬት፦** \`#${ticketId}\`\n\n` +
    `ሰራተኛችን የደጃፍ ዋጋ አስልቶ በአምስት ደቂቃ ያሳውቅዎታል።`;

  const customerKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🎨 መጠንና ቀለም ምረጥ / አክል (Options)", `set_options_${ticketId}`)],
    [Markup.button.callback("💬 እዚህ በቦቱ ሰራተኛ ያነጋግሩ (Ask in Bot)", `chat_worker_${ticketId}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
  ]);

  if (imageUrl) {
    try {
      await ctx.replyWithPhoto(imageUrl, {
        caption: customerReply,
        parse_mode: "Markdown",
        ...customerKeyboard,
      });
    } catch {
      await ctx.replyWithMarkdown(customerReply, customerKeyboard);
    }
  } else {
    await ctx.replyWithMarkdown(customerReply, customerKeyboard);
  }

  if (WORKER_CHAT_ID) {
    let workerHelperSnippet = "";
    let workerButtons = [];

    if (helper && helper.detected_price && helper.precalculated_door_price) {
      const p = helper.precalculated_door_price;
      workerHelperSnippet =
        `🛠️ **የሰራተኛ ረዳት ስሌት (Worker Helper Suggestion)፦**\n` +
        `• የተገኘ ዋጋ፦ **$${helper.detected_price} USD**\n` +
        `• የተገመተ ክብደት፦ **${helper.suggested_weight_kg} kg**\n` +
        `• የሚመከር ዋጋ፦ **${p.total_door_price_etb.toLocaleString()} ETB** (ቅድመ ክፍያ: ${p.deposit_25_etb.toLocaleString()} ETB)\n\n` +
        `*(ሰራተኛው ይህንን ዋጋ 1-Click በማጽደቅ ወይም የራሱን ዋጋ በመስጠት ማስተካከል ይችላል)*\n`;

      workerButtons.push([
        Markup.button.callback(
          `✅ በ $${helper.detected_price} አጽድቅ (${p.total_door_price_etb.toLocaleString()} ETB)`,
          `approve_helper_${ticketId}_${helper.detected_price}_${helper.suggested_weight_kg}`
        ),
      ]);
    } else {
      workerHelperSnippet =
        `⚠️ **ረዳት ማስታወሻ፦** የቀጥታ ዋጋ በራስ-ሰር ማግኘት አልተቻለም (Anti-bot)። እባክዎ ሊንኩን ከፍተው ዋጋውን ይመልከቱ።\n`;
    }

    workerButtons.push([
      Markup.button.url("🔗 እቃውን በድረ-ገጹ ላይ ክፈት", url),
    ]);

    const workerAlert =
      `🔔 **አዲስ የዋጋ ስሌት ጥያቄ (New Quote Request)**\n\n` +
      `🎫 **Ticket:** \`#${ticketId}\`\n` +
      `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n` +
      `🌐 **ገበያ:** ${marketplace.toUpperCase()}\n` +
      `📦 **እቃ:** ${title}\n` +
      `🎨 **የተጠየቀ መጠንና ቀለም (Size/Color)፦** **${initialOptions}**\n` +
      `🔗 **ሊንክ:** ${url}\n\n` +
      workerHelperSnippet +
      `👉 **ዋጋ በእጅ ለመስጠት፦**\n` +
      `\`/estimate ${ticketId} <USD_PRICE> [WEIGHT_KG] [SIZE/COLOR]\`\n\n` +
      `👉 **በቀጥታ በቦቱ ለደንበኛው ለመመለስ፦** ለዚህ መልዕክት Reply ያድርጉ ወይም \`/reply ${ticketId} <መልስ>\``;

    try {
      const sent = await ctx.telegram.sendMessage(WORKER_CHAT_ID, workerAlert, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(workerButtons),
      });
      workerAlertToCustomer.set(sent.message_id, { userId, ticketId });
    } catch (err) {
      console.warn("Failed to alert worker channel:", err.message);
    }
  }
});

// 7b. Action: Customer chooses to set/change size and color on a quote
bot.action(/set_options_(.+)/, async (ctx) => {
  const ticketId = ctx.match[1];
  const userId = ctx.from.id;
  const quote = quotes.get(ticketId);

  userStates.set(userId, {
    step: "AWAITING_OPTIONS_QUOTE",
    ticketId,
  });

  await ctx.answerCbQuery();
  return ctx.replyWithMarkdown(
    `🎨 **የእቃው መጠንና ቀለም መምረጫ (#${ticketId})**\n\n` +
    `እቃ፦ **${quote?.title || "የተመረጠ እቃ"}**\n` +
    (quote?.options && quote.options !== "አልተመረጠም (Not specified)" ? `አሁን ያለው፦ **${quote.options}**\n\n` : `\n`) +
    `እባክዎን የሚፈልጉትን **መጠን (Size)**፣ **ቀለም (Color)** ወይም **ተጨማሪ ምርጫ** ጽፈው ይላኩልን፦\n` +
    `*(ምሳሌ፦ "መጠን 42፣ ጥቁር ቀለም" ወይም "Size M, White Color")*`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ሰርዝና ተመለስ", "return_to_main")],
    ])
  );
});

// 8. Handling uploaded photos / screenshots with Worker Helper & Options
bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
  const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;
  const photo = ctx.message.photo[ctx.message.photo.length - 1];

  const state = userStates.get(userId);

  if (state && state.step === "AWAITING_RECEIPT_UPLOAD") {
    userStates.delete(userId);
    if (WORKER_CHAT_ID) {
      const receiptCaption =
        `🧾 **አዲስ የክፍያ ደረሰኝ ስክሪንሾት (Payment Receipt Screenshot)**\n\n` +
        `📦 **Order:** \`#${state.orderId}\`\n` +
        `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n\n` +
        `👉 **በቀጥታ በቦቱ ለደንበኛው ለመመለስ፦**\n` +
        `ለዚህ ፎቶ **Reply** ያድርጉ ወይም \`/reply ${state.orderId} ክፍያዎ ተረጋግጧል...\``;

      ctx.telegram.sendPhoto(WORKER_CHAT_ID, photo.file_id, {
        caption: receiptCaption,
        parse_mode: "Markdown",
      }).then((sent) => {
        workerAlertToCustomer.set(sent.message_id, { userId, orderId: state.orderId });
      }).catch((err) => {
        console.warn("Failed to forward receipt screenshot:", err.message);
      });
    }

    return ctx.replyWithMarkdown(
      `✅ **የክፍያ ደረሰኝ ፎቶዎ ደርሶናል!**\n\n` +
      `📦 **የትዕዛዝ ቁጥር፦** \`#${state.orderId}\`\n` +
      `ሰራተኞቻችን ክፍያዎን አረጋግጠው እቃው ከቻይና እንዲገዛ ወዲያውኑ ያስተላልፋሉ። ሁኔታውን **በቀጥታ እዚህ በቦቱ** እናሳውቅዎታለን።`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📦 የትዕዛዝ ሁኔታ ተመልከት", "menu_orders")],
        [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
      ])
    );
  }

  const ticketId = `KORCHA-${Date.now().toString().slice(-6)}`;
  const caption = ctx.message.caption || "የእቃ ፎቶ/ስክሪንሾት";

  quotes.set(ticketId, {
    ticketId,
    userId,
    userTag,
    caption,
    options: caption !== "የእቃ ፎቶ/ስክሪንሾት" ? caption : "አልተመረጠም",
    fileId: photo.file_id,
    status: "pending_worker_estimation",
    createdAt: new Date(),
  });

  const customerReply =
    `📸 **ስክሪንሾቱ ደርሶናል!**\n\n` +
    `📝 **መግለጫ፦** ${caption}\n` +
    `🎫 **መለያ ቁጥር፦** \`#${ticketId}\`\n\n` +
    `የሚያስተናግዶት ሠራተኛ የእቃዉን ዋጋ አስልቶ በጥቂት ደቂቃዎች ዉስጥ ያሳውቅዎታል።`;

  await ctx.replyWithMarkdown(
    customerReply,
    Markup.inlineKeyboard([
      [Markup.button.callback("🎨 መጠንና ቀለም ምረጥ / አክል (Options)", `set_options_${ticketId}`)],
      [Markup.button.callback("💬 እዚህ በቦቱ ሰራተኛ ያነጋግሩ (Ask in Bot)", `chat_worker_${ticketId}`)],
      [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
    ])
  );

  if (WORKER_CHAT_ID) {
    const workerCaption =
      `📸 **አዲስ የስክሪንሾት ዋጋ ጥያቄ (New Screenshot Quote)**\n\n` +
      `🎫 **Ticket:** \`#${ticketId}\`\n` +
      `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n` +
      `🎨 **መጠንና ቀለም (Options/Notes):** ${caption}\n\n` +
      `🛠️ **ስሌት ረዳት፦** \`/calc <USD_PRICE> [WEIGHT_KG]\`\n` +
      `👉 **ዋጋ ለመስጠት፦** \`/estimate ${ticketId} <USD_PRICE> [WEIGHT_KG] [OPTIONS]\`\n\n` +
      `👉 **በቀጥታ በቦቱ ለደንበኛው ለመመለስ፦** ለዚህ ፎቶ Reply ያድርጉ ወይም \`/reply ${ticketId} <መልስ>\``;

    try {
      const sent = await ctx.telegram.sendPhoto(WORKER_CHAT_ID, photo.file_id, {
        caption: workerCaption,
        parse_mode: "Markdown",
      });
      workerAlertToCustomer.set(sent.message_id, { userId, ticketId });
    } catch (err) {
      console.warn("Failed to forward photo to worker channel:", err.message);
    }
  }
});

// 9. Worker 1-Click Approval Action
bot.action(/approve_helper_(.+)_([0-9\.]+)_([0-9\.]+)/, async (ctx) => {
  const ticketId = ctx.match[1];
  const usdPrice = parseFloat(ctx.match[2]);
  const weightKg = parseFloat(ctx.match[3]);

  const quote = quotes.get(ticketId);
  if (!quote) {
    return ctx.answerCbQuery("❌ ቲኬት ቁጥሩ አልተገኘም");
  }

  const pricing = calculateDoorPrice(usdPrice, weightKg);
  quote.pricing = pricing;
  quote.status = "estimated";

  await ctx.answerCbQuery("✓ ዋጋው ጸድቆ ለደንበኛው ተልኳል");
  await ctx.replyWithMarkdown(
    `✅ **ዋጋው በረዳት ስሌት መሰረት ጸድቋል!**\n\n` +
    `🎫 **Ticket:** \`#${ticketId}\`\n` +
    `🎨 **Options:** ${quote.options || "Default"}\n` +
    `💵 **Total:** ${pricing.totalDoorPrice.toLocaleString()} ETB\n` +
    `💳 **Deposit (${ADVANCE_PAYMENT_PERCENT}\%):**${pricing.depositEtb.toLocaleString()} ETB\n` +
    `🚚 **COD (${COD_PAYMENT_PERCENT}\%):**${pricing.codEtb.toLocaleString()} ETB`
  );

  const customerQuoteMsg =
    `✨ **የዋጋ ስሌት ደርሶዎታል! (Your Price Quote is Ready)**\n\n` +
    `🎫 **የጥያቄ ቲኬት፦** \`#${ticketId}\`\n` +
    `📦 **እቃ፦** ${quote.title || quote.caption || "የተመረጠ እቃ"}\n` +
    `🎨 **መጠንና ቀለም (Size/Color)፦** ${quote.options || "መደበኛ"}\n\n` +
    `💰 **ጠቅላላ የደጃፍ ዋጋ (Total Landed Cost)፦** **${pricing.totalDoorPrice.toLocaleString()} ብር**\n` +
    `💳 **የ ${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ (Advance Deposit)፦** **${pricing.depositEtb.toLocaleString()} ብር**\n` +
    `🚚 **ቀሪ ${COD_PAYMENT_PERCENT}% ሲደርስ የሚከፈል (COD)፦** **${pricing.codEtb.toLocaleString()} ብር**\n\n` +
    `📦 ዋጋው የውጭ ሀገር ግዢ፣ የጉዞ ጭነት፣ የጉምሩክ እና የደጃፍ ማድረሻ አገልግሎትን ያካተተ ነው።\n\n` +
    `ትዕዛዝዎን ለማጠናቀቅ ከታች ያለውን **"🛒 አሁን እዘዝ"** የሚለውን ይጫኑ👇`;

  const orderKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🛒 አሁን እዘዝ (Place Order Now)", `order_${ticketId}`)],
    [Markup.button.callback("💬 እዚህ በቦቱ ጥያቄ ይጠይቁ (Ask in Bot)", `chat_worker_${ticketId}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
  ]);

  try {
    await ctx.telegram.sendMessage(quote.userId, customerQuoteMsg, {
      parse_mode: "Markdown",
      ...orderKeyboard,
    });
  } catch (err) {
    await ctx.reply(`⚠️ ደንበኛውን ማግኘት አልተቻለም (ID: ${quote.userId})፦ ${err.message}`);
  }
});

// 10. Worker Command: /estimate <ticketId> <usdPrice> [weightKg] [options...]
bot.command(["estimate", "quote"], async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) {
    return ctx.replyWithMarkdown(
      `⚠️ **ትክክለኛ አጠቃቀም፦**\n\`/estimate <TICKET_ID> <USD_PRICE> [WEIGHT_KG] [OPTIONS]\`\n\n` +
      `ምሳሌ፦ \`/estimate KORCHA-123456 18.5 0.4 Size 42 Black\``
    );
  }

  const rawTicket = parts[1].replace("#", "").trim();
  const usdPrice = parseFloat(parts[2]);
  const weightKg = parseFloat(parts[3] || "0.4");
  const workerSuppliedOptions = parts.slice(4).join(" ").trim();

  if (isNaN(usdPrice) || usdPrice <= 0) {
    return ctx.reply("❌ እባክዎን ትክክለኛ የዶላር ዋጋ (USD Price) ያስገቡ።");
  }

  const quote = quotes.get(rawTicket);
  if (!quote) {
    return ctx.reply(`❌ ቲኬት ቁጥር #${rawTicket} አልተገኘም። እባክዎ ቁጥሩን ያረጋግጡ።`);
  }

  if (workerSuppliedOptions) {
    quote.options = workerSuppliedOptions;
  }

  const pricing = calculateDoorPrice(usdPrice, weightKg);
  quote.pricing = pricing;
  quote.status = "estimated";

  await ctx.replyWithMarkdown(
    `✅ **ዋጋው በተሳካ ሁኔታ ተሰልቶ ለደንበኛው ተልኳል!**\n\n` +
    `🎫 **Ticket:** \`#${rawTicket}\`\n` +
    `🎨 **Options:** ${quote.options || "Default"}\n` +
    `💵 **Total:** ${pricing.totalDoorPrice.toLocaleString()} ETB\n` +
    `💳 **Deposit (${ADVANCE_PAYMENT_PERCENT}\%):**${pricing.depositEtb.toLocaleString()} ETB\n` +
    `🚚 **COD (${COD_PAYMENT_PERCENT}\%):**${pricing.codEtb.toLocaleString()} ETB`
  );

  const customerQuoteMsg =
    `✨ **የዋጋ ስሌት ደርሶዎታል! (Your Price Quote is Ready)**\n\n` +
    `🎫 **የጥያቄ ቲኬት፦** \`#${rawTicket}\`\n` +
    `📦 **እቃ፦** ${quote.title || quote.caption || "የተመረጠ እቃ"}\n` +
    `🎨 **መጠንና ቀለም (Size/Color)፦** ${quote.options || "መደበኛ"}\n\n` +
    `💰 **ጠቅላላ የደጃፍ ዋጋ (Total Landed Cost)፦** **${pricing.totalDoorPrice.toLocaleString()} ብር**\n` +
    `💳 **የ ${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ (Advance Deposit)፦** **${pricing.depositEtb.toLocaleString()} ብር**\n` +
    `🚚 **ቀሪ ${COD_PAYMENT_PERCENT}% ሲደርስ የሚከፈል (COD)፦** **${pricing.codEtb.toLocaleString()} ብር**\n\n` +
    `📦 ዋጋው የውጭ ሀገር ግዢ፣ የጉዞ ጭነት፣ የጉምሩክ እና የደጃፍ ማድረሻ አገልግሎትን ያካተተ ነው።\n\n` +
    `ትዕዛዝዎን ለማጠናቀቅ ከታች ያለውን **"🛒 አሁን እዘዝ"** የሚለውን ይጫኑ👇`;

  const orderKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🛒 አሁን እዘዝ (Place Order Now)", `order_${rawTicket}`)],
    [Markup.button.callback("💬 እዚህ በቦቱ ጥያቄ ይጠይቁ (Ask in Bot)", `chat_worker_${rawTicket}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
  ]);

  try {
    await ctx.telegram.sendMessage(quote.userId, customerQuoteMsg, {
      parse_mode: "Markdown",
      ...orderKeyboard,
    });
  } catch (err) {
    await ctx.reply(`⚠️ ደንበኛውን ማግኘት አልተቻለም (ID: ${quote.userId})፦ ${err.message}`);
  }
});

// Helper: finalize order and send payment instructions
async function completeFinalOrder(ctx, state, chosenOptions = "") {
  const userId = ctx.from.id;
  const ticket = quotes.get(state.ticketId);
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  const finalOptions = chosenOptions || state.options || ticket?.options || "መደበኛ (Standard / As per link)";

  const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
  const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;

  const orderData = {
    orderId,
    ticketId: state.ticketId,
    userId,
    userTag,
    phone: state.phone,
    landmark: state.landmark,
    options: finalOptions,
    itemTitle: ticket?.title || ticket?.caption || "Marketplace Item",
    itemUrl: ticket?.url || "Screenshot",
    pricing: ticket?.pricing,
    status: "awaiting_deposit",
    createdAt: new Date(),
  };

  orders.set(orderId, orderData);
  userStates.delete(userId);

  const paymentMsg =
    `🎉 **ትዕዛዝዎ በተሳካ ሁኔታ ተመዝግቧል!**\n\n` +
    `📦 **የትዕዛዝ ቁጥር፦** \`#${orderId}\`\n` +
    `🛍️ **እቃ፦** ${orderData.itemTitle}\n` +
    `🎨 **መጠንና ቀለም፦** **${finalOptions}**\n` +
    `📍 **መዳረሻ፦** ${orderData.landmark}\n` +
    `📞 **ስልክ፦** \`${orderData.phone}\`\n\n` +
    `💵 **ጠቅላላ ዋጋ፦** ${ticket.pricing.totalDoorPrice.toLocaleString()} ብር\n` +
    `💳 **መከፈል ያለበት ${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ፦** **${ticket.pricing.depositEtb.toLocaleString()} ብር**\n` +
    `🚚 **ቀሪ ${COD_PAYMENT_PERCENT}% ሲደርስ የሚከፈል፦** ${ticket.pricing.codEtb.toLocaleString()} ብር\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📲 **የቅድመ ክፍያ መመሪያ (Payment Steps)፦**\n\n` +
    `1️⃣ **በቴሌብር (Telebirr)፦**\n` +
    `   ስልክ፦ \`${TELEBIRR_PHONE}\`\n` +
    `   ስም፦ Korcha Marketplace\n\n` +
    `2️⃣ **በንግድ ባንክ (CBE)፦**\n` +
    `   ሒሳብ ቁጥር፦ \`${CBE_ACCOUNT}\`\n` +
    `   ስም፦ Korcha Cross-Border\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ **ክፍያውን እንደፈጸሙ የግብይት ቁጥሩን (Transaction ID) ወይም ደረሰኝ እዚህ ይላኩልን!**`;

  const finishKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("📱 የቴሌብር QR ኮድ አሳይ (Telebirr QR)", `show_qr_telebirr_${orderId}`),
      Markup.button.callback("🏛️ የንግድ ባንክ (CBE) QR", `show_qr_cbe_${orderId}`),
    ],
    [Markup.button.callback("🧾 ደረሰኝ እዚህ በቦቱ ይላኩ (Submit Receipt in Bot)", `upload_receipt_${orderId}`)],
    [Markup.button.callback("💬 ስለ ትዕዛዙ ሰራተኛ እዚህ ይጠይቁ (Ask in Bot)", `chat_order_${orderId}`)],
    [Markup.button.callback("🔙 ወደ ዋና ማውጫ (Return to Main)", "return_to_main")],
  ]);

  await ctx.replyWithMarkdown(paymentMsg, finishKeyboard);

  if (WORKER_CHAT_ID) {
    const workerOrderAlert =
      `🚨 **አዲስ የተረጋገጠ ትዕዛዝ (New Confirmed Order)!**\n\n` +
      `📦 **Order ID:** \`#${orderId}\`\n` +
      `🎫 **Ticket:** \`#${state.ticketId}\`\n` +
      `👤 **ደንበኛ:** ${orderData.userTag} (ID: \`${userId}\`)\n` +
      `📞 **ስልክ:** \`${orderData.phone}\`\n` +
      `📍 **አድራሻ:** ${orderData.landmark}\n` +
      `🎨 **የተመረጠ መጠንና ቀለም (Size/Color/Options)፦** **${finalOptions}**\n\n` +
      `💰 **ጠቅላላ ዋጋ:** ${ticket.pricing.totalDoorPrice.toLocaleString()} ETB\n` +
      `💳 **ቅድመ ክፍያ (${ADVANCE_PAYMENT_PERCENT}\%):**${ticket.pricing.depositEtb.toLocaleString()} ETB\n` +
      `🚚 **ቀሪ ክፍያ (${COD_PAYMENT_PERCENT}\%):**${ticket.pricing.codEtb.toLocaleString()} ETB\n` +
      `🔗 **እቃ:** ${orderData.itemUrl}\n\n` +
      `📌 **ሁኔታ:** የቴሌብር/CBE ክፍያ ደረሰኝ በመጠበቅ ላይ...\n\n` +
      `👉 **በቀጥታ በቦቱ ለደንበኛው ለመመለስ፦** ለዚህ መልዕክት Reply ያድርጉ ወይም \`/reply ${orderId} <መልስ>\``;

    try {
      const sentOrder = await ctx.telegram.sendMessage(WORKER_CHAT_ID, workerOrderAlert, { parse_mode: "Markdown" });
      workerAlertToCustomer.set(sentOrder.message_id, { userId, ticketId: state.ticketId, orderId });
    } catch (err) {
      console.warn("Failed to notify worker channel of order:", err.message);
    }
  }
}

// 11. Callback Query: "Order Now" button
bot.action(/order_(.+)/, async (ctx) => {
  const ticketId = ctx.match[1];
  const quote = quotes.get(ticketId);
  const userId = ctx.from.id;

  if (!quote || !quote.pricing) {
    return ctx.reply("❌ የዋጋ ስሌት መረጃው አልተገኘም። እባክዎ እንደገና ይሞክሩ ወይም ሰራተኛ ያነጋግሩ።");
  }

  userStates.set(userId, {
    step: "AWAITING_PHONE",
    ticketId,
  });

  await ctx.answerCbQuery();
  return ctx.replyWithMarkdown(
    `📦 **ትዕዛዝ ማረጋገጫ (Step 1/3 - ስልክ ቁጥር)**\n\n` +
    `የመረጡት እቃ፦ **${quote.title || quote.caption}**\n` +
    `የ ${ADVANCE_PAYMENT_PERCENT}% ቅድመ ክፍያ፦ **${quote.pricing.depositEtb.toLocaleString()} ብር**\n\n` +
    `እባክዎን **ስልክ ቁጥርዎን** ያስገቡ፦\n*(ምሳሌ፦ 0911234567 ወይም 0711234567)*`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔙 ትዕዛዙን ሰርዝና ወደ ዋና ማውጫ ተመለስ", "return_to_main")],
    ])
  );
});

// Skip or use previous options buttons
bot.action(/skip_options_(.+)/, async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  if (!state || state.step !== "AWAITING_ORDER_OPTIONS") {
    return ctx.answerCbQuery();
  }
  await ctx.answerCbQuery("ያለ ተጨማሪ ምርጫ ቀጥለዋል");
  return completeFinalOrder(ctx, state, "መደበኛ (Standard / No Special Choice)");
});

bot.action(/use_prev_options_(.+)/, async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  if (!state || state.step !== "AWAITING_ORDER_OPTIONS") {
    return ctx.answerCbQuery();
  }
  const ticket = quotes.get(state.ticketId);
  await ctx.answerCbQuery("የተመረጠውን ምርጫ ተጠቅመዋል");
  return completeFinalOrder(ctx, state, ticket?.options || "መደበኛ");
});

// 12. Text Handler for Order Checkout Steps (Phone, Landmark, Size/Color Options)
bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  const text = ctx.message.text.trim();

  if (/^(ተመለስ|ሰርዝ|cancel|back|main menu|ወደ ዋና ማውጫ)$/i.test(text)) {
    userStates.delete(userId);
    const payload = getMainWelcomePayload(ctx.from.first_name);
    return ctx.replyWithMarkdown("❌ ትዕዛዝዎ ተሰርዟል፤ ወደ ዋና ማውጫ ተመልሰዋል።\n\n" + payload.text, payload.keyboard);
  }

  // Handle in-bot live chat message from customer to worker
  if (state && state.step === "AWAITING_WORKER_CHAT") {
    const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
    const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;
    const ref = state.ticketId ? `🎫 **Ticket:** \`#${state.ticketId}\`` : (state.orderId ? `📦 **Order:** \`#${state.orderId}\`` : "💬 **አጠቃላይ ጥያቄ (General Inquiry)**");

    if (WORKER_CHAT_ID) {
      const workerMsg =
        `💬 **አዲስ የደንበኛ መልዕክት (Customer Message via Bot)**\n\n` +
        `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n` +
        `${ref}\n\n` +
        `📝 **መልዕክት፦**\n"${text}"\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 **ለደንበኛው በቀጥታ በቦቱ መልስ ለመስጠት፦**\n` +
        `1️⃣ ለዚህ መልዕክት **Reply** ያድርጉ (Swipe & Reply)\n` +
        `ወይም\n` +
        `2️⃣ \`/reply ${userId} <የመልስ ጽሑፍ>\` ብለው ይጻፉ`;

      try {
        ctx.telegram.sendMessage(WORKER_CHAT_ID, workerMsg, { parse_mode: "Markdown" }).then((sent) => {
          workerAlertToCustomer.set(sent.message_id, { userId, userTag, ticketId: state.ticketId, orderId: state.orderId });
        }).catch((err) => {
          console.warn("Failed to dispatch to worker chat:", err.message);
        });
      } catch (err) {
        console.warn("Worker dispatch error:", err.message);
      }
    }

    userStates.delete(userId);
    return ctx.replyWithMarkdown(
      `✅ **መልዕክትዎ ለሰራተኞቻችን ደርሷል!**\n\n` +
      `ሰራተኛችን መልዕክትዎን ተመልክቶ **በቀጥታ እዚህ በቦቱ** ይመልስልዎታል!\n\n` +
      `እቃ ለማዘዝ ወይም ዋጋ ለማስላት ከፈለጉ የእቃውን ሊንክ ወይም ስክሪንሾት እዚህ መላክ ይችላሉ።`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")]
      ])
    );
  }

  // Handle in-bot receipt transaction text upload
  if (state && state.step === "AWAITING_RECEIPT_UPLOAD") {
    const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
    const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;

    if (WORKER_CHAT_ID) {
      const workerReceiptAlert =
        `🧾 **የቅድመ ክፍያ መረጃ ደርሷል (Payment Info Submitted)!**\n\n` +
        `📦 **Order:** \`#${state.orderId}\`\n` +
        `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n` +
        `📝 **የተላከ መረጃ / Transaction ID:**\n"${text}"\n\n` +
        `👉 **በቦቱ ለደንበኛው ምላሽ ለመስጠት፦**\n` +
        `ለዚህ መልዕክት Reply ያድርጉ ወይም \`/reply ${state.orderId} ክፍያዎ ተረጋግጧል...\``;

      ctx.telegram.sendMessage(WORKER_CHAT_ID, workerReceiptAlert, { parse_mode: "Markdown" })
        .then((sent) => {
          workerAlertToCustomer.set(sent.message_id, { userId, userTag, orderId: state.orderId });
        })
        .catch((err) => {
          console.warn("Failed to alert worker of receipt:", err.message);
        });
    }

    userStates.delete(userId);
    return ctx.replyWithMarkdown(
      `✅ **የክፍያ መረጃዎ ደርሶናል!**\n\n` +
      `📦 **የትዕዛዝ ቁጥር፦** \`#${state.orderId}\`\n` +
      `ሰራተኞቻችን ክፍያዎን አረጋግጠው እቃው ከቻይና እንዲገዛ ወዲያውኑ ትዕዛዝ ያስተላልፋሉ። ሁኔታውን **በቀጥታ እዚህ በቦቱ** እናሳውቅዎታለን።`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📦 የትዕዛዝ ሁኔታ ተመልከት", "menu_orders")],
        [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")]
      ])
    );
  }

  // If user is not currently in an active checkout state, forward inquiry to workers & offer guidance
  if (!state) {
    const cleanNumbers = text.replace(/\D/g, "");
    if (cleanNumbers.length >= 9 && cleanNumbers.length <= 12) {
      return handleTrackingResponse(ctx, text);
    }

    if (WORKER_CHAT_ID) {
      const rawTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || `User ${userId}`);
      const userTag = ctx.from.username ? `@${ctx.from.username}` : `[${rawTag}](tg://user?id=${userId})`;
      const inquiryAlert =
        `💬 **አዲስ የደንበኛ ጥያቄ (In-Bot Customer Inquiry)**\n\n` +
        `👤 **ደንበኛ:** ${userTag} (ID: \`${userId}\`)\n` +
        `📝 **ጥያቄ፦**\n"${text}"\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 **በቀጥታ በቦቱ መልስ ለመስጠት፦**\n` +
        `1️⃣ ለዚህ መልዕክት **Reply** ያድርጉ\n` +
        `ወይም\n` +
        `2️⃣ \`/reply ${userId} <መልስዎ እዚህ>\``;

      ctx.telegram.sendMessage(WORKER_CHAT_ID, inquiryAlert, { parse_mode: "Markdown" })
        .then((sent) => {
          workerAlertToCustomer.set(sent.message_id, { userId, userTag });
        })
        .catch((err) => {
          console.warn("Failed to dispatch inquiry to worker:", err.message);
        });
    }

    const welcome = getMainWelcomePayload(ctx.from.first_name || "ውድ ደንበኛ");
    return ctx.replyWithMarkdown(
      `👋 **ሰላም! መልዕክትዎ ደርሶናል**\n\n` +
      `ጥያቄዎን ለኮርቻ ሰራተኞች አስተላልፈናል፤ **በቀጥታ እዚህ በቦቱ** ይመልሱልዎታል!\n\n` +
      `እንዲሁም እቃ ለመግዛት ከፈለጉ ከ **Shein**፣ **Temu** ወይም **AliExpress** የመረጡትን እቃ **ሊንክ (URL)** ወይም **ስክሪንሾት (ፎቶ)** እዚህ ይላኩልን።`,
      welcome.keyboard
    );
  }

  // Handle setting options on an initial quote request
  if (state.step === "AWAITING_OPTIONS_QUOTE") {
    const quote = quotes.get(state.ticketId);
    if (quote) {
      quote.options = text;
      if (WORKER_CHAT_ID) {
        ctx.telegram.sendMessage(
          WORKER_CHAT_ID,
          `🎨 **የደንበኛ መጠንና ቀለም ምርጫ ተዘምኗል!**\n\n` +
          `🎫 **Ticket:** \`#${state.ticketId}\`\n` +
          `👤 **ደንበኛ:** ${ctx.from.username ? `@${ctx.from.username}` : `[${ctx.from.first_name || userId}](tg://user?id=${userId})`}\n` +
          `🎨 **የተመረጠ ምርጫ (Size/Color/Notes)፦** **${text}**`,
          { parse_mode: "Markdown" }
        ).catch(() => {});
      }
    }
    userStates.delete(userId);
    return ctx.replyWithMarkdown(
      `✅ **የእቃው መጠንና ቀለም ምርጫ ተመዝግቧል!**\n\n` +
      `🎨 **ምርጫዎ፦** **${text}**\n` +
      `🎫 **ቲኬት፦** \`#${state.ticketId}\`\n\n` +
      `ሰራተኛችን ይህን ምርጫ መሰረት አድርጎ ዋጋውን በደቂቃዎች ውስጥ ያሳውቅዎታል።`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 ወደ ዋና ማውጫ", "return_to_main")],
      ])
    );
  }

  // Checkout Step 1: Phone
  if (state.step === "AWAITING_PHONE") {
    const cleanPhone = text.replace(/[\s-]/g, "");
    if (!/^(?:\+251|0)?[97]\d{8}$/.test(cleanPhone)) {
      return ctx.replyWithMarkdown(
        "⚠️ እባክዎን ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ፦ `0911234567` ወይም `0711234567` ወይም `+251911234567`)።\n\n" +
        "ለመሰረዝ ከፈለጉ 'ተመለስ' ብለው ይጻፉ።"
      );
    }

    state.phone = cleanPhone;
    state.step = "AWAITING_LANDMARK";
    userStates.set(userId, state);

    return ctx.replyWithMarkdown(
      `📍 **የመዳረሻ አድራሻ (Step 2/3 - አድራሻ)**\n\n` +
      `እባክዎን **የመዳረሻ ምልክት (Landmark) ወይም ክፍለ ከተማ** ይጻፉ፦\n` +
      `*(ምሳሌ፦ ቦሌ መድኃኔዓለም ወይም መገናኛ ማራቶን ህንጻ አጠገብ)*`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 ሰርዝና ወደ ዋና ማውጫ ተመለስ", "return_to_main")],
      ])
    );
  }

  // Checkout Step 2: Landmark
  if (state.step === "AWAITING_LANDMARK") {
    state.landmark = text;
    state.step = "AWAITING_ORDER_OPTIONS";
    userStates.set(userId, state);

    const ticket = quotes.get(state.ticketId);
    const preSelected = ticket?.options && ticket.options !== "አልተመረጠም (Not specified)" ? ticket.options : "";

    const optionRows = [];
    if (preSelected) {
      optionRows.push([Markup.button.callback(`✓ቀደም ሲል የመረጡትን ተጠቀም (${preSelected})`, `use_prev_options_${state.ticketId}`)]);
    }
    optionRows.push([Markup.button.callback("⏩ ያለ ተጨማሪ ምርጫ ቀጥል (Skip)", `skip_options_${state.ticketId}`)]);
    optionRows.push([Markup.button.callback("🔙 ሰርዝና ወደ ዋና ማውጫ ተመለስ", "return_to_main")]);

    return ctx.replyWithMarkdown(
      `🎨 **የእቃው ዝርዝር ምርጫ (Step 3/3 - Size, Color & Choices)**\n\n` +
      `የመረጡት እቃ፦ **${ticket?.title || ticket?.caption || "የኮርቻ እቃ"}**\n` +
      (preSelected ? `የተመዘገበ ምርጫ፦ **${preSelected}**\n\n` : `\n`) +
      `እባክዎን የሚፈልጉትን **መጠን (Size)**፣ **ቀለም (Color)** ወይም **ተጨማሪ ምርጫ** ይጻፉልን፦\n` +
      `*(ምሳሌ፦ "መጠን 42፣ ጥቁር ቀለም" ወይም "Size L, Red")*\n\n` +
      `ምንም ልዩ ምርጫ ከሌለ ከታች ያለውን **"⏩ ያለ ተጨማሪ ምርጫ ቀጥል"** የሚለውን ይጫኑ👇`,
      Markup.inlineKeyboard(optionRows)
    );
  }

  // Checkout Step 3: Size, Color or Other choices
  if (state.step === "AWAITING_ORDER_OPTIONS") {
    return completeFinalOrder(ctx, state, text);
  }
});

// Launch unified server (Worker Portal & TMA static app)
startWorkerPortal();

// Launch bot long polling
bot.launch().then(() => {
  console.log("🚀 Korcha Telegram Bot is running in Worker-Assisted Mode...");
}).catch((err) => {
  console.error("Bot launch failed:", err.message);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));