import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { appendRow } from "./sheets.js";

const worker = new Worker(
  "monday-event",
  async (job) => {
    console.log("Processing job:", job.id, job.data);

    const { event, receivedAt, spreadsheetId } = job.data;

    const row = [receivedAt, event.type, event.pulseId, JSON.stringify(event)];

    console.log("Appending row to Google Sheet:", row);

    await appendRow(row, spreadsheetId);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log("Job completed:", job.id);
});

worker.on("failed", (err) => {
  console.error("Job failed:", err);
});

console.log("Worker running...");
