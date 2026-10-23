// backend/routes/orderRoutes.js
import express from "express";
import { orderController } from "../controllers/orderController.js";

const router = express.Router();

router.post("/", orderController.createOrder);
router.get("/", orderController.getAllOrders);
router.get("/:id", orderController.getOrderById);
router.patch("/:id/status", orderController.updateStatus);

export default router;
