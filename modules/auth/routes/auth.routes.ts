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

    const host = req.headers.host || "";
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
    const redirectUri = isLocal
      ? "http://localhost:5001/api/auth/google/callback"
      : (process.env.GOOGLE_REDIRECT_URI || "https://api.cally.rupeshhh.in/api/auth/google/callback");

    const client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.readonly"
      ],
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
  const host = req.headers.host || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const frontendUrl = isLocal ? "http://localhost:3000" : (process.env.FRONTEND_URL || "https://cally.rupeshhh.in");

  try {
    const code = req.query.code as string;
    const clerkUserId = req.query.state as string;

    if (!code || !clerkUserId) {
      return res.redirect(`${frontendUrl}/dashboard/calendar?google_connected=error`);
    }

    const redirectUri = isLocal
      ? "http://localhost:5001/api/auth/google/callback"
      : (process.env.GOOGLE_REDIRECT_URI || "https://api.cally.rupeshhh.in/api/auth/google/callback");

    const client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      return res.redirect(`${frontendUrl}/dashboard/calendar?google_connected=error`);
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

    return res.redirect(`${frontendUrl}/dashboard/calendar?google_connected=success`);
  } catch (err: any) {
    console.error("Error in Google OAuth callback:", err);
    return res.redirect(`${frontendUrl}/dashboard/calendar?google_connected=error`);
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

// GET /api/auth/google/settings - Retrieve calendar integration settings
router.get("/google/settings", requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const account = await prisma.googleAccount.findUnique({
      where: { clerkUserId: userId },
    });
    if (!account) {
      return res.status(404).json({ error: "Google account not connected." });
    }
    const settings = (account.settings as any) || {
      syncEnabled: true,
      addMeetLink: true,
      deleteOnCancel: true,
    };
    return res.json({ settings });
  } catch (err) {
    console.error("Error fetching Google settings:", err);
    return res.status(500).json({ error: "Failed to retrieve calendar sync settings." });
  }
});

// PUT /api/auth/google/settings - Save calendar integration settings
router.put("/google/settings", requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const { syncEnabled, addMeetLink, deleteOnCancel } = req.body;

    await prisma.googleAccount.update({
      where: { clerkUserId: userId },
      data: {
        settings: {
          syncEnabled: syncEnabled !== false,
          addMeetLink: addMeetLink !== false,
          deleteOnCancel: deleteOnCancel !== false,
        },
      },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error updating Google settings:", err);
    return res.status(500).json({ error: "Failed to save calendar sync settings." });
  }
});

export default router;
