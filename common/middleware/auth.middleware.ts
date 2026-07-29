import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { prisma } from "../../config/database";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    timezone: string;
    locale: string;
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    let auth: any = null;
    try {
      auth = getAuth(req);
    } catch (authErr) {
      console.warn("Clerk getAuth error:", authErr);
      return res.status(401).json({ error: "Unauthorized: Invalid authentication token" });
    }

    if (!auth || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid authentication session" });
    }

    // 1. Extract email and profile fields from JWT claims first (zero latency)
    const claims = (auth.sessionClaims as any) || {};
    let email = claims.email || claims.primary_email || claims.email_address;
    let firstName = claims.first_name || claims.given_name || null;
    let lastName = claims.last_name || claims.family_name || null;
    let imageUrl = claims.image_url || claims.picture || null;

    // 2. If email claim is missing, attempt to fetch from Clerk API
    if (!email) {
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        email = clerkUser?.emailAddresses?.[0]?.emailAddress;
        firstName = firstName ?? clerkUser?.firstName;
        lastName = lastName ?? clerkUser?.lastName;
        imageUrl = imageUrl ?? clerkUser?.imageUrl;
      } catch (err) {
        console.warn("Could not fetch user details from Clerk API:", err);
      }
    }

    // Fallback email if Clerk secret key is omitted
    if (!email) {
      email = `${auth.userId}@cally.user`;
    }

    // 3. Atomic upsert to prevent race conditions & keep profile updated
    const dbUser = await prisma.user.upsert({
      where: { id: auth.userId },
      create: {
        id: auth.userId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        imageUrl: imageUrl,
        timezone: "UTC",
        locale: "en",
      },
      update: {
        email: email,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      },
    });

    // 4. Attach authenticated user profile to request
    (req as AuthenticatedRequest).user = dbUser;
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
