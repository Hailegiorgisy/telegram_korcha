// backend/controllers/helpController.js
import { HelpModel } from "../models/HelpModel.js";
import { notificationService } from "../services/notificationService.js";

export const helpController = {
  async submitHelpRequest(req, res) {
    try {
      const { name, phone, message, sheinLink } = req.body;

      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: "ስልክ ቁጥር ማስገባት ግዴታ ነው (Phone number is required)" });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "የእርዳታ ጥያቄዎን መግለጽ ግዴታ ነው (Message is required)" });
      }

      const ticket = HelpModel.create({ name, phone, message, sheinLink });

      // Send telegram/email notification to Korcha workers
      await notificationService.notifyHelpRequest(ticket);

      res.status(201).json({
        success: true,
        message: "የእርዳታ ጥያቄዎ በተሳካ ሁኔታ ደርሶናል! ሰራተኞቻችን ወዲያውኑ በስልክ ያገኙዎታል።",
        ticket,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getAllRequests(req, res) {
    res.status(200).json(HelpModel.findAll());
  },
};
