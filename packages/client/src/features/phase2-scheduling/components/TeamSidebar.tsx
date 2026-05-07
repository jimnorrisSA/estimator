import { useState } from "react";
import type { Discipline, Resource } from "@estimator/shared";
import type { Currency } from "../store/schedulingStore.js";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";

const DISCIPLINES: Discipline[] = ["Art", "Design", "Code", "Production"];

const DISCIPLINE_STYLES: Record<Discipline, { dot: string; badge: string }> = {
  Art:        { dot: "bg-orange-400",  badge: "bg-orange-50 text-orange-700" },
  Design:     { dot: "bg-purple-400",  badge: "bg-purple-50 text-purple-700" },
  Code:       { dot: "bg-sky-400",     badge: "bg-sky-50 text-sky-700" },
  Production: { dot: "bg-green-400",   badge: "bg-green-50 text-green-700" },
  Custom:     { dot: "bg-gray-400",    badge: "bg-gray-50 text-gray-600" },
};

interface Props {
  resources: Resource[];
  currency: Currency;
  onAdd: (role: Discipline, name: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Resource, "name" | "dailyRate">>) => void;
  onDelete: (id: string) => void;
}

export function TeamSidebar({ resources, currency, onAdd, onUpdate, onDelete }: Props) {
  const symbol = CURRENCY_SYMBOLS[currency];
  const hasRates = resources.some((r) => r.dailyRate > 0);

  return (
    <div className="w-56 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Team</h2>
        <span className="text-sm text-gray-400">{resources.length} member{resources.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Rate hint */}
      {!hasRates && resources.length > 0 && (
        <div className="mx-3 mt-3 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-600 leading-snug">
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
  onUpdate: (id: string, patch: Partial<Pick<Resource, "name" | "dailyRate">>) => void;
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
        <span className="text-sm font-semibold text-gray-600">{discipline}</span>
        {members.length > 0 && (
          <span className="text-sm text-gray-400 ml-auto">{members.length}</span>
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
            className="w-full text-sm border border-blue-400 rounded-lg px-2 py-1.5 focus:outline-none"
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
            className="text-sm text-gray-400 hover:text-blue-600 text-left py-0.5 transition-colors"
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

function MemberRow({
  member,
  symbol,
  onUpdate,
  onDelete,
}: {
  member: Resource;
  symbol: string;
  onUpdate: (id: string, patch: Partial<Pick<Resource, "name" | "dailyRate">>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(member.name);
  const [draftRate, setDraftRate] = useState(String(member.dailyRate || ""));

  function commitEdit() {
    const name = draftName.trim() || member.name;
    const rate = parseFloat(draftRate);
    onUpdate(member.id, {
      name,
      dailyRate: isNaN(rate) || rate < 0 ? 0 : rate,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-gray-50 rounded-lg p-2 flex flex-col gap-1.5 border border-gray-200">
        <input
          autoFocus
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Name"
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-400">{symbol}</span>
          <input
            type="number"
            min={0}
            step={50}
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={draftRate}
            onChange={(e) => setDraftRate(e.target.value)}
            placeholder="Daily rate"
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          />
        </div>
        <div className="flex gap-1 justify-end">
          <button
            className="text-sm px-2 py-0.5 rounded text-gray-500 hover:bg-gray-200 transition-colors"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            className="text-sm px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={commitEdit}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group rounded-lg px-1.5 py-1 hover:bg-gray-50">
      <span className="flex-1 text-sm text-gray-700 truncate">{member.name}</span>
      {member.dailyRate > 0 && (
        <span className="text-sm text-gray-400 tabular-nums">
          {symbol}{member.dailyRate.toLocaleString()}
        </span>
      )}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          onClick={() => { setDraftName(member.name); setDraftRate(String(member.dailyRate || "")); setEditing(true); }}
          title="Edit"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2l2 2-6 6H2V8l6-6z" />
          </svg>
        </button>
        <button
          className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
    <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Daily team cost</p>
      {byDiscipline.map(({ discipline, members }) => {
        const total = members.reduce((s, m) => s + m.dailyRate, 0);
        return (
          <div key={discipline} className="flex justify-between text-sm">
            <span className="text-gray-500">{discipline}</span>
            <span className="text-gray-700 tabular-nums font-medium">
              {symbol}{total.toLocaleString()}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100 mt-0.5">
        <span className="text-gray-600">Total / day</span>
        <span className="text-gray-800 tabular-nums">
          {symbol}{resources.filter((r) => r.dailyRate > 0).reduce((s, r) => s + r.dailyRate, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
