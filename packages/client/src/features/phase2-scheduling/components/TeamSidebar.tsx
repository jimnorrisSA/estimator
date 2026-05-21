import { useState } from "react";
import type { Discipline, Resource, ResourceType } from "@estimator/shared";
import type { Currency } from "../store/schedulingStore.js";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";

const DISCIPLINES: Discipline[] = ["Art", "Design", "Code", "Production", "Custom"];

const DISCIPLINE_STYLES: Record<Discipline, { dot: string; badge: string }> = {
  Art:        { dot: "bg-amber-500",  badge: "bg-amber-900/30 text-amber-400" },
  Design:     { dot: "bg-purple-500", badge: "bg-purple-900/30 text-purple-400" },
  Code:       { dot: "bg-sky-500",    badge: "bg-sky-900/30 text-sky-400" },
  Production: { dot: "bg-green-500",  badge: "bg-green-900/30 text-green-400" },
  Custom:     { dot: "bg-gray-500",   badge: "bg-gray-800 text-gray-400" },
};

type ResourcePatch = Partial<Pick<Resource, "name" | "email" | "jiraId" | "resourceType" | "monthlyRate" | "allocationPct" | "rollOnDate" | "rollOffDate">>;

interface Props {
  resources: Resource[];
  currency: Currency;
  defaultMonthlyRate: number;
  onAdd: (role: Discipline, name: string) => void;
  onUpdate: (id: string, patch: ResourcePatch) => void;
  onDelete: (id: string) => void;
}

export function TeamSidebar({ resources, currency, defaultMonthlyRate, onAdd, onUpdate, onDelete }: Props) {
  const symbol = CURRENCY_SYMBOLS[currency];
  const hasRates = resources.some((r) => r.monthlyRate > 0 || ((r.resourceType || "Contractor") === "FTE" && defaultMonthlyRate > 0));

  return (
    <div className="w-56 flex-shrink-0 border-l border-[#2e2848] bg-[#14112a] flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2848] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#ece7ff]">Team</h2>
        <span className="text-sm text-[#5c5575]">{resources.length} member{resources.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Rate hint */}
      {!hasRates && resources.length > 0 && (
        <div className="mx-3 mt-3 px-3 py-2 bg-[#1e1548] rounded-lg text-sm text-[#a78bfa] leading-snug">
          Add daily rates to unlock cost totals.
        </div>
      )}

      {/* Discipline sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-5">
        {DISCIPLINES.map((discipline) => (
          <DisciplineSection
            key={discipline}
            discipline={discipline}
            members={resources.filter((r) => r.role === discipline)}
            symbol={symbol}
            defaultMonthlyRate={defaultMonthlyRate}
            onAdd={(name) => onAdd(discipline, name)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Total cost footer */}
      {hasRates && (
        <TotalCostFooter resources={resources} symbol={symbol} defaultMonthlyRate={defaultMonthlyRate} />
      )}
    </div>
  );
}

// ─── Discipline section ───────────────────────────────────────────────────────

function DisciplineSection({
  discipline,
  members,
  symbol,
  defaultMonthlyRate,
  onAdd,
  onUpdate,
  onDelete,
}: {
  discipline: Discipline;
  members: Resource[];
  symbol: string;
  defaultMonthlyRate: number;
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: ResourcePatch) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const styles = DISCIPLINE_STYLES[discipline];

  function commitAdd() {
    if (newName.trim()) onAdd(newName.trim());
    setNewName("");
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className="text-sm font-semibold text-[#9b93ba]">{discipline}</span>
        {members.length > 0 && (
          <span className="text-sm text-[#5c5575] ml-auto">{members.length}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            symbol={symbol}
            defaultMonthlyRate={defaultMonthlyRate}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}

        {adding ? (
          <input
            autoFocus
            className="w-full text-sm border border-[#7c3aed] bg-[#1a1628] text-[#ece7ff] rounded-lg px-2 py-1.5 focus:outline-none placeholder:text-[#3a3456]"
            placeholder="Name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            onBlur={commitAdd}
          />
        ) : (
          <button
            className="text-sm text-[#5c5575] hover:text-[#a78bfa] text-left py-0.5 transition-colors"
            onClick={() => setAdding(true)}
          >
            + Add {discipline.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function formatDateHint(rollOnDate: string, rollOffDate: string): string | null {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]}`;
  };
  if (rollOnDate && rollOffDate) return `${fmt(rollOnDate)} – ${fmt(rollOffDate)}`;
  if (rollOnDate) return `From ${fmt(rollOnDate)}`;
  if (rollOffDate) return `Until ${fmt(rollOffDate)}`;
  return null;
}

function MemberRow({
  member,
  symbol,
  defaultMonthlyRate,
  onUpdate,
  onDelete,
}: {
  member: Resource;
  symbol: string;
  defaultMonthlyRate: number;
  onUpdate: (id: string, patch: ResourcePatch) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const effectiveType: ResourceType = (member.resourceType || "Contractor") as ResourceType;
  const [draftName, setDraftName] = useState(member.name);
  const [draftEmail, setDraftEmail] = useState(member.email || "");
  const [draftJiraId, setDraftJiraId] = useState(member.jiraId || "");
  const [draftType, setDraftType] = useState<ResourceType>(effectiveType);
  const [draftRate, setDraftRate] = useState(String(member.monthlyRate || ""));
  const [useDefault, setUseDefault] = useState(effectiveType === "FTE" && !member.monthlyRate);
  const [draftAlloc, setDraftAlloc] = useState(String(member.allocationPct ?? 100));
  const [draftRollOn, setDraftRollOn] = useState(member.rollOnDate || "");
  const [draftRollOff, setDraftRollOff] = useState(member.rollOffDate || "");

  function openEdit() {
    const t: ResourceType = (member.resourceType || "Contractor") as ResourceType;
    setDraftName(member.name);
    setDraftEmail(member.email || "");
    setDraftJiraId(member.jiraId || "");
    setDraftType(t);
    setDraftRate(String(member.monthlyRate || ""));
    setUseDefault(t === "FTE" && !member.monthlyRate);
    setDraftAlloc(String(member.allocationPct ?? 100));
    setDraftRollOn(member.rollOnDate || "");
    setDraftRollOff(member.rollOffDate || "");
    setEditing(true);
  }

  function handleTypeChange(t: ResourceType) {
    setDraftType(t);
    if (t === "FTE") setUseDefault(!member.monthlyRate);
  }

  function commitEdit() {
    const name = draftName.trim() || member.name;
    const rate = (draftType === "FTE" && useDefault) ? 0 : (parseFloat(draftRate) || 0);
    const alloc = Math.min(100, Math.max(1, parseInt(draftAlloc) || 100));
    onUpdate(member.id, {
      name,
      email: draftEmail.trim() || undefined,
      jiraId: draftJiraId.trim() || undefined,
      resourceType: draftType,
      monthlyRate: rate,
      allocationPct: alloc,
      rollOnDate: draftRollOn || "",
      rollOffDate: draftRollOff || "",
    });
    setEditing(false);
  }

  const dateHint = formatDateHint(member.rollOnDate, member.rollOffDate);
  const displayRate = effectiveType === "FTE" && !member.monthlyRate ? defaultMonthlyRate : member.monthlyRate;
  const allocLabel = (member.allocationPct ?? 100) < 100 ? ` · ${member.allocationPct}%` : "";

  if (editing) {
    return (
      <div className="bg-[#1d1930] rounded-lg p-2 flex flex-col gap-2 border border-[#2e2848]">
        {/* Name */}
        <input
          autoFocus
          className="text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Name"
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
        />

        {/* Email */}
        <input
          type="email"
          className="text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]"
          value={draftEmail}
          onChange={(e) => setDraftEmail(e.target.value)}
          placeholder="Email (optional)"
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
        />

        {/* Jira ID */}
        <input
          type="text"
          className="text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]"
          value={draftJiraId}
          onChange={(e) => setDraftJiraId(e.target.value)}
          placeholder="Jira account ID (optional)"
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
        />

        {/* FTE / Contractor toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#2e2848]">
          {(["FTE", "Contractor"] as ResourceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`flex-1 text-xs py-1 font-semibold transition-colors ${
                draftType === t
                  ? "bg-[#7c3aed] text-white"
                  : "bg-[#1a1628] text-[#5c5575] hover:text-[#9b93ba]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Rate */}
        {draftType === "FTE" ? (
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useDefault}
                onChange={(e) => setUseDefault(e.target.checked)}
                className="accent-[#7c3aed]"
              />
              <span className="text-xs text-[#9b93ba]">
                Use project default
                {defaultMonthlyRate > 0 && ` (${symbol}${defaultMonthlyRate.toLocaleString()}/mo)`}
              </span>
            </label>
            {!useDefault && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-[#5c5575]">{symbol}</span>
                <input
                  type="number" min={0} step={50}
                  className="flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
                  value={draftRate}
                  onChange={(e) => setDraftRate(e.target.value)}
                  placeholder="Override rate"
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-sm text-[#5c5575]">{symbol}</span>
            <input
              type="number" min={0} step={50}
              className="flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
              value={draftRate}
              onChange={(e) => setDraftRate(e.target.value)}
              placeholder="Monthly rate"
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
            />
          </div>
        )}

        {/* Allocation % */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#5c5575] w-16 flex-shrink-0">Allocation</span>
          <input
            type="number" min={1} max={100} step={10}
            className="flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            value={draftAlloc}
            onChange={(e) => setDraftAlloc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          />
          <span className="text-xs text-[#5c5575]">%</span>
        </div>

        {/* Availability */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[#5c5575]">Availability</p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#5c5575] w-10 flex-shrink-0">From</span>
            <input
              type="date"
              className="flex-1 text-xs border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
              value={draftRollOn}
              onChange={(e) => setDraftRollOn(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#5c5575] w-10 flex-shrink-0">Until</span>
            <input
              type="date"
              className="flex-1 text-xs border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
              value={draftRollOff}
              onChange={(e) => setDraftRollOff(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-1 justify-end">
          <button
            className="text-sm px-2 py-0.5 rounded text-[#9b93ba] hover:bg-[#252041] transition-colors"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            className="text-sm px-2 py-0.5 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors"
            onClick={commitEdit}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 group rounded-lg px-1.5 py-1 hover:bg-[#1d1930] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-sm text-[#ece7ff] truncate">{member.name}</span>
          {displayRate > 0 && (
            <span className="text-sm text-[#5c5575] tabular-nums flex-shrink-0">
              {symbol}{displayRate.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {effectiveType === "FTE" ? (
            <span className="text-xs px-1 rounded" style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }}>FTE</span>
          ) : (
            <span className="text-xs px-1 rounded" style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>Contractor</span>
          )}
          {allocLabel && <span className="text-xs text-[#5c5575]">{allocLabel}</span>}
          {dateHint && <span className="text-xs text-[#5c5575] truncate">{dateHint}</span>}
        </div>
        {member.email && (
          <span className="text-xs text-[#5c5575] truncate mt-0.5">{member.email}</span>
        )}
        {member.jiraId && (
          <span className="text-xs text-[#5c5575] truncate mt-0.5 flex items-center gap-1">
            <span style={{ color: "#2d7ff9" }}>J</span>{member.jiraId}
          </span>
        )}
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0">
        <button
          className="p-0.5 rounded text-[#5c5575] hover:text-[#a78bfa] hover:bg-[#252041] transition-colors"
          onClick={openEdit}
          title="Edit"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2l2 2-6 6H2V8l6-6z" />
          </svg>
        </button>
        <button
          className="p-0.5 rounded text-[#5c5575] hover:text-red-400 hover:bg-red-900/20 transition-colors"
          onClick={() => onDelete(member.id)}
          title="Remove"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Cost footer ──────────────────────────────────────────────────────────────

function TotalCostFooter({ resources, symbol, defaultMonthlyRate }: { resources: Resource[]; symbol: string; defaultMonthlyRate: number }) {
  const byDiscipline = DISCIPLINES.map((d) => ({
    discipline: d,
    members: resources.filter((r) => r.role === d).filter((r) => {
      const rate = (r.resourceType === "FTE" && !r.monthlyRate) ? defaultMonthlyRate : r.monthlyRate;
      return rate > 0;
    }),
  })).filter((g) => g.members.length > 0);

  if (byDiscipline.length === 0) return null;

  const effectiveRate = (r: Resource) =>
    (r.resourceType === "FTE" && !r.monthlyRate) ? defaultMonthlyRate : r.monthlyRate;

  return (
    <div className="border-t border-[#2e2848] px-4 py-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-1">Monthly team cost</p>
      {byDiscipline.map(({ discipline, members }) => {
        const total = members.reduce((s, m) => s + effectiveRate(m), 0);
        return (
          <div key={discipline} className="flex justify-between text-sm">
            <span className="text-[#9b93ba]">{discipline}</span>
            <span className="text-[#ece7ff] tabular-nums font-medium">
              {symbol}{total.toLocaleString()}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-[#2e2848] mt-0.5">
        <span className="text-[#9b93ba]">Total / month</span>
        <span className="text-[#a78bfa] tabular-nums">
          {symbol}{resources.reduce((s, r) => s + effectiveRate(r), 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
