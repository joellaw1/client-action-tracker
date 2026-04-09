/**
 * Proactive Trigger Rules Engine
 *
 * Two-layer system:
 * 1. RULE-BASED: Firm-defined rules that fire on specific events/milestones
 * 2. AI-INFERRED: Gemini detects situations in email that imply follow-up work
 *
 * Rules encode institutional knowledge — what your firm always does when X happens.
 * AI inference catches what the rules don't — novel situations, unusual requests.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerRule {
  id: string;
  name: string;                        // e.g., "Entity Formation Completed"
  description: string;
  category: TriggerCategory;
  conditions: TriggerCondition[];      // ALL must match (AND logic)
  actions: SuggestedAction[];          // Tasks to suggest when triggered
  enabled: boolean;
  priority: "high" | "medium" | "low";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TriggerCategory =
  | "entity_formation"
  | "financing"
  | "contracts"
  | "compliance"
  | "employment"
  | "ma_transaction"
  | "intellectual_property"
  | "litigation_dispute"
  | "regulatory"
  | "general";

export interface TriggerCondition {
  type: "matter_type" | "milestone" | "keyword" | "date_proximity" | "email_pattern";
  field: string;
  operator: "equals" | "contains" | "matches" | "within_days";
  value: string | number;
}

export interface SuggestedAction {
  title: string;
  description: string;
  dueOffset?: {                         // Relative due date from trigger event
    days: number;
    business_days: boolean;
  };
  assignTo?: "joel" | "partner" | "auto"; // Auto = assign based on matter ownership
  priority: "high" | "medium" | "low";
  category: string;
}

export interface TriggeredSuggestion {
  ruleId: string;
  ruleName: string;
  clientId: string;
  matterId: string;
  triggeredBy: string;                   // What caused this to fire
  triggeredAt: string;
  suggestedActions: SuggestedAction[];
  status: "pending" | "accepted" | "dismissed";
}

// ─── Default Rules for Corporate/Transactional Practice ───────────────────────

export const DEFAULT_TRIGGER_RULES: Omit<TriggerRule, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Entity Formation Completed",
    description: "When a new entity (LLC, Corp, LP) is formed, suggest standard post-formation tasks",
    category: "entity_formation",
    conditions: [
      { type: "milestone", field: "status", operator: "equals", value: "formation_complete" },
    ],
    actions: [
      {
        title: "File Beneficial Ownership Information (BOI) report",
        description: "File FinCEN BOI report within 90 days of formation (30 days for entities formed after Jan 1, 2025)",
        dueOffset: { days: 30, business_days: false },
        priority: "high",
        category: "compliance",
      },
      {
        title: "Apply for EIN with IRS",
        description: "File Form SS-4 to obtain Employer Identification Number",
        dueOffset: { days: 7, business_days: true },
        priority: "high",
        category: "entity_formation",
      },
      {
        title: "Draft initial organizational resolutions",
        description: "Prepare consent of members/directors approving initial actions (officers, bank accounts, etc.)",
        dueOffset: { days: 14, business_days: true },
        priority: "medium",
        category: "entity_formation",
      },
      {
        title: "Confirm registered agent designation",
        description: "Verify registered agent is properly designated in formation state and any foreign qualification states",
        dueOffset: { days: 7, business_days: true },
        priority: "medium",
        category: "compliance",
      },
      {
        title: "Set annual report calendar reminder",
        description: "Create recurring reminder for state annual report filing deadline",
        dueOffset: { days: 14, business_days: true },
        priority: "low",
        category: "compliance",
      },
      {
        title: "Draft operating agreement / bylaws",
        description: "Prepare governing documents if not already done as part of formation",
        dueOffset: { days: 21, business_days: true },
        priority: "high",
        category: "entity_formation",
      },
    ],
    enabled: true,
    priority: "high",
    createdBy: "system",
  },
  {
    name: "Financing Round Closing",
    description: "When a client closes an equity financing round, suggest standard closing and post-closing tasks",
    category: "financing",
    conditions: [
      { type: "matter_type", field: "type", operator: "equals", value: "equity_financing" },
      { type: "milestone", field: "status", operator: "equals", value: "closing" },
    ],
    actions: [
      {
        title: "Prepare board resolutions authorizing share issuance",
        description: "Draft board consent approving the financing, share issuance, and related matters",
        dueOffset: { days: 0, business_days: false },
        priority: "high",
        category: "financing",
      },
      {
        title: "Update capitalization table",
        description: "Reflect new share issuance, any conversion of notes/SAFEs, and updated ownership percentages",
        dueOffset: { days: 3, business_days: true },
        priority: "high",
        category: "financing",
      },
      {
        title: "File amended certificate of incorporation",
        description: "If new share class created, file amended/restated charter with Secretary of State",
        dueOffset: { days: 5, business_days: true },
        priority: "high",
        category: "compliance",
      },
      {
        title: "Review existing investor side letters for MFN provisions",
        description: "Check whether existing investors have MFN rights triggered by new round terms",
        dueOffset: { days: 5, business_days: true },
        priority: "medium",
        category: "financing",
      },
      {
        title: "Update stock ledger and issue certificates/notices",
        description: "Record new share issuances in stock ledger; issue certificates or book-entry notices",
        dueOffset: { days: 7, business_days: true },
        priority: "medium",
        category: "financing",
      },
      {
        title: "Blue sky / securities filings",
        description: "File Form D with SEC and state securities notices as required",
        dueOffset: { days: 15, business_days: false },
        priority: "medium",
        category: "compliance",
      },
    ],
    enabled: true,
    priority: "high",
    createdBy: "system",
  },
  {
    name: "New Customer Contract Signed",
    description: "When a client executes a new customer/vendor contract, set up monitoring and follow-ups",
    category: "contracts",
    conditions: [
      { type: "matter_type", field: "type", operator: "equals", value: "commercial_contract" },
      { type: "milestone", field: "status", operator: "equals", value: "executed" },
    ],
    actions: [
      {
        title: "Set renewal/expiration calendar reminder",
        description: "Calendar the contract expiration date and any auto-renewal notice deadlines",
        dueOffset: { days: 3, business_days: true },
        priority: "medium",
        category: "contracts",
      },
      {
        title: "Calendar termination notice window",
        description: "Set reminder for the latest date client can give notice of non-renewal",
        dueOffset: { days: 3, business_days: true },
        priority: "medium",
        category: "contracts",
      },
      {
        title: "Verify insurance requirements met",
        description: "Confirm any required insurance coverage is in place per contract terms",
        dueOffset: { days: 7, business_days: true },
        priority: "low",
        category: "compliance",
      },
    ],
    enabled: true,
    priority: "medium",
    createdBy: "system",
  },
  {
    name: "M&A Transaction Initiated",
    description: "When a client begins an acquisition or merger, generate comprehensive pre-closing checklist",
    category: "ma_transaction",
    conditions: [
      { type: "matter_type", field: "type", operator: "equals", value: "ma_transaction" },
      { type: "milestone", field: "status", operator: "equals", value: "initiated" },
    ],
    actions: [
      {
        title: "Prepare due diligence request list",
        description: "Generate comprehensive due diligence checklist covering corporate, contracts, IP, employment, litigation, regulatory",
        dueOffset: { days: 3, business_days: true },
        priority: "high",
        category: "ma_transaction",
      },
      {
        title: "Assess Hart-Scott-Rodino requirements",
        description: "Determine whether HSR filing is required based on transaction size and party revenues",
        dueOffset: { days: 5, business_days: true },
        priority: "high",
        category: "regulatory",
      },
      {
        title: "Board approval resolutions",
        description: "Prepare board resolutions authorizing the transaction and related agreements",
        dueOffset: { days: 7, business_days: true },
        priority: "high",
        category: "ma_transaction",
      },
      {
        title: "Review third-party consent requirements",
        description: "Identify contracts, leases, and licenses that require consent for assignment or change of control",
        dueOffset: { days: 10, business_days: true },
        priority: "medium",
        category: "contracts",
      },
      {
        title: "Draft or review LOI / term sheet",
        description: "Prepare letter of intent or review counterparty's proposed terms",
        dueOffset: { days: 2, business_days: true },
        priority: "high",
        category: "ma_transaction",
      },
    ],
    enabled: true,
    priority: "high",
    createdBy: "system",
  },
  {
    name: "Annual Report Due (30-day warning)",
    description: "Proactive reminder when a client entity's annual report deadline is approaching",
    category: "compliance",
    conditions: [
      { type: "date_proximity", field: "annual_report_due", operator: "within_days", value: 30 },
    ],
    actions: [
      {
        title: "Prepare annual report filing",
        description: "Complete state annual report with current officers, directors, and registered agent",
        dueOffset: { days: 0, business_days: false },
        priority: "high",
        category: "compliance",
      },
      {
        title: "Confirm registered agent is current",
        description: "Verify registered agent designation is still accurate before filing",
        dueOffset: { days: 0, business_days: false },
        priority: "medium",
        category: "compliance",
      },
      {
        title: "Update officer/director information if changed",
        description: "Confirm any leadership changes are reflected in the filing",
        dueOffset: { days: 0, business_days: false },
        priority: "medium",
        category: "compliance",
      },
    ],
    enabled: true,
    priority: "medium",
    createdBy: "system",
  },
  {
    name: "New Hire / Offer Letter",
    description: "When a client is hiring, suggest employment-related legal documents",
    category: "employment",
    conditions: [
      { type: "keyword", field: "email_body", operator: "contains", value: "offer letter|new hire|onboarding" },
    ],
    actions: [
      {
        title: "Draft/review PIIA (Proprietary Information and Inventions Assignment)",
        description: "Ensure new employee signs invention assignment and confidentiality agreement",
        dueOffset: { days: 0, business_days: false },
        priority: "high",
        category: "employment",
      },
      {
        title: "Prepare equity grant documentation",
        description: "If equity is part of the offer, prepare stock option grant or RSU agreement",
        dueOffset: { days: 7, business_days: true },
        priority: "medium",
        category: "employment",
      },
      {
        title: "Review offer letter for compliance",
        description: "Confirm offer letter terms comply with applicable employment laws",
        dueOffset: { days: 0, business_days: false },
        priority: "medium",
        category: "employment",
      },
    ],
    enabled: true,
    priority: "medium",
    createdBy: "system",
  },
];

// ─── Trigger Engine ───────────────────────────────────────────────────────────

export class TriggerEngine {
  private rules: TriggerRule[];

  constructor(rules?: TriggerRule[]) {
    this.rules = rules || this.initializeDefaultRules();
  }

  private initializeDefaultRules(): TriggerRule[] {
    return DEFAULT_TRIGGER_RULES.map((rule, index) => ({
      ...rule,
      id: `rule_${index + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  /**
   * Evaluate all rules against a matter event and return triggered suggestions
   */
  evaluateEvent(event: {
    clientId: string;
    matterId: string;
    matterType: string;
    milestone: string;
    metadata?: Record<string, any>;
  }): TriggeredSuggestion[] {
    const suggestions: TriggeredSuggestion[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matches = rule.conditions.every(condition => {
        switch (condition.type) {
          case "matter_type":
            return this.matchCondition(event.matterType, condition.operator, condition.value);
          case "milestone":
            return this.matchCondition(event.milestone, condition.operator, condition.value);
          case "keyword":
            return this.matchCondition(
              event.metadata?.[condition.field] || "",
              condition.operator,
              condition.value
            );
          case "date_proximity":
            if (event.metadata?.[condition.field]) {
              const targetDate = new Date(event.metadata[condition.field]);
              const now = new Date();
              const daysUntil = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
              return daysUntil <= (condition.value as number) && daysUntil >= 0;
            }
            return false;
          default:
            return false;
        }
      });

      if (matches) {
        suggestions.push({
          ruleId: rule.id,
          ruleName: rule.name,
          clientId: event.clientId,
          matterId: event.matterId,
          triggeredBy: `${rule.name} — milestone: ${event.milestone}`,
          triggeredAt: new Date().toISOString(),
          suggestedActions: rule.actions,
          status: "pending",
        });
      }
    }

    return suggestions;
  }

  /**
   * Merge AI-inferred suggestions with rule-based suggestions, deduplicating
   */
  mergeWithAiSuggestions(
    ruleSuggestions: TriggeredSuggestion[],
    aiSuggestions: { trigger: string; suggestedActions: string[]; confidence: number; client: string | null }[]
  ): TriggeredSuggestion[] {
    const merged = [...ruleSuggestions];

    for (const aiSugg of aiSuggestions) {
      // Check if any rule already covers this
      const alreadyCovered = ruleSuggestions.some(rs =>
        rs.suggestedActions.some(sa =>
          aiSugg.suggestedActions.some(
            aiAction => this.stringSimilarity(sa.title.toLowerCase(), aiAction.toLowerCase()) > 0.7
          )
        )
      );

      if (!alreadyCovered) {
        merged.push({
          ruleId: "ai_inferred",
          ruleName: `AI-Detected: ${aiSugg.trigger}`,
          clientId: aiSugg.client || "unknown",
          matterId: "auto",
          triggeredBy: aiSugg.trigger,
          triggeredAt: new Date().toISOString(),
          suggestedActions: aiSugg.suggestedActions.map(action => ({
            title: action,
            description: `AI-suggested based on: ${aiSugg.trigger}`,
            priority: "medium" as const,
            category: "ai_inferred",
          })),
          status: "pending",
        });
      }
    }

    return merged;
  }

  private matchCondition(
    actual: string,
    operator: string,
    expected: string | number
  ): boolean {
    const actualStr = String(actual).toLowerCase();
    const expectedStr = String(expected).toLowerCase();

    switch (operator) {
      case "equals":
        return actualStr === expectedStr;
      case "contains":
        // Support pipe-separated alternatives: "offer letter|new hire|onboarding"
        return expectedStr.split("|").some(term => actualStr.includes(term.trim()));
      case "matches":
        try {
          return new RegExp(expectedStr, "i").test(actualStr);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    const editDist = this.levenshtein(longer, shorter);
    return (longer.length - editDist) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  // ─── Rule CRUD ────────────────────────────────────────────────────────

  addRule(rule: Omit<TriggerRule, "id" | "createdAt" | "updatedAt">): TriggerRule {
    const newRule: TriggerRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rules.push(newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<TriggerRule>): TriggerRule | null {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return null;
    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.rules[index];
  }

  toggleRule(id: string): boolean {
    const rule = this.rules.find(r => r.id === id);
    if (!rule) return false;
    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date().toISOString();
    return true;
  }

  deleteRule(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== id);
    return this.rules.length < before;
  }

  getRules(): TriggerRule[] {
    return [...this.rules];
  }

  getRule(id: string): TriggerRule | undefined {
    return this.rules.find(r => r.id === id);
  }
}
