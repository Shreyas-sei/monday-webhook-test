import fs from "fs";
import { google } from "googleapis";
import open from "open";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = "token.json";

export async function getSheetsClient() {
  const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));

  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Load saved token if exists
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(
      JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"))
    );
    console.log("Loaded saved Google Sheets token.");
    return google.sheets({ version: "v4", auth: oAuth2Client });
  }

  // First-time OAuth flow
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("\nAuthorize this app by visiting this URL:\n");
  console.log(authUrl, "\n");

  await open(authUrl);

  const code = await new Promise<string>((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  return google.sheets({ version: "v4", auth: oAuth2Client });
}
