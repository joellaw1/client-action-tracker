/**
 * Gmail API Integration Module
 *
 * Connects to Google Workspace via OAuth2 to read emails.
 * Uses ONLY the gmail.readonly scope — no write access.
 *
 * Setup requirements:
 * 1. Create a Google Cloud project
 * 2. Enable the Gmail API
 * 3. Create OAuth 2.0 credentials (Web application type)
 * 4. Add authorized redirect URI: http://localhost:3000/api/auth/callback/google
 * 5. Add your email addresses as test users (no verification needed for internal use)
 */

import { google, gmail_v1 } from "googleapis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string; // Obtained after initial OAuth flow
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labels: string[];
  snippet: string;
}

export interface SyncState {
  lastHistoryId: string | null;
  lastSyncAt: string | null;
  emailsProcessed: number;
}

// ─── Gmail Client ─────────────────────────────────────────────────────────────

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private auth: any;
  private syncState: SyncState;

  constructor(config: GmailConfig) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.auth.setCredentials({
      refresh_token: config.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.auth });

    this.syncState = {
      lastHistoryId: null,
      lastSyncAt: null,
      emailsProcessed: 0,
    };
  }

  /**
   * Generate the OAuth authorization URL for initial setup.
   * User visits this URL, grants access, and we get a code to exchange for tokens.
   */
  static getAuthUrl(clientId: string, clientSecret: string, redirectUri: string): string {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      prompt: "consent", // Force consent to always get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens (one-time setup step)
   */
  static async exchangeCode(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    code: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    return {
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || "",
    };
  }

  /**
   * Fetch recent emails (last N hours) that haven't been scanned yet.
   * Returns parsed emails ready for the Gemini scanner.
   */
  async fetchRecentEmails(hoursBack: number = 1): Promise<ParsedEmail[]> {
    const after = Math.floor(
      (Date.now() - hoursBack * 60 * 60 * 1000) / 1000
    );
    const query = `after:${after}`;

    try {
      const maxResults = hoursBack > 48 ? 500 : 50; // Larger fetch for backfill scans
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) return [];

      const emails: ParsedEmail[] = [];

      // Fetch full message details in parallel (batches of 10)
      const BATCH_SIZE = 10;
      for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
        const batch = messageIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(msg =>
            this.gmail.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "full",
            })
          )
        );

        for (const result of batchResults) {
          const parsed = this.parseMessage(result.data);
          if (parsed) emails.push(parsed);
        }
      }

      // Update sync state
      if (listResponse.data.resultSizeEstimate) {
        this.syncState.emailsProcessed += emails.length;
        this.syncState.lastSyncAt = new Date().toISOString();
      }

      return emails;
    } catch (error) {
      console.error("Error fetching emails:", error);
      throw error;
    }
  }

  /**
   * Incremental sync using Gmail History API.
   * More efficient than fetching all recent emails — only gets what's new.
   */
  async fetchNewEmailsSinceLastSync(): Promise<ParsedEmail[]> {
    if (!this.syncState.lastHistoryId) {
      // First sync: fall back to time-based fetch
      const emails = await this.fetchRecentEmails(2);
      // Store the current history ID for future incremental syncs
      const profile = await this.gmail.users.getProfile({ userId: "me" });
      this.syncState.lastHistoryId = profile.data.historyId || null;
      return emails;
    }

    try {
      const historyResponse = await this.gmail.users.history.list({
        userId: "me",
        startHistoryId: this.syncState.lastHistoryId,
        historyTypes: ["messageAdded"],
      });

      const history = historyResponse.data.history || [];
      const newMessageIds = new Set<string>();

      for (const record of history) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            newMessageIds.add(added.message.id);
          }
        }
      }

      // Update history ID
      if (historyResponse.data.historyId) {
        this.syncState.lastHistoryId = historyResponse.data.historyId;
      }

      if (newMessageIds.size === 0) return [];

      // Fetch full messages
      const emails: ParsedEmail[] = [];
      const ids = Array.from(newMessageIds);

      const BATCH_SIZE = 10;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(id =>
            this.gmail.users.messages.get({
              userId: "me",
              id,
              format: "full",
            })
          )
        );

        for (const result of batchResults) {
          const parsed = this.parseMessage(result.data);
          if (parsed) emails.push(parsed);
        }
      }

      this.syncState.emailsProcessed += emails.length;
      this.syncState.lastSyncAt = new Date().toISOString();

      return emails;
    } catch (error: any) {
      // If history ID is too old, Gmail returns 404 — fall back to time-based
      if (error.code === 404) {
        console.warn("History ID expired, falling back to time-based fetch");
        this.syncState.lastHistoryId = null;
        return this.fetchNewEmailsSinceLastSync();
      }
      throw error;
    }
  }

  /**
   * Parse a Gmail API message into our simplified format
   */
  private parseMessage(message: gmail_v1.Schema$Message): ParsedEmail | null {
    if (!message.id || !message.threadId) return null;

    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const body = this.extractBody(message.payload);

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      body: body || message.snippet || "",
      labels: message.labelIds || [],
      snippet: message.snippet || "",
    };
  }

  /**
   * Extract plain text body from message payload (handles multipart)
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return "";

    // Direct body (simple message)
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Multipart: prefer text/plain, fall back to text/html
    if (payload.parts) {
      // First pass: look for text/plain
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }

      // Second pass: try text/html and strip tags
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          const html = Buffer.from(part.body.data, "base64").toString("utf-8");
          return this.stripHtml(html);
        }
      }

      // Recursive: check nested multipart
      for (const part of payload.parts) {
        if (part.parts) {
          const nested = this.extractBody(part);
          if (nested) return nested;
        }
      }
    }

    return "";
  }

  /**
   * Basic HTML stripping for email body extraction
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Get current sync state (for display in UI)
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Set sync state (for persistence across restarts)
   */
  setSyncState(state: SyncState) {
    this.syncState = { ...state };
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/**
 * Runs the email scan on an interval.
 * In production, this would be a cron job or background worker.
 * For the MVP, it's a simple setInterval.
 */
export class EmailScanScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private gmailClient: GmailClient,
    private onResults: (emails: ParsedEmail[]) => Promise<void>,
    private intervalMinutes: number = 30
  ) {}

  start() {
    if (this.intervalId) return;

    // Run immediately on start
    this.runScan();

    // Then run on interval
    this.intervalId = setInterval(
      () => this.runScan(),
      this.intervalMinutes * 60 * 1000
    );

    console.log(`Email scan scheduler started (every ${this.intervalMinutes} min)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("Email scan scheduler stopped");
  }

  private async runScan() {
    if (this.isRunning) {
      console.log("Scan already in progress, skipping");
      return;
    }

    this.isRunning = true;
    try {
      console.log("Starting email scan...");
      const emails = await this.gmailClient.fetchNewEmailsSinceLastSync();
      console.log(`Fetched ${emails.length} new emails`);

      if (emails.length > 0) {
        await this.onResults(emails);
      }
    } catch (error) {
      console.error("Email scan failed:", error);
    } finally {
      this.isRunning = false;
    }
  }
}
