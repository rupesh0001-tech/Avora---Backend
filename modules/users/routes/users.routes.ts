import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { requireAuth } from "../../../common/middleware/auth.middleware";

const router = Router();
const controller = new UsersController();

// Check if a username is available
router.get("/username/check", controller.checkUsername);

// Update/set current user's username
router.put("/username", requireAuth as any, controller.updateUsername as any);

// Update general profile details
router.put("/profile", requireAuth as any, controller.updateProfile as any);

// GET & PUT availability schedule
router.get("/availability", requireAuth as any, controller.getAvailability as any);
router.put("/availability", requireAuth as any, controller.updateAvailability as any);

export default router;
