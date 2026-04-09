import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-client";
import { GmailClient } from "@/lib/gmail-integration";
import { GeminiEmailScanner } from "@/lib/gemini-scanner";

/**
 * POST /api/scan — Run an email scan now.
 * Pulls new Gmail messages, runs them through Gemini, writes results to Sheets.
 */
export async function POST() {
  try {
    // Initialize Gmail client
    const gmail = new GmailClient({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
    });

    // Initialize Gemini scanner
    const firmEmails = (process.env.FIRM_ATTORNEY_EMAILS || "").split(",").map(e => e.trim());
    const sheets = getSheetsClient();
    const clients = await sheets.getClients();

    const scanner = new GeminiEmailScanner({
      geminiApiKey: process.env.GEMINI_API_KEY!,
      minConfidence: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || "0.75"),
      includeProactive: process.env.ENABLE_PROACTIVE_TRIGGERS !== "false",
      firmAttorneyEmails: firmEmails,
      knownClients: clients.map(c => ({
        name: c.name,
        domain: c.domain,
        matters: [], // Could be enriched from a Matters tab
      })),
    });

    // Fetch emails — default 60 days for backfill, env override available
    const hoursBack = parseInt(process.env.SCAN_HOURS_BACK || "1440", 10); // 1440h = 60 days
    const emails = await gmail.fetchRecentEmails(hoursBack);

    if (emails.length === 0) {
      return NextResponse.json({
        emailsScanned: 0,
        itemsFound: 0,
        suggestionsFound: 0,
        message: "No new emails to scan",
      });
    }

    // Run through Gemini
    const scanResults = await scanner.scanBatch(emails);

    let itemsFound = 0;
    let suggestionsFound = 0;

    // Write results to Sheets
    for (const result of scanResults) {
      const senderDomain = result.emailFrom.split("@")[1]?.toLowerCase();
      const matchedClient = clients.find(c =>
        c.domain.toLowerCase() === senderDomain
      );

      for (const item of result.actionItems) {
        await sheets.addEmailScanResult({
          emailFrom: result.emailFrom,
          emailSubject: result.emailSubject,
          emailDate: result.emailDate,
          clientName: matchedClient?.name || item.client || "Unknown",
          type: item.type === "client_request" ? "Client Request"
              : item.type === "attorney_commitment" ? "Attorney Commitment"
              : item.type === "resolution" ? "Resolution (Sent/Done)"
              : "Proactive Trigger",
          extractedQuote: item.sourceQuote,
          suggestedAction: item.description,
          timeframe: item.timeframe || "None specified",
          confidence: item.confidence.toFixed(2),
          scannedAt: result.scannedAt,
        });
        itemsFound++;
      }

      for (const suggestion of result.proactiveSuggestions) {
        await sheets.addProactiveSuggestion({
          clientName: matchedClient?.name || suggestion.client || "Unknown",
          trigger: suggestion.trigger,
          suggestedActions: suggestion.suggestedActions.join("\n"),
          source: "AI-Inferred",
          ruleName: "",
          confidence: suggestion.confidence.toFixed(2),
        });
        suggestionsFound++;
      }
    }

    return NextResponse.json({
      emailsScanned: emails.length,
      itemsFound,
      suggestionsFound,
      message: `Scanned ${emails.length} emails, found ${itemsFound} action items and ${suggestionsFound} proactive suggestions`,
    });
  } catch (error: any) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
