import { useEffect, useMemo, useState } from "react";
import type { Feature, EstimateUnit, Resource, Discipline } from "@estimator/shared";
import type { ScheduledTask } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
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
  contingencyPct: number;
}

export function SpecsTable({ tasks, features, settings, currencySymbol, contingencyPct }: Props) {
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
  const overrides = useSchedulingStore((s) => s.overrides);
  const setOverride = useSchedulingStore((s) => s.setOverride);
  const assignResource = useSchedulingStore((s) => s.assignResource);
  const resources = useSchedulingStore((s) => s.resources);

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

  // Group tasks by feature (preserving scheduler order)
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

  const totalWd   = tasks.reduce((s, t) => s + t.workingDays, 0);
  const baseCost  = tasks.reduce((s, t) => s + t.cost, 0);
  const contCost  = baseCost * contingencyPct / 100;
  const totalCost = baseCost + contCost;
  const hasCosts  = baseCost > 0;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-gray-700">Task specifications</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
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
                      <tr key={task.taskId} className="hover:bg-blue-50/30 transition-colors bg-white">
                        <td className="px-3 py-2 text-sm text-gray-400 whitespace-nowrap border-b border-gray-100">
                          {task.featureName}
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100 min-w-[140px]">
                          <EditableText
                            value={task.label}
                            onCommit={(v) => { if (meta && v.trim()) updateTaskLabel(meta.featureId, meta.groupId, task.taskId, v.trim()); }}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100">
                          <DisciplineBadge discipline={task.discipline} />
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100">
                          <div className="flex items-center gap-1">
                            <EstimateValueInput
                              value={task.estimateValue}
                              onCommit={(v) => { if (meta) updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, v, task.estimateUnit); }}
                            />
                            <select
                              value={task.estimateUnit}
                              className="border border-gray-200 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              onChange={(e) => { if (meta) updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, task.estimateValue, e.target.value as EstimateUnit); }}
                            >
                              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                            </select>
                          </div>
                        </td>

                        <td className="px-3 py-2 text-sm text-gray-500 border-b border-gray-100 tabular-nums text-right">
                          {task.workingDays % 1 === 0 ? task.workingDays : task.workingDays.toFixed(1)}d
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100 whitespace-nowrap">
                          <EditableDayCell
                            day={task.startDay}
                            settings={settings}
                            cal={cal}
                            onCommit={(d) => setOverride(task.taskId, { startDay: d, endDay: task.endDay })}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100 whitespace-nowrap">
                          <EditableDayCell
                            day={task.endDay}
                            settings={settings}
                            cal={cal}
                            onCommit={(d) => setOverride(task.taskId, { startDay: task.startDay, endDay: d })}
                          />
                        </td>

                        <td className="px-3 py-2 border-b border-gray-100">
                          <ResourcePicker
                            taskId={task.taskId}
                            discipline={task.discipline}
                            assignedResourceId={task.assignedResourceId}
                            resources={resources}
                            onAssign={assignResource}
                          />
                        </td>

                        {hasCosts && (
                          <td className="px-3 py-2 text-sm border-b border-gray-100 tabular-nums text-right">
                            {task.cost > 0
                              ? <span className="text-gray-700">{currencySymbol}{Math.round(task.cost).toLocaleString()}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        )}

                        <td className="px-3 py-2 border-b border-gray-100 min-w-[160px]">
                          <EditableText
                            value={overrides[task.taskId]?.notes ?? ""}
                            placeholder="Add note…"
                            onCommit={(v) => setOverride(task.taskId, { notes: v })}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {/* Feature subtotal row */}
                  <tr key={`subtotal-${group.featureId}`} className="bg-gray-50/80 border-t border-gray-200">
                    <td colSpan={4} className="px-3 py-1.5 text-sm font-semibold text-gray-600 italic">
                      {group.featureName}
                    </td>
                    <td className="px-3 py-1.5 text-sm font-semibold text-gray-600 tabular-nums text-right">
                      {groupWd % 1 === 0 ? groupWd : groupWd.toFixed(1)}d
                    </td>
                    <td colSpan={hasCosts ? 3 : 3} />
                    {hasCosts && (
                      <td className="px-3 py-1.5 text-sm font-semibold text-gray-600 tabular-nums text-right">
                        {groupCost > 0 ? `${currencySymbol}${Math.round(groupCost).toLocaleString()}` : "—"}
                      </td>
                    )}
                    <td />
                  </tr>
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-gray-600">Base total</td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-700 tabular-nums text-right">
                {totalWd % 1 === 0 ? totalWd : totalWd.toFixed(1)}d
              </td>
              <td colSpan={3} />
              {hasCosts && <td className="px-3 py-2 text-sm font-semibold text-gray-700 tabular-nums text-right">{currencySymbol}{Math.round(baseCost).toLocaleString()}</td>}
              <td />
            </tr>
            {hasCosts && contingencyPct > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-3 py-2 text-sm text-gray-500 italic">
                  Contingency ({contingencyPct}%)
                </td>
                <td colSpan={4} />
                <td className="px-3 py-2 text-sm text-gray-500 tabular-nums text-right italic">
                  +{currencySymbol}{Math.round(contCost).toLocaleString()}
                </td>
                <td />
              </tr>
            )}
            {hasCosts && contingencyPct > 0 && (
              <tr className="bg-gray-100 border-t border-gray-200">
                <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-700">Project total</td>
                <td colSpan={4} />
                <td className="px-3 py-2 text-sm font-bold text-gray-800 tabular-nums text-right">
                  {currencySymbol}{Math.round(totalCost).toLocaleString()}
                </td>
                <td />
              </tr>
            )}
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
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function DisciplineBadge({ discipline }: { discipline: string }) {
  const colors: Record<string, string> = {
    Art: "bg-orange-100 text-orange-700",
    Design: "bg-purple-100 text-purple-700",
    Code: "bg-sky-100 text-sky-700",
    Production: "bg-green-100 text-green-700",
    Custom: "bg-gray-100 text-gray-600",
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
      className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        className="cursor-text text-sm text-gray-500 hover:bg-gray-100 rounded px-1 -mx-1 block whitespace-nowrap tabular-nums"
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
        className="border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
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
      className="border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none w-20"
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
    return <span className="text-sm text-gray-300">—</span>;
  }

  return (
    <select
      value={assignedResourceId ?? ""}
      className="text-sm border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 max-w-[150px]"
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
        className="cursor-text text-sm text-gray-700 hover:bg-gray-100 rounded px-1 -mx-1 block min-w-[60px] leading-5"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-gray-300">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      className="border border-blue-400 rounded px-1.5 py-0.5 text-sm focus:outline-none w-full"
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
