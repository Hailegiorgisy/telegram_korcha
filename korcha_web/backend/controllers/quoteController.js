// backend/controllers/quoteController.js
import { QuoteModel } from "../models/QuoteModel.js";
import { calculateOrderPricing } from "../services/pricingService.js";

export const quoteController = {
  // Customer submits URL or screenshot (NO AUTOMATIC CUSTOMER PRICING)
  createQuoteRequest(req, res) {
    try {
      const {
        ticketId,
        marketplace = "shein",
        sourceUrl,
        screenshotName,
        screenshotUrl,
        title,
        imageUrl,
        workerHelper,
      } = req.body;

      if (!sourceUrl && !screenshotName && !screenshotUrl) {
        return res.status(400).json({ error: "Product URL or Screenshot is required" });
      }

      const quote = QuoteModel.create({
        ticketId,
        marketplace,
        sourceUrl,
        screenshotName,
        screenshotUrl,
        title: title || "Marketplace Product",
        imageUrl,
        workerHelper,
        customerMessage: "ዋጋውን በ5 ደቂቃ ውስጥ አስልተን እናሳውቅዎታለን",
      });

      res.status(201).json(quote);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Worker approves or submits custom estimation
  estimateQuote(req, res) {
    try {
      const { id } = req.params;
      const { pricing, priceUsd, weightKg } = req.body;

      let finalPricing = pricing;
      if (!finalPricing && priceUsd !== undefined) {
        finalPricing = calculateOrderPricing(priceUsd, weightKg);
      }

      if (!finalPricing) {
        return res.status(400).json({ error: "Pricing or priceUsd is required" });
      }

      const updated = QuoteModel.updateEstimate(id, finalPricing);
      if (!updated) {
        return res.status(404).json({ error: "Quote ticket not found" });
      }

      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getQuoteById(req, res) {
    try {
      const quote = QuoteModel.findById(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.status(200).json(quote);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getAllQuotes(req, res) {
    try {
      const quotes = QuoteModel.findAll();
      res.status(200).json(quotes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getPendingQuotes(req, res) {
    try {
      const pending = QuoteModel.findPending();
      res.status(200).json(pending);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Worker on-demand calculation helper
  calculateHelper(req, res) {
    try {
      const { priceUsd, weightKg, customHkdRate } = req.body;
      if (priceUsd === undefined) {
        return res.status(400).json({ error: "priceUsd is required" });
      }
      const pricing = calculateOrderPricing(priceUsd, weightKg, customHkdRate);
      res.status(200).json(pricing);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
};
