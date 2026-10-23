// backend/server.js: Modern Concierge Web Server for Korcha with Worker Direct Responses & Payment Marketing
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  runMigrations,
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
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration
const WORKER_USERNAME = process.env.WORKER_TELEGRAM_USERNAME || "korcha_support";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper: Escape HTML entities for Telegram notifications
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Bulletproof Ethiopian Phone Normalizer & Validator
function normalizeEthiopianPhone(phoneInput) {
  if (!phoneInput) return null;
  let digits = String(phoneInput).trim().replace(/[^\d+]/g, "");

  if (digits.startsWith("+251")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("251")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Accepts 9 digits starting with 9 (EthioTelecom) or 7 (Safaricom)
  if (/^(9|7)\d{8}$/.test(digits)) {
    return "0" + digits; // Standard 10-digit format (09... or 07...)
  }
  return null;
}

function isValidEthiopianPhone(phone) {
  return Boolean(normalizeEthiopianPhone(phone));
}

function normalizePhone(phone) {
  return normalizeEthiopianPhone(phone) || phone;
}

// Helper: Dispatch Telegram Alert to Worker Chat in HTML Format with optional Inline Buttons
async function sendWorkerTelegramAlert(text, photoPath = null, replyMarkup = null) {
  if (!BOT_TOKEN || !WORKER_CHAT_ID) return;

  try {
    if (photoPath && fs.existsSync(photoPath)) {
      const formData = new FormData();
      formData.append("chat_id", WORKER_CHAT_ID);
      formData.append("caption", text);
      formData.append("parse_mode", "HTML");
      if (replyMarkup) {
        formData.append("reply_markup", JSON.stringify(replyMarkup));
      }

      const fileBuffer = fs.readFileSync(photoPath);
      const blob = new Blob([fileBuffer]);
      formData.append("photo", blob, path.basename(photoPath));

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      });
    } else {
      const payload = {
        chat_id: WORKER_CHAT_ID,
        text,
        parse_mode: "HTML",
      };
      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  } catch (err) {
    console.warn("[Telegram Worker Alert Warning]", err.message);
  }
}

// API Health Check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Korcha (ኮርቻ) Web API with Direct Worker Responses & Payment Marketing",
    version: "5.4.0",
    worker: WORKER_USERNAME,
    paymentOptions: ["telebirr", "cbe_birr"],
    timestamp: new Date().toISOString(),
  });
});

// GET /api/marketing/payment-options: Marketing endpoints detailing Telebirr & CBE Birr benefits
app.get("/api/marketing/payment-options", (req, res) => {
  res.json({
    success: true,
    marketingTitle: "በ Telebirr ወይም CBE Birr ይክፈሉ — 100% በኢትዮጵያ ብር",
    forexMarkup: "0%",
    advanceDepositPercent: 40,
    codPercent: 60,
    options: [
      {
        id: "telebirr",
        name: "Telebirr (ቴሌብር)",
        accountPhone: "+251-996237800",
        accountHolder: "Korcha Cross-Border E-Commerce",
        badge: "ፈጣን ማረጋገጫ (Instant)",
        perks: ["0% Foreign Transaction Fee", "Instant Transaction Receipt", "40% Advance / 60% COD"],
      },
      {
        id: "cbe_birr",
        name: "Commercial Bank of Ethiopia (CBE / CBE Birr)",
        accountNumber: "10001116390",
        accountHolder: "Korcha Commerce / CBE",
        badge: "አስተማማኝ የባንክ ክፍያ (Secured)",
        perks: ["Direct Bank-to-Bank Verification", "Mobile Banking & CBE Birr Supported", "40% Advance / 60% COD"],
      },
    ],
  });
});

// GET /api/test-notify: Worker notification test endpoint
app.get("/api/test-notify", async (req, res) => {
  if (!WORKER_CHAT_ID) {
    return res.status(400).json({
      success: false,
      error: "TELEGRAM_WORKER_CHAT_ID is not configured in .env",
    });
  }
  if (!BOT_TOKEN) {
    return res.status(400).json({
      success: false,
      error: "TELEGRAM_BOT_TOKEN is not configured in .env",
    });
  }

  try {
    const testMsg = `
🔔 <b>የሙከራ ማሳወቂያ (Test Notification)</b>
━━━━━━━━━━━━━━━━━━━━
✅ የኮርቻ ዌብ ማሳወቂያ ስርዓት በትክክል እየሰራ ነው። (Notification operational)
⏰ ሰዓት፡ <code>${new Date().toISOString()}</code>
🛠️ ሰራተኛ፡ @${escapeHtml(WORKER_USERNAME)}
━━━━━━━━━━━━━━━━━━━━
`;
    await sendWorkerTelegramAlert(testMsg);
    res.json({ success: true, message: "Test notification sent to worker chat" });
  } catch (err) {
    console.error("[Test Notify Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/quotes: Inbound quote request from Web Modal
app.post("/api/quotes", upload.single("screenshot"), async (req, res) => {
  try {
    const { sourceType, productUrl, size, color, quantity, details, phone, telegramId } = req.body;
    const screenshotFile = req.file;

    if (!phone || !isValidEthiopianPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09**** / 07****)",
      });
    }

    const cleanPhone = normalizePhone(phone);
    const combinedDetails = `መጠን: ${size || "N/A"} | ቀለም: ${color || "N/A"} | ብዛት: ${quantity || "1"} | ማስታወሻ: ${details || "N/A"}`;
    const quoteCode = `KC-${Math.floor(100000 + Math.random() * 900000)}`;

    await createQuote({
      quoteCode,
      customerPhone: cleanPhone,
      customerTelegramId: telegramId ? parseInt(telegramId, 10) : null,
      sourceType: sourceType || "link",
      productUrl: productUrl || null,
      screenshotUrl: screenshotFile ? screenshotFile.filename : null,
      size,
      color,
      quantity: parseInt(quantity || "1", 10),
      details: combinedDetails,
    });

    const linkHtml = productUrl
      ? `<a href="${escapeHtml(productUrl)}">${escapeHtml(productUrl)}</a>`
      : "N/A";

    const workerMsg = `
🔔 <b>አዲስ ጥያቄ ከ Web App ደርሷል!</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Quote:</b> <code>${escapeHtml(quoteCode)}</code>
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone)}</code>
📝 <b>ዝርዝር:</b> ${escapeHtml(combinedDetails)}
🔗 <b>ሊንክ:</b> ${linkHtml}
━━━━━━━━━━━━━━━━━━━━
👉 ለደንበኛው በቀጥታ መልስ ለመስጠት፡
<code>/reply ${quoteCode} የእቃው ዋጋ በብር ...</code>
`;
    const intlPhone = cleanPhone.startsWith("0") ? `+251${cleanPhone.slice(1)}` : cleanPhone;
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "💬 በቴሌግራም መልስ (Reply)", url: `https://t.me/${intlPhone.replace('+', '')}` },
          { text: "📞 ደውል (Call)", url: `tel:${cleanPhone}` }
        ]
      ]
    };

    sendWorkerTelegramAlert(workerMsg, screenshotFile ? screenshotFile.path : null, replyMarkup);

    res.json({ success: true, quoteCode });
  } catch (err) {
    console.error("[API Quote Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/quotes/:code: Fetch quote details
app.get("/api/quotes/:code", async (req, res) => {
  try {
    const quote = await getQuoteByCode(req.params.code);
    if (!quote) return res.status(404).json({ success: false, error: "Quote not found" });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/lookup: Customer Self-Service order tracking with instant worker notification
app.get("/api/orders/lookup", async (req, res) => {
  try {
    const { phone, code } = req.query;
    let orders = [];
    const searchTarget = code || phone;

    if (!searchTarget) {
      return res.status(400).json({ success: false, error: "Phone number or order code required" });
    }

    if (code) {
      const order = await getOrderByCode(code);
      if (order) orders = [order];
    } else if (phone) {
      orders = await getOrdersByPhone(normalizePhone(phone));
    }

    // Record lookup timestamp
    await recordOrderLookup(normalizePhone(phone) || code, orders.length);

    // Notify assigned workers immediately when customer checks status
    if (orders.length > 0) {
      const ord = orders[0];
      const customerPhone = ord.customer_phone;
      const intlPhone = customerPhone.startsWith("0") ? `+251${customerPhone.slice(1)}` : customerPhone;

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
👉 ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡
<code>/reply ${ord.order_code} ሰላም፣ እቃዎ ...</code>
`;
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "💬 በቴሌግራም መልስ (Reply)", url: `https://t.me/${intlPhone.replace('+', '')}` },
            { text: "📞 ደውል (Call)", url: `tel:${customerPhone}` }
          ]
        ]
      };
      sendWorkerTelegramAlert(lookupAlert, null, replyMarkup);
    } else {
      const lookupMissingAlert = `
⚠️ <b>ያልተገኘ የትዕዛዝ ፍለጋ ሙከራ (Unmatched Status Lookup)!</b>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>የተፈለገው ኮድ/ስልክ:</b> <code>${escapeHtml(searchTarget)}</code>
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 ደንበኛው ትዕዛዝ አላገኘም፤ እርዳታ ሊያስፈልገው ይችላል።
`;
      const replyMarkup = isValidEthiopianPhone(searchTarget) ? {
        inline_keyboard: [
          [
            { text: "📞 ለደንበኛው ደውል", url: `tel:${normalizePhone(searchTarget)}` }
          ]
        ]
      } : null;
      sendWorkerTelegramAlert(lookupMissingAlert, null, replyMarkup);
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/:code/ping: Customer ping or follow-up request on active inquiry
app.post("/api/orders/:code/ping", async (req, res) => {
  try {
    const code = req.params.code;
    const { phone, note, customerName, telegramId } = req.body;

    const order = await getOrderByCode(code);
    const cleanPhone = normalizePhone(phone || (order ? order.customer_phone : null));

    if (!cleanPhone && !order) {
      return res.status(400).json({
        success: false,
        error: "Valid phone number or order code required for follow-up ping",
      });
    }

    const recordedPing = await recordCustomerPing({
      referenceCode: code,
      customerPhone: cleanPhone || "Unknown",
      customerName: customerName || null,
      customerTelegramId: telegramId || order?.customer_telegram_id || null,
      pingType: "status_followup",
      customerNote: note || "ደንበኛ ወቅታዊ ሁኔታ ማወቅ ይፈልጋል (Customer requested status update)",
      assignedWorker: order?.assigned_worker || WORKER_USERNAME,
    });

    // Notify assigned workers immediately
    const intlPhone = cleanPhone && cleanPhone.startsWith("0") ? `+251${cleanPhone.slice(1)}` : cleanPhone;
    const pingAlert = `
🚨 <b>አስቸኳይ፡ ደንበኛ ሁኔታ እንዲጣራለት ጠየቀ! (Customer Inquiry Follow-up / Ping)</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ ኮድ:</b> <code>${escapeHtml(code)}</code>
📱 <b>ስልክ:</b> <code>${escapeHtml(cleanPhone || 'N/A')}</code>
📊 <b>የአሁን ሁኔታ:</b> <code>${escapeHtml(order ? order.status : 'Inquiry')}</code>
📝 <b>የደንበኛው መልዕክት:</b> ${escapeHtml(note || 'ወቅታዊ ሁኔታ እንዲገለጽለት ጠይቋል')}
⏰ <b>ሰዓት:</b> <code>${new Date().toLocaleTimeString()}</code>
━━━━━━━━━━━━━━━━━━━━
👉 ለደንበኛው በቀጥታ በቦት መልስ ለመስጠት፡
<code>/reply ${code} የእርስዎ ምላሽ እዚህ ይጻፉ</code>
`;

    const replyMarkup = {
      inline_keyboard: [
        [
          ...(intlPhone ? [{ text: "💬 በቴሌግራም መልስ (Reply)", url: `https://t.me/${intlPhone.replace('+', '')}` }] : []),
          ...(cleanPhone ? [{ text: "📞 ደውል (Call)", url: `tel:${cleanPhone}` }] : [])
        ]
      ]
    };

    sendWorkerTelegramAlert(pingAlert, null, replyMarkup);

    res.json({
      success: true,
      message: "ጥያቄዎ ለአስተናጋጅ ደርሷል! በአጭር ጊዜ ውስጥ ምላሽ ይሰጡዎታል።",
      ping: recordedPing,
    });
  } catch (err) {
    console.error("[Order Ping Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/:code/respond: Worker responds to customer inquiry or updates status with response note
// Direct push to customer on Telegram Bot + Mini App visibility
app.post("/api/orders/:code/respond", async (req, res) => {
  try {
    const code = req.params.code;
    const { responseText, newStatus, workerUsername } = req.body;

    if (!responseText) {
      return res.status(400).json({ success: false, error: "Response text is required" });
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

    if (BOT_TOKEN && targetTelegramId) {
      try {
        const directCustomerMsg = `
📩 <b>ከአስተናጋጅ የተሰጠ የቀጥታ ምላሽ (Message from Support):</b>
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>የትዕዛዝ/የጥያቄ ኮድ:</b> <code>${escapeHtml(code)}</code>
📝 <b>መልዕክት:</b> ${escapeHtml(responseText)}
${newStatus ? `📊 <b>አዲስ ሁኔታ:</b> <code>${escapeHtml(newStatus)}</code>\n` : ""}━━━━━━━━━━━━━━━━━━━━
👉 ጥያቄ ካለዎት እዚህ መልስ መላክ ይችላሉ።
`;
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetTelegramId,
            text: directCustomerMsg,
            parse_mode: "HTML",
          }),
        });
        deliveredDirectlyToTelegram = true;
      } catch (err) {
        console.warn("[Telegram Direct Dispatch Warning]", err.message);
      }
    }

    res.json({
      success: true,
      message: "Response recorded and visible to customer in Mini App tracking",
      deliveredDirectlyToTelegram,
      result,
    });
  } catch (err) {
    console.error("[Worker Response Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:code/pings: Get follow-up inquiry history
app.get("/api/orders/:code/pings", async (req, res) => {
  try {
    const pings = await getCustomerPings(req.params.code);
    res.json({ success: true, pings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders: Create Order
app.post("/api/orders", async (req, res) => {
  try {
    const {
      quoteId,
      customerPhone,
      customerTelegramId,
      productSummary,
      totalPriceEtb,
      paymentMethod = "telebirr",
      deliveryAddress,
    } = req.body;

    if (!customerPhone || !isValidEthiopianPhone(customerPhone)) {
      return res.status(400).json({ success: false, error: "Valid phone number required" });
    }

    const cleanPhone = normalizePhone(customerPhone);
    const orderCode = `KC-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const advancePercent = parseFloat(process.env.ADVANCE_PAYMENT_PERCENT || "40") / 100;
    const total = parseFloat(totalPriceEtb || "0");
    const deposit = Math.round((total * advancePercent) / 100) * 100; // rounded to nearest 100 ETB
    const cod = total - deposit;

    const order = await createOrder({
      orderCode,
      quoteId: quoteId || null,
      customerPhone: cleanPhone,
      customerTelegramId: customerTelegramId || null,
      productSummary: productSummary || "የተዘዘ እቃ",
      totalPriceEtb: total,
      depositAmountEtb: deposit,
      codBalanceEtb: cod,
      paymentMethod,
      deliveryAddress,
    });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/orders/:code/status: Update Order Status
app.patch("/api/orders/:code/status", async (req, res) => {
  try {
    const { newStatus, changedBy, note } = req.body;
    const result = await updateOrderStatus(req.params.code, newStatus, changedBy || WORKER_USERNAME, note);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static uploaded screenshots
app.use("/uploads", express.static(uploadsDir));

// Resolve frontend static build paths
const candidateDistPaths = [
  path.resolve(__dirname, "../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve(__dirname, "dist"),
];

let frontendDistPath = candidateDistPaths[0];
for (const p of candidateDistPaths) {
  if (fs.existsSync(path.join(p, "index.html"))) {
    frontendDistPath = p;
    break;
  }
}

if (fs.existsSync(path.join(frontendDistPath, "index.html"))) {
  console.log(`📂 Serving compiled frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
}

// Single-page application (SPA) client fallback
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/health") {
    return next();
  }

  const indexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(200).send(`
<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Korcha (ኮርቻ) - Ethiopia Cross-Border E-Commerce</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafaf9; color: #1c1917; margin: 0; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; text-align: center; }
    .card { background: white; border: 1px solid #e7e5e4; border-radius: 20px; padding: 32px; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
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
    <span class="badge">KORCHA ETHIOPIA WEB APP</span>
    <h1>ኮርቻ የውጭ ገበያ ድልድይ</h1>
    <p>Backend API server is running with Worker Notification, Direct Responses & Telebirr/CBE Birr Marketing active.</p>
    <div class="links">
      <a href="/health">የሰርቨር ጤና (API Health)</a>
      <a href="https://t.me/${escapeHtml(WORKER_USERNAME)}" target="_blank" class="secondary">ከአስተናጋጅ ጋር አውራ (@${escapeHtml(WORKER_USERNAME)})</a>
    </div>
  </div>
</body>
</html>
  `);
});

// Initialize database and start server
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.warn("[DB Warning] Database migration deferred:", err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ [Web Server] Korcha web serving on http://0.0.0.0:${PORT}`);
    console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
  });
}

startServer();

export default app;
