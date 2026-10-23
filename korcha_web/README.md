# Korcha (ኮርቻ) — Ethiopia Cross-Border E-Commerce Web Platform

[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2022.x-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-blue.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v3-38bdf8.svg)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20In--Memory%20Fallback-336791.svg)](https://www.postgresql.org/)
[![Repository](https://img.shields.io/badge/GitHub-hailegiorgisy%2Fkorcha-181717.svg)](https://github.com/hailegiorgisy/korcha)

**Korcha (ኮርቻ)** is a modern cross-border e-commerce web platform engineered for Ethiopian shoppers. It mirrors the exact workflow, business model, and visual identity of the **Telegram Korcha Bot and Mini App**, allowing customers to order fashion, electronics, and home essentials directly from **Shein**, **Temu**, and **AliExpress** using local Ethiopian Birr (ETB) payments and landmark-routed doorstep delivery.

---

## 🌟 Key Features (Unified with Telegram Mini App & Bot)

1. **Assisted Commerce & Manual Quoting Model (@korcha_support):**
   - Eliminates fragile, CAPTCHA-blocked automated scrapers.
   - Customers submit product links or screenshot photos through the web storefront.
   - Concierge personnel (`@korcha_support`) verify product specs and calculate authentic landed costs in ETB.

2. **Dual-Phase Local Payment Architecture (40% / 60%):**
   - **40% Advance Deposit:** Collected via **Telebirr** (`+251-996237800`) or **Commercial Bank of Ethiopia (CBE)** (`10001116390`), rounded to the nearest 100 ETB, to confirm purchasing and air freight.
   - **60% Cash on Delivery (COD):** Settled upon doorstep handover in Addis Ababa and regional cities.

3. **Polished Mobile-First Storefront UI:**
   - **Brand Header:** Clean logo (`ኮ`), *KORCHA Ethiopia* badge, and direct *'አስተናጋጅ አውራ'* button opening a direct chat with `@korcha_support`.
   - **Global Marketplace Cards:** Direct links to official web portals AND mobile app downloads on [Google Play Store](https://play.google.com) and [Apple App Store](https://apps.apple.com) for Shein, Temu, and AliExpress.
   - **8 Marketing Category Cards:** High-resolution marketing imagery with dark gradient overlays across all 8 sectors (Electronics, Women's, Kids, Men's, Sports, Home, Beauty, Shoes & Bags).
   - **Guided 3-Step Quote Modal (`LinkOrScreenshotQuoteModal.tsx`):**
     1. *Step 1:* Input product link (with `https://` placeholder) or upload screenshot/photo.
     2. *Step 2:* Specify Size (*መጠን*), Color (*ቀለም*), Quantity (*ብዛት*), and notes.
     3. *Step 3:* Ethiopian phone number validation (`09****` or `07****`, stripping whitespace, dashes, and `+251`).
     4. *Step 4:* Unique `KC-XXXXXX` ticket generation, customer confirmation breakdown, and direct link to message `@korcha_support`.
   - **Order Tracking Tab:** Self-service lookup by phone number or order code (`KC-XXXXXX`), displaying status (`pending_deposit`, `purchased`, `cargo_transit`, `arrived_addis`, `delivered`), total ETB, deposit, and COD balance.

4. **ACID Relational Database & In-Memory Fallback:**
   - PostgreSQL persistence with connection pooling and automated SQL migrations (`001_initial_schema.sql`).
   - Resilient fail-safe in-memory store ensuring 100% web uptime even if PostgreSQL is temporarily offline.

---

## 📁 Repository Structure

```text
korcha/
├── app.js                              # Universal root entrypoint for Passenger, cPanel, VPS
├── package.json                        # Root workspace configuration
├── .gitignore                          # Standard git ignore rules
├── README.md                           # Platform documentation & setup guide
├── backend/
│   ├── db.js                           # PostgreSQL connection pool & in-memory fallback
│   ├── server.js                       # Express web server with REST APIs & static serving
│   ├── package.json                    # Backend dependencies (cors, dotenv, express, multer, pg)
│   ├── .env.example                    # Environment configuration template
│   └── migrations/
│       └── 001_initial_schema.sql      # ACID schema (customers, quotes, orders, history)
└── frontend/
    ├── package.json                    # Frontend dependencies (React 18, Tailwind, Lucide)
    ├── vite.config.ts                  # Vite build configuration with /api proxy
    ├── tailwind.config.js              # Tailwind CSS styling rules
    ├── postcss.config.js               # PostCSS build pipeline
    ├── index.html                      # Single-page application HTML entry
    └── src/
        ├── main.tsx                    # React application bootstrap
        ├── App.tsx                     # Main storefront shell with Home and Orders tabs
        ├── index.css                   # Tailwind CSS root directives
        ├── components/
        │   ├── Header.tsx              # Clean navigation with direct @korcha_support link
        │   ├── StorefrontHome.tsx      # Marketplace cards, app links, category image cards
        │   └── LinkOrScreenshotQuoteModal.tsx # Guided 3-step quote modal & phone validation
        ├── data/
        │   └── categories.js           # 8 categories with high-res marketing imagery
        ├── services/
        │   └── pricingEngine.ts        # Dynamic environment rate calculator
        └── types/
            └── index.ts                # TypeScript interfaces
```

---

## 🛠️ Quick Start & Local Development

### 1. Prerequisites
- Node.js 18.x, 20.x, or 22.x
- PostgreSQL (optional — falls back to in-memory store if offline)

### 2. Setup
```bash
# Clone the web repository
git clone https://github.com/hailegiorgisy/korcha.git
cd korcha

# Install all dependencies (root, backend, and frontend)
npm run install:all

# Configure environment variables
cp backend/.env.example backend/.env
```

### 3. Run Locally
```bash
# Terminal 1: Start backend API server (runs on http://localhost:5000)
npm start

# Terminal 2: Start frontend Vite development server (runs on http://localhost:5173)
npm run client
```

---

## 🌐 Production Deployment

### Building the Frontend
```bash
npm run build
```
Vite will compile the production bundle into `frontend/dist/`.

### Starting the Production Server
```bash
node backend/server.js
# Or using the root entrypoint:
node app.js
```
The Express server automatically serves the compiled `frontend/dist` assets on `http://0.0.0.0:5000` (or your configured `PORT`), routes `/api/...` endpoints, and provides single-page application (SPA) client routing.

---

## 🔄 GitHub Synchronization (`hailegiorgisy/korcha`)

To commit and push these updates to your GitHub repository:
```bash
git add -A
git commit -m "feat: align web platform with Telegram Mini App and Bot architecture"
git branch -M main
git push origin main
```

---

## 📄 License
Private & Proprietary — Developed for Korcha Cross-Border E-Commerce (Addis Ababa, Ethiopia).
