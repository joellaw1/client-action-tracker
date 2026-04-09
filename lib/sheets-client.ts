/**
 * Singleton Sheets client — shared across API routes.
 * Reads config from environment variables.
 */

import { SheetsDataLayer } from "./sheets-data-layer";

let _instance: SheetsDataLayer | null = null;

export function getSheetsClient(): SheetsDataLayer {
  if (!_instance) {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

    _instance = new SheetsDataLayer({
      spreadsheetId,
      credentials: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
      },
    });
  }
  return _instance;
}
