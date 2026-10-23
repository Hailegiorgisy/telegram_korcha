// backend/services/notificationService.js
import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WORKER_CHAT_ID,
  WORKER_EMAIL,
} from "../config/notificationConfig.js";

/**
 * Dispatches a Telegram notification to the Korcha workers group / chat.
 */
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WORKER_CHAT_ID) {
    console.log("[TELEGRAM NOTIFICATION (Simulated - Token not set)]:\n" + text);
    return { simulated: true };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_WORKER_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    const result = await response.json();
    return result;
  } catch (err) {
    console.error("[TELEGRAM DISPATCH ERROR]:", err.message);
    return { error: err.message };
  }
}

/**
 * Dispatches an email notification to Korcha workers.
 */
async function sendWorkerEmail(subject, body) {
  console.log(`[EMAIL TO ${WORKER_EMAIL}]: Subject: ${subject}\n${body}`);
  return { success: true };
}

export const notificationService = {
  /**
   * 1. Alert workers when a new order is placed
   */
  async notifyNewOrder(order) {
    const itemsList = order.items
      .map(
        (i) =>
          `• <b>${i.quantity}x ${i.product.name}</b>\n  Size: ${i.selectedSize || "N/A"} | Color: ${i.selectedColor || "N/A"}\n  Price: ${i.product.priceEtb.toLocaleString()} ETB\n  Link: ${i.product.sheinUrl || "N/A"}`
      )
      .join("\n");

    const message = `🚨 <b>አዲስ የኮርቻ ትዕዛዝ ደርሷል! (NEW ORDER)</b>\n\n` +
      `<b>የትዕዛዝ ቁጥር (Order ID):</b> #${order.orderId}\n` +
      `<b>ደንበኛ ስልክ (Primary Phone):</b> ${order.deliveryProfile.primaryPhone}\n` +
      (order.deliveryProfile.backupPhone ? `<b>ተጨማሪ ስልክ (Backup):</b> ${order.deliveryProfile.backupPhone}\n` : "") +
      `<b>የመዳረሻ ምልክት (Landmark):</b> ${order.deliveryProfile.landmark}\n` +
      `<b>የማድረሻ ዘዴ (Method):</b> ${order.deliveryProfile.deliveryMethod}\n` +
      `<b>ጂፒኤስ (GPS):</b> https://www.google.com/maps?q=${order.deliveryProfile.gps.lat},${order.deliveryProfile.gps.lng}\n\n` +
      `<b>የታዘዙ እቃዎች (Items):</b>\n${itemsList}\n\n` +
      `💰 <b>ጠቅላላ ዋጋ (Total):</b> ${order.totalPrice.toLocaleString()} ብር\n` +
      `💵 <b>የ 25% ቅድመ ክፍያ (Deposit):</b> ${order.depositAmount.toLocaleString()} ብር\n` +
      `📦 <b>ቀሪ 75% ሲደርስ (COD):</b> ${order.codAmount.toLocaleString()} ብር\n` +
      `<b>የክፍያ ሁኔታ:</b> ${order.depositPaid ? "✅ 25% ተከፍሏል" : "⏳ ክፍያ በመጠባበቅ ላይ"}\n` +
      `<b>ቀን:</b> ${new Date().toLocaleString()}`;

    await Promise.all([
      sendTelegramMessage(message),
      sendWorkerEmail(`[አዲስ ትዕዛዝ] #${order.orderId} - ${order.deliveryProfile.primaryPhone}`, message),
    ]);
  },

  /**
   * 2. Alert workers when a customer submits a payment / Telebirr transaction
   */
  async notifyPaymentReceived(order, txnId) {
    const message = `💰 <b>የቴሌብር ቅድመ ክፍያ ተፈጽሟል! (DEPOSIT PAID)</b>\n\n` +
      `<b>የትዕዛዝ ቁጥር:</b> #${order.orderId}\n` +
      `<b>የቴሌብር ትራንዛክሽን ቁጥር (Txn ID):</b> <code>${txnId}</code>\n` +
      `<b>የተከፈለ መጠን (Deposit):</b> ${order.depositAmount.toLocaleString()} ብር\n` +
      `<b>ቀሪ የሚከፈል (COD 75%):</b> ${order.codAmount.toLocaleString()} ብር\n` +
      `<b>የደንበኛ ስልክ:</b> ${order.deliveryProfile.primaryPhone}\n` +
      `<b>አድራሻ/ምልክት:</b> ${order.deliveryProfile.landmark}\n` +
      `<b>ቀን:</b> ${new Date().toLocaleString()}`;

    await Promise.all([
      sendTelegramMessage(message),
      sendWorkerEmail(`[ክፍያ ተፈጽሟል] #${order.orderId} - Txn: ${txnId}`, message),
    ]);
  },

  /**
   * 3. Alert workers when a customer asks for help / assistance
   */
  async notifyHelpRequest(helpData) {
    const message = `💬 <b>የደንበኛ እርዳታ ጥሪ! (CUSTOMER ASSISTANCE REQUEST)</b>\n\n` +
      `<b>የደንበኛ ስም:</b> ${helpData.name || "ስም አልተጠቀሰም"}\n` +
      `<b>ስልክ ቁጥር:</b> ${helpData.phone}\n` +
      `<b>የእርዳታው አይነት / ጥያቄ:</b>\n${helpData.message}\n` +
      (helpData.sheinLink ? `\n<b>የእቃው ሊንክ:</b> ${helpData.sheinLink}\n` : "") +
      `\n<b>ሰዓት:</b> ${new Date().toLocaleString()}\n` +
      `<i>እባክዎን ወዲያውኑ ለደንበኛው በስልክ ወይም በቴሌግራም ምላሽ ይስጡ።</i>`;

    await Promise.all([
      sendTelegramMessage(message),
      sendWorkerEmail(`[የእርዳታ ጥያቄ] ${helpData.name || "ደንበኛ"} - ${helpData.phone}`, message),
    ]);
  },
};
