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
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid authentication session" });
    }

    // Check if user exists in the local database
    let dbUser = await prisma.user.findUnique({
      where: { id: auth.userId },
    });

    // Lazy sync: If user doesn't exist in local DB, fetch from Clerk and create them
    if (!dbUser) {
      console.log(`Lazy sync: User ${auth.userId} not found in DB. Fetching from Clerk...`);
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;

        if (!email) {
          return res.status(400).json({ error: "User profile contains no primary email address" });
        }

        dbUser = await prisma.user.create({
          data: {
            id: clerkUser.id,
            email: email,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            imageUrl: clerkUser.imageUrl,
            timezone: "UTC", // Default timezone
            locale: "en", // Default locale
          },
        });
        console.log(`Lazy sync: Successfully created user ${dbUser.email} in DB.`);
      } catch (clerkError) {
        console.error("Error fetching user details from Clerk API during lazy sync:", clerkError);
        return res.status(500).json({ error: "Failed to synchronize user session with database" });
      }
    }

    // Attach local user object to request
    (req as AuthenticatedRequest).user = dbUser;
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
