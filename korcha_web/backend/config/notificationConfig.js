// backend/config/notificationConfig.js

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const TELEGRAM_WORKER_CHAT_ID = process.env.TELEGRAM_WORKER_CHAT_ID || "";
export const WORKER_EMAIL = process.env.WORKER_EMAIL || "support@korcha.et";

export const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
};
