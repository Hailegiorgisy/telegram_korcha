// backend/routes/catalogRoutes.js
import express from "express";
import { catalogController } from "../controllers/catalogController.js";

const router = express.Router();

router.get("/", catalogController.getCatalog);
router.get("/:id", catalogController.getProductById);

export default router;
