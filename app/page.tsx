"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string; name: string; type: string; domain: string;
  primaryContact: string; clioId: string; notes: string;
}
interface ActionItem {
  id: string; clientName: string; matter: string; title: string;
  description: string; status: string; priority: string; assignedTo: string;
  dueDate: string; source: string; sourceDetail: string; confidence: string;
  createdAt: string; completedAt: string;
}
interface EmailScan {
  id: string; emailFrom: string; emailSubject: string; emailDate: string;
  clientName: string; type: string; extractedQuote: string;
  suggestedAction: string; timeframe: string; confidence: string;
  status: string; reviewedBy: string; reviewedAt: string; scannedAt: string;
}

type Page = "dashboard" | "clients" | "items" | "scanner" | "triggers" | "settings";

// ─── Icons (inline SVG to avoid import issues) ───────────────────────────────

const Icon = ({ d, className = "" }: { d: string; className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  clients: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M12 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0z M16 3.13a4 4 0 0 1 0 7.75",
  items: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  scanner: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  triggers: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plus: "M12 5v14 M5 12h14",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18 M6 6l12 12",
  refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
  chevron: "M9 18l6-6-6-6",
  search: "M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z M16 16l4.5 4.5",
};

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700", blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700", purple: "bg-purple-50 text-purple-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c[color] || c.gray}`}>{children}</span>;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

async function postApi<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({
  items, scans, onNavigate, onScan, scanning
}: {
  items: ActionItem[]; scans: EmailScan[]; onNavigate: (p: Page) => void;
  onScan: () => void; scanning: boolean;
}) {
  const overdue = items.filter(i => i.status === "Overdue");
  const open = items.filter(i => i.status !== "Completed");
  const pending = scans.filter(s => s.status === "Pending Review");
  const dueThisWeek = items.filter(i => {
    if (!i.dueDate || i.status === "Completed") return false;
    const d = new Date(i.dueDate);
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (5 - end.getDay()));
    return d >= now && d <= end;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button onClick={onScan} disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scanning ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          <Icon d={icons.refresh} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning..." : "Scan Email Now"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Items", value: open.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Due This Week", value: dueThisWeek.length, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Overdue", value: overdue.length, color: "text-red-600", bg: "bg-red-50" },
          { label: "Email Suggestions", value: pending.length, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
            <Icon d={icons.alert} className="text-red-600" /> Overdue
          </h3>
          {overdue.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 mb-2 last:mb-0 border border-red-100">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.clientName} · Due {item.dueDate}</p>
              </div>
              <Badge color="red">Overdue</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pending Email Scans */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Icon d={icons.scanner} className="text-purple-600" /> Email-Detected Items
              <Badge color="purple">{pending.length}</Badge>
            </h3>
            <button onClick={() => onNavigate("scanner")} className="text-sm text-blue-600 hover:text-blue-800">View all →</button>
          </div>
          {pending.slice(0, 4).map(s => (
            <div key={s.id} className="p-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge color={s.type === "Client Request" ? "blue" : "amber"}>{s.type}</Badge>
                <span className="text-xs text-gray-400">{Math.round(parseFloat(s.confidence) * 100)}%</span>
              </div>
              <p className="font-medium text-gray-900">{s.suggestedAction}</p>
              <p className="text-sm text-gray-500">{s.clientName} · {s.timeframe}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent action items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Action Items</h3>
          <button onClick={() => onNavigate("items")} className="text-sm text-blue-600 hover:text-blue-800">View all →</button>
        </div>
        {items.slice(0, 6).map(item => (
          <div key={item.id} className="p-4 border-b border-gray-50 last:border-0 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500">{item.clientName} · {item.assignedTo} · {item.dueDate}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={item.source === "Email Scan" ? "purple" : item.source === "AI Trigger" ? "green" : "gray"}>
                {item.source}
              </Badge>
              <Badge color={item.status === "Overdue" ? "red" : item.status === "In Progress" ? "amber" : item.status === "Completed" ? "green" : "blue"}>
                {item.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Action Items Page ────────────────────────────────────────────────────────

function ActionItemsPage({ items, onStatusChange }: {
  items: ActionItem[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const filtered = items.filter(i => {
    if (filter !== "all" && i.status !== filter) return false;
    if (assignee !== "all" && i.assignedTo !== assignee) return false;
    return true;
  });

  const assignees = [...new Set(items.map(i => i.assignedTo).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Action Items</h1>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[["all", "All"], ["Open", "Open"], ["In Progress", "Active"], ["Overdue", "Overdue"], ["Completed", "Done"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {assignees.length > 0 && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setAssignee("all")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${assignee === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
              Everyone
            </button>
            {assignees.map(a => (
              <button key={a} onClick={() => setAssignee(a)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${assignee === a ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {filtered.length === 0 && <p className="p-8 text-center text-gray-400">No items match your filters</p>}
        {filtered.map(item => (
          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.priority === "High" && <Badge color="red">High</Badge>}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                  <span>{item.clientName}</span>
                  {item.assignedTo && <span>· {item.assignedTo}</span>}
                  {item.dueDate && <span>· Due {item.dueDate}</span>}
                  {item.matter && <span>· {item.matter}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Badge color={item.source === "Email Scan" ? "purple" : item.source === "AI Trigger" ? "green" : "gray"}>
                  {item.source}
                </Badge>
                <select
                  value={item.status}
                  onChange={(e) => onStatusChange(item.id, e.target.value)}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1"
                >
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Overdue</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scanner Page ─────────────────────────────────────────────────────────────

function ScannerPage({ scans, onReview, onScan, scanning }: {
  scans: EmailScan[];
  onReview: (id: string, action: "accept" | "dismiss") => void;
  onScan: () => void;
  scanning: boolean;
}) {
  const pending = scans.filter(s => s.status === "Pending Review");
  const reviewed = scans.filter(s => s.status !== "Pending Review");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Scanner</h1>
          <p className="text-gray-500 mt-1">Gemini-powered email analysis</p>
        </div>
        <button onClick={onScan} disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scanning ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          <Icon d={icons.refresh} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Config summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Scanner Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Client requests</div>
            <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Attorney commitments</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Proactive triggers</div>
          </div>
          <div>
            <p>Model: <strong>Gemini 2.5 Pro</strong></p>
            <p>Min confidence: <strong>75%</strong></p>
            <p>Total scanned: <strong>{scans.length} items</strong></p>
          </div>
        </div>
      </div>

      {/* Pending Review */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Pending Review <Badge color="purple">{pending.length}</Badge></h3>
        </div>
        {pending.length === 0 && <p className="p-8 text-center text-gray-400">No pending items — run a scan to check for new emails</p>}
        {pending.map(s => (
          <div key={s.id} className="p-4 border-b border-gray-50 last:border-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={s.type === "Client Request" ? "blue" : s.type === "Attorney Commitment" ? "amber" : "green"}>
                    {s.type}
                  </Badge>
                  <Badge color={parseFloat(s.confidence) >= 0.9 ? "green" : "amber"}>
                    {Math.round(parseFloat(s.confidence) * 100)}%
                  </Badge>
                </div>
                <p className="font-medium text-gray-900 mt-1">{s.suggestedAction}</p>
                <p className="text-sm text-gray-600">{s.clientName} · {s.timeframe}</p>
                <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500">From: {s.emailFrom} · {s.emailSubject}</p>
                  <p className="text-sm text-gray-700 italic mt-0.5">{s.extractedQuote}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-4">
                <button onClick={() => onReview(s.id, "accept")}
                  className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 font-medium">
                  Accept
                </button>
                <button onClick={() => onReview(s.id, "dismiss")}
                  className="px-3 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 font-medium">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Already reviewed */}
      {reviewed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Previously Reviewed</h3>
          </div>
          {reviewed.slice(0, 10).map(s => (
            <div key={s.id} className="p-3 border-b border-gray-50 last:border-0 flex items-center justify-between text-sm">
              <div>
                <p className="text-gray-700">{s.suggestedAction}</p>
                <p className="text-xs text-gray-400">{s.clientName} · {s.emailSubject}</p>
              </div>
              <Badge color={s.status === "Accepted" ? "green" : s.status === "Dismissed" ? "gray" : "blue"}>{s.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: icons.dashboard },
  { id: "clients", label: "Clients", icon: icons.clients },
  { id: "items", label: "Action Items", icon: icons.items },
  { id: "scanner", label: "Email Scanner", icon: icons.scanner },
  { id: "triggers", label: "Trigger Rules", icon: icons.triggers },
  { id: "settings", label: "Settings", icon: icons.settings },
];

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [scans, setScans] = useState<EmailScan[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useDemo, setUseDemo] = useState(false);

  // Load data from API (falls back to demo mode if API not configured)
  const loadData = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([
        fetchApi<{ clients: Client[] }>("/api/clients"),
        fetchApi<{ items: ActionItem[] }>("/api/action-items"),
      ]);
      setClients(c.clients);
      setItems(i.items);
    } catch {
      // API not configured yet — show demo mode notice
      setUseDemo(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await postApi("/api/scan", {});
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleReview = async (id: string, action: "accept" | "dismiss") => {
    try {
      await postApi("/api/scan/review", { id, action, reviewer: "Joel" });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">ActionTracker</p>
              <p className="text-xs text-gray-500">Paradox Principals</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                page === n.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon d={n.icon} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">JC</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Joel Cohen</p>
              <p className="text-xs text-gray-500">joel@paradoxprincipals.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {/* Demo mode banner */}
          {useDemo && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
              <p className="text-sm text-amber-800">
                <strong>Setup needed:</strong> Copy <code className="bg-amber-100 px-1 rounded">env.example</code> to <code className="bg-amber-100 px-1 rounded">.env.local</code> and add your Google API credentials. See SETUP.md for details.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {page === "dashboard" && <Dashboard items={items} scans={scans} onNavigate={setPage} onScan={handleScan} scanning={scanning} />}
          {page === "items" && <ActionItemsPage items={items} onStatusChange={handleStatusChange} />}
          {page === "scanner" && <ScannerPage scans={scans} onReview={handleReview} onScan={handleScan} scanning={scanning} />}
          {page === "clients" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
              {clients.length === 0 && <p className="text-gray-500">No clients yet. Add clients to the Google Sheet or use the API.</p>}
              <div className="space-y-2">
                {clients.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <p className="text-sm text-gray-500">{c.type} · {c.domain}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {page === "triggers" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Trigger Rules</h1>
              <p className="text-gray-500">Pre-configured rules for corporate/transactional practice. These fire when the AI detects matching situations in your email.</p>
              <div className="space-y-3">
                {["Entity Formation Completed", "Financing Round Closing", "New Customer Contract Signed", "M&A Transaction Initiated", "Annual Report Due", "New Hire / Offer Letter"].map((rule, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h3 className="font-semibold text-gray-900">{rule}</h3>
                      <Badge color="green">Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {page === "settings" && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Gmail access</span><Badge color="green">Read-only</Badge>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">AI model</span><span className="text-gray-900 font-medium">Gemini 2.5 Pro</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Data storage</span><span className="text-gray-900 font-medium">Google Sheets</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-600">Proactive triggers</span><Badge color="green">Enabled</Badge>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">AI data retention</span><Badge color="green">None (API mode)</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
