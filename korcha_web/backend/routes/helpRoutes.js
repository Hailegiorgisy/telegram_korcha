// backend/routes/helpRoutes.js
import express from "express";
import { helpController } from "../controllers/helpController.js";

const router = express.Router();

router.post("/request", helpController.submitHelpRequest);
router.get("/requests", helpController.getAllRequests);

export default router;
