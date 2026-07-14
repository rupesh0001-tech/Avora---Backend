import dotenv from "dotenv";
dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  PORT: parseInt(process.env.PORT || "5001", 10),
};

if (!env.DATABASE_URL) {
  console.warn("⚠️ Warning: DATABASE_URL is not set in environment variables");
}
if (!env.CLERK_SECRET_KEY) {
  console.warn("⚠️ Warning: CLERK_SECRET_KEY is not set in environment variables");
}
