// Run this script to set up Google OAuth and generate token.json via `npx tsx src/setup-google-auth.ts` which would basically run src/auth/google.ts
import { getSheetsClient } from "./auth/google";

(async () => {
  await getSheetsClient();
  console.log("✅ Google OAuth setup complete");
  process.exit(0);
})();
