import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Mail, Bell, CheckCircle, Clock, AlertTriangle, ChevronRight, Filter, Settings, Users, FileText, Zap, BarChart3, Shield, Eye, Check, X, ArrowRight, Calendar, User, Building2, Tag, MessageSquare, Sparkles, RefreshCw, ExternalLink } from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const CLIENTS = [
  { id: 1, name: "Meridian Holdings LLC", type: "Private Equity", matters: 3, openItems: 5, risk: "medium" },
  { id: 2, name: "Apex BioSciences Inc.", type: "Life Sciences", matters: 2, openItems: 8, risk: "high" },
  { id: 3, name: "Greenfield Ventures", type: "Real Estate", matters: 1, openItems: 2, risk: "low" },
  { id: 4, name: "TechBridge Solutions", type: "SaaS / Tech", matters: 4, openItems: 6, risk: "medium" },
  { id: 5, name: "Coastal Capital Group", type: "Financial Services", matters: 2, openItems: 3, risk: "low" },
];

const ACTION_ITEMS = [
  { id: 1, clientId: 2, title: "Draft Series B term sheet revisions", assignee: "Joel", due: "2026-04-11", status: "in_progress", priority: "high", source: "email", matter: "Series B Financing" },
  { id: 2, clientId: 1, title: "File annual report with Secretary of State", assignee: "Partner", due: "2026-04-15", status: "open", priority: "medium", source: "trigger", matter: "Entity Maintenance" },
  { id: 3, clientId: 4, title: "Review SaaS subscription agreement redline from customer", assignee: "Joel", due: "2026-04-12", status: "open", priority: "high", source: "email", matter: "Customer Contracts" },
  { id: 4, clientId: 2, title: "Prepare board resolutions for new financing round", assignee: "Partner", due: "2026-04-18", status: "open", priority: "medium", source: "trigger", matter: "Series B Financing" },
  { id: 5, clientId: 3, title: "Send updated operating agreement to Greenfield", assignee: "Joel", due: "2026-04-10", status: "in_progress", priority: "high", source: "manual", matter: "Entity Formation" },
  { id: 6, clientId: 1, title: "Beneficial ownership information report (BOI)", assignee: "Joel", due: "2026-04-30", status: "open", priority: "medium", source: "trigger", matter: "Entity Maintenance" },
  { id: 7, clientId: 4, title: "Negotiate MSA with enterprise prospect", assignee: "Partner", due: "2026-04-20", status: "open", priority: "medium", source: "email", matter: "Customer Contracts" },
  { id: 8, clientId: 5, title: "Update fund formation docs per new SEC guidance", assignee: "Joel", due: "2026-04-25", status: "open", priority: "low", source: "trigger", matter: "Fund Formation" },
  { id: 9, clientId: 2, title: "Send investor side letter to lead investor counsel", assignee: "Joel", due: "2026-04-09", status: "overdue", priority: "high", source: "email", matter: "Series B Financing" },
  { id: 10, clientId: 1, title: "Draft amendment to operating agreement", assignee: "Partner", due: "2026-04-22", status: "open", priority: "low", source: "manual", matter: "Entity Maintenance" },
];

const EMAIL_SUGGESTIONS = [
  {
    id: 101, clientId: 2, emailFrom: "sarah.chen@apexbio.com", emailSubject: "RE: Series B - Updated timeline",
    extractedText: "\"Can you have the revised term sheet back to us by Friday?\"",
    suggestedAction: "Revise Series B term sheet and return to client by April 11",
    timeframe: "By Friday, April 11", confidence: 0.95, type: "client_request", scannedAt: "2026-04-09T08:30:00",
    status: "pending"
  },
  {
    id: 102, clientId: 4, emailFrom: "mike.r@techbridge.io", emailSubject: "Fwd: Acme Corp wants to move forward",
    extractedText: "\"We just got verbal approval from Acme — they want a 3-year enterprise deal. Can you draft something?\"",
    suggestedAction: "Draft enterprise MSA for TechBridge / Acme Corp deal",
    timeframe: "No specific deadline — client implied urgency", confidence: 0.88, type: "client_request", scannedAt: "2026-04-09T07:15:00",
    status: "pending"
  },
  {
    id: 103, clientId: 1, emailFrom: "joel@paradoxprincipals.com", emailSubject: "RE: Meridian subsidiary question",
    extractedText: "\"I'll get you the amended operating agreement by end of next week.\"",
    suggestedAction: "Deliver amended operating agreement to Meridian Holdings",
    timeframe: "By end of next week (April 17)", confidence: 0.92, type: "attorney_commitment", scannedAt: "2026-04-08T16:45:00",
    status: "pending"
  },
  {
    id: 104, clientId: 5, emailFrom: "david.p@coastalcap.com", emailSubject: "New fund structure question",
    extractedText: "\"We're thinking about launching a second fund — possibly a different structure. Can we set up a call?\"",
    suggestedAction: "Schedule call with Coastal Capital re: Fund II structure",
    timeframe: "No deadline — exploratory", confidence: 0.82, type: "client_request", scannedAt: "2026-04-09T09:00:00",
    status: "pending"
  },
];

const PROACTIVE_TRIGGERS = [
  {
    id: 201, clientId: 2, source: "email_context",
    trigger: "Client mentioned closing Series B financing round",
    suggestions: [
      "Prepare board resolutions authorizing new share issuance",
      "Update cap table and stock ledger",
      "Draft investor rights agreement amendments",
      "File amended certificate of incorporation (if new share class)",
      "Review existing investor side letters for MFN provisions",
    ],
    confidence: 0.91, scannedAt: "2026-04-09T08:30:00", status: "pending"
  },
  {
    id: 202, clientId: 3, source: "email_context",
    trigger: "New LLC entity formation completed last month",
    suggestions: [
      "Apply for EIN with IRS",
      "File beneficial ownership information (BOI) report",
      "Draft initial resolutions / consent of members",
      "Set up annual report reminder (state-specific deadline)",
      "Confirm registered agent designation",
    ],
    confidence: 0.94, scannedAt: "2026-04-08T14:00:00", status: "pending"
  },
  {
    id: 203, clientId: 4, source: "email_context",
    trigger: "Client entering enterprise sales — mentions \"3-year deal\" with Acme Corp",
    suggestions: [
      "Review existing MSA template for enterprise-tier provisions",
      "Add data processing addendum (DPA) for enterprise compliance",
      "Consider SLA commitments and liability cap adjustments",
      "Draft mutual NDA if not already in place with Acme",
    ],
    confidence: 0.87, scannedAt: "2026-04-09T07:15:00", status: "pending"
  },
];

const TRIGGER_RULES = [
  { id: 1, event: "Entity Formation Completed", actions: ["File BOI report", "Apply for EIN", "Draft initial resolutions", "Set annual report reminder"], active: true },
  { id: 2, event: "Financing Round Closing", actions: ["Board resolutions", "Update cap table", "Amend certificate of incorporation", "Review side letters"], active: true },
  { id: 3, event: "New Customer Contract Signed", actions: ["Set renewal reminder", "Calendar termination notice window", "Check insurance requirements"], active: true },
  { id: 4, event: "Annual Report Due (30 days)", actions: ["Prepare annual report", "Confirm registered agent", "Update officer/director information"], active: true },
  { id: 5, event: "M&A Transaction Initiated", actions: ["Due diligence checklist", "Board approval resolutions", "Hart-Scott-Rodino assessment", "Third-party consents review"], active: true },
  { id: 6, event: "New Hire / Offer Letter Sent", actions: ["PIIA / invention assignment", "Equity grant documentation", "Benefits enrollment reminder"], active: false },
];

// ─── Utility Components ───────────────────────────────────────────────────────
const Badge = ({ children, color = "gray" }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, trend, color = "blue" }) => {
  const bgColors = { blue: "bg-blue-50", amber: "bg-amber-50", red: "bg-red-50", green: "bg-emerald-50", purple: "bg-purple-50" };
  const iconColors = { blue: "text-blue-600", amber: "text-amber-600", red: "text-red-600", green: "text-emerald-600", purple: "text-purple-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${bgColors[color]}`}>
          <Icon size={20} className={iconColors[color]} />
        </div>
      </div>
    </div>
  );
};

// ─── Page Components ──────────────────────────────────────────────────────────

const DashboardPage = ({ setPage, setSelectedClient }) => {
  const overdue = ACTION_ITEMS.filter(i => i.status === "overdue").length;
  const dueThisWeek = ACTION_ITEMS.filter(i => {
    const d = new Date(i.due);
    const now = new Date("2026-04-09");
    const weekEnd = new Date("2026-04-13");
    return d >= now && d <= weekEnd && i.status !== "completed";
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Wednesday, April 9, 2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Open Items" value={ACTION_ITEMS.filter(i => i.status !== "completed").length} icon={FileText} color="blue" trend="Across all clients" />
        <StatCard label="Due This Week" value={dueThisWeek} icon={Clock} color="amber" trend="Through Friday" />
        <StatCard label="Overdue" value={overdue} icon={AlertTriangle} color="red" trend="Needs attention" />
        <StatCard label="Email Suggestions" value={EMAIL_SUGGESTIONS.filter(s => s.status === "pending").length} icon={Mail} color="purple" trend="Awaiting review" />
        <StatCard label="Proactive Alerts" value={PROACTIVE_TRIGGERS.filter(t => t.status === "pending").length} icon={Sparkles} color="green" trend="AI-detected" />
      </div>

      {/* Overdue / Urgent */}
      {overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-semibold text-red-900">Overdue Items</h3>
          </div>
          {ACTION_ITEMS.filter(i => i.status === "overdue").map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{CLIENTS.find(c => c.id === item.clientId)?.name} · Due {item.due}</p>
              </div>
              <Badge color="red">Overdue</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Email Suggestions Preview */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-purple-600" />
            <h3 className="font-semibold text-gray-900">Email-Detected Action Items</h3>
            <Badge color="purple">{EMAIL_SUGGESTIONS.filter(s => s.status === "pending").length} pending</Badge>
          </div>
          <button onClick={() => setPage("scanner")} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {EMAIL_SUGGESTIONS.filter(s => s.status === "pending").slice(0, 3).map(s => (
            <div key={s.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={s.type === "client_request" ? "blue" : "amber"}>
                      {s.type === "client_request" ? "Client Request" : "Your Commitment"}
                    </Badge>
                    <span className="text-xs text-gray-400">{Math.round(s.confidence * 100)}% confidence</span>
                  </div>
                  <p className="font-medium text-gray-900">{s.suggestedAction}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{CLIENTS.find(c => c.id === s.clientId)?.name} · {s.timeframe}</p>
                  <p className="text-xs text-gray-400 mt-1 italic">{s.extractedText}</p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Accept">
                    <Check size={16} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Dismiss">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proactive Triggers Preview */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Proactive Suggestions</h3>
            <Badge color="green">{PROACTIVE_TRIGGERS.filter(t => t.status === "pending").length} new</Badge>
          </div>
          <button onClick={() => setPage("triggers")} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            Manage rules <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {PROACTIVE_TRIGGERS.filter(t => t.status === "pending").slice(0, 2).map(t => (
            <div key={t.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-medium text-gray-700">{t.trigger}</p>
                <span className="text-xs text-gray-400">{Math.round(t.confidence * 100)}%</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{CLIENTS.find(c => c.id === t.clientId)?.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.suggestions.slice(0, 3).map((s, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs">
                    <Plus size={10} className="mr-1" />{s}
                  </span>
                ))}
                {t.suggestions.length > 3 && (
                  <span className="text-xs text-gray-400 self-center">+{t.suggestions.length - 3} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ClientsPage = ({ setPage, setSelectedClient }) => {
  const [search, setSearch] = useState("");
  const filtered = CLIENTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map(client => {
          const items = ACTION_ITEMS.filter(i => i.clientId === client.id);
          const overdueCount = items.filter(i => i.status === "overdue").length;
          const emailSuggCount = EMAIL_SUGGESTIONS.filter(s => s.clientId === client.id && s.status === "pending").length;
          const proactiveCount = PROACTIVE_TRIGGERS.filter(t => t.clientId === client.id && t.status === "pending").length;

          return (
            <div
              key={client.id}
              onClick={() => { setSelectedClient(client); setPage("client-detail"); }}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-500">{client.type} · {client.matters} matters</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {overdueCount > 0 && <Badge color="red">{overdueCount} overdue</Badge>}
                  {emailSuggCount > 0 && <Badge color="purple">{emailSuggCount} email</Badge>}
                  {proactiveCount > 0 && <Badge color="green">{proactiveCount} proactive</Badge>}
                  <Badge color={client.openItems > 5 ? "amber" : "blue"}>{client.openItems} open</Badge>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClientDetailPage = ({ client, setPage }) => {
  if (!client) return null;
  const items = ACTION_ITEMS.filter(i => i.clientId === client.id);
  const suggestions = EMAIL_SUGGESTIONS.filter(s => s.clientId === client.id);
  const triggers = PROACTIVE_TRIGGERS.filter(t => t.clientId === client.id);

  const statusColors = { open: "blue", in_progress: "amber", overdue: "red", completed: "green" };
  const statusLabels = { open: "Open", in_progress: "In Progress", overdue: "Overdue", completed: "Done" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => setPage("clients")} className="hover:text-blue-600">Clients</button>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{client.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 size={24} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-500">{client.type} · {client.matters} active matters</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus size={16} /> Add Action Item
        </button>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Action Items</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {items.map(item => (
            <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    {item.priority === "high" && <Badge color="red">High</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><User size={12} />{item.assignee}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />{item.due}</span>
                    <span className="flex items-center gap-1"><Tag size={12} />{item.matter}</span>
                    <Badge color={item.source === "email" ? "purple" : item.source === "trigger" ? "green" : "gray"}>
                      {item.source === "email" ? "From Email" : item.source === "trigger" ? "AI Triggered" : "Manual"}
                    </Badge>
                  </div>
                </div>
                <Badge color={statusColors[item.status]}>{statusLabels[item.status]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Suggestions for this client */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200">
          <div className="p-4 border-b border-purple-100 flex items-center gap-2">
            <Mail size={18} className="text-purple-600" />
            <h3 className="font-semibold text-gray-900">Pending Email Suggestions</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {suggestions.map(s => (
              <div key={s.id} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={s.type === "client_request" ? "blue" : "amber"}>
                    {s.type === "client_request" ? "Client Request" : "Your Commitment"}
                  </Badge>
                  <span className="text-xs text-gray-400">{Math.round(s.confidence * 100)}%</span>
                </div>
                <p className="font-medium text-gray-900">{s.suggestedAction}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.timeframe}</p>
                <p className="text-xs text-gray-400 mt-1 italic">{s.extractedText}</p>
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100">Accept</button>
                  <button className="px-3 py-1 text-xs bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100">Edit & Accept</button>
                  <button className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proactive Triggers for this client */}
      {triggers.length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-200">
          <div className="p-4 border-b border-emerald-100 flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Proactive Suggestions</h3>
          </div>
          {triggers.map(t => (
            <div key={t.id} className="p-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-medium text-gray-700">{t.trigger}</p>
              </div>
              <div className="space-y-1.5 ml-5">
                {t.suggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <ArrowRight size={12} className="text-emerald-500" />{s}
                    </span>
                    <button className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-all">
                      Create Task
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionItemsPage = () => {
  const [filter, setFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const filtered = ACTION_ITEMS.filter(item => {
    if (filter !== "all" && item.status !== filter) return false;
    if (assigneeFilter !== "all" && item.assignee !== assigneeFilter) return false;
    return true;
  });

  const statusColors = { open: "blue", in_progress: "amber", overdue: "red", completed: "green" };
  const statusLabels = { open: "Open", in_progress: "In Progress", overdue: "Overdue", completed: "Done" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Action Items</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus size={16} /> New Item
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[["all", "All"], ["open", "Open"], ["in_progress", "In Progress"], ["overdue", "Overdue"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[["all", "Everyone"], ["Joel", "Joel"], ["Partner", "Partner"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setAssigneeFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${assigneeFilter === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {filtered.map(item => (
          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.priority === "high" && <Badge color="red">High</Badge>}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Building2 size={12} />{CLIENTS.find(c => c.id === item.clientId)?.name}</span>
                  <span className="flex items-center gap-1"><User size={12} />{item.assignee}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{item.due}</span>
                  <Badge color={item.source === "email" ? "purple" : item.source === "trigger" ? "green" : "gray"}>
                    {item.source === "email" ? "Email" : item.source === "trigger" ? "AI" : "Manual"}
                  </Badge>
                </div>
              </div>
              <Badge color={statusColors[item.status]}>{statusLabels[item.status]}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScannerPage = () => {
  const [scanRunning, setScanRunning] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Scanner</h1>
          <p className="text-gray-500 mt-1">Gemini-powered email analysis</p>
        </div>
        <button
          onClick={() => { setScanRunning(true); setTimeout(() => setScanRunning(false), 2000); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scanRunning ? "bg-gray-100 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          disabled={scanRunning}
        >
          <RefreshCw size={16} className={scanRunning ? "animate-spin" : ""} />
          {scanRunning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Scanner Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">47</p>
          <p className="text-xs text-gray-500 mt-1">Emails scanned today</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">4</p>
          <p className="text-xs text-gray-500 mt-1">Items detected</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">91%</p>
          <p className="text-xs text-gray-500 mt-1">Avg confidence</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">8:30 AM</p>
          <p className="text-xs text-gray-500 mt-1">Last scan</p>
        </div>
      </div>

      {/* Extraction Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Settings size={16} className="text-gray-500" /> Scanner Configuration
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <label className="block text-gray-600 font-medium">Detection Patterns</label>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700">Client requests ("Can you...", "Please prepare...", "We need...")</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-gray-700">Attorney commitments ("I'll get you...", "We'll have that...")</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-gray-700">Proactive triggers (situation-implied follow-up)</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-gray-600 font-medium">Settings</label>
            <div className="space-y-1 text-gray-700">
              <p>Model: <span className="font-medium">Gemini 2.5 Pro</span></p>
              <p>Scan frequency: <span className="font-medium">Every 30 minutes</span></p>
              <p>Min confidence: <span className="font-medium">75%</span></p>
              <p>Accounts: <span className="font-medium">joel@paradoxprincipals.com</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Suggestions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Pending Review</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {EMAIL_SUGGESTIONS.map(s => (
            <div key={s.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={s.type === "client_request" ? "blue" : "amber"}>
                      {s.type === "client_request" ? "Client Request" : "Your Commitment"}
                    </Badge>
                    <Badge color={s.confidence >= 0.9 ? "green" : s.confidence >= 0.8 ? "amber" : "gray"}>
                      {Math.round(s.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900 mt-1">{s.suggestedAction}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{CLIENTS.find(c => c.id === s.clientId)?.name} · {s.timeframe}</p>
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">From: {s.emailFrom} · {s.emailSubject}</p>
                    <p className="text-sm text-gray-700 italic">{s.extractedText}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 ml-4">
                  <button className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 font-medium">Accept</button>
                  <button className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 font-medium">Edit</button>
                  <button className="px-3 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-md hover:bg-gray-100 font-medium">Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proactive Triggers from email context */}
      <div className="bg-white rounded-xl border border-emerald-200">
        <div className="p-4 border-b border-emerald-100 flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Proactive Work Detected</h3>
          <Badge color="green">AI-Inferred</Badge>
        </div>
        <div className="divide-y divide-gray-50">
          {PROACTIVE_TRIGGERS.map(t => (
            <div key={t.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-amber-500" />
                <p className="font-medium text-gray-800">{t.trigger}</p>
                <span className="text-xs text-gray-400">{Math.round(t.confidence * 100)}% confidence</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{CLIENTS.find(c => c.id === t.clientId)?.name}</p>
              <div className="space-y-1.5">
                {t.suggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <ArrowRight size={12} className="text-emerald-500" />{s}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                      <button className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">Create Task</button>
                      <button className="px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded hover:bg-gray-100">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TriggerRulesPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trigger Rules</h1>
          <p className="text-gray-500 mt-1">Define what follow-up work should be suggested automatically</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus size={16} /> New Rule
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">These rules encode your firm's institutional knowledge</p>
            <p className="text-sm text-amber-700 mt-1">When the AI detects a triggering event in email or when you manually mark a matter milestone, the system suggests the follow-up work items below. You can add, edit, or disable rules as your practice evolves.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {TRIGGER_RULES.map(rule => (
          <div key={rule.id} className={`bg-white rounded-xl border ${rule.active ? "border-gray-200" : "border-gray-100 opacity-60"} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${rule.active ? "bg-emerald-500" : "bg-gray-300"}`}></div>
                <h3 className="font-semibold text-gray-900">{rule.event}</h3>
                <Badge color={rule.active ? "green" : "gray"}>{rule.active ? "Active" : "Disabled"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                <button className="text-xs text-gray-500 hover:text-gray-700">{rule.active ? "Disable" : "Enable"}</button>
              </div>
            </div>
            <div className="ml-5 space-y-1">
              {rule.actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <ArrowRight size={12} className="text-emerald-500" />
                  {action}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsPage = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield size={18} className="text-blue-600" /> Security & Access</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Encryption at rest</span>
            <Badge color="green">Enabled (AES-256)</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Two-factor authentication</span>
            <Badge color="green">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Audit logging</span>
            <Badge color="green">Active</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">AI API data retention</span>
            <Badge color="green">None (API mode)</Badge>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Mail size={18} className="text-purple-600" /> Email Integration</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Google Workspace connection</span>
            <Badge color="green">Connected</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Gmail scope</span>
            <span className="text-gray-600">gmail.readonly</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Scan frequency</span>
            <span className="text-gray-600">Every 30 minutes</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap size={18} className="text-amber-600" /> AI Configuration</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Email scanner model</span>
            <span className="text-gray-600">Gemini 2.5 Pro</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Minimum confidence threshold</span>
            <span className="text-gray-600">75%</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-700">Proactive triggers</span>
            <Badge color="green">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Clio sync</span>
            <Badge color="amber">Not configured</Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "clients", label: "Clients", icon: Users },
  { id: "items", label: "Action Items", icon: FileText },
  { id: "scanner", label: "Email Scanner", icon: Mail },
  { id: "triggers", label: "Trigger Rules", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedClient, setSelectedClient] = useState(null);
  const activePage = page === "client-detail" ? "clients" : page;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm leading-tight">ActionTracker</h2>
              <p className="text-xs text-gray-500">Paradox Principals</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activePage === item.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === "scanner" && (
                <span className="ml-auto bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">
                  {EMAIL_SUGGESTIONS.filter(s => s.status === "pending").length}
                </span>
              )}
              {item.id === "triggers" && (
                <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">
                  {PROACTIVE_TRIGGERS.filter(t => t.status === "pending").length}
                </span>
              )}
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {page === "dashboard" && <DashboardPage setPage={setPage} setSelectedClient={setSelectedClient} />}
          {page === "clients" && <ClientsPage setPage={setPage} setSelectedClient={setSelectedClient} />}
          {page === "client-detail" && <ClientDetailPage client={selectedClient} setPage={setPage} />}
          {page === "items" && <ActionItemsPage />}
          {page === "scanner" && <ScannerPage />}
          {page === "triggers" && <TriggerRulesPage />}
          {page === "settings" && <SettingsPage />}
        </div>
      </div>
    </div>
  );
}
