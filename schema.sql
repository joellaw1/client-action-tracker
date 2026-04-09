-- ActionTracker Database Schema
-- PostgreSQL (recommended for production) or SQLite (for MVP/local dev)
--
-- Security: All tables include audit fields (created_by, updated_at).
-- Row-level security can be added for multi-tenant deployments.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'attorney',  -- attorney, admin, paralegal
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Clients ──────────────────────────────────────────────────────────────────
CREATE TABLE clients (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name            TEXT NOT NULL,
    type            TEXT,                               -- "Private Equity", "Life Sciences", etc.
    domain          TEXT,                               -- Email domain for auto-matching
    clio_id         TEXT,                               -- Clio integration ID
    notes           TEXT,
    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_domain ON clients(domain);
CREATE INDEX idx_clients_clio_id ON clients(clio_id);

-- ─── Matters ──────────────────────────────────────────────────────────────────
CREATE TABLE matters (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id       TEXT NOT NULL REFERENCES clients(id),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,                      -- entity_formation, equity_financing, commercial_contract, etc.
    status          TEXT NOT NULL DEFAULT 'active',     -- active, closed, on_hold
    clio_id         TEXT,
    opened_at       TIMESTAMP DEFAULT NOW(),
    closed_at       TIMESTAMP,
    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matters_client ON matters(client_id);
CREATE INDEX idx_matters_status ON matters(status);

-- ─── Action Items ─────────────────────────────────────────────────────────────
CREATE TABLE action_items (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id       TEXT NOT NULL REFERENCES clients(id),
    matter_id       TEXT REFERENCES matters(id),
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'open',       -- open, in_progress, completed, overdue
    priority        TEXT NOT NULL DEFAULT 'medium',     -- high, medium, low
    assigned_to     TEXT REFERENCES users(id),
    due_date        DATE,
    completed_at    TIMESTAMP,

    -- Source tracking
    source          TEXT NOT NULL DEFAULT 'manual',     -- manual, email, trigger, clio
    source_email_id TEXT,                               -- Gmail message ID if from email scan
    source_rule_id  TEXT,                               -- Trigger rule ID if from trigger engine
    confidence      REAL,                               -- AI confidence score (0-1) if AI-generated

    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_items_client ON action_items(client_id);
CREATE INDEX idx_items_status ON action_items(status);
CREATE INDEX idx_items_assigned ON action_items(assigned_to);
CREATE INDEX idx_items_due ON action_items(due_date);

-- ─── Email Scan Results ───────────────────────────────────────────────────────
-- Stores raw scan output before human review
CREATE TABLE email_scan_results (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email_id        TEXT NOT NULL,                      -- Gmail message ID
    thread_id       TEXT NOT NULL,                      -- Gmail thread ID
    email_from      TEXT NOT NULL,
    email_subject   TEXT NOT NULL,
    email_date      TIMESTAMP NOT NULL,

    -- Extraction results
    extraction_type TEXT NOT NULL,                      -- client_request, attorney_commitment, proactive_trigger
    extracted_text  TEXT NOT NULL,                       -- The quote that triggered extraction
    suggested_action TEXT NOT NULL,
    timeframe       TEXT,
    confidence      REAL NOT NULL,
    reasoning       TEXT,

    -- Review status
    status          TEXT NOT NULL DEFAULT 'pending',    -- pending, accepted, edited, dismissed
    reviewed_by     TEXT REFERENCES users(id),
    reviewed_at     TIMESTAMP,
    action_item_id  TEXT REFERENCES action_items(id),   -- Links to created action item if accepted

    -- Auto-matched client
    matched_client_id TEXT REFERENCES clients(id),
    matched_matter_id TEXT REFERENCES matters(id),

    scanned_at      TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scan_status ON email_scan_results(status);
CREATE INDEX idx_scan_email ON email_scan_results(email_id);
CREATE INDEX idx_scan_thread ON email_scan_results(thread_id);
CREATE UNIQUE INDEX idx_scan_dedup ON email_scan_results(thread_id, extraction_type, suggested_action);

-- ─── Proactive Suggestions ────────────────────────────────────────────────────
CREATE TABLE proactive_suggestions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id       TEXT REFERENCES clients(id),
    matter_id       TEXT REFERENCES matters(id),
    source          TEXT NOT NULL,                      -- rule_based, ai_inferred
    rule_id         TEXT,                               -- Trigger rule ID if rule-based
    trigger_description TEXT NOT NULL,
    suggested_actions JSONB NOT NULL,                   -- Array of suggested action objects
    confidence      REAL,

    -- Review status
    status          TEXT NOT NULL DEFAULT 'pending',    -- pending, partially_accepted, accepted, dismissed
    reviewed_by     TEXT REFERENCES users(id),
    reviewed_at     TIMESTAMP,

    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_proactive_status ON proactive_suggestions(status);
CREATE INDEX idx_proactive_client ON proactive_suggestions(client_id);

-- ─── Trigger Rules ────────────────────────────────────────────────────────────
CREATE TABLE trigger_rules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,
    conditions      JSONB NOT NULL,                     -- Array of condition objects
    actions         JSONB NOT NULL,                     -- Array of suggested action templates
    enabled         BOOLEAN NOT NULL DEFAULT true,
    priority        TEXT NOT NULL DEFAULT 'medium',
    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Email Sync State ─────────────────────────────────────────────────────────
CREATE TABLE email_sync_state (
    user_id         TEXT PRIMARY KEY REFERENCES users(id),
    last_history_id TEXT,
    last_sync_at    TIMESTAMP,
    emails_processed INTEGER DEFAULT 0
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
-- Track all significant actions for compliance
CREATE TABLE audit_log (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT REFERENCES users(id),
    action          TEXT NOT NULL,                      -- create, update, delete, review, scan, login
    entity_type     TEXT NOT NULL,                      -- action_item, client, matter, scan_result, etc.
    entity_id       TEXT,
    details         JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_time ON audit_log(created_at);
