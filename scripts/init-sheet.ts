/**
 * Sheet Initialization Script
 *
 * Creates all required tabs and headers in your Google Sheet.
 * Run once after creating a new spreadsheet.
 *
 * Usage: npm run init-sheet
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { SheetsDataLayer } from "../lib/sheets-data-layer";

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    console.error("❌ Missing GOOGLE_SHEETS_ID in .env.local");
    console.error("   Create a Google Sheet and paste its ID (from the URL).");
    process.exit(1);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("❌ Missing Google OAuth credentials in .env.local");
    console.error("   Run 'npm run auth-setup' first to get your refresh token.");
    process.exit(1);
  }

  console.log("📊 Initializing Google Sheet...\n");

  const sheets = new SheetsDataLayer({
    spreadsheetId,
    credentials: { clientId, clientSecret, refreshToken },
  });

  try {
    await sheets.initializeSpreadsheet();
    console.log("✅ Sheet initialized with the following tabs:");
    console.log("   • Clients");
    console.log("   • Action Items");
    console.log("   • Email Scans");
    console.log("   • Proactive Suggestions");
    console.log("   • Audit Log");
    console.log("\nYou can now run 'npm run dev' to start the app.");
    console.log(`\nOpen your sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  } catch (error: any) {
    console.error("❌ Failed to initialize sheet:", error.message);
    if (error.message.includes("not found")) {
      console.error("   Make sure the spreadsheet ID is correct and the sheet exists.");
    }
    if (error.message.includes("permission")) {
      console.error("   Make sure your Google account has edit access to the sheet.");
    }
  }
}

main();
