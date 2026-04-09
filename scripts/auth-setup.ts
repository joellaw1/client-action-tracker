/**
 * OAuth Setup Script
 *
 * Run once to get your Google OAuth refresh token.
 *
 * Usage:
 *   1. Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
 *   2. Run: npm run auth-setup
 *   3. Open the URL in your browser, grant access
 *   4. Paste the authorization code when prompted
 *   5. Copy the refresh token into your .env.local
 */

import { google } from "googleapis";
import * as readline from "readline";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

console.log("\n🔐 ActionTracker — Google OAuth Setup\n");
console.log("Step 1: Open this URL in your browser:\n");
console.log(`  ${authUrl}\n`);
console.log("Step 2: Sign in and grant access\n");
console.log("Step 3: You'll be redirected to a URL. Copy the 'code' parameter from the URL.\n");
console.log("  (It looks like: 4/0AfJohXk...)\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Step 4: Paste the authorization code here: ", async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    console.log("\n✅ Success! Add this to your .env.local:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    if (tokens.access_token) {
      console.log("(Access token also received — the refresh token is what you need for long-term use)\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error exchanging code:", error.message);
    console.error("Make sure you copied the full code and that your Client ID/Secret are correct.");
  }

  rl.close();
});
