import { useState } from "react";
import type { Discipline, Resource } from "@estimator/shared";
import type { Currency } from "../store/schedulingStore.js";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";

const DISCIPLINES: Discipline[] = ["Art", "Design", "Code", "Production"];

const DISCIPLINE_STYLES: Record<Discipline, { dot: string; badge: string }> = {
  Art:        { dot: "bg-amber-500",  badge: "bg-amber-900/30 text-amber-400" },
  Design:     { dot: "bg-purple-500", badge: "bg-purple-900/30 text-purple-400" },
  Code:       { dot: "bg-sky-500",    badge: "bg-sky-900/30 text-sky-400" },
  Production: { dot: "bg-green-500",  badge: "bg-green-900/30 text-green-400" },
  Custom:     { dot: "bg-gray-500",   badge: "bg-gray-800 text-gray-400" },
};

type ResourcePatch = Partial<Pick<Resource, "name" | "dailyRate" | "rollOnDate" | "rollOffDate">>;

interface Props {
  resources: Resource[];
  currency: Currency;
  onAdd: (role: Discipline, name: string) => void;
  onUpdate: (id: string, patch: ResourcePatch) => void;
  onDelete: (id: string) => void;
}

export function TeamSidebar({ resources, currency, onAdd, onUpdate, onDelete }: Props) {
  const symbol = CURRENCY_SYMBOLS[currency];
  const hasRates = resources.some((r) => r.dailyRate > 0);

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
            onAdd={(name) => onAdd(discipline, name)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Total cost footer */}
      {hasRates && (
        <TotalCostFooter resources={resources} symbol={symbol} />
      )}
    </div>
  );
}

// ─── Discipline section ───────────────────────────────────────────────────────

function DisciplineSection({
  discipline,
  members,
  symbol,
  onAdd,
  onUpdate,
  onDelete,
}: {
  discipline: Discipline;
  members: Resource[];
  symbol: string;
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
  onUpdate,
  onDelete,
}: {
  member: Resource;
  symbol: string;
  onUpdate: (id: string, patch: ResourcePatch) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(member.name);
  const [draftRate, setDraftRate] = useState(String(member.dailyRate || ""));
  const [draftRollOn, setDraftRollOn] = useState(member.rollOnDate || "");
  const [draftRollOff, setDraftRollOff] = useState(member.rollOffDate || "");

  function openEdit() {
    setDraftName(member.name);
    setDraftRate(String(member.dailyRate || ""));
    setDraftRollOn(member.rollOnDate || "");
    setDraftRollOff(member.rollOffDate || "");
    setEditing(true);
  }

  function commitEdit() {
    const name = draftName.trim() || member.name;
    const rate = parseFloat(draftRate);
    onUpdate(member.id, {
      name,
      dailyRate: isNaN(rate) || rate < 0 ? 0 : rate,
      rollOnDate: draftRollOn || "",
      rollOffDate: draftRollOff || "",
    });
    setEditing(false);
  }

  const dateHint = formatDateHint(member.rollOnDate, member.rollOffDate);

  if (editing) {
    return (
      <div className="bg-[#1d1930] rounded-lg p-2 flex flex-col gap-1.5 border border-[#2e2848]">
        <input
          autoFocus
          className="text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Name"
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-[#5c5575]">{symbol}</span>
          <input
            type="number"
            min={0}
            step={50}
            className="flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
            value={draftRate}
            onChange={(e) => setDraftRate(e.target.value)}
            placeholder="Daily rate"
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          />
        </div>
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
          {member.dailyRate > 0 && (
            <span className="text-sm text-[#5c5575] tabular-nums flex-shrink-0">
              {symbol}{member.dailyRate.toLocaleString()}
            </span>
          )}
        </div>
        {dateHint && (
          <p className="text-xs text-[#5c5575] mt-0.5">{dateHint}</p>
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

function TotalCostFooter({ resources, symbol }: { resources: Resource[]; symbol: string }) {
  const byDiscipline = DISCIPLINES.map((d) => ({
    discipline: d,
    members: resources.filter((r) => r.role === d && r.dailyRate > 0),
  })).filter((g) => g.members.length > 0);

  if (byDiscipline.length === 0) return null;

  return (
    <div className="border-t border-[#2e2848] px-4 py-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-1">Daily team cost</p>
      {byDiscipline.map(({ discipline, members }) => {
        const total = members.reduce((s, m) => s + m.dailyRate, 0);
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
        <span className="text-[#9b93ba]">Total / day</span>
        <span className="text-[#a78bfa] tabular-nums">
          {symbol}{resources.filter((r) => r.dailyRate > 0).reduce((s, r) => s + r.dailyRate, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
