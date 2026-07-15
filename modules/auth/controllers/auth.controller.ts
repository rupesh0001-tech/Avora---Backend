import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../common/middleware/auth.middleware";

export class AuthController {
  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(404).json({ error: "User profile not found in local session" });
      }
      return res.json({ user: req.user });
    } catch (error) {
      console.error("AuthController.getMe error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}
