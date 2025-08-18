import express from "express";
import { webhookController, healthController } from "../controllers/index.js";
import authRoutes from "./auth.js";
import zoomRoutes from "./zoom.js";

const router = express.Router();

// Health check endpoint
router.get("/health", healthController);

// Webhook endpoint
router.post("/webhook", webhookController);

// Zoom auth routes
router.use("/zoomapp", authRoutes);

// Zoom API proxy routes
router.use("/zoom", zoomRoutes);

export default router;
