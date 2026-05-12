import { useMemo, useRef, useState } from "react";
import type { Feature, EstimateUnit } from "@estimator/shared";
import type { ScheduleResult, ScheduledTask } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useMilestonesStore } from "../../phase3-milestones/store/milestonesStore.js";
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
const MILESTONE_LANE_H = 30;
const SLOT_H = 40;
const ROW_VPAD = 5;
const ROW_GAP = 6;
const BOTTOM_PAD = 16;

function rowHeight(cap: number) {
  return cap * SLOT_H + ROW_VPAD * 2;
}

const FEATURE_PALETTE = [
  "#7c3aed", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#06b6d4", "#f97316", "#a78bfa",
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
  const maxFeatureChars = Math.floor((barW - 10) / 4.8);
  const isDragging = dragType !== null;
  const featureY = y + Math.round(barH * 0.3);
  const taskY = y + Math.round(barH * 0.68);

  return (
    <g>
      <title>{task.featureName} — {task.label}{task.isPinned ? " · pinned" : ""}</title>

      <rect
        x={x} y={y} width={barW} height={barH} rx={3}
        fill={color}
        opacity={isDragging ? 0.55 : 0.9}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); startDrag("move", e.clientX); }}
        onDoubleClick={(e) => { e.stopPropagation(); onClearPin(task.taskId); }}
      />

      {barW > 40 && (
        <>
          <text x={x + 5} y={featureY} dominantBaseline="middle" fontSize={9}
            fill="rgba(255,255,255,0.65)"
            style={{ pointerEvents: "none", userSelect: "none" }}>
            {task.featureName.length > maxFeatureChars ? task.featureName.slice(0, maxFeatureChars) + "…" : task.featureName}
          </text>
          <text x={x + 5} y={taskY} dominantBaseline="middle" fontSize={11} fill="white"
            style={{ pointerEvents: "none", userSelect: "none" }}>
            {task.label.length > maxChars ? task.label.slice(0, maxChars) + "…" : task.label}
          </text>
        </>
      )}

      {barW > 16 && (
        <rect
          x={x + barW - RESIZE_HANDLE_W} y={y}
          width={RESIZE_HANDLE_W} height={barH}
          fill={isDragging && dragType === "resize" ? "rgba(255,255,255,0.25)" : "transparent"}
          style={{ cursor: "ew-resize" }}
          onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); startDrag("resize", e.clientX); }}
        />
      )}

      {task.isPinned && !isDragging && (
        <circle cx={x + 5} cy={y + 4} r={2.5} fill="white" opacity={0.8}
          style={{ pointerEvents: "none" }} />
      )}

      {isDragging && preview && (
        <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#a78bfa" fontWeight="600"
          style={{ pointerEvents: "none", userSelect: "none" }}>
          {String(Math.round((preview.endDay - preview.startDay) * 2) / 2)}d
        </text>
      )}
    </g>
  );
}

const SUMMARY_ROW_H = 36;

interface Props {
  result: ScheduleResult;
  features: Feature[];
  settings: ScheduleSettings;
  viewMode: "detailed" | "summary";
  onToggleView: () => void;
}

export function Timeline({ result, features, settings, viewMode, onToggleView }: Props) {
  const { tasks, disciplines, capacities, projectEndDay, slotContingency, blockedPeriods } = result;

  const { setOverride, clearOverride } = useSchedulingStore();
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
  const milestones = useMilestonesStore((s) => s.milestones);
  const milestoneH = milestones.length > 0 ? MILESTONE_LANE_H : 0;

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

  const summaryRows = useMemo(() => {
    let y = 0;
    return features
      .map((f) => {
        const ft = tasks.filter((t) => t.featureId === f.id);
        if (!ft.length) return null;
        const rowY = y;
        y += SUMMARY_ROW_H + ROW_GAP;
        return {
          featureId: f.id,
          featureName: f.name,
          startDay: Math.min(...ft.map((t) => t.startDay)),
          endDay: Math.max(...ft.map((t) => t.endDay)),
          color: featureColors.get(f.id) ?? "#7c3aed",
          rowY,
        };
      })
      .filter(Boolean) as { featureId: string; featureName: string; startDay: number; endDay: number; color: string; rowY: number }[];
  }, [features, tasks, featureColors]);

  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual" || projectEndDay === 0) return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), projectEndDay + 1);
  }, [settings.calendarMode, settings.startDate, projectEndDay]);

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

  const detailedH =
    rowLayouts.length > 0
      ? rowLayouts[rowLayouts.length - 1].rowY + rowLayouts[rowLayouts.length - 1].height + ROW_GAP
      : 0;
  const summaryH = summaryRows.length * (SUMMARY_ROW_H + ROW_GAP);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-[#5c5575] border border-dashed border-[#2e2848] rounded-xl">
        No tasks yet — add discipline cards and tasks in Phase 1 to see the schedule.
      </div>
    );
  }

  const svgH = HEADER_H + milestoneH + (viewMode === "detailed" ? detailedH : summaryH) + BOTTOM_PAD;
  const chartW = Math.max(projectEndDay * DAY_W + 20 * DAY_W, 480);

  return (
    <div className="flex flex-col gap-3">
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border border-[#2e2848] overflow-hidden text-xs shadow-sm">
          {(["detailed", "summary"] as const).map((mode) => (
            <button
              key={mode}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === mode
                  ? "bg-[#7c3aed] text-white font-medium"
                  : "bg-[#1d1930] text-[#5c5575] hover:bg-[#252041]"
              }`}
              onClick={onToggleView}
            >
              {mode === "detailed" ? "Detailed" : "Summary"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2e2848] shadow-sm shadow-black/40">
        <div className="flex items-stretch">
          {/* Fixed label column */}
          <svg data-label-svg width={LABEL_W} height={svgH} className="flex-shrink-0 border-r border-[#2e2848]" style={{ background: "#14112a" }}>
            {milestoneH > 0 && (
              <>
                <rect x={0} y={HEADER_H} width={LABEL_W} height={milestoneH} fill="#1a1628" />
                <text x={LABEL_W - 12} y={HEADER_H + milestoneH / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#5c5575" fontStyle="italic">
                  Milestones
                </text>
                <line x1={0} y1={HEADER_H + milestoneH} x2={LABEL_W} y2={HEADER_H + milestoneH} stroke="#2e2848" strokeWidth={1} />
              </>
            )}
            {viewMode === "detailed"
              ? rowLayouts.map((layout) => (
                  <g key={layout.discipline}>
                    <text
                      x={LABEL_W - 12}
                      y={HEADER_H + milestoneH + layout.rowY + layout.height / 2 - (layout.capacity > 1 ? 8 : 0)}
                      textAnchor="end" dominantBaseline="middle" fontSize={13} fill="#c5bedf" fontWeight="600"
                    >
                      {layout.discipline}
                    </text>
                    {layout.capacity > 1 && (
                      <text
                        x={LABEL_W - 12}
                        y={HEADER_H + milestoneH + layout.rowY + layout.height / 2 + 9}
                        textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#5c5575"
                      >
                        ×{layout.capacity} people
                      </text>
                    )}
                  </g>
                ))
              : summaryRows.map((row) => (
                  <text
                    key={row.featureId}
                    x={LABEL_W - 12}
                    y={HEADER_H + milestoneH + row.rowY + SUMMARY_ROW_H / 2}
                    textAnchor="end" dominantBaseline="middle" fontSize={12} fill="#c5bedf" fontWeight="600"
                  >
                    {row.featureName.length > 12 ? row.featureName.slice(0, 11) + "…" : row.featureName}
                  </text>
                ))}
          </svg>

          {/* Scrollable chart */}
          <div className="overflow-x-auto flex-1" style={{ background: "#14112a" }}>
            <svg data-chart-svg width={chartW} height={svgH}>
              {/* Milestone lane */}
              {milestoneH > 0 && (
                <>
                  <rect x={0} y={HEADER_H} width={chartW} height={milestoneH} fill="#1a1628" />
                  {milestones.map((m) => {
                    const { startDay, endDay } = milestoneWorkingDays(m, settings.calendarMode, settings.startDate, cal);
                    const x = startDay * DAY_W;
                    const w = Math.max(4, (endDay - startDay) * DAY_W - 2);
                    const barH = milestoneH - 8;
                    const maxChars = Math.floor((w - 10) / 5.5);
                    return (
                      <g key={m.id}>
                        <rect x={x} y={HEADER_H + 4} width={w} height={barH} rx={3} fill={m.color} opacity={0.85} />
                        {w > 30 && (
                          <text x={x + 5} y={HEADER_H + 4 + barH / 2} dominantBaseline="middle" fontSize={10} fontWeight="600" fill="white" style={{ pointerEvents: "none", userSelect: "none" }}>
                            {m.title.length > maxChars ? m.title.slice(0, maxChars) + "…" : m.title}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <line x1={0} y1={HEADER_H + milestoneH} x2={chartW} y2={HEADER_H + milestoneH} stroke="#2e2848" strokeWidth={1} />
                </>
              )}

              {/* Row backgrounds */}
              {viewMode === "detailed"
                ? rowLayouts.map((layout, i) => (
                    <rect key={`bg-${layout.discipline}`}
                      x={0} y={HEADER_H + milestoneH + layout.rowY} width={chartW} height={layout.height}
                      fill={i % 2 === 0 ? "#1d1930" : "#201c32"} />
                  ))
                : summaryRows.map((row, i) => (
                    <rect key={`bg-${row.featureId}`}
                      x={0} y={HEADER_H + milestoneH + row.rowY} width={chartW} height={SUMMARY_ROW_H}
                      fill={i % 2 === 0 ? "#1d1930" : "#201c32"} />
                  ))}

              {/* Hardening overlays — span all discipline rows */}
              {blockedPeriods.map((bp) => {
                const bx = bp.start * DAY_W;
                const bw = Math.max(2, (bp.end - bp.start) * DAY_W);
                const rowsH =
                  viewMode === "detailed"
                    ? rowLayouts.length > 0
                      ? rowLayouts[rowLayouts.length - 1].rowY + rowLayouts[rowLayouts.length - 1].height
                      : 0
                    : summaryRows.length * (SUMMARY_ROW_H + ROW_GAP);
                const by = HEADER_H + milestoneH;
                return (
                  <g key={`harden-${bp.label}`}>
                    <title>{bp.label}</title>
                    <rect
                      x={bx} y={by} width={bw} height={rowsH}
                      fill={bp.color} opacity={0.13}
                    />
                    <rect
                      x={bx} y={by} width={bw} height={rowsH}
                      fill="none" stroke={bp.color} strokeWidth={1.5} opacity={0.5}
                    />
                    {bw > 40 && (
                      <text
                        x={bx + bw / 2} y={by + Math.min(rowsH / 2, 60)}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={10} fontWeight="600"
                        fill={bp.color} opacity={0.85}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                        transform={bw < 80 ? `rotate(-90, ${bx + bw / 2}, ${by + Math.min(rowsH / 2, 60)})` : undefined}
                      >
                        {bp.label}
                      </text>
                    )}
                  </g>
                );
              })}

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
                milestoneH={milestoneH}
              />

              {/* Task bars */}
              {viewMode === "detailed"
                ? tasks.map((task) => {
                    const layout = rowLayouts.find((r) => r.discipline === task.discipline);
                    if (!layout) return null;
                    const barH = SLOT_H - 4;
                    const y = HEADER_H + milestoneH + layout.rowY + ROW_VPAD + task.slotIndex * SLOT_H;
                    const color = featureColors.get(task.featureId) ?? "#7c3aed";
                    return (
                      <DraggableTaskBar key={task.taskId} task={task} y={y} barH={barH} color={color}
                        onMove={handleMove} onResize={handleResize} onClearPin={handleClearPin} />
                    );
                  })
                : summaryRows.map((row) => {
                    const x = row.startDay * DAY_W;
                    const barW = Math.max(4, (row.endDay - row.startDay) * DAY_W - 2);
                    const y = HEADER_H + milestoneH + row.rowY + 5;
                    const barH = SUMMARY_ROW_H - 10;
                    const maxChars = Math.floor((barW - 10) / 6);
                    return (
                      <g key={row.featureId}>
                        <title>{row.featureName}</title>
                        <rect x={x} y={y} width={barW} height={barH} rx={4} fill={row.color} opacity={0.9} />
                        {barW > 40 && (
                          <text x={x + 8} y={y + barH / 2} dominantBaseline="middle"
                            fontSize={11} fontWeight="600" fill="white"
                            style={{ pointerEvents: "none", userSelect: "none" }}>
                            {row.featureName.length > maxChars ? row.featureName.slice(0, maxChars) + "…" : row.featureName}
                          </text>
                        )}
                      </g>
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
                  deadlineDay = Math.round(calDays * 5 / 7);
                }
                if (deadlineDay === null || deadlineDay <= 0) return null;
                const dx = deadlineDay * DAY_W;
                const isOverrun = deadlineDay < projectEndDay;
                const lineColor = isOverrun ? "#ef4444" : "#22c55e";
                return (
                  <g>
                    <line x1={dx} y1={HEADER_H + milestoneH} x2={dx} y2={svgH - BOTTOM_PAD}
                      stroke={lineColor} strokeWidth={2} strokeDasharray="4 3" />
                    <rect x={dx - 1} y={HEADER_H + milestoneH} width={isOverrun ? dx - 1 : chartW - dx}
                      height={svgH - HEADER_H - milestoneH - BOTTOM_PAD}
                      fill={isOverrun ? "#ef4444" : "#22c55e"} opacity={0.05} />
                    <rect x={dx - 28} y={HEADER_H + milestoneH + 4} width={56} height={16} rx={3}
                      fill={lineColor} />
                    <text x={dx} y={HEADER_H + milestoneH + 12} textAnchor="middle" dominantBaseline="middle"
                      fontSize={10} fill="white" fontWeight="600"
                      style={{ pointerEvents: "none" }}>
                      {isOverrun ? "OVERRUN" : "TARGET"}
                    </text>
                  </g>
                );
              })()}

              {/* Per-member contingency buffers */}
              {viewMode === "detailed" && slotContingency.map((sc) => {
                const layout = rowLayouts.find((r) => r.discipline === sc.discipline);
                if (!layout || sc.contingencyDays <= 0) return null;
                const barH = SLOT_H - 4;
                const bx = sc.lastTaskEndDay * DAY_W;
                const bw = Math.max(2, sc.contingencyDays * DAY_W - 2);
                const by = HEADER_H + milestoneH + layout.rowY + ROW_VPAD + sc.slotIndex * SLOT_H;
                return (
                  <g key={`buf-${sc.discipline}-${sc.slotIndex}`}>
                    <title>{sc.discipline} slot {sc.slotIndex + 1} — {sc.contingencyDays}d buffer ({settings.contingencyPct}%)</title>
                    <rect x={bx} y={by} width={bw} height={barH} rx={3}
                      fill="rgba(255,255,255,0.04)" stroke="#3d366a" strokeWidth={1} strokeDasharray="4 3" />
                    {bw > 28 && (
                      <text x={bx + bw / 2} y={by + barH / 2} dominantBaseline="middle" textAnchor="middle"
                        fontSize={9} fill="#4a4060" style={{ pointerEvents: "none", userSelect: "none" }}>
                        +{sc.contingencyDays}d
                      </text>
                    )}
                  </g>
                );
              })}
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
        <rect x={x} y={0} width={w} height={MONTH_H} fill={m % 2 === 0 ? "#1a1628" : "#211d38"} />
        <text x={x + w / 2} y={MONTH_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#c5bedf" fontWeight="600">
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
          <rect x={wx} y={MONTH_H} width={ww} height={WEEK_H} fill={(m + w4) % 2 === 0 ? "#1d1930" : "#201c32"} />
          <text x={wx + ww / 2} y={MONTH_H + WEEK_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#5c5575">
            W{w4 + 1}
          </text>
        </g>
      );
    }
  }

  els.push(<line key="hdr-border" x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#2e2848" strokeWidth={1} />);
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
        <rect x={x} y={0} width={w} height={MONTH_H} fill={monthIdx % 2 === 0 ? "#1a1628" : "#211d38"} />
        <text x={x + w / 2} y={MONTH_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#c5bedf" fontWeight="600">
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
        <text key={`wk-${d}`} x={d * DAY_W + 3} y={MONTH_H + WEEK_H / 2} dominantBaseline="middle" fontSize={10} fill="#5c5575">
          {formatDateShort(date)}
        </text>
      );
    }
  }
  flushMonth(projectEndDay);
  els.push(<line key="hdr-border" x1={0} y1={HEADER_H} x2={chartW} y2={HEADER_H} stroke="#2e2848" strokeWidth={1} />);
  return <>{els}</>;
}

function milestoneWorkingDays(
  m: { startDate: string; endDate: string },
  calendarMode: string,
  startDate: string,
  cal: Date[]
): { startDay: number; endDay: number } {
  if (calendarMode === "actual" && cal.length > 0) {
    const mStart = parseISODate(m.startDate);
    const mEnd = parseISODate(m.endDate);
    const startDay = Math.max(0, cal.findIndex((d) => d >= mStart));
    let endDay = cal.findIndex((d) => d > mEnd);
    if (endDay < 0) endDay = cal.length;
    return { startDay, endDay: Math.max(startDay + 1, endDay) };
  }
  const projStart = parseISODate(startDate);
  const mStart = parseISODate(m.startDate);
  const mEnd = parseISODate(m.endDate);
  return {
    startDay: Math.max(0, Math.round(((mStart.getTime() - projStart.getTime()) / 86400000) * 5 / 7)),
    endDay: Math.max(1, Math.round(((mEnd.getTime() - projStart.getTime()) / 86400000) * 5 / 7)),
  };
}

function GridLines({ projectEndDay, calendarMode, cal, svgH, milestoneH }: { projectEndDay: number; calendarMode: string; cal: Date[]; svgH: number; milestoneH: number }) {
  const bottom = svgH - BOTTOM_PAD;
  const top = HEADER_H + milestoneH;
  const lines: React.ReactNode[] = [];
  if (calendarMode === "four-week") {
    for (let d = 5; d <= projectEndDay; d += 5) {
      const isMonth = d % 20 === 0;
      lines.push(
        <line key={`gl-${d}`} x1={d * DAY_W} y1={top} x2={d * DAY_W} y2={bottom}
          stroke={isMonth ? "#2e2848" : "#1e1a2e"} strokeWidth={isMonth ? 1.5 : 1} />
      );
    }
  } else {
    for (let d = 0; d < projectEndDay; d++) {
      const date = cal[d];
      if (!date || date.getDay() !== 1) continue;
      const isMonthStart = date.getDate() <= 7;
      lines.push(
        <line key={`gl-${d}`} x1={d * DAY_W} y1={top} x2={d * DAY_W} y2={bottom}
          stroke={isMonthStart ? "#2e2848" : "#1e1a2e"} strokeWidth={isMonthStart ? 1.5 : 1} />
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
        <div key={f.id} className="flex items-center gap-1.5 text-sm text-[#9b93ba]">
          <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: featureColors.get(f.id) ?? "#7c3aed" }} />
          {f.name}
        </div>
      ))}
    </div>
  );
}
