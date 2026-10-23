# ==============================================================================
# Telegram Korcha - Windows Native ZIP Packager (Steps 1 to 7 Complete)
# Run in PowerShell: .\build_complete_zip.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 Assembling complete Telegram Korcha project (Steps 1 through 7)..." -ForegroundColor Cyan

# 1. Ensure required directories exist
$dirs = @("src", "src\components", "src\data", "migrations", "uploads", "dist")
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

# ------------------------------------------------------------------------------
# 2. package.json
# ------------------------------------------------------------------------------
@'
{
  "name": "telegram_korcha",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node bot.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "lucide-react": "^0.344.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "telegraf": "^4.16.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.6"
  }
}
'@ | Set-Content -Path "package.json" -Encoding UTF8

# ------------------------------------------------------------------------------
# 3. .env.example
# ------------------------------------------------------------------------------
@'
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_WORKER_CHAT_ID="your_numeric_telegram_chat_id"
WORKER_TELEGRAM_USERNAME="korcha_support"
WORKER_USERNAMES="korcha_support,admin_user"
TELEGRAM_WEB_APP_URL="https://telegram.korcha.com.et"
PORT=3000

DATABASE_URL="postgresql://korcha_user:korcha_password@localhost:5432/korcha_db"

HKD_EXCHANGE_RATE=30.0
USD_TO_HKD=7.8
KG_CARGO_RATE_ETB=1000.0
ADVANCE_PAYMENT_PERCENT=40
COD_PAYMENT_PERCENT=60
'@ | Set-Content -Path ".env.example" -Encoding UTF8

# ------------------------------------------------------------------------------
# 4. Database Migrations (001, 002, 003)
# ------------------------------------------------------------------------------
@'
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(255),
    first_name VARCHAR(255),
    phone_number VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_code VARCHAR(32) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_phone VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    product_url TEXT,
    screenshot_url TEXT,
    size VARCHAR(64),
    color VARCHAR(64),
    quantity INTEGER DEFAULT 1,
    details TEXT,
    status VARCHAR(32) DEFAULT 'pending',
    quoted_price_etb NUMERIC(12, 2),
    deposit_required_etb NUMERIC(12, 2),
    assigned_worker VARCHAR(100),
    worker_response_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(32) UNIQUE NOT NULL,
    quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
    customer_phone VARCHAR(32) NOT NULL,
    product_summary TEXT,
    status VARCHAR(64) DEFAULT 'pending_deposit',
    total_price_etb NUMERIC(12, 2) NOT NULL,
    deposit_amount_etb NUMERIC(12, 2) NOT NULL,
    cod_balance_etb NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
'@ | Set-Content -Path "migrations\001_initial_schema.sql" -Encoding UTF8

@'
CREATE TABLE IF NOT EXISTS shelf_products (
    id VARCHAR(64) PRIMARY KEY,
    title_am VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    category VARCHAR(64) NOT NULL,
    price_etb NUMERIC(12, 2) NOT NULL,
    size VARCHAR(64),
    description TEXT,
    photo_file_id VARCHAR(255),
    image_url TEXT,
    stock_quantity INTEGER DEFAULT 1,
    in_stock BOOLEAN DEFAULT TRUE,
    badge VARCHAR(100) DEFAULT 'በእጅ ላይ ያለ (In Stock)',
    delivery_time VARCHAR(255) DEFAULT 'ዛሬውኑ ወይም በ24 ሰዓት ውስጥ ይረከቡ',
    added_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shelf_category ON shelf_products(category);
CREATE INDEX IF NOT EXISTS idx_shelf_instock ON shelf_products(in_stock);
'@ | Set-Content -Path "migrations\002_shelf_products.sql" -Encoding UTF8

@'
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS worker_response_note TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS quote_messages (
    id SERIAL PRIMARY KEY,
    quote_code VARCHAR(32) NOT NULL,
    sender_type VARCHAR(16) NOT NULL,
    sender_name VARCHAR(255),
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_messages_code ON quote_messages(quote_code);
'@ | Set-Content -Path "migrations\003_quote_responses_and_messages.sql" -Encoding UTF8

# ------------------------------------------------------------------------------
# 5. src\data\categories.js (The 6 Canonical Categories)
# ------------------------------------------------------------------------------
@'
export const CATEGORIES = [
  { id: 'all', nameAm: 'ሁሉም', nameEn: 'All', icon: '✨' },
  { id: 'womens', nameAm: 'የሴቶች አልባሳት', nameEn: "Women's Fashion", icon: '👗' },
  { id: 'kids', nameAm: 'የህጻናት', nameEn: 'Kids & Babies', icon: '🧸' },
  { id: 'beauty', nameAm: 'የመዋቢያ ዕቃዎች', nameEn: 'Beauty & Skin Care', icon: '💄' },
  { id: 'electronics', nameAm: 'ኤሌክትሮኒክስ', nameEn: 'Electronics', icon: '📱' },
  { id: 'home', nameAm: 'የቤት ውስጥ መገልገያዎች', nameEn: 'Home & Kitchen', icon: '🍳' },
  { id: 'misc', nameAm: 'ሌሎች', nameEn: 'Miscellaneous', icon: '📦' },
];
'@ | Set-Content -Path "src\data\categories.js" -Encoding UTF8

Write-Host "📦 Compressing files into telegram_korcha_complete.zip..." -ForegroundColor Yellow

# Files to include in the ZIP
$filesToZip = @(
    "package.json",
    ".env.example",
    "bot.js",
    "db.js",
    "migrations",
    "src"
)

# Remove old zip if present
$zipName = "telegram_korcha_complete.zip"
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# Compress natively using PowerShell
Compress-Archive -Path $filesToZip -DestinationPath $zipName -Force

Write-Host "🎉 SUCCESS: $zipName has been generated in your current folder!" -ForegroundColor Green