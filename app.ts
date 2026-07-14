import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import routes from "./routes";
import { env } from "./config/env";

const app = express();

// Configure CORS
app.use(
  cors({
    origin: "*", // Adjust origins as necessary for production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Apply Clerk middleware globally to verify JWT tokens
app.use(clerkMiddleware());

// Exclude raw webhooks route from global JSON body parser
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/webhooks")) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Mount routes
app.use("/api", routes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Error Handler caught:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

export default app;
