#!/usr/bin/env bash
# ==============================================================================
# Korcha (ኮርቻ) - Ethio Telecom Linux Hosting & VPS Deployment Script
# Supports: Ubuntu 20.04 / 22.04 / 24.04 & Debian 11 / 12
# ==============================================================================

set -e

echo "🇪🇹 ========================================================"
echo "🇪🇹 Starting Korcha Deployment on Ethio Telecom VPS Server"
echo "🇪🇹 ========================================================"

# 1. Update OS packages
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw build-essential

# 2. Install Node.js 20 LTS (if not present)
if ! command -v node &> /dev/null; then
    echo "⬇️ Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 3. Install PM2 process manager
npm install -g pm2 telegraf dotenv

# 4. App Directory
APP_DIR="/var/www/korcha"
mkdir -p $APP_DIR
cd $APP_DIR

# 5. Clone or pull repo
if [ ! -d "$APP_DIR/.git" ]; then
    echo "📥 Cloning from GitHub: Hailegiorgisy/korcha..."
    git clone https://github.com/Hailegiorgisy/korcha.git .
else
    echo "🔄 Pulling latest commits..."
    git pull origin main
fi

# 6. Install dependencies & build Web/TMA
echo "📦 Installing production dependencies..."
npm install

if [ -f "package.json" ]; then
    echo "🏗️ Building Web App & TMA frontend (/dist)..."
    npm run build || echo "⚠️ Build skipped or completed."
fi

# 7. Check .env file
if [ -f "$APP_DIR/.env" ]; then
    echo "🔐 .env file detected in $APP_DIR. Setting secure permissions..."
    chmod 600 "$APP_DIR/.env"
else
    echo "⚠️ Warning: .env not found in $APP_DIR. Please ensure your .env is present."
fi

# 8. Configure firewall
echo "🛡️ Configuring UFW firewall for Ethio Telecom..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 3001/tcp # Worker Portal & TMA Port
ufw --force enable

# 9. Start or reload with PM2
echo "🚀 Starting Korcha Telegram Bot & TMA Server with PM2..."
pm2 reload korcha-telegram-bot --update-env || pm2 start ecosystem.config.cjs || pm2 start bot.js --name korcha-telegram-bot
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "Check bot logs anytime with: pm2 logs korcha-telegram-bot"
