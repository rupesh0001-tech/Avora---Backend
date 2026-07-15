import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";

const app = express();

// Standard middleware
app.use(cors({
  origin: "http://localhost:3000", // Frontend port
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Clerk middleware to populate auth context
app.use(clerkMiddleware());

// Setup all routes
app.use("/api", router);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
