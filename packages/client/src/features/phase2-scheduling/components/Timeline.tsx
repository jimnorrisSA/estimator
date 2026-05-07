import { useMemo, useRef, useState } from "react";
import type { Feature, EstimateUnit } from "@estimator/shared";
import type { ScheduleResult, ScheduledTask } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import {
  buildWorkingDayCalendar,
  formatDateShort,
  formatMonthYear,
  parseISODate,
} from "../utils/calendarUtils.js";

// Layout
const LABEL_W = 124;
const DAY_W = 22;
const MONTH_H = 22;
const WEEK_H = 20;
const HEADER_H = MONTH_H + WEEK_H;
const SLOT_H = 28;       // pixels per resource slot
const ROW_VPAD = 5;      // top + bottom padding inside a row
const ROW_GAP = 6;
const CONT_ROW_H = 34;
const BOTTOM_PAD = 16;

function rowHeight(cap: number) {
  return cap * SLOT_H + ROW_VPAD * 2;
}

const FEATURE_PALETTE = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
  "#ec4899", "#14b8a6",
];

interface RowLayout {
  discipline: string;
  rowY: number;
  height: number;
  capacity: number;
}

const RESIZE_HANDLE_W = 8;

function daysToEstimate(days: number, preferred: EstimateUnit): { value: number; unit: EstimateUnit } {
  const perUnit: Record<EstimateUnit, number> = { half_day: 0.5, day: 1, week: 5, month: 20 };
  const ratio = days / perUnit[preferred];
  if (ratio >= 0.5 && Math.abs(Math.round(ratio * 2) - ratio * 2) < 0.001) {
    return { value: Math.round(ratio * 2) / 2, unit: preferred };
  }
  return { value: Math.max(0.5, Math.round(days * 2) / 2), unit: "day" };
}

interface TaskBarProps {
  task: ScheduledTask;
  y: number;
  barH: number;
  color: string;
  onMove: (taskId: string, startDay: number, endDay: number) => void;
  onResize: (taskId: string, startDay: number, endDay: number, newDays: number) => void;
  onClearPin: (taskId: string) => void;
}

function DraggableTaskBar({ task, y, barH, color, onMove, onResize, onClearPin }: TaskBarProps) {
  const [preview, setPreview] = useState<{ startDay: number; endDay: number } | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize" | null>(null);

  const callbacksRef = useRef({ onMove, onResize, onClearPin });
  callbacksRef.current = { onMove, onResize, onClearPin };

  function startDrag(type: "move" | "resize", clientX: number) {
    const origStart = task.startDay;
    const origEnd = task.endDay;
    setDragType(type);

    function onMouseMove(e: MouseEvent) {
      const dx = e.clientX - clientX;
      const snap = Math.round((dx / DAY_W) * 2) / 2;
      if (type === "move") {
        const dur = origEnd - origStart;
        const s = Math.max(0, origStart + snap);
        setPreview({ startDay: s, endDay: s + dur });
      } else {
        setPreview({ startDay: origStart, endDay: Math.max(origStart + 0.5, origEnd + snap) });
      }
    }

    function onMouseUp() {
      setPreview((p) => {
        if (p) {
          if (type === "move") callbacksRef.current.onMove(task.taskId, p.startDay, p.endDay);
          else callbacksRef.current.onResize(task.taskId, p.startDay, p.endDay, p.endDay - p.startDay);
        }
        return null;
      });
      setDragType(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const dispStart = preview?.startDay ?? task.startDay;
  const dispEnd   = preview?.endDay   ?? task.endDay;
  const x    = dispStart * DAY_W;
  const barW = Math.max(2, (dispEnd - dispStart) * DAY_W - 2);
  const maxChars = Math.floor((barW - 10) / 5.5);
  const isDragging = dragType !== null;

  return (
    <g>
      <title>{task.featureName} — {task.label}{task.isPinned ? " · pinned" : ""}</title>

      {/* Bar body — drag to move */}
      <rect
        x={x} y={y} width={barW} height={barH} rx={3}
        fill={color}
        opacity={isDragging ? 0.65 : 0.88}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); startDrag("move", e.clientX); }}
        onDoubleClick={(e) => { e.stopPropagation(); onClearPin(task.taskId); }}
      />

      {/* Label */}
      {barW > 32 && (
        <text x={x + 5} y={y + barH / 2} dominantBaseline="middle" fontSize={9} fill="white"
          style={{ pointerEvents: "none", userSelect: "none" }}>
          {task.label.length > maxChars ? task.label.slice(0, maxChars) + "…" : task.label}
        </text>
      )}

      {/* Resize handle — right edge */}
      {barW > 16 && (
        <rect
          x={x + barW - RESIZE_HANDLE_W} y={y}
          width={RESIZE_HANDLE_W} height={barH}
          fill={isDragging && dragType === "resize" ? "rgba(255,255,255,0.25)" : "transparent"}
          style={{ cursor: "ew-resize" }}
          onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); startDrag("resize", e.clientX); }}
        />
      )}

      {/* Pin dot — top-left corner when pinned */}
      {task.isPinned && !isDragging && (
        <circle cx={x + 5} cy={y + 4} r={2.5} fill="white" opacity={0.8}
          style={{ pointerEvents: "none" }} />
      )}

      {/* Duration label above bar while dragging */}
      {isDragging && preview && (
        <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600"
          style={{ pointerEvents: "none", userSelect: "none" }}>
          {String(Math.round((preview.endDay - preview.startDay) * 2) / 2)}d
        </text>
      )}
    </g>
  );
}

interface Props {
  result: ScheduleResult;
  features: Feature[];
  settings: ScheduleSettings;
}

export function Timeline({ result, features, settings }: Props) {
  const { tasks, disciplines, capacities, totalDays, contingencyDays, projectEndDay } = result;

  const { setOverride, clearOverride } = useSchedulingStore();
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);

  function handleMove(taskId: string, startDay: number, endDay: number) {
    setOverride(taskId, { startDay, endDay });
  }

  function handleResize(taskId: string, startDay: number, endDay: number, newDays: number) {
    const t = tasks.find((t) => t.taskId === taskId);
    if (t) {
      const { value, unit } = daysToEstimate(newDays, t.estimateUnit);
      updateTaskEstimate(t.featureId, t.groupId, taskId, value, unit);
    }
    setOverride(taskId, { startDay, endDay });
  }

  function handleClearPin(taskId: string) {
    clearOverride(taskId);
  }

  const featureColors = useMemo(
    () => new Map(features.map((f, i) => [f.id, FEATURE_PALETTE[i % FEATURE_PALETTE.length]])),
    [features]
  );

  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual" || projectEndDay === 0) return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), projectEndDay + 1);
  }, [settings.calendarMode, settings.startDate, projectEndDay]);

  // Compute row layouts
  const rowLayouts = useMemo<RowLayout[]>(() => {
    let y = 0;
    return disciplines.map((d) => {
      const cap = capacities[d] ?? 1;
      const h = rowHeight(cap);
      const layout: RowLayout = { discipline: d, rowY: y, height: h, capacity: cap };
      y += h + ROW_GAP;
      return layout;
    });
  }, [disciplines, capacities]);

  const contY =
    rowLayouts.length > 0
      ? rowLayouts[rowLayouts.length - 1].rowY + rowLayouts[rowLayouts.length - 1].height + ROW_GAP
      : 0;

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No tasks yet — add discipline cards and tasks in Phase 1 to see the schedule.
      </div>
    );
  }

  const svgH = HEADER_H + contY + CONT_ROW_H + BOTTOM_PAD;
  const chartW = Math.max(projectEndDay * DAY_W + 20 * DAY_W, 480);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-stretch">
          {/* Fixed label column */}
          <svg width={LABEL_W} height={svgH} className="flex-shrink-0 border-r border-gray-200 bg-white">
            {rowLayouts.map((layout) => (
              <g key={layout.discipline}>
                <text
                  x={LABEL_W - 12}
                  y={HEADER_H + layout.rowY + layout.height / 2 - (layout.capacity > 1 ? 7 : 0)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={12}
                  fill="#374151"
                  fontWeight="600"
                >
                  {layout.discipline}
                </text>
                {layout.capacity > 1 && (
                  <text
                    x={LABEL_W - 12}
                    y={HEADER_H + layout.rowY + layout.height / 2 + 8}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={9}
                    fill="#9ca3af"
                  >
                    ×{layout.capacity} people
                  </text>
                )}
              </g>
            ))}
            <text
              x={LABEL_W - 12}
              y={HEADER_H + contY + CONT_ROW_H / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
              fontStyle="italic"
            >
              Contingency
            </text>
          </svg>

          {/* Scrollable chart */}
          <div className="overflow-x-auto flex-1 bg-white">
            <svg width={chartW} height={svgH}>
              {/* Row backgrounds */}
              {rowLayouts.map((layout, i) => (
                <rect
                  key={`bg-${layout.discipline}`}
                  x={0}
                  y={HEADER_H + layout.rowY}
                  width={chartW}
                  height={layout.height}
                  fill={i % 2 === 0 ? "#f9fafb" : "#ffffff"}
                />
              ))}
              <rect
                x={0}
                y={HEADER_H + contY}
                width={chartW}
                height={CONT_ROW_H}
                fill="#fafafa"
              />

              {/* Date headers */}
              {settings.calendarMode === "four-week" ? (
                <FourWeekHeader projectEndDay={projectEndDay} chartW={chartW} />
              ) : (
                <ActualDateHeader projectEndDay={projectEndDay} cal={cal} chartW={chartW} />
              )}

              {/* Grid lines */}
              <GridLines
                projectEndDay={projectEndDay}
                calendarMode={settings.calendarMode}
                cal={cal}
                svgH={svgH}
              />

              {/* Task bars */}
              {tasks.map((task) => {
                const layout = rowLayouts.find((r) => r.discipline === task.discipline);
                if (!layout) return null;
                const barH = SLOT_H - 4;
                const y = HEADER_H + layout.rowY + ROW_VPAD + task.slotIndex * SLOT_H;
                const color = featureColors.get(task.featureId) ?? "#3b82f6";
                return (
                  <DraggableTaskBar
                    key={task.taskId}
                    task={task}
                    y={y}
                    barH={barH}
                    color={color}
                    onMove={handleMove}
                    onResize={handleResize}
                    onClearPin={handleClearPin}
                  />
                );
              })}

              {/* Target end date deadline line */}
              {settings.targetEndDate && (() => {
                let deadlineDay: number | null = null;
                if (settings.calendarMode === "actual" && cal.length > 0) {
                  const target = parseISODate(settings.targetEndDate);
                  const idx = cal.findIndex(
                    (d) => d.getFullYear() === target.getFullYear() &&
                            d.getMonth() === target.getMonth() &&
                            d.getDate() === target.getDate()
                  );
                  deadlineDay = idx >= 0 ? idx : null;
                } else if (settings.calendarMode === "four-week" && settings.startDate) {
                  const start = parseISODate(settings.startDate);
                  const target = parseISODate(settings.targetEndDate);
                  const msPerDay = 86400000;
                  const calDays = Math.round((target.getTime() - start.getTime()) / msPerDay);
                  // Rough working-day estimate: 5/7 of calendar days
                  deadlineDay = Math.round(calDays * 5 / 7);
                }
                if (deadlineDay === null || deadlineDay <= 0) return null;
                const dx = deadlineDay * DAY_W;
                const isOverrun = deadlineDay < projectEndDay;
                const lineColor = isOverrun ? "#ef4444" : "#22c55e";
                return (
                  <g>
                    <line x1={dx} y1={HEADER_H} x2={dx} y2={svgH - BOTTOM_PAD}
                      stroke={lineColor} strokeWidth={2} strokeDasharray="4 3" />
                    <rect x={dx - 1} y={HEADER_H} width={isOverrun ? dx - 1 : chartW - dx}
                      height={svgH - HEADER_H - BOTTOM_PAD}
                      fill={isOverrun ? "#ef4444" : "#22c55e"} opacity={0.04} />
                    <rect x={dx - 28} y={HEADER_H + 4} width={56} height={16} rx={3}
                      fill={lineColor} />
                    <text x={dx} y={HEADER_H + 12} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9} fill="white" fontWeight="600"
                      style={{ pointerEvents: "none" }}>
                      {isOverrun ? "OVERRUN" : "TARGET"}
                    </text>
                  </g>
                );
              })()}

              {/* Contingency block */}
              {contingencyDays > 0 && (
                <g>
                  <title>Contingency — {settings.contingencyPct}%</title>
                  <rect
                    x={totalDays * DAY_W}
                    y={HEADER_H + contY + 5}
                    width={Math.max(2, contingencyDays * DAY_W - 2)}
                    height={CONT_ROW_H - 10}
                    rx={3}
                    fill="#e5e7eb"
                    stroke="#d1d5db"
                    strokeWidth={1}
                  />
                  {contingencyDays * DAY_W > 60 && (
                    <text
                      x={totalDays * DAY_W + (contingencyDays * DAY_W) / 2}
                      y={HEADER_H + contY + CONT_ROW_H / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill="#6b7280"
                    >
                      {settings.contingencyPct}% contingency
                    </text>
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>

      <FeatureLegend features={features} featureColors={featureColors} tasks={tasks} />
    </div>
  );
}

// ─── Date headers ─────────────────────────────────────────────────────────────

function FourWeekHeader({ projectEndDay, chartW }: { projectEndDay: number; chartW: number }) {
  const numMonths = Math.ceil(projectEndDay / 20);
  const els: React.ReactNode[] = [];

  for (let m = 0; m < numMonths; m++) {
    const mStart = m * 20;
    const mEnd = Math.min((m + 1) * 20, projectEndDay);
    const x = mStart * DAY_W;
    const w = (mEnd - mStart) * DAY_W;
    els.push(
      <g key={`m-${m}`}>
        <rect x={x} y={0} width={w} height={MONTH_H} fill={m % 2 === 0 ? "#f3f4f6" : "#eaecef"} />
        <text x={x + w / 2} y={MONTH_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#374151" fontWeight="600">
          Month {m + 1}
        </text>
      </g>
    );
    for (let w4 = 0; w4 < 4; w4++) {
      const wStart = mStart + w4 * 5;
      const wEnd = Math.min(wStart + 5, projectEndDay);
      if (wStart >= projectEndDay) break;
      const wx = wStart * DAY_W;
      const ww = (wEnd - wStart) * DAY_W;
      els.push(
        <g key={`w-${m}-${w4}`}>
          <rect x={wx} y={MONTH_H} width={ww} height={WEEK_H} fill={(m + w4) % 2 === 0 ? "#f9fafb" : "#ffffff"} />
          <text x={wx + ww / 2} y={MONTH_H + WEEK_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
            W{w4 + 1}
          </text>
        </g>
      );
    }
  }

  els.push(<line key="hdr-border" x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" strokeWidth={1} />);
  return <>{els}</>;
}

function ActualDateHeader({ projectEndDay, cal, chartW }: { projectEndDay: number; cal: Date[]; chartW: number }) {
  if (cal.length === 0) return null;
  const els: React.ReactNode[] = [];
  let monthKey = -1;
  let monthStart = 0;
  let monthIdx = 0;

  const flushMonth = (endDay: number) => {
    if (monthKey === -1) return;
    const x = monthStart * DAY_W;
    const w = (endDay - monthStart) * DAY_W;
    if (w <= 0) return;
    els.push(
      <g key={`month-${monthKey}`}>
        <rect x={x} y={0} width={w} height={MONTH_H} fill={monthIdx % 2 === 0 ? "#f3f4f6" : "#eaecef"} />
        <text x={x + w / 2} y={MONTH_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#374151" fontWeight="600">
          {formatMonthYear(cal[monthStart])}
        </text>
      </g>
    );
    monthIdx++;
  };

  for (let d = 0; d < projectEndDay; d++) {
    const date = cal[d];
    if (!date) continue;
    const mk = date.getFullYear() * 12 + date.getMonth();
    if (mk !== monthKey) {
      flushMonth(d);
      monthKey = mk;
      monthStart = d;
    }
    if (date.getDay() === 1) {
      els.push(
        <text key={`wk-${d}`} x={d * DAY_W + 3} y={MONTH_H + WEEK_H / 2} dominantBaseline="middle" fontSize={9} fill="#9ca3af">
          {formatDateShort(date)}
        </text>
      );
    }
  }
  flushMonth(projectEndDay);
  els.push(<line key="hdr-border" x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#e5e7eb" strokeWidth={1} />);
  return <>{els}</>;
}

function GridLines({ projectEndDay, calendarMode, cal, svgH }: { projectEndDay: number; calendarMode: string; cal: Date[]; svgH: number }) {
  const bottom = svgH - BOTTOM_PAD;
  const lines: React.ReactNode[] = [];
  if (calendarMode === "four-week") {
    for (let d = 5; d <= projectEndDay; d += 5) {
      const isMonth = d % 20 === 0;
      lines.push(
        <line key={`gl-${d}`} x1={d * DAY_W} y1={HEADER_H} x2={d * DAY_W} y2={bottom} stroke={isMonth ? "#d1d5db" : "#f3f4f6"} strokeWidth={isMonth ? 1.5 : 1} />
      );
    }
  } else {
    for (let d = 0; d < projectEndDay; d++) {
      const date = cal[d];
      if (!date || date.getDay() !== 1) continue;
      const isMonthStart = date.getDate() <= 7;
      lines.push(
        <line key={`gl-${d}`} x1={d * DAY_W} y1={HEADER_H} x2={d * DAY_W} y2={bottom} stroke={isMonthStart ? "#d1d5db" : "#f3f4f6"} strokeWidth={isMonthStart ? 1.5 : 1} />
      );
    }
  }
  return <>{lines}</>;
}

function FeatureLegend({ features, featureColors, tasks }: { features: Feature[]; featureColors: Map<string, string>; tasks: ScheduledTask[] }) {
  const activeIds = new Set(tasks.map((t) => t.featureId));
  const active = features.filter((f) => activeIds.has(f.id));
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {active.map((f) => (
        <div key={f.id} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: featureColors.get(f.id) ?? "#3b82f6" }} />
          {f.name}
        </div>
      ))}
    </div>
  );
}
