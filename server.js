<<<<<<< HEAD
// server.js: Production Web Server for Korcha Mini App
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const WORKER_USERNAME = process.env.WORKER_TELEGRAM_USERNAME || 'korcha_support';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve built frontend assets
const distPath = path.join(__dirname, 'dist');
=======
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');

// Serve static production assets
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
app.use(express.static(distPath));

// Health check
app.get('/health', (req, res) => {
<<<<<<< HEAD
  res.json({
    status: 'ok',
    service: 'Korcha Web Server',
    worker: WORKER_USERNAME,
    timestamp: new Date().toISOString(),
  });
});

// Single Page Application (SPA) fallback
=======
  res.json({ status: 'ok', app: 'Korcha (ኮርቻ) Web' });
});

const MARKETPLACE_APPS = {
  shein: {
    name: 'Shein (ሼይን)',
    android: 'https://play.google.com/store/apps/details?id=com.zzkko',
    ios: 'https://apps.apple.com/app/shein-shopping-online/id878577184',
    web: 'https://m.shein.com'
  },
  temu: {
    name: 'Temu (ቴሙ)',
    android: 'https://play.google.com/store/apps/details?id=com.einnovation.temu',
    ios: 'https://apps.apple.com/app/temu-shop-like-a-billionaire/id1641486558',
    web: 'https://www.temu.com'
  },
  aliexpress: {
    name: 'AliExpress (አሊኤክስፕረስ)',
    android: 'https://play.google.com/store/apps/details?id=com.alibaba.aliexpresshd',
    ios: 'https://apps.apple.com/app/aliexpress-shopping-app/id436672029',
    web: 'https://www.aliexpress.com'
  }
};

// Smart Reroute to Play Store or App Store based on customer device
app.get(['/app/:marketplace', '/store/:marketplace', '/download/:marketplace'], (req, res) => {
  const key = (req.params.marketplace || '').toLowerCase();
  const appData = MARKETPLACE_APPS[key] || MARKETPLACE_APPS.shein;
  const ua = (req.headers['user-agent'] || '').toLowerCase();

  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  if (isIos) {
    return res.redirect(302, appData.ios);
  }
  if (isAndroid) {
    return res.redirect(302, appData.android);
  }

  // Fallback for desktop / unknown devices: beautiful mobile-ready launcher
  res.send(`<!DOCTYPE html>
<html lang="am">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appData.name} አፕሊኬሽን ያውርዱ - Korcha</title>
    <script>
      const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        window.location.replace("${appData.ios}");
      } else if (/android/.test(ua)) {
        window.location.replace("${appData.android}");
      }
    </script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
      .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px 24px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
      .badge { display: inline-block; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; }
      h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #fff; }
      p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
      .btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none; margin-bottom: 12px; transition: transform 0.15s ease; }
      .btn:hover { transform: translateY(-2px); }
      .btn-play { background: #10b981; color: #042f2e; }
      .btn-apple { background: #f8fafc; color: #0f172a; }
      .btn-web { background: transparent; color: #94a3b8; border: 1px solid #334155; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">ኮርቻ የገበያ ቦታ አፕ</div>
      <h2>📲 ${appData.name} አፕ ያውርዱ</h2>
      <p>የስልክዎን አይነት ይምረጡ፤ በቀጥታ ወደ ስቶር በመግባት አፕሊኬሽኑን በስልክዎ ላይ ይጫኑ፦</p>
      <a class="btn btn-play" href="${appData.android}">
        <span>📱 Google Play Store (ለ Android)</span>
      </a>
      <a class="btn btn-apple" href="${appData.ios}">
        <span>🍎 Apple App Store (ለ iPhone)</span>
      </a>
      <a class="btn btn-web" href="${appData.web}">
        <span>🌐 በድረ-ገጽ ክፈት (Website)</span>
      </a>
    </div>
  </body>
</html>`);
});

// Dynamic QR Code Generator Endpoint for Telebirr & CBE
app.get('/api/qr/:method', async (req, res) => {
  const method = (req.params.method || 'telebirr').toLowerCase();
  const amount = parseInt(req.query.amount || '0', 10);
  const order = req.query.order || 'KC-ORDER';
  const telebirrPhone = req.query.phone || process.env.TELEBIRR_PHONE || '+251-996237800';
  const cbeAccount = req.query.account || process.env.CBE_ACCOUNT || '10001116390';
  const receiver = req.query.receiver || 'Korcha Logistics (ኮርቻ ሎጂስቲክስ)';

  let payload = '';
  if (method === 'cbe' || method === 'cbe_birr') {
    payload = `cbebirr://pay?account=${encodeURIComponent(cbeAccount)}&amount=${amount}&order=${encodeURIComponent(order)}&receiver=${encodeURIComponent(receiver)}`;
  } else {
    payload = `telebirr://pay?phone=${encodeURIComponent(telebirrPhone)}&amount=${amount}&order=${encodeURIComponent(order)}&receiver=${encodeURIComponent(receiver)}`;
  }

  try {
    const qrBuffer = await QRCode.toBuffer(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: method === 'cbe' || method === 'cbe_birr' ? '#581c87' : '#065f46',
        light: '#ffffff',
      },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(qrBuffer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate QR code', details: err.message });
  }
});

// Single Page Application routing fallback
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

<<<<<<< HEAD
// Initialize database & start server
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.warn('[DB Warning] Database migration deferred:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Web Server] Korcha web serving on http://0.0.0.0:${PORT}`);
  });
}

startServer();
=======
app.listen(PORT, () => {
  console.log(`🚀 Korcha Website running on http://localhost:${PORT}`);
});
>>>>>>> e4c81a9a55bb3ed24e62c7b0d1dd4368a1cfd36a
