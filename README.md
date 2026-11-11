# Telegram Korcha (ኮርቻ) — Ethiopia Cross-Border E-Commerce Web App & Mini App

[![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-blue.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styles-Tailwind%20CSS%20v3-38bdf8.svg)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20In--Memory%20Fallback-336791.svg)](https://www.postgresql.org/)
[![Deployment](https://img.shields.io/badge/Hosting-EthioTelecom%20Plesk-orange.svg)](https://telegram.korcha.com.et)

**Telegram Korcha (ኮርቻ)** is an end-to-end cross-border e-commerce web platform and Telegram Mini App (TMA) designed specifically for the Ethiopian consumer economy. It bridges Ethiopian shoppers to global e-commerce platforms—**Shein**, **Amazon**, and **AliExpress**—enabling seamless browsing, assisted quoting, local currency payment (ETB via Telebirr & CBE), and doorstep delivery across Addis Ababa and regional cities.

---

## 🌟 Key Architecture & Business Highlights

1. **Assisted Commerce & Manual Quoting Model (@korcha_support):**
   - Replaces fragile, CAPTCHA-blocked scrapers with a human-in-the-loop assisted quoting workflow.
   - Customers submit product links or screenshot photos via the Web App / TMA or the conversational Telegram bot.
   - Support personnel (`@korcha_support`) verify product availability, check vendor variations, and calculate exact landed ETB costs.

2. **Dual-Phase Local Payment Structure (ETB):**
   - **40% Advance Deposit:** Collected via **Telebirr** (`+251-996237800`) or **Commercial Bank of Ethiopia (CBE)** (`10001116390`), rounded to the nearest 100 ETB, to confirm purchasing and air cargo.
   - **60% Cash on Delivery (COD):** Settled in cash or Telebirr upon doorstep handover in Ethiopia.

3. **Unified Node.js ESM Architecture:**
   - Single server runtime (`bot.js`) that serves compiled static frontend assets (`dist/`), exposes REST APIs (`/api/quotes`, `/api/orders/lookup`, `/health`, `/api/test-notify`), and coordinates the Telegraf bot.
   - Fully resilient: If Telegram bot tokens or PostgreSQL are temporarily unavailable, the Express web application continues running with in-memory fail-safe persistence.

---

## 🏗️ Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Storefront** | React 18, Vite, TypeScript, Tailwind CSS v3 | Fast, mobile-first Web App and Telegram Mini App. Features marketplace portal cards with App Store/Play Store links, 6 categorized shelf photo grids, order tracking, and a 3-step quote modal. |
| **Backend & Web Server** | Node.js (ESM), Express.js, Multer | Production server in `bot.js` serving `dist/` SPA bundle, REST APIs, and file uploads. |
| **Telegram Bot** | Telegraf Framework (`bot.js`) | Conversational bot matching the 3-step quote wizard, phone validation, and instant ticket dispatch. |
| **Database & Persistence** | PostgreSQL (`db.js`, `pg.Pool`) + Fallback | ACID-compliant relational persistence with automated SQL migrations (`001_initial_schema.sql`) and resilient in-memory fallback. |
| **Production Runtime** | EthioTelecom Plesk / Phusion Passenger | `.plesk.startup.cjs` and `.node-version` (20/22). |

---

## 📋 3-Step Guided Quote Pipeline (Web & Bot)

Both the Web App modal (`LinkOrScreenshotQuoteModal.tsx`) and the Telegram bot wizard enforce an identical 3-step workflow:

1. **Step 1 — Product Source:** Submit product link (with `https://` placeholder) or upload a screenshot/photo.
2. **Step 2 — Specifications:** Input Size (መጠን), Color (ቀለም), Quantity (ብዛት), and custom preferences.
3. **Step 3 — Ethiopian Phone Validation:** Validates numbers across EthioTelecom (`09...`) and Safaricom (`07...`), automatically stripping spaces, hyphens, and `+251` country prefixes.
4. **Step 4 — Ticket Generation & Dispatch:** Generates a unique tracking ticket (`KC-XXXXXX`), confirms receipt to customer, and dispatches the inquiry to the worker in HTML format (preventing URL underscore parse errors).

---

## 🗄️ Database Schema Reference (`migrations/001_initial_schema.sql`)

- **`customers`**: `id`, `telegram_id`, `telegram_username`, `first_name`, `phone_number`, timestamps.
- **`quotes`**: `id`, `quote_code`, `customer_id`, `customer_phone`, `source_type` (`link`/`screenshot`), `product_url`, `screenshot_url`, `size`, `color`, `quantity`, `details`, `status`, `quoted_price_etb`, `deposit_required_etb`, `assigned_worker`.
- **`orders`**: `id`, `order_code`, `quote_id`, `customer_id`, `customer_phone`, `product_summary`, `status` (`pending_deposit`, `deposit_verified`, `purchased`, `cargo_transit`, `arrived_addis`, `out_for_delivery`, `delivered`), `total_price_etb`, `deposit_amount_etb`, `cod_balance_etb`, `delivery_address`.
- **`order_status_history`**: `id`, `order_id`, `previous_status`, `new_status`, `changed_by`, `note`, `created_at`.

---

## 📁 Repository Structure

```
korcha/
├── bot.js                              # Unified Express Web Server, API & Telegram Bot runtime
├── db.js                               # Database layer with connection pooling & in-memory fallback
├── .plesk.startup.cjs                  # EthioTelecom Plesk Passenger startup entry
├── ecosystem.config.cjs                # PM2 production configuration
├── package.json                        # Unified ESM dependencies & scripts
├── vite.config.ts                      # Vite build configuration
├── tailwind.config.js                  # Tailwind CSS styling configuration
├── postcss.config.js                   # PostCSS pipeline
├── index.html                          # Single-page application entry HTML
├── .env.example                        # Template for environment configuration
├── .gitignore                          # Standard git ignores (node_modules, dist, uploads, .env)
├── migrations/
│   ├── 001_initial_schema.sql          # PostgreSQL table schemas and indexes
│   └── 002_add_worker_notifications_and_pings.sql # Worker tracking, pings & direct replies
└── src/
    ├── main.tsx                        # React application mounting
    ├── App.tsx                         # Root storefront shell & order lookup tab
    ├── index.css                       # Tailwind root styles & animations
    ├── components/
    │   ├── Header.tsx                  # Cleaned top navigation with direct @korcha_support button
    │   ├── StorefrontHome.tsx          # Hero banner, Marketplace app links & category image cards
    │   └── LinkOrScreenshotQuoteModal.tsx # Guided 3-step quote & phone validation modal
    ├── data/
    │   └── categories.js               # 6 categories with live product listings and bestseller showcase
    └── services/
        └── pricingEngine.ts            # Dynamic environment rate calculator (HKD, USD, ETB, cargo)
```

---

## 🚀 Setup & Local Development

### 1. Prerequisites
- Node.js 20.x or 22.x
- PostgreSQL 14+ (optional — server automatically falls back to in-memory store if offline)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Hailegiorgisy/telegram_korcha.git
cd telegram_korcha

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### 3. Configure `.env`
Update your credentials in `.env`:
```env
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_WORKER_CHAT_ID="your_numeric_chat_id"
WORKER_TELEGRAM_USERNAME="korcha_support"
DATABASE_URL="postgresql://korcha_user:password@localhost:5432/korcha_db"
```

### 4. Run Locally
```bash
# Start frontend in Vite development mode (http://localhost:3000)
npm run dev

# Or build frontend and start unified production server
npm run build
npm start
```

---

## 🌐 Production Deployment Guide (EthioTelecom Plesk)

To deploy to `https://telegram.korcha.com.et`:

1. **Upload Code:**
   - Upload the project archive (`telegram_korcha_complete.zip`) to your domain document root in Plesk File Manager.
   - Extract files with *Replace existing files* checked. Ensure your production `.env` is preserved.
2. **Node.js Settings:**
   - Open **Node.js** in Plesk.
   - Set **Node.js Version** to `20.x` or `22.x`.
   - Set **Application Startup File** to `.plesk.startup.cjs` (or `bot.js`).
3. **Build Frontend:**
   - In Plesk Node.js, click **Run Script** -> choose `build` -> click **Run**.
   - Vite compiles the React frontend into `dist/`.
4. **Restart & Verify:**
   - Click **Restart** in Plesk.
   - Open `https://telegram.korcha.com.et/health` to confirm server status.
   - Test worker dispatch by opening `https://telegram.korcha.com.et/api/test-notify`.

---

## 🔄 GitHub Synchronization (`Hailegiorgisy/telegram_korcha`)

To push these updates to your GitHub repository:
```bash
git add -A
git commit -m "feat: complete web app modernization per system specifications"
git branch -M main
git push origin main
```

---



## 🔒 Security Notes (Important)

1. **Telegram Mini App initData validation** — Worker and privileged API routes require a valid `X-Telegram-Init-Data` header. The server verifies the HMAC signature against `TELEGRAM_BOT_TOKEN`. Spoofing a username header is not enough.

2. **Worker RBAC** — Only the Telegram account matching `WORKER_TELEGRAM_USERNAME` (default `korcha_support`), proven via validated initData, can price quotes, confirm deposits, or manage shelf products.

3. **Local development bypass** — Set `NODE_ENV=development` and `ALLOW_WORKER_BYPASS=1` only on a local machine if you need username-only access without the Mini App.

4. **Rate limiting** — Quote submission, order lookup, and customer pings are rate-limited per IP.

5. **Quote codes** — Ticket codes are generated with uniqueness checks against quotes and orders.

6. **Sessions** — Bot wizard sessions are backed up to `tmp/sessions.json` every 30s so short restarts do not wipe in-progress flows. Prefer DB-backed ticket state for long-term recovery.


## 📄 License
Private & Proprietary — Developed for Korcha Cross-Border E-Commerce (Addis Ababa, Ethiopia).
