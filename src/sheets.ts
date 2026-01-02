import { getSheetsClient } from "./auth/google.js";
import "dotenv";

export async function appendRow(values: any[], spreadsheetId: string) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
}
