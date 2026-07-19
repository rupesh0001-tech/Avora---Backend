import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import * as controller from "../controllers/bookings.controller";

const router = Router();

// Public route to create a booking slot
router.post("/", controller.createBooking);

// Public route to verify dynamic Razorpay payment
router.post("/payment/verify", controller.verifyPayment);

// Protected route for hosts to retrieve bookings list
router.get("/", requireAuth, controller.getHostBookings);

// Public route to retrieve event details and availability ranges
router.get("/public/:username/:slug", controller.getPublicEventDetails);

export default router;
