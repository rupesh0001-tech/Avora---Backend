import { Router } from "express";
import authRoutes from "../modules/auth/routes/auth.routes";
import userRoutes from "../modules/users/routes/users.routes";
import eventRoutes from "../modules/events/routes/events.routes";
import bookingsRoutes from "../modules/bookings/routes/bookings.routes";
import webhookRoutes from "./webhooks.routes";

const router = Router();

// Register module subrouters
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/events", eventRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/webhooks", webhookRoutes);

export default router;
