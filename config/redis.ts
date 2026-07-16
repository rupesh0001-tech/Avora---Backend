import Redis from "ioredis";
import { env } from "./env";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ to process job retries properly
});

redisConnection.on("error", () => {});
