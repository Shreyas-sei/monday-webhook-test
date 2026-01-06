import { Queue } from "bullmq";
import { Redis } from "ioredis";

// Correct Redis connection options for BullMQ
export const connection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  // This is required for BullMQ to work with blocking commands
  maxRetriesPerRequest: null,
});

// Create the BullMQ queue using this connection
export const webhookQueue = new Queue("monday-event", {
  connection,
});

// New GitHub PR queue
export const githubQueue = new Queue("github-pr-creation", {
  connection,
});
