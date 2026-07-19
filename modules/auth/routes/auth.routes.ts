import { Router } from "express";
import type { Request, Response } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import type { AuthenticatedRequest } from "../../../common/middleware/auth.middleware";
import { oauth2Client } from "../../../config/google";
import { prisma } from "../../../config/database";

const router = Router();
const controller = new AuthController();

// GET /api/auth/me - Get current user profile
router.get("/me", requireAuth as any, controller.getMe as any);

// GET /api/auth/google/connect - Generate Google OAuth login link
router.get("/google/connect", requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user session" });
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar"],
      state: userId,
    });

    return res.json({ url });
  } catch (err: any) {
    console.error("Error generating Google Auth URL:", err);
    return res.status(500).json({ error: "Failed to generate Google auth connection link." });
  }
});

// GET /api/auth/google/callback - Exchange OAuth authorization code
router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clerkUserId = req.query.state as string;

    if (!code || !clerkUserId) {
      return res.status(400).send("Missing authentication code or verification state.");
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.status(400).send("Failed to fetch Google OAuth tokens.");
    }

    const existingAccount = await prisma.googleAccount.findUnique({
      where: { clerkUserId },
    });

    const refreshToken = tokens.refresh_token || existingAccount?.refreshToken || "";

    await prisma.googleAccount.upsert({
      where: { clerkUserId },
      update: {
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: BigInt(tokens.expiry_date || 0),
      },
      create: {
        clerkUserId,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: BigInt(tokens.expiry_date || 0),
      },
    });

    return res.redirect("http://localhost:3000/dashboard/settings?google_connected=success");
  } catch (err: any) {
    console.error("Error in Google OAuth callback:", err);
    return res.redirect("http://localhost:3000/dashboard/settings?google_connected=error");
  }
});

// GET /api/auth/google/status - Check if Google Calendar is connected
router.get("/google/status", requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const account = await prisma.googleAccount.findUnique({
      where: { clerkUserId: userId },
    });
    return res.json({ connected: !!account });
  } catch (err) {
    console.error("Error fetching Google status:", err);
    return res.status(500).json({ error: "Failed to retrieve calendar sync status." });
  }
});

// DELETE /api/auth/google/disconnect - Revoke Google Calendar integration
router.delete("/google/disconnect", requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    await prisma.googleAccount.delete({
      where: { clerkUserId: userId },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting Google account connection:", err);
    return res.status(500).json({ error: "Failed to revoke calendar connection." });
  }
});

export default router;
