import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useRef, useState } from "react";
import { useSchedulingStore } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { buildWorkingDayCalendar, formatDateShort, formatMonthYear, parseISODate, } from "../utils/calendarUtils.js";
// Layout
const LABEL_W = 124;
const DAY_W = 22;
const MONTH_H = 22;
const WEEK_H = 20;
const HEADER_H = MONTH_H + WEEK_H;
const SLOT_H = 28; // pixels per resource slot
const ROW_VPAD = 5; // top + bottom padding inside a row
const ROW_GAP = 6;
const CONT_ROW_H = 34;
const BOTTOM_PAD = 16;
function rowHeight(cap) {
    return cap * SLOT_H + ROW_VPAD * 2;
}
const FEATURE_PALETTE = [
    "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
    "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
    "#ec4899", "#14b8a6",
];
const RESIZE_HANDLE_W = 8;
function daysToEstimate(days, preferred) {
    const perUnit = { half_day: 0.5, day: 1, week: 5, month: 20 };
    const ratio = days / perUnit[preferred];
    if (ratio >= 0.5 && Math.abs(Math.round(ratio * 2) - ratio * 2) < 0.001) {
        return { value: Math.round(ratio * 2) / 2, unit: preferred };
    }
    return { value: Math.max(0.5, Math.round(days * 2) / 2), unit: "day" };
}
function DraggableTaskBar({ task, y, barH, color, onMove, onResize, onClearPin }) {
    const [preview, setPreview] = useState(null);
    const [dragType, setDragType] = useState(null);
    const callbacksRef = useRef({ onMove, onResize, onClearPin });
    callbacksRef.current = { onMove, onResize, onClearPin };
    function startDrag(type, clientX) {
        const origStart = task.startDay;
        const origEnd = task.endDay;
        setDragType(type);
        function onMouseMove(e) {
            const dx = e.clientX - clientX;
            const snap = Math.round((dx / DAY_W) * 2) / 2;
            if (type === "move") {
                const dur = origEnd - origStart;
                const s = Math.max(0, origStart + snap);
                setPreview({ startDay: s, endDay: s + dur });
            }
            else {
                setPreview({ startDay: origStart, endDay: Math.max(origStart + 0.5, origEnd + snap) });
            }
        }
        function onMouseUp() {
            setPreview((p) => {
                if (p) {
                    if (type === "move")
                        callbacksRef.current.onMove(task.taskId, p.startDay, p.endDay);
                    else
                        callbacksRef.current.onResize(task.taskId, p.startDay, p.endDay, p.endDay - p.startDay);
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
    const dispEnd = preview?.endDay ?? task.endDay;
    const x = dispStart * DAY_W;
    const barW = Math.max(2, (dispEnd - dispStart) * DAY_W - 2);
    const maxChars = Math.floor((barW - 10) / 5.5);
    const isDragging = dragType !== null;
    return (_jsxs("g", { children: [_jsxs("title", { children: [task.featureName, " \u2014 ", task.label, task.isPinned ? " · pinned" : ""] }), _jsx("rect", { x: x, y: y, width: barW, height: barH, rx: 3, fill: color, opacity: isDragging ? 0.65 : 0.88, style: { cursor: isDragging ? "grabbing" : "grab" }, onMouseDown: (e) => { if (e.button !== 0)
                    return; e.stopPropagation(); startDrag("move", e.clientX); }, onDoubleClick: (e) => { e.stopPropagation(); onClearPin(task.taskId); } }), barW > 32 && (_jsx("text", { x: x + 5, y: y + barH / 2, dominantBaseline: "middle", fontSize: 9, fill: "white", style: { pointerEvents: "none", userSelect: "none" }, children: task.label.length > maxChars ? task.label.slice(0, maxChars) + "…" : task.label })), barW > 16 && (_jsx("rect", { x: x + barW - RESIZE_HANDLE_W, y: y, width: RESIZE_HANDLE_W, height: barH, fill: isDragging && dragType === "resize" ? "rgba(255,255,255,0.25)" : "transparent", style: { cursor: "ew-resize" }, onMouseDown: (e) => { if (e.button !== 0)
                    return; e.stopPropagation(); startDrag("resize", e.clientX); } })), task.isPinned && !isDragging && (_jsx("circle", { cx: x + 5, cy: y + 4, r: 2.5, fill: "white", opacity: 0.8, style: { pointerEvents: "none" } })), isDragging && preview && (_jsxs("text", { x: x + barW / 2, y: y - 5, textAnchor: "middle", fontSize: 9, fill: "#374151", fontWeight: "600", style: { pointerEvents: "none", userSelect: "none" }, children: [String(Math.round((preview.endDay - preview.startDay) * 2) / 2), "d"] }))] }));
}
const SUMMARY_ROW_H = 36;
export function Timeline({ result, features, settings, viewMode, onToggleView }) {
    const { tasks, disciplines, capacities, totalDays, contingencyDays, projectEndDay } = result;
    const { setOverride, clearOverride } = useSchedulingStore();
    const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
    function handleMove(taskId, startDay, endDay) {
        setOverride(taskId, { startDay, endDay });
    }
    function handleResize(taskId, startDay, endDay, newDays) {
        const t = tasks.find((t) => t.taskId === taskId);
        if (t) {
            const { value, unit } = daysToEstimate(newDays, t.estimateUnit);
            updateTaskEstimate(t.featureId, t.groupId, taskId, value, unit);
        }
        setOverride(taskId, { startDay, endDay });
    }
    function handleClearPin(taskId) {
        clearOverride(taskId);
    }
    const featureColors = useMemo(() => new Map(features.map((f, i) => [f.id, FEATURE_PALETTE[i % FEATURE_PALETTE.length]])), [features]);
    // Summary view: one row per feature spanning earliest start → latest end
    const summaryRows = useMemo(() => {
        let y = 0;
        return features
            .map((f) => {
            const ft = tasks.filter((t) => t.featureId === f.id);
            if (!ft.length)
                return null;
            const rowY = y;
            y += SUMMARY_ROW_H + ROW_GAP;
            return {
                featureId: f.id,
                featureName: f.name,
                startDay: Math.min(...ft.map((t) => t.startDay)),
                endDay: Math.max(...ft.map((t) => t.endDay)),
                color: featureColors.get(f.id) ?? "#3b82f6",
                rowY,
            };
        })
            .filter(Boolean);
    }, [features, tasks, featureColors]);
    const cal = useMemo(() => {
        if (settings.calendarMode !== "actual" || projectEndDay === 0)
            return [];
        return buildWorkingDayCalendar(parseISODate(settings.startDate), projectEndDay + 1);
    }, [settings.calendarMode, settings.startDate, projectEndDay]);
    // Compute row layouts
    const rowLayouts = useMemo(() => {
        let y = 0;
        return disciplines.map((d) => {
            const cap = capacities[d] ?? 1;
            const h = rowHeight(cap);
            const layout = { discipline: d, rowY: y, height: h, capacity: cap };
            y += h + ROW_GAP;
            return layout;
        });
    }, [disciplines, capacities]);
    const detailedContY = rowLayouts.length > 0
        ? rowLayouts[rowLayouts.length - 1].rowY + rowLayouts[rowLayouts.length - 1].height + ROW_GAP
        : 0;
    const summaryContY = summaryRows.length * (SUMMARY_ROW_H + ROW_GAP);
    const contY = viewMode === "summary" ? summaryContY : detailedContY;
    if (tasks.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center h-36 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl", children: "No tasks yet \u2014 add discipline cards and tasks in Phase 1 to see the schedule." }));
    }
    const svgH = HEADER_H + contY + CONT_ROW_H + BOTTOM_PAD;
    const chartW = Math.max(projectEndDay * DAY_W + 20 * DAY_W, 480);
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "flex justify-end", children: _jsx("div", { className: "flex rounded-lg border border-gray-200 overflow-hidden text-xs shadow-sm", children: ["detailed", "summary"].map((mode) => (_jsx("button", { className: `px-3 py-1.5 transition-colors ${viewMode === mode ? "bg-blue-600 text-white font-medium" : "bg-white text-gray-500 hover:bg-gray-50"}`, onClick: onToggleView, children: mode === "detailed" ? "Detailed" : "Summary" }, mode))) }) }), _jsx("div", { className: "overflow-hidden rounded-xl border border-gray-200 shadow-sm", children: _jsxs("div", { className: "flex items-stretch", children: [_jsxs("svg", { width: LABEL_W, height: svgH, className: "flex-shrink-0 border-r border-gray-200 bg-white", children: [viewMode === "detailed"
                                    ? rowLayouts.map((layout) => (_jsxs("g", { children: [_jsx("text", { x: LABEL_W - 12, y: HEADER_H + layout.rowY + layout.height / 2 - (layout.capacity > 1 ? 7 : 0), textAnchor: "end", dominantBaseline: "middle", fontSize: 12, fill: "#374151", fontWeight: "600", children: layout.discipline }), layout.capacity > 1 && (_jsxs("text", { x: LABEL_W - 12, y: HEADER_H + layout.rowY + layout.height / 2 + 8, textAnchor: "end", dominantBaseline: "middle", fontSize: 9, fill: "#9ca3af", children: ["\u00D7", layout.capacity, " people"] }))] }, layout.discipline)))
                                    : summaryRows.map((row) => (_jsx("text", { x: LABEL_W - 12, y: HEADER_H + row.rowY + SUMMARY_ROW_H / 2, textAnchor: "end", dominantBaseline: "middle", fontSize: 11, fill: "#374151", fontWeight: "600", children: row.featureName.length > 12 ? row.featureName.slice(0, 11) + "…" : row.featureName }, row.featureId))), _jsx("text", { x: LABEL_W - 12, y: HEADER_H + contY + CONT_ROW_H / 2, textAnchor: "end", dominantBaseline: "middle", fontSize: 11, fill: "#9ca3af", fontStyle: "italic", children: "Contingency" })] }), _jsx("div", { className: "overflow-x-auto flex-1 bg-white", children: _jsxs("svg", { width: chartW, height: svgH, children: [viewMode === "detailed"
                                        ? rowLayouts.map((layout, i) => (_jsx("rect", { x: 0, y: HEADER_H + layout.rowY, width: chartW, height: layout.height, fill: i % 2 === 0 ? "#f9fafb" : "#ffffff" }, `bg-${layout.discipline}`)))
                                        : summaryRows.map((row, i) => (_jsx("rect", { x: 0, y: HEADER_H + row.rowY, width: chartW, height: SUMMARY_ROW_H, fill: i % 2 === 0 ? "#f9fafb" : "#ffffff" }, `bg-${row.featureId}`))), _jsx("rect", { x: 0, y: HEADER_H + contY, width: chartW, height: CONT_ROW_H, fill: "#fafafa" }), settings.calendarMode === "four-week" ? (_jsx(FourWeekHeader, { projectEndDay: projectEndDay, chartW: chartW })) : (_jsx(ActualDateHeader, { projectEndDay: projectEndDay, cal: cal, chartW: chartW })), _jsx(GridLines, { projectEndDay: projectEndDay, calendarMode: settings.calendarMode, cal: cal, svgH: svgH }), viewMode === "detailed"
                                        ? tasks.map((task) => {
                                            const layout = rowLayouts.find((r) => r.discipline === task.discipline);
                                            if (!layout)
                                                return null;
                                            const barH = SLOT_H - 4;
                                            const y = HEADER_H + layout.rowY + ROW_VPAD + task.slotIndex * SLOT_H;
                                            const color = featureColors.get(task.featureId) ?? "#3b82f6";
                                            return (_jsx(DraggableTaskBar, { task: task, y: y, barH: barH, color: color, onMove: handleMove, onResize: handleResize, onClearPin: handleClearPin }, task.taskId));
                                        })
                                        : summaryRows.map((row) => {
                                            const x = row.startDay * DAY_W;
                                            const barW = Math.max(4, (row.endDay - row.startDay) * DAY_W - 2);
                                            const y = HEADER_H + row.rowY + 5;
                                            const barH = SUMMARY_ROW_H - 10;
                                            const maxChars = Math.floor((barW - 10) / 6);
                                            return (_jsxs("g", { children: [_jsx("title", { children: row.featureName }), _jsx("rect", { x: x, y: y, width: barW, height: barH, rx: 4, fill: row.color, opacity: 0.85 }), barW > 40 && (_jsx("text", { x: x + 8, y: y + barH / 2, dominantBaseline: "middle", fontSize: 10, fontWeight: "600", fill: "white", style: { pointerEvents: "none", userSelect: "none" }, children: row.featureName.length > maxChars ? row.featureName.slice(0, maxChars) + "…" : row.featureName }))] }, row.featureId));
                                        }), settings.targetEndDate && (() => {
                                        let deadlineDay = null;
                                        if (settings.calendarMode === "actual" && cal.length > 0) {
                                            const target = parseISODate(settings.targetEndDate);
                                            const idx = cal.findIndex((d) => d.getFullYear() === target.getFullYear() &&
                                                d.getMonth() === target.getMonth() &&
                                                d.getDate() === target.getDate());
                                            deadlineDay = idx >= 0 ? idx : null;
                                        }
                                        else if (settings.calendarMode === "four-week" && settings.startDate) {
                                            const start = parseISODate(settings.startDate);
                                            const target = parseISODate(settings.targetEndDate);
                                            const msPerDay = 86400000;
                                            const calDays = Math.round((target.getTime() - start.getTime()) / msPerDay);
                                            // Rough working-day estimate: 5/7 of calendar days
                                            deadlineDay = Math.round(calDays * 5 / 7);
                                        }
                                        if (deadlineDay === null || deadlineDay <= 0)
                                            return null;
                                        const dx = deadlineDay * DAY_W;
                                        const isOverrun = deadlineDay < projectEndDay;
                                        const lineColor = isOverrun ? "#ef4444" : "#22c55e";
                                        return (_jsxs("g", { children: [_jsx("line", { x1: dx, y1: HEADER_H, x2: dx, y2: svgH - BOTTOM_PAD, stroke: lineColor, strokeWidth: 2, strokeDasharray: "4 3" }), _jsx("rect", { x: dx - 1, y: HEADER_H, width: isOverrun ? dx - 1 : chartW - dx, height: svgH - HEADER_H - BOTTOM_PAD, fill: isOverrun ? "#ef4444" : "#22c55e", opacity: 0.04 }), _jsx("rect", { x: dx - 28, y: HEADER_H + 4, width: 56, height: 16, rx: 3, fill: lineColor }), _jsx("text", { x: dx, y: HEADER_H + 12, textAnchor: "middle", dominantBaseline: "middle", fontSize: 9, fill: "white", fontWeight: "600", style: { pointerEvents: "none" }, children: isOverrun ? "OVERRUN" : "TARGET" })] }));
                                    })(), contingencyDays > 0 && (_jsxs("g", { children: [_jsxs("title", { children: ["Contingency \u2014 ", settings.contingencyPct, "%"] }), _jsx("rect", { x: totalDays * DAY_W, y: HEADER_H + contY + 5, width: Math.max(2, contingencyDays * DAY_W - 2), height: CONT_ROW_H - 10, rx: 3, fill: "#e5e7eb", stroke: "#d1d5db", strokeWidth: 1 }), contingencyDays * DAY_W > 60 && (_jsxs("text", { x: totalDays * DAY_W + (contingencyDays * DAY_W) / 2, y: HEADER_H + contY + CONT_ROW_H / 2, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, fill: "#6b7280", children: [settings.contingencyPct, "% contingency"] }))] }))] }) })] }) }), _jsx(FeatureLegend, { features: features, featureColors: featureColors, tasks: tasks })] }));
}
// ─── Date headers ─────────────────────────────────────────────────────────────
function FourWeekHeader({ projectEndDay, chartW }) {
    const numMonths = Math.ceil(projectEndDay / 20);
    const els = [];
    for (let m = 0; m < numMonths; m++) {
        const mStart = m * 20;
        const mEnd = Math.min((m + 1) * 20, projectEndDay);
        const x = mStart * DAY_W;
        const w = (mEnd - mStart) * DAY_W;
        els.push(_jsxs("g", { children: [_jsx("rect", { x: x, y: 0, width: w, height: MONTH_H, fill: m % 2 === 0 ? "#f3f4f6" : "#eaecef" }), _jsxs("text", { x: x + w / 2, y: MONTH_H / 2, textAnchor: "middle", dominantBaseline: "middle", fontSize: 11, fill: "#374151", fontWeight: "600", children: ["Month ", m + 1] })] }, `m-${m}`));
        for (let w4 = 0; w4 < 4; w4++) {
            const wStart = mStart + w4 * 5;
            const wEnd = Math.min(wStart + 5, projectEndDay);
            if (wStart >= projectEndDay)
                break;
            const wx = wStart * DAY_W;
            const ww = (wEnd - wStart) * DAY_W;
            els.push(_jsxs("g", { children: [_jsx("rect", { x: wx, y: MONTH_H, width: ww, height: WEEK_H, fill: (m + w4) % 2 === 0 ? "#f9fafb" : "#ffffff" }), _jsxs("text", { x: wx + ww / 2, y: MONTH_H + WEEK_H / 2, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, fill: "#9ca3af", children: ["W", w4 + 1] })] }, `w-${m}-${w4}`));
        }
    }
    els.push(_jsx("line", { x1: 0, y1: HEADER_H, x2: chartW, y2: HEADER_H, stroke: "#e5e7eb", strokeWidth: 1 }, "hdr-border"));
    return _jsx(_Fragment, { children: els });
}
function ActualDateHeader({ projectEndDay, cal, chartW }) {
    if (cal.length === 0)
        return null;
    const els = [];
    let monthKey = -1;
    let monthStart = 0;
    let monthIdx = 0;
    const flushMonth = (endDay) => {
        if (monthKey === -1)
            return;
        const x = monthStart * DAY_W;
        const w = (endDay - monthStart) * DAY_W;
        if (w <= 0)
            return;
        els.push(_jsxs("g", { children: [_jsx("rect", { x: x, y: 0, width: w, height: MONTH_H, fill: monthIdx % 2 === 0 ? "#f3f4f6" : "#eaecef" }), _jsx("text", { x: x + w / 2, y: MONTH_H / 2, textAnchor: "middle", dominantBaseline: "middle", fontSize: 11, fill: "#374151", fontWeight: "600", children: formatMonthYear(cal[monthStart]) })] }, `month-${monthKey}`));
        monthIdx++;
    };
    for (let d = 0; d < projectEndDay; d++) {
        const date = cal[d];
        if (!date)
            continue;
        const mk = date.getFullYear() * 12 + date.getMonth();
        if (mk !== monthKey) {
            flushMonth(d);
            monthKey = mk;
            monthStart = d;
        }
        if (date.getDay() === 1) {
            els.push(_jsx("text", { x: d * DAY_W + 3, y: MONTH_H + WEEK_H / 2, dominantBaseline: "middle", fontSize: 9, fill: "#9ca3af", children: formatDateShort(date) }, `wk-${d}`));
        }
    }
    flushMonth(projectEndDay);
    els.push(_jsx("line", { x1: 0, y1: HEADER_H, x2: chartW, y2: HEADER_H, stroke: "#e5e7eb", strokeWidth: 1 }, "hdr-border"));
    return _jsx(_Fragment, { children: els });
}
function GridLines({ projectEndDay, calendarMode, cal, svgH }) {
    const bottom = svgH - BOTTOM_PAD;
    const lines = [];
    if (calendarMode === "four-week") {
        for (let d = 5; d <= projectEndDay; d += 5) {
            const isMonth = d % 20 === 0;
            lines.push(_jsx("line", { x1: d * DAY_W, y1: HEADER_H, x2: d * DAY_W, y2: bottom, stroke: isMonth ? "#d1d5db" : "#f3f4f6", strokeWidth: isMonth ? 1.5 : 1 }, `gl-${d}`));
        }
    }
    else {
        for (let d = 0; d < projectEndDay; d++) {
            const date = cal[d];
            if (!date || date.getDay() !== 1)
                continue;
            const isMonthStart = date.getDate() <= 7;
            lines.push(_jsx("line", { x1: d * DAY_W, y1: HEADER_H, x2: d * DAY_W, y2: bottom, stroke: isMonthStart ? "#d1d5db" : "#f3f4f6", strokeWidth: isMonthStart ? 1.5 : 1 }, `gl-${d}`));
        }
    }
    return _jsx(_Fragment, { children: lines });
}
function FeatureLegend({ features, featureColors, tasks }) {
    const activeIds = new Set(tasks.map((t) => t.featureId));
    const active = features.filter((f) => activeIds.has(f.id));
    if (active.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-4", children: active.map((f) => (_jsxs("div", { className: "flex items-center gap-1.5 text-xs text-gray-600", children: [_jsx("span", { className: "inline-block w-3 h-3 rounded-sm flex-shrink-0", style: { background: featureColors.get(f.id) ?? "#3b82f6" } }), f.name] }, f.id))) }));
}
