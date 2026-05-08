import { useMemo, useState } from "react";
import { useMilestonesStore, MILESTONE_COLORS, type Milestone } from "./store/milestonesStore.js";
import { useEstimationsStore } from "../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS, getConversionRate } from "../phase2-scheduling/store/schedulingStore.js";
import { runScheduler } from "../phase2-scheduling/utils/scheduler.js";
import { buildWorkingDayCalendar, dateToWorkingDay, parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";


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

  const result = useMemo(
    () => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate, blockedPeriods),
    [features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate, blockedPeriods]
  );

  const hasCosts = result.tasks.some((t) => t.cost > 0);
  const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);

  const milestoneCosts = useMemo(() =>
    milestones.map((m) => {
      const mStart = dateToWorkingDay(m.startDate, settings.calendarMode, settings.startDate, cal);
      const mEnd = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
      const cost = result.tasks
        .filter((t) => t.startDay >= mStart && t.startDay < mEnd)
        .reduce((sum, t) => sum + t.cost, 0);
      const days = result.tasks
        .filter((t) => t.startDay >= mStart && t.startDay < mEnd)
        .reduce((sum, t) => sum + t.workingDays, 0);
      return { ...m, cost, days };
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
    <div className="flex flex-col gap-8 p-6 overflow-y-auto h-full bg-[#0d0b16]">
      <MilestoneList
        milestones={milestones}
        settings={settings}
        onAdd={addMilestone}
        onUpdate={updateMilestone}
        onDelete={deleteMilestone}
      />

      <div className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-[#9b93ba] uppercase tracking-wide">Cost Breakdown</h2>

        {!hasCosts && (
          <p className="text-sm text-[#5c5575]">Add daily rates to your team members in Phase 2 to see cost breakdowns.</p>
        )}

        {hasCosts && (
          <div className="flex flex-wrap gap-6 items-start">
            {/* By milestone */}
            {milestones.length > 0 && (
              <div className="flex-1 min-w-[280px]">
                <h3 className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-3">By Milestone</h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-[#5c5575] uppercase tracking-wide">
                      <th className="pb-2 font-medium pr-4">Milestone</th>
                      <th className="pb-2 font-medium pr-4 text-right">Days</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestoneCosts.map((m) => (
                      <tr key={m.id} className="border-t border-[#2e2848]">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: m.color }} />
                            <span className="text-[#ece7ff]">{m.title}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-[#9b93ba]">{m.days}d</td>
                        <td className="py-2.5 text-right font-medium text-[#ece7ff]">
                          {m.cost > 0 ? `${symbol}${Math.round(m.cost * conversionRate).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* By discipline */}
            <div className="flex-1 min-w-[240px]">
              <h3 className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-3">By Discipline</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-[#5c5575] uppercase tracking-wide">
                    <th className="pb-2 font-medium pr-4">Discipline</th>
                    <th className="pb-2 font-medium pr-4 text-right">Days</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplineCosts.map(({ discipline, days, cost }) => (
                    <tr key={discipline} className="border-t border-[#2e2848]">
                      <td className="py-2.5 pr-4 text-[#ece7ff]">{discipline}</td>
                      <td className="py-2.5 pr-4 text-right text-[#9b93ba]">{Math.round(days)}d</td>
                      <td className="py-2.5 text-right font-medium text-[#ece7ff]">
                        {cost > 0 ? `${symbol}${Math.round(cost * conversionRate).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="w-full flex flex-wrap gap-3 pt-2 border-t border-[#2e2848]">
              <Stat label="Total" value={`${symbol}${Math.round(baseCost * conversionRate).toLocaleString()}`} highlight />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#1d1930] rounded-xl border border-[#2e2848] px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-[#5c5575] font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${highlight ? "text-[#a78bfa]" : "text-[#ece7ff]"}`}>{value}</span>
    </div>
  );
}

interface MilestoneListProps {
  milestones: Milestone[];
  settings: { startDate: string };
  onAdd: (title: string, startDate: string, endDate: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays">>) => void;
  onDelete: (id: string) => void;
}

function MilestoneList({ milestones, settings, onAdd, onUpdate, onDelete }: MilestoneListProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", startDate: settings.startDate, endDate: "" });

  function commitAdd() {
    if (!draft.title.trim() || !draft.startDate || !draft.endDate) return;
    onAdd(draft.title.trim(), draft.startDate, draft.endDate);
    setDraft({ title: "", startDate: settings.startDate, endDate: "" });
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#9b93ba] uppercase tracking-wide">Milestones</h2>
        {!adding && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252041] border border-[#3d366a] text-sm text-[#a78bfa] hover:bg-[#2e2848] transition-colors"
            onClick={() => setAdding(true)}
          >
            <span className="text-base leading-none">+</span> Add milestone
          </button>
        )}
      </div>

      {milestones.length === 0 && !adding && (
        <div className="flex items-center justify-center h-24 text-sm text-[#5c5575] border border-dashed border-[#2e2848] rounded-xl">
          No milestones yet — click "Add milestone" to create one.
        </div>
      )}

      {milestones.length > 0 && (
        <div className="rounded-xl border border-[#2e2848] overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#14112a] text-left text-xs text-[#5c5575] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium w-6" />
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Start</th>
                <th className="px-4 py-2.5 font-medium">End</th>
                <th className="px-4 py-2.5 font-medium">Hardening</th>
                <th className="px-4 py-2.5 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <MilestoneRow key={m.id} milestone={m} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="rounded-xl border border-[#3d366a] bg-[#14112a] p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#5c5575] uppercase tracking-wide font-semibold">Title</label>
            <input
              autoFocus
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
              placeholder="e.g. Alpha release"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAdding(false); }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#5c5575] uppercase tracking-wide font-semibold">Start date</label>
            <input
              type="date"
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#5c5575] uppercase tracking-wide font-semibold">End date</label>
            <input
              type="date"
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              value={draft.endDate}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-40"
              disabled={!draft.title.trim() || !draft.startDate || !draft.endDate}
              onClick={commitAdd}
            >
              Add
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-[#5c5575] text-sm hover:text-[#9b93ba] transition-colors"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({
  milestone,
  onUpdate,
  onDelete,
}: {
  milestone: Milestone;
  onUpdate: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color" | "hardeningDays">>) => void;
  onDelete: (id: string) => void;
}) {
  const hardening = milestone.hardeningDays ?? 0;
  return (
    <tr className="border-t border-[#2e2848] bg-[#0d0b16] hover:bg-[#14112a] transition-colors">
      <td className="px-4 py-2">
        <div className="relative group">
          <span
            className="block w-4 h-4 rounded-sm cursor-pointer"
            style={{ background: milestone.color }}
          />
          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex flex-wrap gap-1 bg-[#1d1930] border border-[#2e2848] rounded-lg p-2 shadow-xl w-28">
            {MILESTONE_COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-sm hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => onUpdate(milestone.id, { color: c })}
              />
            ))}
          </div>
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          className="bg-transparent text-[#ece7ff] text-sm w-full focus:outline-none focus:bg-[#1a1628] focus:px-2 rounded"
          value={milestone.title}
          onChange={(e) => onUpdate(milestone.id, { title: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className="bg-transparent text-[#9b93ba] text-sm focus:outline-none focus:bg-[#1a1628] focus:px-2 rounded"
          value={milestone.startDate}
          onChange={(e) => onUpdate(milestone.id, { startDate: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className="bg-transparent text-[#9b93ba] text-sm focus:outline-none focus:bg-[#1a1628] focus:px-2 rounded"
          value={milestone.endDate}
          onChange={(e) => onUpdate(milestone.id, { endDate: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={1}
            className="w-14 bg-[#1a1628] border border-[#2e2848] text-[#ece7ff] text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] tabular-nums"
            value={hardening}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              onUpdate(milestone.id, { hardeningDays: isNaN(v) || v < 0 ? 0 : v });
            }}
          />
          <span className="text-xs text-[#5c5575]">d</span>
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <button
          className="text-[#3a3456] hover:text-[#ef4444] text-lg leading-none transition-colors"
          onClick={() => onDelete(milestone.id)}
        >
          ×
        </button>
      </td>
    </tr>
  );
}
