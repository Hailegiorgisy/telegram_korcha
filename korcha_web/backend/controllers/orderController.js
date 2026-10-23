// backend/controllers/orderController.js
import { OrderModel } from "../models/OrderModel.js";
import { notificationService } from "../services/notificationService.js";

export const orderController = {
  async createOrder(req, res) {
    try {
      const { items, totalPrice, depositAmount, codAmount, deliveryProfile, telebirrTransactionId } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "ትዕዛዝ ቢያንስ አንድ እቃ ሊኖረው ይገባል (Order must contain at least one item)" });
      }

      if (!deliveryProfile?.landmark || !deliveryProfile?.primaryPhone) {
        return res.status(400).json({
          error: "የመዳረሻ ምልክት እና ዋና ስልክ ቁጥር ማስገባት ግዴታ ነው (Landmark and phone are required)",
        });
      }

      const newOrder = OrderModel.create({
        items,
        totalPrice,
        depositAmount,
        codAmount,
        deliveryProfile,
        depositPaid: Boolean(telebirrTransactionId),
        telebirrTransactionId,
      });

      // Dispatch alert to Korcha workers immediately!
      await notificationService.notifyNewOrder(newOrder);

      res.status(201).json(newOrder);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getAllOrders(req, res) {
    try {
      const orders = OrderModel.findAll();
      res.status(200).json(orders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getOrderById(req, res) {
    try {
      const order = OrderModel.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.status(200).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  updateStatus(req, res) {
    try {
      const { status } = req.body;
      const updated = OrderModel.updateStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: "Order not found" });
      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
