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

function formatContractsForSheets(contractsText: string): string {
  if (!contractsText || contractsText.trim() === "") {
    return "N/A";
  }

  // First, split by lines to handle line-separated format
  let lines = contractsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // If we only have one line, check if it's comma-separated pairs
  if (lines.length === 1) {
    const singleLine = lines[0] as string;
    const parts = singleLine.split(",").map((part) => part.trim());

    // If we have an even number of parts (pairs), it's likely comma-separated format
    // Example: "TradingRouter,0x123,Marketplace,0x456" = 4 parts = 2 pairs
    if (parts.length > 2 && parts.length % 2 === 0) {
      lines = [];
      // Group every 2 parts into contract pairs
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          lines.push(`${parts[i]}, ${parts[i + 1]}`);
        }
      }
    }
  }

  const formattedLines: string[] = [];

  for (const line of lines) {
    // Check if line already starts with "Sei," - if so, keep as is
    if (line.startsWith("Sei,")) {
      formattedLines.push(line);
    } else {
      // Add "Sei," prefix to the line
      formattedLines.push(`Sei,${line}`);
    }
  }

  return formattedLines.join("\n");
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
    const contracts = formatContractsForSheets(
      extractText(c.long_text_mkr6h69e)
    );
    const email = extractEmail(c.email_mkr6crn7);

    /* -------- Google Sheets order -------- */

    const row = [
      valueOrNA(projectName), // A Project name*
      marketSector, // B Market sector* (dropdown)
      valueOrNA(website), // C Website*
      "N/A", // D Twitter*
      "N/A", // E Telegram*
      "N/A", // F Discord*
      "N/A", // G Github*
      valueOrNA(docs), // H Docs (URL)
      valueOrNA(contracts), // I Smart contracts*
      "N/A", // J Metrics interest
      "N/A", // K Gov token symbol
      "N/A", // L Gov token address
      "N/A", // M Gov token chain
      "N/A", // N Coingecko ID
      valueOrNA(email), // O Email*
      "N/A", // P Telegram
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
