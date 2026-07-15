import { Router } from "express";
import { EventsController } from "../controllers/events.controller";
import { requireAuth } from "../../../common/middleware/auth.middleware";

const router = Router();
const controller = new EventsController();

// All event routes are protected by authenticated session
router.get("/", requireAuth as any, controller.getEvents as any);
router.get("/:id", requireAuth as any, controller.getEvent as any);
router.post("/", requireAuth as any, controller.createEvent as any);
router.put("/:id", requireAuth as any, controller.updateEvent as any);
router.delete("/:id", requireAuth as any, controller.deleteEvent as any);

export default router;
