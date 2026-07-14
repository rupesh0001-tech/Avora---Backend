import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../../../common/middleware/auth.middleware";

const router = Router();
const controller = new AuthController();

// GET /api/auth/me - Get current user profile
router.get("/me", requireAuth as any, controller.getMe as any);

export default router;
