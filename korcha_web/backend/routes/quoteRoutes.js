// backend/routes/quoteRoutes.js
import express from "express";
import { quoteController } from "../controllers/quoteController.js";

const router = express.Router();

// Customer creates quote request
router.post("/request", quoteController.createQuoteRequest);

// Worker views pending quote requests
router.get("/pending", quoteController.getPendingQuotes);

// Worker submits estimation
router.post("/:id/estimate", quoteController.estimateQuote);

// Worker on-demand calculation helper
router.post("/calc-helper", quoteController.calculateHelper);

// Get quote by ID (for live customer status)
router.get("/:id", quoteController.getQuoteById);

// Get all quotes
router.get("/", quoteController.getAllQuotes);

export default router;
