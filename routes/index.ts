import { Router } from "express";
import authRoutes from "../modules/auth/routes/auth.routes";
import webhookRoutes from "../modules/webhooks/routes/clerk.routes";

const router = Router();

// Mount modules
router.use("/auth", authRoutes);
router.use("/webhooks", webhookRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

export default router;
