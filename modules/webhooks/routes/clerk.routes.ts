import { Router } from "express";
import express from "express";
import { ClerkWebhookController } from "../controllers/clerk.controller";

const router = Router();
const controller = new ClerkWebhookController();

// POST /api/webhooks/clerk - Process Clerk webhook updates
// Use express.raw to preserve raw payload signatures for svix verification
router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  controller.handleWebhook.bind(controller) as any
);

export default router;
