// backend/controllers/telebirrController.js
import { TELEBIRR_RECEIVER_PHONE, TELEBIRR_RECEIVER_NAME } from "../config/pricingConfig.js";
import { OrderModel } from "../models/OrderModel.js";
import { notificationService } from "../services/notificationService.js";

export const telebirrController = {
  getReceiverDetails(req, res) {
    res.status(200).json({
      receiverPhone: TELEBIRR_RECEIVER_PHONE,
      receiverName: TELEBIRR_RECEIVER_NAME,
      ussdShortCode: "*127#",
      instructionEn: `Send 25% deposit to ${TELEBIRR_RECEIVER_PHONE} (${TELEBIRR_RECEIVER_NAME}). Include your Order Reference in the transaction note.`,
      instructionAm: `የ 25% ቅድመ ክፍያውን ወደ ${TELEBIRR_RECEIVER_PHONE} (${TELEBIRR_RECEIVER_NAME}) ይላኩ። በትራንዛክሽን ማስታወሻ ላይ የትዕዛዝ ቁጥሩን ያስገቡ።`,
    });
  },

  async verifyDeposit(req, res) {
    const { orderId, transactionId } = req.body;
    if (!orderId || !transactionId) {
      return res.status(400).json({ error: "orderId and transactionId are required" });
    }

    const updated = OrderModel.attachTelebirrTransaction(orderId, transactionId);
    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Alert workers that deposit has been transferred!
    await notificationService.notifyPaymentReceived(updated, transactionId);

    res.status(200).json({
      success: true,
      message: "የቴሌብር ክፍያዎ ተመዝግቧል! ሰራተኞቻችን እቃውን ከሼይን ማዘዝ ጀምረዋል።",
      order: updated,
    });
  },
};
