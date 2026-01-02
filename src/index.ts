import express from "express";
import bodyParser from "body-parser";
import { webhookQueue } from "./queue.js";
import "dotenv/config";

const app = express();
app.use(bodyParser.json());

console.log("Google Sheet ID:", process.env.GOOGLE_SHEET);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.post("/webhook", async (req, res) => {
  const body = req.body;

  console.log("Received webhook:", body);

  // Challenge verification
  if (body?.challenge) {
    return res.status(200).json({ challenge: body.challenge });
  }

  // Basic validation
  if (!body?.event) {
    return res.sendStatus(200);
  }

  // Push to queue
  await webhookQueue.add("monday-event", {
    event: body.event,
    receivedAt: new Date().toISOString(),
    spreadsheetId: process.env.GOOGLE_SHEET!,
  });

  console.log("Job added to queue");

  return res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Webhook listening on http://localhost:3000");
});

// Run with npx ngrok http 3000 for allowing monday.com to reach the local server
