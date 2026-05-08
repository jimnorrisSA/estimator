import { useEffect, useMemo, useState } from "react";
import type { Feature, EstimateUnit, Resource, Discipline } from "@estimator/shared";
import type { ScheduledTask } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, getConversionRate } from "../store/schedulingStore.js";
import { buildWorkingDayCalendar, formatDateShort, parseISODate } from "../utils/calendarUtils.js";

const UNITS: EstimateUnit[] = ["half_day", "day", "week", "month"];
const UNIT_LABELS: Record<EstimateUnit, string> = {
  half_day: "½ day",
  day: "day",
  week: "week",
  month: "month",
};

interface Props {
  tasks: ScheduledTask[];
  features: Feature[];
  settings: ScheduleSettings;
  currencySymbol: string;
}

export function SpecsTable({ tasks, features, settings, currencySymbol }: Props) {
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
  const duplicateTask = useEstimationsStore((s) => s.duplicateTask);
  const overrides = useSchedulingStore((s) => s.overrides);
  const setOverride = useSchedulingStore((s) => s.setOverride);
  const assignResource = useSchedulingStore((s) => s.assignResource);
  const resources = useSchedulingStore((s) => s.resources);
  const schedulingSettings = useSchedulingStore((s) => s.settings);
  const conversionRate = getConversionRate(schedulingSettings);

  const maxDay = tasks.length > 0 ? Math.max(...tasks.map((t) => t.endDay)) : 0;

  const cal = useMemo(() => {
    if (maxDay === 0) return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), maxDay + 2);
  }, [settings.startDate, maxDay]);

  const taskMeta = useMemo(
    () =>
      new Map(
        features.flatMap((f) =>
          f.groups.flatMap((g) => g.tasks.map((t) => [t.id, { featureId: f.id, groupId: g.id }]))
        )
      ),
    [features]
  );

  const featureGroups = useMemo(() => {
    const groups: { featureId: string; featureName: string; tasks: ScheduledTask[] }[] = [];
    const idx = new Map<string, number>();
    for (const task of tasks) {
      if (!idx.has(task.featureId)) {
        idx.set(task.featureId, groups.length);
        groups.push({ featureId: task.featureId, featureName: task.featureName, tasks: [] });
      }
      groups[idx.get(task.featureId)!].tasks.push(task);
    }
    return groups;
  }, [tasks]);

  if (tasks.length === 0) return null;

  const totalWd  = tasks.reduce((s, t) => s + t.workingDays, 0);
  const baseCost = tasks.reduce((s, t) => s + t.cost, 0);
  const hasCosts = baseCost > 0;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-[#9b93ba] uppercase tracking-wide">Task specifications</h3>
      <div className="overflow-x-auto rounded-xl border border-[#2e2848] shadow-sm shadow-black/30">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1a1628] border-b border-[#2e2848]">
              <Th>Feature</Th>
              <Th>Task</Th>
              <Th>Discipline</Th>
              <Th>Estimate</Th>
              <Th align="right">Days</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Resource</Th>
              {hasCosts && <Th align="right">Cost</Th>}
              <Th>Notes</Th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {featureGroups.map((group) => {
              const groupWd   = group.tasks.reduce((s, t) => s + t.workingDays, 0);
              const groupCost = group.tasks.reduce((s, t) => s + t.cost, 0);
              return (
                <>
                  {group.tasks.map((task) => {
                    const meta = taskMeta.get(task.taskId);
                    return (
                      <tr key={task.taskId} className="hover:bg-[#1e1548]/30 transition-colors bg-[#1d1930]">
                        <td className="px-3 py-2 text-sm text-[#5c5575] whitespace-nowrap border-b border-[#2e2848]">
                          {task.featureName}
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848] min-w-[140px]">
                          <EditableText
                            value={task.label}
                            onCommit={(v) => { if (meta && v.trim()) updateTaskLabel(meta.featureId, meta.groupId, task.taskId, v.trim()); }}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848]">
                          <DisciplineBadge discipline={task.discipline} />
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848]">
                          <div className="flex items-center gap-1">
                            <EstimateValueInput
                              value={task.estimateValue}
                              onCommit={(v) => { if (meta) updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, v, task.estimateUnit); }}
                            />
                            <select
                              value={task.estimateUnit}
                              className="border border-[#2e2848] bg-[#1a1628] text-[#9b93ba] rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                              onChange={(e) => { if (meta) updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, task.estimateValue, e.target.value as EstimateUnit); }}
                            >
                              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                            </select>
                          </div>
                        </td>

                        <td className="px-3 py-2 text-sm text-[#9b93ba] border-b border-[#2e2848] tabular-nums text-right">
                          {task.workingDays % 1 === 0 ? task.workingDays : task.workingDays.toFixed(1)}d
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848] whitespace-nowrap">
                          <EditableDayCell
                            day={task.startDay}
                            settings={settings}
                            cal={cal}
                            onCommit={(d) => setOverride(task.taskId, { startDay: d, endDay: task.endDay })}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848] whitespace-nowrap">
                          <EditableDayCell
                            day={task.endDay}
                            settings={settings}
                            cal={cal}
                            onCommit={(d) => setOverride(task.taskId, { startDay: task.startDay, endDay: d })}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-[#2e2848]">
                          <ResourcePicker
                            taskId={task.taskId}
                            discipline={task.discipline}
                            assignedResourceId={task.assignedResourceId}
                            resources={resources}
                            onAssign={assignResource}
                          />
                        </td>

                        {hasCosts && (
                          <td className="px-3 py-2 text-sm border-b border-[#2e2848] tabular-nums text-right">
                            {task.cost > 0
                              ? <span className="text-[#a78bfa]">{currencySymbol}{Math.round(task.cost * conversionRate).toLocaleString()}</span>
                              : <span className="text-[#3a3456]">—</span>}
                          </td>
                        )}

                        <td className="px-3 py-2 border-b border-[#2e2848] min-w-[160px]">
                          <EditableText
                            value={overrides[task.taskId]?.notes ?? ""}
                            placeholder="Add note…"
                            onCommit={(v) => setOverride(task.taskId, { notes: v })}
                          />
                        </td>

                        <td className="px-2 py-2 border-b border-[#2e2848]">
                          {meta && (
                            <button
                              title="Duplicate task"
                              className="text-[#3a3456] hover:text-[#a78bfa] transition-colors text-base leading-none"
                              onClick={() => duplicateTask(meta.featureId, meta.groupId, task.taskId)}
                            >
                              ⧉
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Feature subtotal row */}
                  <tr key={`subtotal-${group.featureId}`} className="bg-[#1a1628] border-t border-[#2e2848]">
                    <td colSpan={4} className="px-3 py-1.5 text-sm font-semibold text-[#9b93ba] italic">
                      {group.featureName}
                    </td>
                    <td className="px-3 py-1.5 text-sm font-semibold text-[#9b93ba] tabular-nums text-right">
                      {groupWd % 1 === 0 ? groupWd : groupWd.toFixed(1)}d
                    </td>
                    <td colSpan={3} />
                    {hasCosts && (
                      <td className="px-3 py-1.5 text-sm font-semibold text-[#a78bfa] tabular-nums text-right">
                        {groupCost > 0 ? `${currencySymbol}${Math.round(groupCost * conversionRate).toLocaleString()}` : "—"}
                      </td>
                    )}
                    <td colSpan={2} />
                  </tr>
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#1a1628] border-t-2 border-[#3d366a]">
              <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-[#9b93ba]">Total</td>
              <td className="px-3 py-2 text-sm font-semibold text-[#ece7ff] tabular-nums text-right">
                {totalWd % 1 === 0 ? totalWd : totalWd.toFixed(1)}d
              </td>
              <td colSpan={3} />
              {hasCosts && <td className="px-3 py-2 text-sm font-semibold text-[#ece7ff] tabular-nums text-right">{currencySymbol}{Math.round(baseCost * conversionRate).toLocaleString()}</td>}
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-[#5c5575] uppercase tracking-wide whitespace-nowrap ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function DisciplineBadge({ discipline }: { discipline: string }) {
  const colors: Record<string, string> = {
    Art:        "bg-amber-900/40 text-amber-400",
    Design:     "bg-purple-900/40 text-purple-400",
    Code:       "bg-sky-900/40 text-sky-400",
    Production: "bg-green-900/40 text-green-400",
    Custom:     "bg-gray-800 text-gray-400",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[discipline] ?? colors.Custom}`}>
      {discipline}
    </span>
  );
}

function EstimateValueInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      min={0.5}
      step={0.5}
      className="w-16 border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = parseFloat(draft);
        if (!isNaN(v) && v > 0) onCommit(v);
        else setDraft(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setDraft(String(value)); e.currentTarget.blur(); }
      }}
    />
  );
}

function EditableDayCell({
  day, settings, cal, onCommit,
}: {
  day: number;
  settings: ScheduleSettings;
  cal: Date[];
  onCommit: (day: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  function label() {
    if (settings.calendarMode === "actual" && cal[day]) return formatDateShort(cal[day]);
    const m = Math.floor(day / 20) + 1;
    const w = Math.floor((day % 20) / 5) + 1;
    return `M${m} W${w}`;
  }

  if (!editing) {
    return (
      <span
        className="cursor-text text-sm text-[#9b93ba] hover:bg-[#252041] rounded px-1 -mx-1 block whitespace-nowrap tabular-nums transition-colors"
        title="Click to override"
        onClick={() => setEditing(true)}
      >
        {label()}
      </span>
    );
  }

  if (settings.calendarMode === "actual" && cal.length > 0) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={cal[day] ? cal[day].toISOString().slice(0, 10) : ""}
        className="border border-[#7c3aed] bg-[#1a1628] text-[#ece7ff] rounded px-1 py-0.5 text-sm focus:outline-none"
        onBlur={(e) => {
          if (e.target.value) {
            const target = parseISODate(e.target.value);
            const idx = cal.findIndex(
              (d) => d.getFullYear() === target.getFullYear() &&
                     d.getMonth() === target.getMonth() &&
                     d.getDate() === target.getDate()
            );
            if (idx >= 0) onCommit(idx);
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <input
      type="number"
      autoFocus
      min={0}
      defaultValue={day}
      className="border border-[#7c3aed] bg-[#1a1628] text-[#ece7ff] rounded px-1.5 py-0.5 text-sm focus:outline-none w-20"
      onBlur={(e) => {
        const v = parseInt(e.target.value);
        if (!isNaN(v) && v >= 0) onCommit(v);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function ResourcePicker({
  taskId,
  discipline,
  assignedResourceId,
  resources,
  onAssign,
}: {
  taskId: string;
  discipline: Discipline;
  assignedResourceId?: string;
  resources: Resource[];
  onAssign: (taskId: string, resourceId: string | null) => void;
}) {
  const matching = resources.filter((r) => r.role === discipline);

  if (matching.length === 0) {
    return <span className="text-sm text-[#3a3456]">—</span>;
  }

  return (
    <select
      value={assignedResourceId ?? ""}
      className="text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] max-w-[150px]"
      onChange={(e) => onAssign(taskId, e.target.value || null)}
    >
      <option value="">Unassigned</option>
      {matching.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

function EditableText({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        className="cursor-text text-sm text-[#ece7ff] hover:bg-[#252041] rounded px-1 -mx-1 block min-w-[60px] leading-5 transition-colors"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-[#3a3456]">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      className="border border-[#7c3aed] bg-[#1a1628] text-[#ece7ff] rounded px-1.5 py-0.5 text-sm focus:outline-none w-full"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onCommit(draft); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { onCommit(draft); setEditing(false); }
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
