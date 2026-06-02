import { useCallback, useMemo, useRef, useState } from "react";
import type { Feature, EstimateUnit } from "@estimator/shared";
import type { ScheduleResult, ScheduledTask, BlockedPeriod, ResourceWindow } from "../utils/scheduler.js";
import { computeTaskPlacement } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useMilestonesStore } from "../../phase3-milestones/store/milestonesStore.js";
import { TaskEditModal } from "./TaskEditModal.js";
import {
  buildWorkingDayCalendar,
  formatDateShort,
  formatMonthYear,
  parseISODate,
} from "../utils/calendarUtils.js";

// Layout
const LABEL_W = 124;
const DAY_W = 22;
const FOCUSED_DAY_W = 44;
const WKND_W = 10;   // px for a full 2-day weekend gap (actual-dates mode only)
const MONTH_H = 22;
const WEEK_H = 20;
const HEADER_H = MONTH_H + WEEK_H;
const MILESTONE_LANE_H = 30;
const SLOT_H = 40;
const ROW_VPAD = 5;
const ROW_GAP = 6;
const BOTTOM_PAD = 16;
const RESIZE_HANDLE_W = 8;
const SUMMARY_ROW_H = 36;

function rowHeight(cap: number) {
  return cap * SLOT_H + ROW_VPAD * 2;
}

// JS getDay() is 0=Sun, 1=Mon…6=Sat — convert to Mon-origin (0=Mon…4=Fri)
function jsWeekdayToMon(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
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
  slotCount: number;
  disciplineBoundaries: Array<{ slotIndex: number; startDay: number; endDay: number }>;
  wdToX: (n: number) => number;
  effectiveDayW: number;
  blockedPeriods: BlockedPeriod[];
  onMove: (taskId: string, startDay: number, endDay: number, targetSlot: number) => void;
  onResize: (taskId: string, startDay: number, endDay: number, newDays: number) => void;
  onClearPin: (taskId: string) => void;
  onEditTask: (task: ScheduledTask) => void;
}

function DraggableTaskBar({ task, y, barH, color, slotCount, disciplineBoundaries, wdToX, effectiveDayW, blockedPeriods, onMove, onResize, onClearPin, onEditTask }: TaskBarProps) {
  const [preview, setPreview] = useState<{
    startDay: number; endDay: number; slotIndex: number;
    segments?: { start: number; end: number }[];
  } | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize" | null>(null);

  const callbacksRef = useRef({ onMove, onResize, onClearPin, onEditTask });
  callbacksRef.current = { onMove, onResize, onClearPin, onEditTask };

  function startDrag(type: "move" | "resize", clientX: number, clientY: number) {
    const origStart = task.startDay;
    const origEnd   = task.endDay;   // last segment end for segmented tasks
    const origWd    = task.workingDays;
    setDragType(type);
    document.body.style.userSelect = "none";
    document.body.style.cursor = type === "move" ? "grabbing" : "ew-resize";

    function onMouseMove(e: MouseEvent) {
      const dx = e.clientX - clientX;
      const dy = e.clientY - clientY;
      const snap = Math.round((dx / effectiveDayW) * 2) / 2;

      if (type === "move") {
        let s = Math.max(0, origStart + snap);
        const slotDelta = Math.round(dy / SLOT_H);
        const targetSlot = Math.max(0, Math.min(slotCount - 1, task.slotIndex + slotDelta));
        // Snap start to another task's end, or snap end to another task's start
        let best = 2.5; // working-day snap radius
        let snapped = s;
        for (const b of disciplineBoundaries) {
          if (b.slotIndex !== targetSlot) continue;
          const d1 = Math.abs(s - b.endDay);
          if (d1 < best) { best = d1; snapped = b.endDay; }
          const d2 = Math.abs(s + origWd - b.startDay);
          if (d2 < best) { best = d2; snapped = Math.max(0, b.startDay - origWd); }
        }
        s = snapped;
        // No push-past-overlaps loop here — the user is dragging to insert, so
        // overlapping a task during drag is intentional. handleMove pushes on drop.
        const p = computeTaskPlacement(s, origWd, blockedPeriods);
        setPreview({ startDay: p.startDay, endDay: p.endDay, slotIndex: targetSlot, segments: p.segments });
      } else {
        // Resize snaps the last segment's right edge
        setPreview({
          startDay: origStart,
          endDay: Math.max(origEnd - origWd + 0.5, origEnd + snap),
          slotIndex: task.slotIndex,
        });
      }
    }

    function onMouseUp() {
      setPreview((p) => {
        if (p) {
          if (type === "move") {
            callbacksRef.current.onMove(task.taskId, p.startDay, p.endDay, p.slotIndex);
          } else {
            // newDays = working days + delta on last segment end
            const newDays = Math.max(0.5, origWd + (p.endDay - origEnd));
            callbacksRef.current.onResize(task.taskId, p.startDay, p.endDay, newDays);
          }
        }
        return null;
      });
      setDragType(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const isDragging = dragType !== null;
  const dispSlot  = preview?.slotIndex ?? task.slotIndex;
  const dispY     = y + (dispSlot - task.slotIndex) * SLOT_H;

  // Segments to render: use preview segments if dragging, else task segments, else single span
  const dispSegments: { start: number; end: number }[] =
    preview?.segments ?? task.segments ??
    [{ start: preview?.startDay ?? task.startDay, end: preview?.endDay ?? task.endDay }];

  return (
    <g>
      <title>{task.featureName} — {task.label}{task.isPinned ? " · pinned" : ""}</title>

      {dispSegments.map((seg, i) => {
        const isFirst = i === 0;
        const isLast  = i === dispSegments.length - 1;
        const sx = wdToX(seg.start);
        const sw = Math.max(2, wdToX(seg.end) - sx - 2);
        const maxChars        = Math.floor((sw - 10) / 5.5);
        const maxFeatureChars = Math.floor((sw - 10) / 4.8);
        const featureTextY    = dispY + Math.round(barH * 0.3);
        const taskTextY       = dispY + Math.round(barH * 0.68);

        return (
          <g key={i}>
            {/* Dashed connector to next segment */}
            {!isLast && (() => {
              const nx = wdToX(dispSegments[i + 1].start);
              const lineY = dispY + barH / 2;
              return nx > sx + sw + 4
                ? <line x1={sx + sw + 2} y1={lineY} x2={nx - 1} y2={lineY}
                    stroke={color} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.45}
                    style={{ pointerEvents: "none" }} />
                : null;
            })()}

            <rect
              x={sx} y={dispY} width={sw} height={barH} rx={3}
              fill={color} opacity={isDragging ? 0.55 : 0.9}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
              onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); startDrag("move", e.clientX, e.clientY); }}
              onDoubleClick={(e) => { if (isFirst) { e.stopPropagation(); callbacksRef.current.onEditTask(task); } }}
            />

            {/* Label only in first segment */}
            {isFirst && sw > 40 && (
              <>
                <text x={sx + 5} y={featureTextY} dominantBaseline="middle" fontSize={9}
                  fill="rgba(255,255,255,0.65)" style={{ pointerEvents: "none", userSelect: "none" }}>
                  {task.featureName.length > maxFeatureChars ? task.featureName.slice(0, maxFeatureChars) + "…" : task.featureName}
                </text>
                <text x={sx + 5} y={taskTextY} dominantBaseline="middle" fontSize={11} fill="white"
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {task.label.length > maxChars ? task.label.slice(0, maxChars) + "…" : task.label}
                </text>
              </>
            )}

            {/* Resize handle only on last segment */}
            {isLast && sw > 16 && (
              <rect
                x={sx + sw - RESIZE_HANDLE_W} y={dispY}
                width={RESIZE_HANDLE_W} height={barH}
                fill={isDragging && dragType === "resize" ? "rgba(255,255,255,0.25)" : "transparent"}
                style={{ cursor: "ew-resize" }}
                onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); startDrag("resize", e.clientX, e.clientY); }}
              />
            )}

            {/* Pinned dot on first segment */}
            {isFirst && task.isPinned && !isDragging && (
              <circle cx={sx + 5} cy={dispY + 4} r={2.5} fill="white" opacity={0.8}
                style={{ pointerEvents: "none" }} />
            )}
          </g>
        );
      })}

      {/* Drag preview label — anchored above first segment */}
      {isDragging && preview && (() => {
        const firstSeg = dispSegments[0];
        const sx = wdToX(firstSeg.start);
        const sw = Math.max(2, wdToX(firstSeg.end) - sx - 2);
        const previewDays = dragType === "move"
          ? task.workingDays
          : Math.max(0.5, task.workingDays + (preview.endDay - task.endDay));
        return (
          <text x={sx + sw / 2} y={dispY - 5} textAnchor="middle" fontSize={11} fill="#a78bfa" fontWeight="600"
            style={{ pointerEvents: "none", userSelect: "none" }}>
            {String(Math.round(previewDays * 2) / 2)}d
            {dispSlot !== task.slotIndex ? ` · slot ${dispSlot + 1}` : ""}
          </text>
        );
      })()}

    </g>
  );
}

interface Props {
  result: ScheduleResult;
  features: Feature[];
  settings: ScheduleSettings;
  viewMode: "detailed" | "summary";
  onToggleView: () => void;
  resourceWindows: Record<string, ResourceWindow>;
  focusedMilestoneId?: string | null;
  onFocusMilestone?: (id: string | null) => void;
}

export function Timeline({ result, features, settings, viewMode, onToggleView, resourceWindows, focusedMilestoneId, onFocusMilestone }: Props) {
  const { tasks, disciplines, capacities, projectEndDay, slotContingency, blockedPeriods } = result;

  const { setOverride, clearOverride, resources } = useSchedulingStore();
  const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
  const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
  const rawMilestones = useMilestonesStore((s) => s.milestones);
  const milestones = useMemo(() => [...rawMilestones].sort((a, b) => a.startDate.localeCompare(b.startDate)), [rawMilestones]);

  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const milestoneH = milestones.length > 0 ? MILESTONE_LANE_H : 0;

  const focusedMilestone = focusedMilestoneId
    ? milestones.find((m) => m.id === focusedMilestoneId) ?? null
    : null;

  // ─── Calendar (needed early for focus range + coordinate system) ─────────
  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual" || projectEndDay === 0) return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), projectEndDay + 1);
  }, [settings.calendarMode, settings.startDate, projectEndDay]);

  // Working-day range for the focused milestone (null = show all)
  const focusRange = useMemo<{ startDay: number; endDay: number } | null>(() => {
    if (!focusedMilestone) return null;
    return milestoneWorkingDays(focusedMilestone, settings.calendarMode, settings.startDate, cal);
  }, [focusedMilestone, settings.calendarMode, settings.startDate, cal]);

  const zoomDayW = focusRange ? FOCUSED_DAY_W : DAY_W;

  // ─── Coordinate system: working-day → pixel ───────────────────────────────
  const showWeekends = settings.calendarMode === "actual";

  const startWeekday = useMemo(() => {
    if (!showWeekends || !settings.startDate) return 0;
    return jsWeekdayToMon(parseISODate(settings.startDate).getDay());
  }, [showWeekends, settings.startDate]);

  // Pixels per working-day for drag snap (average accounts for weekend gaps)
  const effectiveDayW = showWeekends ? zoomDayW + WKND_W / 5 : zoomDayW;

  const focusOffset = focusRange?.startDay ?? 0;

  const wdToX = useCallback((n: number): number => {
    const adjusted = n - focusOffset;
    if (!showWeekends) return adjusted * zoomDayW;
    const weekends = Math.floor((startWeekday + n) / 5) - Math.floor((startWeekday + focusOffset) / 5);
    return adjusted * zoomDayW + weekends * WKND_W;
  }, [showWeekends, startWeekday, focusOffset, zoomDayW]);

  // X positions where weekend gaps start (for overlay rendering)
  const weekendStrips = useMemo(() => {
    if (!showWeekends) return [] as number[];
    const strips: number[] = [];
    const sw = startWeekday;
    const maxWd = projectEndDay + 25;
    for (let n = 0; n <= maxWd; n++) {
      if ((sw + n) % 5 === 4) { // Friday (Mon=0…Fri=4)
        strips.push(wdToX(n) + zoomDayW);
      }
    }
    return strips;
  }, [showWeekends, startWeekday, projectEndDay, wdToX]);

  // ─── Interaction handlers ─────────────────────────────────────────────────

  function handleMove(taskId: string, startDay: number, endDay: number, targetSlot: number) {
    const movedTask = tasks.find((t) => t.taskId === taskId);
    if (!movedTask) {
      setOverride(taskId, { startDay, endDay });
      return;
    }

    // Freeze every task in the discipline at its current rendered position,
    // including slotIndex. This prevents the scheduler from repacking any slot
    // on the next render — only the dragged task and explicitly pushed tasks move.
    for (const t of tasks) {
      if (t.taskId === taskId || t.discipline !== movedTask.discipline) continue;
      setOverride(t.taskId, { startDay: t.startDay, endDay: t.endDay, slotIndex: t.slotIndex });
    }

    setOverride(taskId, { startDay, endDay, slotIndex: targetSlot });

    // Push forward tasks in the target slot that overlap the dropped position.
    // Pinned tasks are included — intentional insertion should displace whatever is in the way.
    const targetTasks = tasks
      .filter(t =>
        t.taskId !== taskId &&
        t.discipline === movedTask.discipline &&
        t.slotIndex === targetSlot
      )
      .sort((a, b) => a.startDay - b.startDay);

    let cursor = endDay;
    for (const t of targetTasks) {
      if (t.startDay < startDay) continue; // starts before the insertion point — leave it where it is
      if (t.startDay < cursor) {
        const placement = computeTaskPlacement(cursor, t.workingDays, blockedPeriods);
        setOverride(t.taskId, { startDay: placement.startDay, endDay: placement.endDay, slotIndex: t.slotIndex });
        cursor = placement.endDay;
      }
      // No break — cursor may have jumped past a hardening period, so a later task
      // that appeared non-overlapping might still need pushing.
    }
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

  function handleSaveTask(changes: {
    label: string;
    estimateValue: number;
    estimateUnit: EstimateUnit;
    assignedResourceId: string | null;
    notes: string;
  }) {
    if (!editingTask) return;
    const { taskId, featureId, groupId } = editingTask;
    if (changes.label !== editingTask.label) {
      updateTaskLabel(featureId, groupId, taskId, changes.label);
    }
    if (changes.estimateValue !== editingTask.estimateValue || changes.estimateUnit !== editingTask.estimateUnit) {
      updateTaskEstimate(featureId, groupId, taskId, changes.estimateValue, changes.estimateUnit);
    }

    const newResourceId = changes.assignedResourceId ?? undefined;
    let targetSlotIndex: number | undefined;
    if (newResourceId) {
      const discRes = resources.filter(r => r.role === editingTask.discipline);
      const idx = discRes.findIndex(r => r.id === newResourceId);
      if (idx >= 0) targetSlotIndex = idx;
    }

    if (targetSlotIndex !== undefined && targetSlotIndex !== editingTask.slotIndex) {
      // Freeze all other discipline tasks at their current positions
      for (const t of tasks) {
        if (t.taskId === taskId || t.discipline !== editingTask.discipline) continue;
        setOverride(t.taskId, { startDay: t.startDay, endDay: t.endDay, slotIndex: t.slotIndex });
      }
      setOverride(taskId, {
        assignedResourceId: newResourceId,
        notes: changes.notes,
        slotIndex: targetSlotIndex,
        startDay: editingTask.startDay,
        endDay: editingTask.endDay,
      });
    } else {
      setOverride(taskId, {
        assignedResourceId: newResourceId,
        notes: changes.notes,
      });
    }
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

  const disciplineResources = useMemo(() => {
    const map: Record<string, typeof resources[number][]> = {};
    for (const d of disciplines) map[d] = resources.filter(r => r.role === d);
    return map;
  }, [disciplines, resources]);

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

  const visibleEndDay = focusRange ? focusRange.endDay : projectEndDay;
  const visibleTasks = focusRange
    ? tasks.filter((t) => t.startDay < focusRange.endDay && t.endDay > focusRange.startDay)
    : tasks;

  const svgH = HEADER_H + milestoneH + (viewMode === "detailed" ? detailedH : summaryH) + BOTTOM_PAD;
  const chartW = Math.max(wdToX(visibleEndDay + 20), 480);

  // Prev/next milestones for focus context edges
  const focusedIdx = focusedMilestone ? milestones.findIndex((m) => m.id === focusedMilestone.id) : -1;
  const prevMilestone = focusedIdx > 0 ? milestones[focusedIdx - 1] : null;
  const nextMilestone = focusedIdx >= 0 && focusedIdx < milestones.length - 1 ? milestones[focusedIdx + 1] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Focus banner */}
      {focusedMilestone && onFocusMilestone && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-[#3d366a] bg-[#1d1930] text-sm">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: focusedMilestone.color }} />
          <span className="text-[#ece7ff] font-medium">{focusedMilestone.title}</span>
          <span className="text-[#5c5575]">{focusedMilestone.startDate} – {focusedMilestone.endDate}</span>
          <button
            className="ml-auto px-3 py-1 rounded-md bg-[#252041] border border-[#2e2848] text-xs text-[#a78bfa] hover:bg-[#2e2848] transition-colors"
            onClick={() => onFocusMilestone(null)}
          >
            ← All milestones
          </button>
        </div>
      )}

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
              ? rowLayouts.map((layout, layoutIdx) => {
                  const discResources = disciplineResources[layout.discipline] ?? [];
                  return (
                    <g key={layout.discipline}>
                      {/* Discipline name — small and dim at top of group */}
                      <text
                        x={LABEL_W - 8}
                        y={HEADER_H + milestoneH + layout.rowY + 11}
                        textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#5c5575" fontStyle="italic"
                      >
                        {layout.discipline}
                      </text>
                      {/* Per-slot resource names */}
                      {Array.from({ length: layout.capacity }, (_, i) => {
                        const resource = discResources[i];
                        const slotCenterY = HEADER_H + milestoneH + layout.rowY + ROW_VPAD + i * SLOT_H + (SLOT_H - 4) / 2;
                        const name = resource
                          ? (resource.name.length > 12 ? resource.name.slice(0, 12) + "…" : resource.name)
                          : null;
                        return (
                          <text
                            key={i}
                            x={LABEL_W - 8}
                            y={slotCenterY}
                            textAnchor="end" dominantBaseline="middle"
                            fontSize={11}
                            fill={resource ? "#c5bedf" : "#3d366a"}
                            fontWeight={resource ? "600" : "400"}
                          >
                            {name ?? "—"}
                          </text>
                        );
                      })}
                      {/* Separator line between discipline groups */}
                      {layoutIdx < rowLayouts.length - 1 && (
                        <line
                          x1={0} y1={HEADER_H + milestoneH + layout.rowY + layout.height + ROW_GAP / 2}
                          x2={LABEL_W} y2={HEADER_H + milestoneH + layout.rowY + layout.height + ROW_GAP / 2}
                          stroke="#2e2848" strokeWidth={1}
                        />
                      )}
                    </g>
                  );
                })
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

              <defs>
                <pattern id="dz-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#1e1a2e" strokeWidth="3.5" />
                </pattern>
              </defs>

              {/* Milestone lane */}
              {milestoneH > 0 && (
                <>
                  <rect x={0} y={HEADER_H} width={chartW} height={milestoneH} fill="#1a1628" />
                  {milestones.map((m) => {
                    const { startDay, endDay } = milestoneWorkingDays(m, settings.calendarMode, settings.startDate, cal);
                    const x = wdToX(startDay);
                    const w = Math.max(4, wdToX(endDay) - wdToX(startDay) - 2);
                    const barH = milestoneH - 8;
                    const sprintDays = (m.sprintLengthWeeks ?? 0) * 5;
                    const sprintCount = sprintDays > 0 ? Math.ceil((endDay - startDay) / sprintDays) : 0;
                    const isFocused = focusedMilestoneId === m.id;
                    return (
                      <g key={m.id}
                        onClick={() => onFocusMilestone?.(isFocused ? null : m.id)}
                        style={{ cursor: onFocusMilestone ? "pointer" : undefined }}
                      >
                        <rect x={x} y={HEADER_H + 4} width={w} height={barH} rx={3} fill={m.color}
                          opacity={isFocused ? 1 : 0.85}
                          stroke={isFocused ? "white" : "none"} strokeWidth={1.5} strokeOpacity={0.6} />
                        {sprintCount > 0
                          ? Array.from({ length: sprintCount }, (_, i) => {
                              const sx = wdToX(startDay + i * sprintDays);
                              const ex = wdToX(Math.min(startDay + (i + 1) * sprintDays, endDay));
                              const sw = ex - sx;
                              return (
                                <g key={`sp-${i}`} style={{ pointerEvents: "none" }}>
                                  {i > 0 && (
                                    <line x1={sx} y1={HEADER_H + 6} x2={sx} y2={HEADER_H + 2 + barH}
                                      stroke="white" strokeWidth={0.75} opacity={0.4} />
                                  )}
                                  {sw > 20 && (
                                    <text x={sx + sw / 2} y={HEADER_H + 4 + barH / 2}
                                      textAnchor="middle" dominantBaseline="middle"
                                      fontSize={9} fontWeight="600" fill="white" opacity={0.85}
                                      style={{ userSelect: "none" }}>
                                      S{i + 1}
                                    </text>
                                  )}
                                </g>
                              );
                            })
                          : w > 30 && (
                              <text x={x + 5} y={HEADER_H + 4 + barH / 2} dominantBaseline="middle" fontSize={10} fontWeight="600" fill="white" style={{ pointerEvents: "none", userSelect: "none" }}>
                                {m.title.length > Math.floor((w - 10) / 5.5) ? m.title.slice(0, Math.floor((w - 10) / 5.5)) + "…" : m.title}
                              </text>
                            )
                        }
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

              {/* Sprint column bands — alternating tint per sprint within milestone range */}
              {milestoneH > 0 && milestones.flatMap((m) => {
                const sprintDays = (m.sprintLengthWeeks ?? 0) * 5;
                if (!sprintDays) return [];
                const { startDay, endDay } = milestoneWorkingDays(m, settings.calendarMode, settings.startDate, cal);
                const bandsH = svgH - HEADER_H - milestoneH - BOTTOM_PAD;
                const count = Math.ceil((endDay - startDay) / sprintDays);
                return Array.from({ length: count }, (_, i) => {
                  const sx = wdToX(startDay + i * sprintDays);
                  const ex = wdToX(Math.min(startDay + (i + 1) * sprintDays, endDay));
                  return (
                    <rect key={`sprint-band-${m.id}-${i}`}
                      x={sx} y={HEADER_H + milestoneH} width={Math.max(0, ex - sx)} height={bandsH}
                      fill={m.color} opacity={i % 2 === 0 ? 0.05 : 0.12} style={{ pointerEvents: "none" }} />
                  );
                });
              })}

              {/* Weekend strips — full-height overlay so task bars naturally bridge Fri→Mon */}
              {weekendStrips.map((wx) => (
                <rect
                  key={`wknd-${wx}`}
                  x={wx} y={0} width={WKND_W} height={svgH}
                  fill="#0a0814" opacity={0.55}
                  style={{ pointerEvents: "none" }}
                />
              ))}

              {/* Hardening overlays — span all discipline rows */}
              {blockedPeriods.map((bp) => {
                const bx = wdToX(bp.start);
                const bw = Math.max(2, wdToX(bp.end) - wdToX(bp.start));
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
                    <rect x={bx} y={by} width={bw} height={rowsH} fill={bp.color} opacity={0.13} />
                    <rect x={bx} y={by} width={bw} height={rowsH} fill="none" stroke={bp.color} strokeWidth={1.5} opacity={0.5} />
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

              {/* Dead zone overlays — resource roll-on/roll-off unavailability */}
              {viewMode === "detailed" && rowLayouts.flatMap((layout) =>
                Array.from({ length: layout.capacity }, (_, i) => {
                  const resource = (disciplineResources[layout.discipline] ?? [])[i];
                  if (!resource) return null;
                  const win = resourceWindows[resource.id];
                  if (!win) return null;
                  const zy = HEADER_H + milestoneH + layout.rowY + ROW_VPAD + i * SLOT_H;
                  const zh = SLOT_H - 4;
                  const zones: React.ReactNode[] = [];
                  if (win.startDay > 0) {
                    const x = 0;
                    const w = wdToX(win.startDay);
                    if (w > 0) {
                      zones.push(
                        <g key={`dz-before-${resource.id}`}>
                          <title>{resource.name} — not yet available</title>
                          <rect x={x} y={zy} width={w} height={zh} fill="url(#dz-hatch)" opacity={0.85} style={{ pointerEvents: "none" }} />
                          <rect x={x} y={zy} width={w} height={zh} fill="#09070f" opacity={0.55} style={{ pointerEvents: "none" }} />
                        </g>
                      );
                    }
                  }
                  if (win.endDay !== null) {
                    const x = wdToX(win.endDay);
                    const w = chartW - x;
                    if (w > 0) {
                      zones.push(
                        <g key={`dz-after-${resource.id}`}>
                          <title>{resource.name} — rolled off</title>
                          <rect x={x} y={zy} width={w} height={zh} fill="url(#dz-hatch)" opacity={0.85} style={{ pointerEvents: "none" }} />
                          <rect x={x} y={zy} width={w} height={zh} fill="#09070f" opacity={0.55} style={{ pointerEvents: "none" }} />
                        </g>
                      );
                    }
                  }
                  return zones.length > 0 ? zones : null;
                }).filter(Boolean)
              )}

              {/* Focused milestone boundary markers */}
              {focusRange && (
                <>
                  {/* Left boundary — end of previous milestone */}
                  <line x1={0} y1={0} x2={0} y2={svgH}
                    stroke={focusedMilestone?.color ?? "#7c3aed"} strokeWidth={2} strokeDasharray="6 3" opacity={0.5}
                    style={{ pointerEvents: "none" }} />
                  {prevMilestone && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={4} y={HEADER_H + 4} width={Math.min(140, 10 + prevMilestone.title.length * 6.5)} height={16}
                        rx={3} fill={prevMilestone.color} opacity={0.18} />
                      <text x={8} y={HEADER_H + 13}
                        fontSize={10} fontWeight="600" fill={prevMilestone.color} opacity={0.9}
                        style={{ userSelect: "none" }}>
                        ← {prevMilestone.title.length > 18 ? prevMilestone.title.slice(0, 17) + "…" : prevMilestone.title}
                      </text>
                    </g>
                  )}

                  {/* Right boundary — start of next milestone */}
                  {(() => {
                    const rx = wdToX(focusRange.endDay);
                    return (
                      <>
                        <line x1={rx} y1={0} x2={rx} y2={svgH}
                          stroke={focusedMilestone?.color ?? "#7c3aed"} strokeWidth={2} strokeDasharray="6 3" opacity={0.5}
                          style={{ pointerEvents: "none" }} />
                        {nextMilestone && (
                          <g style={{ pointerEvents: "none" }}>
                            <rect x={rx - Math.min(144, 10 + nextMilestone.title.length * 6.5)} y={HEADER_H + 4}
                              width={Math.min(144, 10 + nextMilestone.title.length * 6.5)} height={16}
                              rx={3} fill={nextMilestone.color} opacity={0.18} />
                            <text x={rx - 6} y={HEADER_H + 13}
                              textAnchor="end" fontSize={10} fontWeight="600" fill={nextMilestone.color} opacity={0.9}
                              style={{ userSelect: "none" }}>
                              {nextMilestone.title.length > 18 ? nextMilestone.title.slice(0, 17) + "…" : nextMilestone.title} →
                            </text>
                          </g>
                        )}
                      </>
                    );
                  })()}
                </>
              )}

              {/* Date headers */}
              {settings.calendarMode === "four-week" ? (
                <FourWeekHeader projectEndDay={visibleEndDay} startDay={focusOffset} chartW={chartW} wdToX={wdToX} />
              ) : (
                <ActualDateHeader projectEndDay={visibleEndDay} startDay={focusOffset} cal={cal} chartW={chartW} wdToX={wdToX} />
              )}

              {/* Grid lines */}
              <GridLines
                projectEndDay={visibleEndDay}
                startDay={focusOffset}
                calendarMode={settings.calendarMode}
                cal={cal}
                svgH={svgH}
                milestoneH={milestoneH}
                wdToX={wdToX}
              />

              {/* Task bars */}
              {viewMode === "detailed"
                ? visibleTasks.map((task) => {
                    const layout = rowLayouts.find((r) => r.discipline === task.discipline);
                    if (!layout) return null;
                    const barH = SLOT_H - 4;
                    const y = HEADER_H + milestoneH + layout.rowY + ROW_VPAD + task.slotIndex * SLOT_H;
                    const color = featureColors.get(task.featureId) ?? "#7c3aed";
                    const disciplineBoundaries = tasks
                      .filter((t) => t.discipline === task.discipline && t.taskId !== task.taskId)
                      .map((t) => ({ slotIndex: t.slotIndex, startDay: t.startDay, endDay: t.endDay }));
                    return (
                      <DraggableTaskBar
                        key={task.taskId} task={task} y={y} barH={barH} color={color}
                        slotCount={layout.capacity}
                        disciplineBoundaries={disciplineBoundaries}
                        blockedPeriods={blockedPeriods}
                        wdToX={wdToX} effectiveDayW={effectiveDayW}
                        onMove={handleMove} onResize={handleResize} onClearPin={handleClearPin}
                        onEditTask={setEditingTask}
                      />
                    );
                  })
                : summaryRows.map((row) => {
                    const x = wdToX(row.startDay);
                    const barW = Math.max(4, wdToX(row.endDay) - wdToX(row.startDay) - 2);
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
                  const calDays = Math.round((target.getTime() - start.getTime()) / 86400000);
                  deadlineDay = Math.round(calDays * 5 / 7);
                }
                if (deadlineDay === null || deadlineDay <= 0) return null;
                const dx = wdToX(deadlineDay);
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
                const bx = wdToX(sc.lastTaskEndDay);
                const bw = Math.max(2, wdToX(sc.lastTaskEndDay + sc.contingencyDays) - bx - 2);
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

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          resources={resources}
          onSave={handleSaveTask}
          onUnpin={() => handleClearPin(editingTask.taskId)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

// ─── Date headers ─────────────────────────────────────────────────────────────

function FourWeekHeader({ projectEndDay, startDay = 0, chartW, wdToX }: { projectEndDay: number; startDay?: number; chartW: number; wdToX: (n: number) => number }) {
  const els: React.ReactNode[] = [];
  const firstMonth = Math.floor(startDay / 20);
  const lastMonth = Math.ceil(projectEndDay / 20);

  for (let m = firstMonth; m < lastMonth; m++) {
    const mStart = m * 20;
    const mEnd = Math.min((m + 1) * 20, projectEndDay);
    const x = wdToX(mStart);
    const w = wdToX(mEnd) - wdToX(mStart);
    if (w <= 0) continue;
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
      if (wStart >= projectEndDay || wEnd <= startDay) continue;
      const wx = wdToX(wStart);
      const ww = wdToX(wEnd) - wdToX(wStart);
      if (ww <= 0) continue;
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

function ActualDateHeader({ projectEndDay, startDay = 0, cal, chartW, wdToX }: { projectEndDay: number; startDay?: number; cal: Date[]; chartW: number; wdToX: (n: number) => number }) {
  if (cal.length === 0) return null;
  const els: React.ReactNode[] = [];
  let monthKey = -1;
  let monthStart = startDay;
  let monthIdx = 0;

  const flushMonth = (endDay: number) => {
    if (monthKey === -1) return;
    const x = wdToX(monthStart);
    const w = wdToX(endDay) - wdToX(monthStart);
    if (w <= 0) return;
    els.push(
      <g key={`month-${monthKey}`}>
        <rect x={Math.max(0, x)} y={0} width={w} height={MONTH_H} fill={monthIdx % 2 === 0 ? "#1a1628" : "#211d38"} />
        <text x={Math.max(0, x) + w / 2} y={MONTH_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#c5bedf" fontWeight="600">
          {formatMonthYear(cal[monthStart] ?? cal[startDay])}
        </text>
      </g>
    );
    monthIdx++;
  };

  for (let d = startDay; d < projectEndDay; d++) {
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
        <text key={`wk-${d}`} x={wdToX(d) + 3} y={MONTH_H + WEEK_H / 2} dominantBaseline="middle" fontSize={10} fill="#5c5575">
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

function GridLines({ projectEndDay, startDay = 0, calendarMode, cal, svgH, milestoneH, wdToX }: {
  projectEndDay: number; startDay?: number; calendarMode: string; cal: Date[]; svgH: number; milestoneH: number;
  wdToX: (n: number) => number;
}) {
  const bottom = svgH - BOTTOM_PAD;
  const top = HEADER_H + milestoneH;
  const lines: React.ReactNode[] = [];
  if (calendarMode === "four-week") {
    const first = Math.ceil(startDay / 5) * 5;
    for (let d = first; d <= projectEndDay; d += 5) {
      const isMonth = d % 20 === 0;
      const x = wdToX(d);
      lines.push(
        <line key={`gl-${d}`} x1={x} y1={top} x2={x} y2={bottom}
          stroke={isMonth ? "#2e2848" : "#1e1a2e"} strokeWidth={isMonth ? 1.5 : 1} />
      );
    }
  } else {
    for (let d = startDay; d < projectEndDay; d++) {
      const date = cal[d];
      if (!date || date.getDay() !== 1) continue;
      const isMonthStart = date.getDate() <= 7;
      const x = wdToX(d);
      lines.push(
        <line key={`gl-${d}`} x1={x} y1={top} x2={x} y2={bottom}
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
