import crypto from "crypto";
import { env } from "../../config/env";

export function generateBookingToken(bookingId: string): string {
  const secret = env.CLERK_SECRET_KEY || "cally_default_secret_34892";
  return crypto.createHmac("sha256", secret).update(bookingId).digest("hex");
}

export function verifyBookingToken(bookingId: string, token: string): boolean {
  if (!token) return false;
  const expected = generateBookingToken(bookingId);
  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const tokenBuf = Buffer.from(token, "hex");
    if (expectedBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}
