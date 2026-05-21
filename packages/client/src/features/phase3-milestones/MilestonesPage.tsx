import { useMemo, useState } from "react";
import { useMilestonesStore, type Milestone } from "./store/milestonesStore.js";
import { useEstimationsStore } from "../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS, getConversionRate } from "../phase2-scheduling/store/schedulingStore.js";
import { runScheduler } from "../phase2-scheduling/utils/scheduler.js";
import type { ResourceWindow } from "../phase2-scheduling/utils/scheduler.js";
import { buildWorkingDayCalendar, dateToWorkingDay, parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";
import { Timeline } from "../phase2-scheduling/components/Timeline.js";

export function MilestonesPage() {
  const { milestones: rawMilestones, addMilestone, updateMilestone, deleteMilestone } = useMilestonesStore();
  const milestones = useMemo(
    () => [...rawMilestones].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [rawMilestones]
  );
  const features = useEstimationsStore((s) => s.features);
  const { settings, overrides, resources } = useSchedulingStore();
  const symbol = CURRENCY_SYMBOLS[settings.currency];
  const conversionRate = getConversionRate(settings);

  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
  const [focusedMilestoneId, setFocusedMilestoneId] = useState<string | null>(null);

  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual") return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), 500);
  }, [settings.calendarMode, settings.startDate]);

  const blockedPeriods = useMemo(() =>
    milestones
      .filter((m) => (m.hardeningDays ?? 0) > 0)
      .map((m) => {
        const endDay = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
        const startDay = Math.max(0, endDay - (m.hardeningDays ?? 0));
        return { start: startDay, end: endDay, label: `${m.title} Hardening`, color: m.color };
      }),
    [milestones, settings.calendarMode, settings.startDate, cal]
  );

  const resourceWindows = useMemo(() => {
    const map: Record<string, ResourceWindow> = {};
    for (const r of resources) {
      const startDay = r.rollOnDate
        ? dateToWorkingDay(r.rollOnDate, settings.calendarMode, settings.startDate, cal)
        : 0;
      const endDay = r.rollOffDate
        ? dateToWorkingDay(r.rollOffDate, settings.calendarMode, settings.startDate, cal)
        : null;
      if (startDay > 0 || endDay !== null) map[r.id] = { startDay, endDay };
    }
    return map;
  }, [resources, settings.calendarMode, settings.startDate, cal]);

  const result = useMemo(
    () => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth),
    [features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth]
  );

  const hasCosts = result.tasks.some((t) => t.cost > 0);
  const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);
  const projectCost = baseCost * (1 + settings.contingencyPct / 100);
  const agencyFee = projectCost * ((settings.agencyFeePct ?? 0) / 100);
  const revenueGBP = settings.revenueGBP ?? 0;
  const marginGBP = revenueGBP - projectCost - agencyFee;
  const hasFinancials = hasCosts && (revenueGBP > 0 || (settings.agencyFeePct ?? 0) > 0);

  const milestoneCosts = useMemo(() =>
    milestones.map((m) => {
      const mStart = dateToWorkingDay(m.startDate, settings.calendarMode, settings.startDate, cal);
      const mEnd = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
      const matching = result.tasks.filter((t) => t.startDay >= mStart && t.startDay < mEnd);
      return {
        ...m,
        cost: matching.reduce((sum, t) => sum + t.cost, 0),
        days: matching.reduce((sum, t) => sum + t.workingDays, 0),
      };
    }),
    [milestones, result.tasks, cal, settings.calendarMode, settings.startDate]
  );

  const disciplineCosts = useMemo(() => {
    const map = new Map<string, { days: number; cost: number }>();
    for (const t of result.tasks) {
      const cur = map.get(t.discipline) ?? { days: 0, cost: 0 };
      map.set(t.discipline, { days: cur.days + t.workingDays, cost: cur.cost + t.cost });
    }
    return Array.from(map.entries()).map(([discipline, data]) => ({ discipline, ...data }));
  }, [result.tasks]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0d0b16]">
      {/* Milestone management strip */}
      <MilestoneStrip
        milestones={milestones}
        settings={settings}
        onAdd={addMilestone}
        onUpdate={updateMilestone}
        onDelete={deleteMilestone}
        focusedMilestoneId={focusedMilestoneId}
        onFocusMilestone={setFocusedMilestoneId}
      />

      {/* Timeline */}
      <div className="flex-1 px-6 pb-6 flex flex-col gap-6">
        <Timeline
          result={result}
          features={features}
          settings={settings}
          viewMode={viewMode}
          onToggleView={() => setViewMode((v) => (v === "detailed" ? "summary" : "detailed"))}
          resourceWindows={resourceWindows}
          focusedMilestoneId={focusedMilestoneId}
          onFocusMilestone={setFocusedMilestoneId}
        />

        {/* Cost breakdown */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-[#9b93ba] uppercase tracking-wide">Cost Breakdown</h2>

          {!hasCosts && (
            <p className="text-sm text-[#5c5575]">Add daily rates to team members in Phase 2 to see cost breakdowns.</p>
          )}

          {hasCosts && (
            <div className="flex flex-wrap gap-6 items-start">
              {milestones.length > 0 && (
                <CostTable
                  label="By Milestone"
                  rows={milestoneCosts.map((m) => ({
                    key: m.id,
                    name: m.title,
                    color: m.color,
                    days: m.days,
                    cost: m.cost * conversionRate,
                  }))}
                  symbol={symbol}
                />
              )}

              <CostTable
                label="By Discipline"
                rows={disciplineCosts.map(({ discipline, days, cost }) => ({
                  key: discipline,
                  name: discipline,
                  days,
                  cost: cost * conversionRate,
                }))}
                symbol={symbol}
              />

              <div className="w-full flex flex-wrap gap-3 pt-2 border-t border-[#2e2848]">
                <StatCard label="Base cost" value={`${symbol}${Math.round(baseCost * conversionRate).toLocaleString()}`} />
                <StatCard label={`Contingency (${settings.contingencyPct}%)`} value={`+${symbol}${Math.round((projectCost - baseCost) * conversionRate).toLocaleString()}`} />
                <StatCard label="Total" value={`${symbol}${Math.round(projectCost * conversionRate).toLocaleString()}`} highlight />

                {hasFinancials && (
                  <>
                    <div className="w-full border-t border-[#2e2848] mt-1" />
                    {(settings.agencyFeePct ?? 0) > 0 && (
                      <StatCard
                        label={`${settings.agencyFeeLabel || "Agency"} fee (${settings.agencyFeePct}%)`}
                        value={`${symbol}${Math.round(agencyFee * conversionRate).toLocaleString()}`}
                      />
                    )}
                    {revenueGBP > 0 && (
                      <StatCard
                        label="Revenue"
                        value={`${symbol}${Math.round(revenueGBP * conversionRate).toLocaleString()}`}
                      />
                    )}
                    {revenueGBP > 0 && (
                      <StatCard
                        label="Margin"
                        value={`${marginGBP >= 0 ? "" : "-"}${symbol}${Math.round(Math.abs(marginGBP) * conversionRate).toLocaleString()}`}
                        highlight
                        positive={marginGBP >= 0}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Milestone strip ──────────────────────────────────────────────────────────

type StripView = "list" | "chips";

interface StripProps {
  milestones: Milestone[];
  settings: { startDate: string };
  onAdd: (title: string, startDate: string, endDate: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays" | "sprintLengthWeeks">>) => void;
  onDelete: (id: string) => void;
  focusedMilestoneId: string | null;
  onFocusMilestone: (id: string | null) => void;
}

function MilestoneStrip({ milestones, settings, onAdd, onUpdate, onDelete, focusedMilestoneId, onFocusMilestone }: StripProps) {
  const [adding, setAdding] = useState(false);
  const [stripView, setStripView] = useState<StripView>("list");
  const [draft, setDraft] = useState({ title: "", startDate: settings.startDate, endDate: "" });

  function commitAdd() {
    if (!draft.title.trim() || !draft.startDate || !draft.endDate) return;
    onAdd(draft.title.trim(), draft.startDate, draft.endDate);
    setDraft({ title: "", startDate: settings.startDate, endDate: "" });
    setAdding(false);
  }

  return (
    <div className="flex-shrink-0 border-b border-[#2e2848] bg-[#14112a] px-6 py-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#9b93ba] uppercase tracking-wide">Milestones</h2>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[#2e2848] overflow-hidden text-xs">
            {(["list", "chips"] as StripView[]).map((v) => (
              <button
                key={v}
                onClick={() => setStripView(v)}
                className={`px-3 py-1 transition-colors ${
                  stripView === v
                    ? "bg-[#7c3aed] text-white font-medium"
                    : "bg-[#1d1930] text-[#5c5575] hover:bg-[#252041]"
                }`}
              >
                {v === "list" ? "List" : "Chips"}
              </button>
            ))}
          </div>
          {!adding && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252041] border border-[#3d366a] text-sm text-[#a78bfa] hover:bg-[#2e2848] transition-colors"
              onClick={() => setAdding(true)}
            >
              <span className="text-base leading-none">+</span> Add milestone
            </button>
          )}
        </div>
      </div>

      {milestones.length === 0 && !adding && (
        <p className="text-xs text-[#5c5575]">No milestones yet. Add one to see it on the timeline above.</p>
      )}

      {milestones.length > 0 && stripView === "chips" && (
        <div className="flex flex-wrap gap-2">
          {milestones.map((m) => (
            <MilestoneChip key={m.id} milestone={m} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}

      {milestones.length > 0 && stripView === "list" && (
        <MilestoneList milestones={milestones} onUpdate={onUpdate} onDelete={onDelete} focusedMilestoneId={focusedMilestoneId} onFocusMilestone={onFocusMilestone} />
      )}

      {adding && (
        <div className="flex flex-wrap gap-3 items-end bg-[#0d0b16] rounded-xl border border-[#3d366a] p-3">
          <Field label="Title">
            <input
              autoFocus
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
              placeholder="e.g. Alpha release"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
            />
          </Field>
          <Field label="Start">
            <input type="date" className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} />
          </Field>
          <Field label="End">
            <input type="date" className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} />
          </Field>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-40"
              disabled={!draft.title.trim() || !draft.startDate || !draft.endDate}
              onClick={commitAdd}
            >
              Add
            </button>
            <button className="px-3 py-1.5 rounded-lg text-[#5c5575] text-sm hover:text-[#9b93ba] transition-colors" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneList({ milestones, onUpdate, onDelete, focusedMilestoneId, onFocusMilestone }: {
  milestones: Milestone[];
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays" | "sprintLengthWeeks">>) => void;
  onDelete: (id: string) => void;
  focusedMilestoneId: string | null;
  onFocusMilestone: (id: string | null) => void;
}) {
  return (
    <div className="rounded-xl border border-[#2e2848] overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#1a1628] text-left text-xs text-[#5c5575] uppercase tracking-wide">
            <th className="px-4 py-2 font-medium">Milestone</th>
            <th className="px-4 py-2 font-medium">Start</th>
            <th className="px-4 py-2 font-medium">End</th>
            <th className="px-4 py-2 font-medium text-center">Hardening</th>
            <th className="px-4 py-2 font-medium text-center">Sprints</th>
            <th className="px-4 py-2 font-medium w-16" />
          </tr>
        </thead>
        <tbody>
          {milestones.map((m, i) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              zebra={i % 2 === 1}
              focused={focusedMilestoneId === m.id}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onFocus={() => onFocusMilestone(focusedMilestoneId === m.id ? null : m.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MilestoneRow({ milestone: m, zebra, focused, onUpdate, onDelete, onFocus }: {
  milestone: Milestone;
  zebra: boolean;
  focused: boolean;
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays" | "sprintLengthWeeks">>) => void;
  onDelete: (id: string) => void;
  onFocus: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);

  const rowBg = focused
    ? "bg-[#1e1535]"
    : zebra ? "bg-[#1a1628]" : "bg-[#14112a]";

  return (
    <tr
      className={`${rowBg} border-t transition-colors group cursor-pointer`}
      style={{ borderColor: focused ? m.color : "#2e2848", borderLeftWidth: focused ? 3 : undefined, borderLeftColor: focused ? m.color : undefined }}
      onClick={onFocus}
      title={focused ? "Click to exit focus" : "Click to zoom into this milestone"}
    >
      {/* Name + colour */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={m.color}
            onChange={(e) => onUpdate(m.id, { color: e.target.value })}
            className="w-4 h-4 rounded-sm border-0 cursor-pointer flex-shrink-0 bg-transparent"
            title="Change colour"
          />
          {editingTitle ? (
            <input
              autoFocus
              className="bg-transparent border-b border-[#7c3aed] text-[#ece7ff] text-sm outline-none w-40 caret-[#a78bfa]"
              value={m.title}
              onChange={(e) => onUpdate(m.id, { title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }}
            />
          ) : (
            <span
              className="text-[#ece7ff] font-medium cursor-pointer hover:text-[#a78bfa] transition-colors"
              onDoubleClick={() => setEditingTitle(true)}
              title="Double-click to rename"
            >
              {m.title}
            </span>
          )}
        </div>
      </td>

      {/* Start date */}
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          className="bg-transparent text-[#9b93ba] text-xs focus:outline-none focus:text-[#ece7ff] cursor-pointer"
          value={m.startDate}
          onChange={(e) => onUpdate(m.id, { startDate: e.target.value })}
        />
      </td>

      {/* End date */}
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          className="bg-transparent text-[#9b93ba] text-xs focus:outline-none focus:text-[#ece7ff] cursor-pointer"
          value={m.endDate}
          onChange={(e) => onUpdate(m.id, { endDate: e.target.value })}
        />
      </td>

      {/* Hardening days */}
      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1">
          <input
            type="number"
            min={0}
            step={1}
            className="w-12 text-center bg-[#1d1930] border border-[#2e2848] text-[#ece7ff] text-xs rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            value={m.hardeningDays ?? 0}
            onChange={(e) => onUpdate(m.id, { hardeningDays: Math.max(0, parseInt(e.target.value) || 0) })}
          />
          <span className="text-xs text-[#5c5575]">d</span>
        </div>
      </td>

      {/* Sprint length */}
      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5">
          {([undefined, 2, 3] as const).map((v) => (
            <button
              key={String(v)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                m.sprintLengthWeeks === v
                  ? "bg-[#7c3aed] text-white font-semibold"
                  : "bg-[#1d1930] text-[#5c5575] hover:text-[#9b93ba]"
              }`}
              onClick={(e) => { e.stopPropagation(); onUpdate(m.id, { sprintLengthWeeks: v }); }}
            >
              {v == null ? "—" : `${v}w`}
            </button>
          ))}
        </div>
      </td>

      {/* Delete */}
      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          className="opacity-0 group-hover:opacity-100 text-[#3a3456] hover:text-red-400 transition-all text-lg leading-none"
          onClick={() => onDelete(m.id)}
          title="Delete milestone"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function MilestoneChip({ milestone, onUpdate, onDelete }: {
  milestone: Milestone;
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays" | "sprintLengthWeeks">>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-[#1d1930] border border-[#3d366a] rounded-lg px-3 py-1.5">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: milestone.color }} />
        <input
          autoFocus
          className="bg-transparent text-[#ece7ff] text-sm w-32 focus:outline-none"
          value={milestone.title}
          onChange={(e) => onUpdate(milestone.id, { title: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
        />
        <input type="date" className="bg-transparent text-[#9b93ba] text-xs focus:outline-none"
          value={milestone.startDate} onChange={(e) => onUpdate(milestone.id, { startDate: e.target.value })} />
        <span className="text-[#3a3456] text-xs">→</span>
        <input type="date" className="bg-transparent text-[#9b93ba] text-xs focus:outline-none"
          value={milestone.endDate} onChange={(e) => onUpdate(milestone.id, { endDate: e.target.value })} />
        <button className="text-[#3a3456] hover:text-[#ef4444] text-lg leading-none ml-1 transition-colors" onMouseDown={(e) => { e.preventDefault(); onDelete(milestone.id); }}>×</button>
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-2 bg-[#1d1930] border border-[#2e2848] rounded-lg px-3 py-1.5 hover:border-[#3d366a] transition-colors"
      onClick={() => setEditing(true)}
    >
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: milestone.color }} />
      <span className="text-sm text-[#ece7ff]">{milestone.title}</span>
      <span className="text-xs text-[#5c5575]">
        {milestone.startDate} – {milestone.endDate}
      </span>
    </button>
  );
}

// ─── Cost tables ──────────────────────────────────────────────────────────────

function CostTable({ label, rows, symbol }: {
  label: string;
  rows: { key: string; name: string; color?: string; days: number; cost: number }[];
  symbol: string;
}) {
  return (
    <div className="flex-1 min-w-[240px]">
      <h3 className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-3">{label}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-[#5c5575] uppercase tracking-wide">
            <th className="pb-2 font-medium pr-4">Name</th>
            <th className="pb-2 font-medium pr-4 text-right">Days</th>
            <th className="pb-2 font-medium text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, name, color, days, cost }) => (
            <tr key={key} className="border-t border-[#2e2848]">
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  {color && <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />}
                  <span className="text-[#ece7ff]">{name}</span>
                </div>
              </td>
              <td className="py-2.5 pr-4 text-right text-[#9b93ba]">{Math.round(days)}d</td>
              <td className="py-2.5 text-right font-medium text-[#ece7ff]">
                {cost > 0 ? `${symbol}${Math.round(cost).toLocaleString()}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, highlight, positive }: { label: string; value: string; highlight?: boolean; positive?: boolean }) {
  const valueColor = positive === false ? "text-red-400" : positive === true ? "text-green-400" : highlight ? "text-[#a78bfa]" : "text-[#ece7ff]";
  return (
    <div className="bg-[#1d1930] rounded-xl border border-[#2e2848] px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-[#5c5575] font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
