import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";

const app = express();

// Standard middleware
const allowedOrigins = [
  "http://localhost:3000",
  "https://cally.rupeshhh.in",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints (Unauthenticated)
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Cally Backend API is running" });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Cally Backend API is running" });
});

// Initialize Clerk middleware safely if CLERK_SECRET_KEY is set
if (process.env.CLERK_SECRET_KEY) {
  try {
    app.use(clerkMiddleware());
  } catch (err) {
    console.warn("⚠️ Warning: Clerk middleware initialization skipped:", err);
  }
} else {
  console.warn("⚠️ Warning: CLERK_SECRET_KEY is not set. Clerk auth middleware skipped.");
}

// Setup all routes
app.use("/api", router);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
