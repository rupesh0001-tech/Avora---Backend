import { Router } from "express";
import { paymentQueue } from "../queues/booking-queues";

const router = Router();

router.post("/razorpay", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    console.log("[Webhook Route] Received Razorpay webhook payload, enqueuing payment job.");

    await paymentQueue.add("process-webhook", {
      rawBody,
      signature: signature || "",
    });

    return res.status(200).json({ status: "acknowledged" });
  } catch (err: any) {
    console.error("[Webhook Route] Razorpay webhook error:", err);
    return res.status(500).json({ error: "Failed to queue webhook payload." });
  }
});

export default router;
