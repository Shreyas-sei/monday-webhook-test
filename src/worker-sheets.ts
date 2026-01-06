import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { appendRow } from "./sheets.js";

/* ---------------- helpers ---------------- */

function valueOrNA(value?: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

function extractText(col: any): string {
  return col?.text ?? col?.value ?? "";
}

function extractLink(col: any): string {
  return col?.url ?? "";
}

function extractEmail(col: any): string {
  return col?.email ?? "";
}

function normalizeMarketSector(col: any): string {
  const label = col?.label?.text;
  if (!label) return "";

  if (label === "GameFi") return "Gaming"; // dropdown-safe
  return label;
}

/* ---------------- worker ---------------- */

const worker = new Worker(
  "monday-event",
  async (job) => {
    console.log("Processing job:", job.id);

    const { event, spreadsheetId } = job.data;

    if (!event) {
      console.warn("⚠️ Missing event object, skipping job", job.id);
      return;
    }

    // ✅ normalize Monday payload shape
    const c =
      event.column_values || event.columnValues || event?.pulse?.column_values;

    if (!c) {
      console.warn(
        "⚠️ No column values found, skipping job",
        job.id,
        event.type
      );
      return;
    }

    console.log("Column values:", c);

    /* -------- extract fields -------- */

    const projectName = extractText(c.text_mkr6cypr);
    const marketSector = normalizeMarketSector(c.color_mkr65y7p);
    const website = extractLink(c.link_mkr62c24);
    const docs = extractLink(c.link_mkr61z2y);
    // const desc = extractText(c.text_mkr6qyhd);
    const contracts = extractText(c.long_text_mkr6h69e);
    const email = extractEmail(c.email_mkr6crn7);

    /* -------- Google Sheets order -------- */

    const row = [
      valueOrNA(projectName), // A Project name*
      marketSector, // B Market sector* (dropdown)
      valueOrNA(website), // C Website*
      "N/A", // D Twitter*
      "N/A", // E Discord*
      "N/A", // F Github*
      valueOrNA(docs), // G Docs (URL)
      valueOrNA(contracts), // H Smart contracts*
      "N/A", // I Metrics interest
      "N/A", // J Gov token symbol
      "N/A", // K Gov token address
      "N/A", // L Gov token chain
      "N/A", // M Coingecko ID
      valueOrNA(email), // N Email*
      "N/A", // O Telegram
    ];

    console.log("Appending row:", row);

    await appendRow(row, spreadsheetId);
  },
  { connection }
);

/* ---------------- events ---------------- */

worker.on("completed", (job) => {
  console.log("Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("❌ Job failed:", job?.id, err);
});

console.log("Worker running…");
