/**
 * Google Sheets Data Layer
 *
 * Uses Google Sheets as the primary data store so that:
 * - Partners and staff can view/edit data in a familiar Sheets interface
 * - The app reads/writes through the Sheets API
 * - No new software to learn for non-technical team members
 * - Data stays in Google Workspace (security win)
 *
 * Sheet Structure:
 * - Tab "Clients": client roster with key info
 * - Tab "Action Items": all tasks with status, assignee, due date, source
 * - Tab "Email Scans": AI-detected items pending review
 * - Tab "Proactive Suggestions": triggered follow-up work suggestions
 * - Tab "Trigger Rules": configurable rules (optional — can be app-only)
 * - Tab "Audit Log": who did what and when
 *
 * Setup:
 * 1. Create a Google Sheet (or use the template generator below)
 * 2. Share it with your Google Cloud service account
 * 3. Set the GOOGLE_SHEETS_ID env variable
 */

import { google, sheets_v4 } from "googleapis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SheetsConfig {
  spreadsheetId: string;
  credentials: {
    clientEmail: string;    // Service account email
    privateKey: string;     // Service account private key
  } | {
    clientId: string;       // OAuth client
    clientSecret: string;
    refreshToken: string;
  };
}

export interface SheetClient {
  id: string;
  name: string;
  type: string;
  domain: string;
  primaryContact: string;
  clioId: string;
  notes: string;
}

export interface SheetActionItem {
  id: string;
  clientName: string;
  matter: string;
  title: string;
  description: string;
  status: "Open" | "In Progress" | "Completed" | "Overdue";
  priority: "High" | "Medium" | "Low";
  assignedTo: string;
  dueDate: string;
  source: "Manual" | "Email Scan" | "AI Trigger" | "Clio";
  sourceDetail: string;
  confidence: string;
  createdAt: string;
  completedAt: string;
}

export interface SheetEmailScan {
  id: string;
  emailFrom: string;
  emailSubject: string;
  emailDate: string;
  clientName: string;
  type: "Client Request" | "Attorney Commitment" | "Proactive Trigger";
  extractedQuote: string;
  suggestedAction: string;
  timeframe: string;
  confidence: string;
  status: "Pending Review" | "Accepted" | "Edited & Accepted" | "Dismissed";
  reviewedBy: string;
  reviewedAt: string;
  scannedAt: string;
}

export interface SheetProactiveSuggestion {
  id: string;
  clientName: string;
  trigger: string;
  suggestedActions: string;   // Newline-separated list
  source: "Rule-Based" | "AI-Inferred";
  ruleName: string;
  confidence: string;
  status: "Pending" | "Accepted" | "Partially Accepted" | "Dismissed";
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
}

// ─── Tab Definitions (Headers) ────────────────────────────────────────────────

const TAB_CONFIGS = {
  Clients: {
    headers: ["ID", "Name", "Type", "Domain", "Primary Contact", "Clio ID", "Notes"],
    columnWidths: [120, 250, 150, 180, 200, 120, 300],
  },
  "Action Items": {
    headers: [
      "ID", "Client", "Matter", "Title", "Description", "Status", "Priority",
      "Assigned To", "Due Date", "Source", "Source Detail", "Confidence",
      "Created", "Completed"
    ],
    columnWidths: [120, 200, 180, 300, 400, 100, 80, 120, 100, 100, 200, 80, 140, 140],
  },
  "Email Scans": {
    headers: [
      "ID", "From", "Subject", "Email Date", "Client", "Type",
      "Extracted Quote", "Suggested Action", "Timeframe", "Confidence",
      "Status", "Reviewed By", "Reviewed At", "Scanned At"
    ],
    columnWidths: [120, 200, 250, 140, 200, 150, 350, 300, 150, 80, 120, 120, 140, 140],
  },
  "Proactive Suggestions": {
    headers: [
      "ID", "Client", "Trigger", "Suggested Actions", "Source", "Rule Name",
      "Confidence", "Status", "Reviewed By", "Reviewed At", "Created"
    ],
    columnWidths: [120, 200, 300, 400, 120, 200, 80, 120, 120, 140, 140],
  },
  "Audit Log": {
    headers: ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Details"],
    columnWidths: [180, 150, 120, 120, 120, 400],
  },
};

// ─── Sheets Data Layer Class ──────────────────────────────────────────────────

export class SheetsDataLayer {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(config: SheetsConfig) {
    this.spreadsheetId = config.spreadsheetId;

    let auth: any;
    if ("clientEmail" in config.credentials) {
      // Service account auth
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.credentials.clientEmail,
          private_key: config.credentials.privateKey,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else {
      // OAuth auth
      const oauth2 = new google.auth.OAuth2(
        config.credentials.clientId,
        config.credentials.clientSecret
      );
      oauth2.setCredentials({ refresh_token: config.credentials.refreshToken });
      auth = oauth2;
    }

    this.sheets = google.sheets({ version: "v4", auth });
  }

  // ─── Template Generator ───────────────────────────────────────────────

  /**
   * Initialize the spreadsheet with all required tabs and headers.
   * Call this once during setup.
   */
  async initializeSpreadsheet(): Promise<void> {
    // Get existing sheet names
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

    // Create missing tabs
    const requests: any[] = [];
    for (const [tabName, config] of Object.entries(TAB_CONFIGS)) {
      if (!existingSheets.includes(tabName)) {
        requests.push({
          addSheet: {
            properties: { title: tabName },
          },
        });
      }
    }

    if (requests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });
    }

    // Add headers to each tab
    for (const [tabName, config] of Object.entries(TAB_CONFIGS)) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${tabName}'!A1:${this.colLetter(config.headers.length)}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [config.headers],
        },
      });
    }

    // Format header rows (bold, freeze)
    const sheetInfo = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const formatRequests: any[] = [];
    for (const sheet of sheetInfo.data.sheets || []) {
      const sheetId = sheet.properties?.sheetId;
      const title = sheet.properties?.title;
      if (sheetId === undefined || !title || !TAB_CONFIGS[title as keyof typeof TAB_CONFIGS]) continue;

      formatRequests.push(
        // Bold header row
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.93, green: 0.94, blue: 0.96 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        // Freeze header row
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        }
      );
    }

    if (formatRequests.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    }

    console.log("Spreadsheet initialized with all tabs and headers");
  }

  // ─── Clients CRUD ─────────────────────────────────────────────────────

  async getClients(): Promise<SheetClient[]> {
    return this.readTab<SheetClient>("Clients", row => ({
      id: row[0] || "",
      name: row[1] || "",
      type: row[2] || "",
      domain: row[3] || "",
      primaryContact: row[4] || "",
      clioId: row[5] || "",
      notes: row[6] || "",
    }));
  }

  async addClient(client: Omit<SheetClient, "id">): Promise<string> {
    const id = this.generateId("CLI");
    await this.appendRow("Clients", [
      id, client.name, client.type, client.domain,
      client.primaryContact, client.clioId, client.notes,
    ]);
    await this.logAudit("create", "client", id, `Added client: ${client.name}`);
    return id;
  }

  // ─── Action Items CRUD ────────────────────────────────────────────────

  async getActionItems(filters?: {
    clientName?: string;
    status?: string;
    assignedTo?: string;
  }): Promise<SheetActionItem[]> {
    let items = await this.readTab<SheetActionItem>("Action Items", row => ({
      id: row[0] || "",
      clientName: row[1] || "",
      matter: row[2] || "",
      title: row[3] || "",
      description: row[4] || "",
      status: row[5] as SheetActionItem["status"] || "Open",
      priority: row[6] as SheetActionItem["priority"] || "Medium",
      assignedTo: row[7] || "",
      dueDate: row[8] || "",
      source: row[9] as SheetActionItem["source"] || "Manual",
      sourceDetail: row[10] || "",
      confidence: row[11] || "",
      createdAt: row[12] || "",
      completedAt: row[13] || "",
    }));

    if (filters) {
      if (filters.clientName) items = items.filter(i => i.clientName === filters.clientName);
      if (filters.status) items = items.filter(i => i.status === filters.status);
      if (filters.assignedTo) items = items.filter(i => i.assignedTo === filters.assignedTo);
    }

    return items;
  }

  async addActionItem(item: Omit<SheetActionItem, "id" | "createdAt" | "completedAt">): Promise<string> {
    const id = this.generateId("ACT");
    const now = new Date().toISOString();
    await this.appendRow("Action Items", [
      id, item.clientName, item.matter, item.title, item.description,
      item.status, item.priority, item.assignedTo, item.dueDate,
      item.source, item.sourceDetail, item.confidence, now, "",
    ]);
    await this.logAudit("create", "action_item", id, `Added: ${item.title}`);
    return id;
  }

  async updateActionItemStatus(id: string, status: string, completedAt?: string): Promise<void> {
    const rowIndex = await this.findRowById("Action Items", id);
    if (rowIndex === -1) throw new Error(`Action item ${id} not found`);

    // Update status column (F = column 6) and completedAt (N = column 14)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'Action Items'!F${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    });

    if (completedAt) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'Action Items'!N${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[completedAt]] },
      });
    }

    await this.logAudit("update", "action_item", id, `Status → ${status}`);
  }

  // ─── Email Scan Results ───────────────────────────────────────────────

  async addEmailScanResult(scan: Omit<SheetEmailScan, "id" | "status" | "reviewedBy" | "reviewedAt">): Promise<string> {
    // Deduplicate: check if this exact suggestion already exists
    const existing = await this.readTab<SheetEmailScan>("Email Scans", row => ({
      id: row[0] || "",
      emailFrom: row[1] || "",
      emailSubject: row[2] || "",
      emailDate: row[3] || "",
      clientName: row[4] || "",
      type: row[5] as any,
      extractedQuote: row[6] || "",
      suggestedAction: row[7] || "",
      timeframe: row[8] || "",
      confidence: row[9] || "",
      status: row[10] as any,
      reviewedBy: row[11] || "",
      reviewedAt: row[12] || "",
      scannedAt: row[13] || "",
    }));

    const isDuplicate = existing.some(
      e => e.emailSubject === scan.emailSubject &&
           e.suggestedAction === scan.suggestedAction &&
           e.type === scan.type
    );

    if (isDuplicate) {
      console.log(`Skipping duplicate scan result: ${scan.suggestedAction}`);
      return "";
    }

    const id = this.generateId("SCN");
    await this.appendRow("Email Scans", [
      id, scan.emailFrom, scan.emailSubject, scan.emailDate,
      scan.clientName, scan.type, scan.extractedQuote, scan.suggestedAction,
      scan.timeframe, scan.confidence, "Pending Review", "", "", scan.scannedAt,
    ]);
    return id;
  }

  async reviewEmailScan(id: string, action: "accept" | "edit" | "dismiss", reviewer: string, editedAction?: string): Promise<void> {
    const rowIndex = await this.findRowById("Email Scans", id);
    if (rowIndex === -1) throw new Error(`Scan result ${id} not found`);

    const statusMap = { accept: "Accepted", edit: "Edited & Accepted", dismiss: "Dismissed" };
    const now = new Date().toISOString();

    // Update status, reviewer, reviewed_at
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'Email Scans'!K${rowIndex + 1}:M${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[statusMap[action], reviewer, now]] },
    });

    // If accepted/edited, create an action item
    if (action === "accept" || action === "edit") {
      const scanRow = await this.getRowByIndex("Email Scans", rowIndex);
      await this.addActionItem({
        clientName: scanRow[4] || "Unknown",
        matter: "",
        title: editedAction || scanRow[7] || "",
        description: `From email: ${scanRow[2]} (${scanRow[1]})`,
        status: "Open",
        priority: parseFloat(scanRow[9] || "0") >= 0.9 ? "High" : "Medium",
        assignedTo: "",
        dueDate: "",
        source: "Email Scan",
        sourceDetail: `${scanRow[5]}: ${scanRow[6]}`,
        confidence: scanRow[9] || "",
      });
    }

    await this.logAudit("review", "email_scan", id, `${statusMap[action]} by ${reviewer}`);
  }

  // ─── Proactive Suggestions ────────────────────────────────────────────

  async addProactiveSuggestion(suggestion: Omit<SheetProactiveSuggestion, "id" | "status" | "reviewedBy" | "reviewedAt" | "createdAt">): Promise<string> {
    const id = this.generateId("PRO");
    const now = new Date().toISOString();
    await this.appendRow("Proactive Suggestions", [
      id, suggestion.clientName, suggestion.trigger, suggestion.suggestedActions,
      suggestion.source, suggestion.ruleName, suggestion.confidence,
      "Pending", "", "", now,
    ]);
    return id;
  }

  // ─── Helper Methods ───────────────────────────────────────────────────

  private async readTab<T>(tabName: string, mapper: (row: string[]) => T): Promise<T[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return []; // Only header row

    return rows.slice(1).map(row => mapper(row));
  }

  private async appendRow(tabName: string, values: any[]): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  }

  private async findRowById(tabName: string, id: string): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A:A`,
    });

    const column = response.data.values || [];
    for (let i = 1; i < column.length; i++) {
      if (column[i]?.[0] === id) return i + 1; // 1-based for Sheets
    }
    return -1;
  }

  private async getRowByIndex(tabName: string, rowIndex: number): Promise<string[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `'${tabName}'!A${rowIndex}:Z${rowIndex}`,
    });
    return (response.data.values || [])[0] || [];
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: string): Promise<void> {
    const now = new Date().toISOString();
    await this.appendRow("Audit Log", [now, "System", action, entityType, entityId, details]);
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${timestamp}-${random}`;
  }

  private colLetter(n: number): string {
    let result = "";
    while (n > 0) {
      n--;
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26);
    }
    return result;
  }
}

// ─── Orchestrator: Ties Everything Together ───────────────────────────────────

/**
 * Main orchestration function that connects Gmail → Gemini → Sheets.
 * Called by the scan scheduler on each interval.
 */
export async function runScanPipeline(
  gmailClient: any,           // GmailClient instance
  geminiScanner: any,          // GeminiEmailScanner instance
  sheetsLayer: SheetsDataLayer,
  knownClients: SheetClient[]
): Promise<{ emailsScanned: number; itemsFound: number; suggestionsFound: number }> {
  // 1. Fetch new emails
  const emails = await gmailClient.fetchNewEmailsSinceLastSync();
  if (emails.length === 0) {
    return { emailsScanned: 0, itemsFound: 0, suggestionsFound: 0 };
  }

  // 2. Run through Gemini scanner
  const scanResults = await geminiScanner.scanBatch(emails);

  let itemsFound = 0;
  let suggestionsFound = 0;

  // 3. Write results to Google Sheets
  for (const result of scanResults) {
    // Match client by email domain
    const senderDomain = result.emailFrom.split("@")[1]?.toLowerCase();
    const matchedClient = knownClients.find(c =>
      c.domain.toLowerCase() === senderDomain
    );

    // Write action items (client requests + attorney commitments)
    for (const item of result.actionItems) {
      await sheetsLayer.addEmailScanResult({
        emailFrom: result.emailFrom,
        emailSubject: result.emailSubject,
        emailDate: result.emailDate,
        clientName: matchedClient?.name || item.client || "Unknown",
        type: item.type === "client_request" ? "Client Request" : "Attorney Commitment",
        extractedQuote: item.sourceQuote,
        suggestedAction: item.description,
        timeframe: item.timeframe || "None specified",
        confidence: item.confidence.toFixed(2),
        scannedAt: result.scannedAt,
      });
      itemsFound++;
    }

    // Write proactive suggestions
    for (const suggestion of result.proactiveSuggestions) {
      await sheetsLayer.addProactiveSuggestion({
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

  return {
    emailsScanned: emails.length,
    itemsFound,
    suggestionsFound,
  };
}
