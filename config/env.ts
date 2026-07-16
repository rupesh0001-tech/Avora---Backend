import dotenv from "dotenv";
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  PORT: parseInt(process.env.PORT || "5001", 10),
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
};

if (!env.DATABASE_URL) {
  console.warn("⚠️ Warning: DATABASE_URL is not set in environment variables");
}
if (!env.CLERK_SECRET_KEY) {
  console.warn("⚠️ Warning: CLERK_SECRET_KEY is not set in environment variables");
}
if (!env.REDIS_URL) {
  console.warn("⚠️ Warning: REDIS_URL is not set in environment variables");
}
