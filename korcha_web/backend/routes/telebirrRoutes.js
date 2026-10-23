// backend/routes/telebirrRoutes.js
import express from "express";
import { telebirrController } from "../controllers/telebirrController.js";

const router = express.Router();

router.get("/receiver", telebirrController.getReceiverDetails);
router.post("/verify", telebirrController.verifyDeposit);

export default router;
