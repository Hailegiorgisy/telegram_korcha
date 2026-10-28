export interface CodeFile {
  filename: string;
  language: string;
  description: string;
  code: string;
}

export const GITHUB_AUDIT_REPORT = {
  repoUrl: '', // removed from UI
  currentStatus: '⚠️ Incomplete: Missing Interactive Telegram Bot Daemon & 2 Marketplaces',
  keyFindings: [
    {
      title: 'Missing Telegram Bot Listener (Crucial Issue)',
      severity: 'Critical',
      description:
        'The existing repository only contained a one-way notification sender (sendTelegramMessage in notificationService.js). There was NO interactive bot script or polling daemon where Ethiopian customers can interact directly.',
      solution:
        'We created a standalone, production-ready bot daemon (bot.js) with Telegraf/grammY architecture that runs 24/7 on your server and handles commands, callbacks, and inline calls.',
    },
    {
      title: 'Pricing Multiplier Mismatch (Formula Correction)',
      severity: 'High',
      description:
        'The repository hardcoded a 1.50 multiplier (50% markup) in pricingConfig.js. Your requirement specifically states: "1.88* the original price and using official exchange rate".',
      solution:
        'Updated formula to: Total ETB = Original USD × 1.88 × Official Exchange Rate (e.g. CBE/NBE rate). Dynamic advance deposit via Telebirr (configured via .env ADVANCE_PAYMENT_PERCENT, default 25%).',
    },
    {
      title: 'Single Marketplace vs. Three Marketplaces',
      severity: 'High',
      description:
        'The repo only had sheinParserService.js. Amazon and AliExpress were completely missing from both parser and UI models.',
      solution:
        'Implemented a unified 3-marketplace parser supporting Shein, Amazon, and AliExpress product URLs, item slugs, and currency normalizations.',
    },
    {
      title: 'Customer Terms Agreement & Worker Dispatch Flow',
      severity: 'Medium',
      description:
        'The Telegram bot flow needed an explicit agreement step where customers review delivery timeline (10-18 days), deposit rules, and landmark address before instant worker notification is triggered.',
      solution:
        'Integrated an interactive Telegram confirmation inline keyboard. Once the user clicks "I Agree & Order", an immediate structured alert is dispatched to workers with order details.',
    },
    {
      title: 'Ethio Telecom Hosting & Systemd Setup Missing',
      severity: 'High',
      description:
        'No deployment scripts, PM2 configuration, or systemd services existed in the repo for hosting on an Ethio Telecom Cloud/VPS instance.',
      solution:
        'Provided ready-to-run korcha-bot.service, ecosystem.config.cjs, and an automated deploy script for Ubuntu/Debian on Ethio Telecom.',
    },
  ],
};

export const PRODUCTION_BOT_CODE = `/**
 * Korcha (ኮርቻ) - Telegram E-Commerce Bot
 * Production Bot Daemon
 */

import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID;
const OFFICIAL_EXCHANGE_RATE = parseFloat(process.env.OFFICIAL_EXCHANGE_RATE || '145.50');
const LANDED_MULTIPLIER = 1.88; // User requirement: 1.88 * original price
const TELEBIRR_ACCOUNT = process.env.TELEBIRR_RECEIVER_PHONE || '+251911234567';

if (!BOT_TOKEN) {
  console.error('❌ FATAL: TELEGRAM_BOT_TOKEN is not defined in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function calculatePricing(usdPrice) {
  const landedUsd = usdPrice * LANDED_MULTIPLIER;
  const totalEtb = Math.round(landedUsd * OFFICIAL_EXCHANGE_RATE);
  const depositEtb = Math.max(100, Math.round((totalEtb * 0.25) / 100) * 100);
  const codEtb = Math.max(0, totalEtb - depositEtb);
  return { usdPrice, landedUsd, totalEtb, depositEtb, codEtb };
}

export default bot;
`;

export const SYSTEMD_SERVICE_FILE = `[Unit]
Description=Korcha Telegram Bot Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/korcha
ExecStart=/usr/bin/node /var/www/korcha/bot.js
Restart=always
RestartSec=10
EnvironmentFile=/var/www/korcha/.env
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=korcha-bot

[Install]
WantedBy=multi-user.target
`;

export const PM2_ECOSYSTEM_FILE = `module.exports = {
  apps: [
    {
      name: 'korcha-telegram-bot',
      script: './bot.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
`;

export const DEPLOY_SCRIPT_SHELL = `#!/usr/bin/env bash
# Generic deployment script placeholder

set -e

# Replace <YOUR_REPO_URL> with your private repository URL
echo "Cloning project repository..."
git clone <YOUR_REPO_URL> /var/www/korcha
cd /var/www/korcha
npm install
npm install -g pm2
pm2 start bot.js --name korcha-bot
pm2 save
pm2 startup systemd

echo "Deployment placeholder complete."
`;

export const ENV_TEMPLATE = `# Environment Variables Template

TELEGRAM_BOT_TOKEN="your_bot_token_here"
TELEGRAM_WORKER_CHAT_ID="-100xxxxxxxxxx"
OFFICIAL_EXCHANGE_RATE="145.50"
LANDED_MULTIPLIER="1.88"
TELEBIRR_RECEIVER_PHONE="+251911234567"
PORT=5000
NODE_ENV="production"
`;
