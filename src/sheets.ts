import { getSheetsClient } from "./auth/google.js";
import dotenv from "dotenv";

dotenv.config();

export async function appendRow(values: any[], spreadsheetId: string) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Ecosystem listings",
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
}
