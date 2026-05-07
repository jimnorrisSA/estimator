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
}

export function SpecsTable({ tasks, features, settings, currencySymbol }: Props) {
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
  const overrides = useSchedulingStore((s) => s.overrides);
  const setOverride = useSchedulingStore((s) => s.setOverride);
  const assignResource = useSchedulingStore((s) => s.assignResource);
  const resources = useSchedulingStore((s) => s.resources);

  const maxDay = tasks.length > 0 ? Math.max(...tasks.map((t) => t.endDay)) : 0;

  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual" || maxDay === 0) return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), maxDay + 2);
  }, [settings.calendarMode, settings.startDate, maxDay]);

  const taskMeta = useMemo(
    () =>
      new Map(
        features.flatMap((f) =>
          f.groups.flatMap((g) => g.tasks.map((t) => [t.id, { featureId: f.id, groupId: g.id }]))
        )
      ),
    [features]
  );

  if (tasks.length === 0) return null;

  function dayLabel(day: number) {
    if (settings.calendarMode === "actual" && cal[day]) {
      return formatDateShort(cal[day]);
    }
    const m = Math.floor(day / 20) + 1;
    const w = Math.floor((day % 20) / 5) + 1;
    return `M${m} W${w}`;
  }

  const totalWd = tasks.reduce((s, t) => s + t.workingDays, 0);
  const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
  const hasCosts = tasks.some((t) => t.cost > 0);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-700">Task specifications</h3>
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
            {tasks.map((task, idx) => {
              const meta = taskMeta.get(task.taskId);
              return (
                <tr
                  key={task.taskId}
                  className={`hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                >
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap border-b border-gray-100">
                    {task.featureName}
                  </td>

                  <td className="px-3 py-2 border-b border-gray-100 min-w-[140px]">
                    <EditableText
                      value={task.label}
                      onCommit={(v) => {
                        if (!meta || !v.trim()) return;
                        updateTaskLabel(meta.featureId, meta.groupId, task.taskId, v.trim());
                      }}
                    />
                  </td>

                  <td className="px-3 py-2 border-b border-gray-100">
                    <DisciplineBadge discipline={task.discipline} />
                  </td>

                  <td className="px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      <EstimateValueInput
                        value={task.estimateValue}
                        onCommit={(v) => {
                          if (!meta) return;
                          updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, v, task.estimateUnit);
                        }}
                      />
                      <select
                        value={task.estimateUnit}
                        className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        onChange={(e) => {
                          if (!meta) return;
                          updateTaskEstimate(
                            meta.featureId,
                            meta.groupId,
                            task.taskId,
                            task.estimateValue,
                            e.target.value as EstimateUnit
                          );
                        }}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 tabular-nums text-right">
                    {task.workingDays % 1 === 0 ? task.workingDays : task.workingDays.toFixed(1)}d
                  </td>

                  <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 whitespace-nowrap tabular-nums">
                    {dayLabel(task.startDay)}
                  </td>

                  <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 whitespace-nowrap tabular-nums">
                    {dayLabel(task.endDay)}
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
                    <td className="px-3 py-2 text-xs border-b border-gray-100 tabular-nums text-right">
                      {task.cost > 0 ? (
                        <span className="text-gray-700">{currencySymbol}{Math.round(task.cost).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-600">
                Totals
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-gray-700 tabular-nums text-right">
                {totalWd % 1 === 0 ? totalWd : totalWd.toFixed(1)}d
              </td>
              <td colSpan={2} />
              {hasCosts && (
                <td className="px-3 py-2 text-xs font-semibold text-gray-700 tabular-nums text-right">
                  {currencySymbol}{Math.round(totalCost).toLocaleString()}
                </td>
              )}
              <td />
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
      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
    return <span className="text-xs text-gray-300">—</span>;
  }

  return (
    <select
      value={assignedResourceId ?? ""}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 max-w-[140px]"
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
        className="cursor-text text-xs text-gray-700 hover:bg-gray-100 rounded px-1 -mx-1 block min-w-[60px] leading-5"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || <span className="text-gray-300">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      className="border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full"
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
