/**
 * Gemini Email Scanner Module
 *
 * Scans Gmail messages using Gemini 2.5 Pro to extract:
 * 1. Client requests (inbound obligations)
 * 2. Attorney commitments (outbound promises — "I'll get you X")
 * 3. Proactive triggers (situation-implied follow-up work)
 *
 * Security notes:
 * - Uses Gemini API (data stays within Google ecosystem)
 * - Gmail API read-only scope
 * - All extracted items are DRAFTS requiring human approval
 * - No client data is stored by Gemini (API mode, no training)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedActionItem {
  type: "client_request" | "attorney_commitment" | "proactive_trigger" | "resolution";
  client: string | null;
  matter: string | null;
  description: string;
  timeframe: string | null;
  urgency: "high" | "medium" | "low";
  confidence: number; // 0-1
  sourceQuote: string;
  reasoning: string;
}

export interface ProactiveSuggestion {
  trigger: string;
  client: string | null;
  suggestedActions: string[];
  confidence: number;
  reasoning: string;
}

export interface ScanResult {
  emailId: string;
  emailFrom: string;
  emailSubject: string;
  emailDate: string;
  threadId: string;
  actionItems: ExtractedActionItem[];
  proactiveSuggestions: ProactiveSuggestion[];
  scannedAt: string;
}

export interface ScannerConfig {
  geminiApiKey: string;
  minConfidence: number;         // Default: 0.75
  includeProactive: boolean;     // Default: true
  firmAttorneyEmails: string[];  // Emails belonging to firm attorneys
  knownClients: { name: string; domain: string; matters: string[] }[];
}

// ─── Extraction Prompt ────────────────────────────────────────────────────────

function buildExtractionPrompt(config: ScannerConfig): string {
  const clientContext = config.knownClients
    .map(c => `- ${c.name} (${c.domain}): matters include ${c.matters.join(", ")}`)
    .join("\n");

  return `You are a legal assistant AI for a small corporate/transactional law firm (Paradox Principals). You are analyzing attorney email to extract action items, detect deadlines, and identify whether items have already been completed.

FIRM ATTORNEY EMAILS:
${config.firmAttorneyEmails.map(e => `- ${e}`).join("\n")}

KNOWN CLIENTS:
${clientContext}

ANALYZE THE EMAIL BELOW AND EXTRACT:

1. **CLIENT REQUESTS** — Any request from a client, opposing counsel, or third party for the attorney to do something. Be thorough — capture everything.
   Trigger language includes:
   - Direct asks: "Can you...", "Please prepare...", "We need...", "Could you send...", "Is it possible to..."
   - Deadline questions: "When can we expect...", "When can this be sent...", "How soon can you...", "What's the timeline for..."
   - Implied requests: "We're waiting on...", "Following up on...", "Just checking on the status of..."
   - Document requests: "Can you send the draft...", "We need the redline by...", "Please circulate..."
   - Scheduling: "Can we set up a call...", "Are you available to...", "Let's schedule..."

2. **ATTORNEY COMMITMENTS** — Any promise or commitment the attorney made to deliver something.
   Trigger language: "I'll get you...", "We'll have that...", "I'll send...", "We'll prepare...", "Let me draft...", "I'll follow up with...", "Expect it by...", "Will circulate by...", "Working on it now..."

3. **RESOLUTION INDICATORS** — If the email shows that a previously requested item has been COMPLETED or SENT, flag it so we can mark it done.
   Trigger language: "Attached please find...", "Here's the draft...", "Just sent over...", "See attached...", "Circulating now...", "Done — see below...", "Filed today...", "Sent to [recipient]..."
   For these, set type to "resolution" and describe what was completed.

4. **PROACTIVE TRIGGERS** — Situations mentioned that should trigger additional legal work, even though no one explicitly asked.
   Examples:
   - Client mentions an acquisition → due diligence, board resolutions, HSR assessment
   - Client mentions hiring → offer letters, PIIA, equity grants
   - Client mentions new funding → cap table updates, investor agreements, amended charter
   - Client mentions expanding to new state → foreign qualification, registered agent
   - Client mentions a dispute → litigation hold, insurance notice, preservation letter
   - Client mentions regulatory inquiry → response strategy, document preservation
   - Client mentions a new product launch → IP review, terms of service, privacy policy

For each item, provide:
- type: "client_request" | "attorney_commitment" | "proactive_trigger" | "resolution"
- client: The client name if identifiable (match to known clients when possible)
- matter: The relevant matter/case if identifiable
- description: A clear, actionable description of what needs to be done (or what was completed, for resolutions)
- timeframe: Any deadline or timeframe mentioned (null if none). Include implicit deadlines like "ASAP", "EOD", "end of week", "before the board meeting"
- urgency: "high" (explicit deadline within 1 week, or words like ASAP/urgent/time-sensitive), "medium" (deadline within 1 month or implied urgency), "low" (no deadline)
- confidence: Your confidence in this extraction (0.0 to 1.0)
- sourceQuote: The exact quote from the email that triggered this extraction (keep short)
- reasoning: Brief explanation of why you flagged this

For proactive triggers, also provide:
- trigger: Description of the triggering situation
- suggestedActions: Array of specific legal tasks that should be considered

RESPOND WITH VALID JSON ONLY. Use this exact schema:
{
  "actionItems": [...],
  "proactiveSuggestions": [...]
}

If nothing is found, return empty arrays.

EMAIL:
`;
}

// ─── Scanner Class ────────────────────────────────────────────────────────────

export class GeminiEmailScanner {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,       // Low temperature for accurate extraction
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });
  }

  /**
   * Scan a single email with retry logic for rate limits (429 errors)
   */
  async scanEmail(email: {
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    body: string;
  }): Promise<ScanResult> {
    const prompt = buildExtractionPrompt(this.config);
    const emailText = `From: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;

    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.model.generateContent(prompt + emailText);
        const response = result.response;
        const text = response.text();
        const parsed = JSON.parse(text);

        // Filter by minimum confidence
        const actionItems = (parsed.actionItems || []).filter(
          (item: ExtractedActionItem) => item.confidence >= this.config.minConfidence
        );

        const proactiveSuggestions = this.config.includeProactive
          ? (parsed.proactiveSuggestions || []).filter(
              (s: ProactiveSuggestion) => s.confidence >= this.config.minConfidence
            )
          : [];

        return {
          emailId: email.id,
          emailFrom: email.from,
          emailSubject: email.subject,
          emailDate: email.date,
          threadId: email.threadId,
          actionItems,
          proactiveSuggestions,
          scannedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        const is429 = error?.status === 429 ||
          error?.message?.includes("429") ||
          error?.message?.includes("Too Many Requests") ||
          error?.message?.includes("RESOURCE_EXHAUSTED");

        if (is429 && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
          console.log(`Rate limited on email ${email.id}, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error(`Error scanning email ${email.id} (attempt ${attempt}):`, error);
        return {
          emailId: email.id,
          emailFrom: email.from,
          emailSubject: email.subject,
          emailDate: email.date,
          threadId: email.threadId,
          actionItems: [],
          proactiveSuggestions: [],
          scannedAt: new Date().toISOString(),
        };
      }
    }

    // Should not reach here, but TypeScript needs it
    return {
      emailId: email.id,
      emailFrom: email.from,
      emailSubject: email.subject,
      emailDate: email.date,
      threadId: email.threadId,
      actionItems: [],
      proactiveSuggestions: [],
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Batch scan multiple emails, deduplicating by thread
   */
  async scanBatch(emails: Array<{
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    body: string;
  }>): Promise<ScanResult[]> {
    // Group by thread to avoid duplicate extractions from the same conversation
    const threadMap = new Map<string, typeof emails[0]>();
    for (const email of emails) {
      const existing = threadMap.get(email.threadId);
      // Keep the most recent email per thread
      if (!existing || new Date(email.date) > new Date(existing.date)) {
        threadMap.set(email.threadId, email);
      }
    }

    const uniqueEmails = Array.from(threadMap.values());
    const results: ScanResult[] = [];

    // Process emails sequentially to respect Gemini free-tier rate limits
    for (let i = 0; i < uniqueEmails.length; i++) {
      console.log(`Scanning email ${i + 1}/${uniqueEmails.length}: ${uniqueEmails[i].subject}`);
      const result = await this.scanEmail(uniqueEmails[i]);
      results.push(result);

      // Pause between emails to avoid rate limits
      if (i < uniqueEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return results.filter(
      r => r.actionItems.length > 0 || r.proactiveSuggestions.length > 0
    );
  }

  /**
   * Update scanner configuration (e.g., add new clients, change confidence)
   */
  updateConfig(updates: Partial<ScannerConfig>) {
    this.config = { ...this.config, ...updates };
  }
}

// ─── Deduplication Helpers ────────────────────────────────────────────────────

/**
 * Check if a newly extracted action item is a duplicate of an existing one.
 * Uses fuzzy matching on description + client + timeframe.
 */
export function isDuplicateItem(
  newItem: ExtractedActionItem,
  existingItems: ExtractedActionItem[]
): boolean {
  return existingItems.some(existing => {
    // Same client and similar description
    if (existing.client !== newItem.client) return false;
    const similarity = jaroWinkler(
      existing.description.toLowerCase(),
      newItem.description.toLowerCase()
    );
    return similarity > 0.85;
  });
}

// Simple Jaro-Winkler similarity for deduplication
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const match1 = new Array(len1).fill(false);
  const match2 = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (match2[j] || s1[i] !== s2[j]) continue;
      match1[i] = true;
      match2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!match1[i]) continue;
    while (!match2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}
