import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
import { buildWorkingDayCalendar, formatDateShort, parseISODate } from "../utils/calendarUtils.js";
const UNITS = ["half_day", "day", "week", "month"];
const UNIT_LABELS = {
    half_day: "½ day",
    day: "day",
    week: "week",
    month: "month",
};
export function SpecsTable({ tasks, features, settings, currencySymbol, contingencyPct }) {
    const updateTaskLabel = useEstimationsStore((s) => s.updateTaskLabel);
    const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
    const overrides = useSchedulingStore((s) => s.overrides);
    const setOverride = useSchedulingStore((s) => s.setOverride);
    const assignResource = useSchedulingStore((s) => s.assignResource);
    const resources = useSchedulingStore((s) => s.resources);
    const maxDay = tasks.length > 0 ? Math.max(...tasks.map((t) => t.endDay)) : 0;
    const cal = useMemo(() => {
        if (maxDay === 0)
            return [];
        return buildWorkingDayCalendar(parseISODate(settings.startDate), maxDay + 2);
    }, [settings.startDate, maxDay]);
    const taskMeta = useMemo(() => new Map(features.flatMap((f) => f.groups.flatMap((g) => g.tasks.map((t) => [t.id, { featureId: f.id, groupId: g.id }])))), [features]);
    // Group tasks by feature (preserving scheduler order)
    const featureGroups = useMemo(() => {
        const groups = [];
        const idx = new Map();
        for (const task of tasks) {
            if (!idx.has(task.featureId)) {
                idx.set(task.featureId, groups.length);
                groups.push({ featureId: task.featureId, featureName: task.featureName, tasks: [] });
            }
            groups[idx.get(task.featureId)].tasks.push(task);
        }
        return groups;
    }, [tasks]);
    if (tasks.length === 0)
        return null;
    const totalWd = tasks.reduce((s, t) => s + t.workingDays, 0);
    const baseCost = tasks.reduce((s, t) => s + t.cost, 0);
    const contCost = baseCost * contingencyPct / 100;
    const totalCost = baseCost + contCost;
    const hasCosts = baseCost > 0;
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-700", children: "Task specifications" }), _jsx("div", { className: "overflow-x-auto rounded-xl border border-gray-200 shadow-sm", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 border-b border-gray-200", children: [_jsx(Th, { children: "Feature" }), _jsx(Th, { children: "Task" }), _jsx(Th, { children: "Discipline" }), _jsx(Th, { children: "Estimate" }), _jsx(Th, { align: "right", children: "Days" }), _jsx(Th, { children: "Start" }), _jsx(Th, { children: "End" }), _jsx(Th, { children: "Resource" }), hasCosts && _jsx(Th, { align: "right", children: "Cost" }), _jsx(Th, { children: "Notes" })] }) }), _jsx("tbody", { children: featureGroups.map((group) => {
                                const groupWd = group.tasks.reduce((s, t) => s + t.workingDays, 0);
                                const groupCost = group.tasks.reduce((s, t) => s + t.cost, 0);
                                return (_jsxs(_Fragment, { children: [group.tasks.map((task) => {
                                            const meta = taskMeta.get(task.taskId);
                                            return (_jsxs("tr", { className: "hover:bg-blue-50/30 transition-colors bg-white", children: [_jsx("td", { className: "px-3 py-2 text-xs text-gray-400 whitespace-nowrap border-b border-gray-100", children: task.featureName }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100 min-w-[140px]", children: _jsx(EditableText, { value: task.label, onCommit: (v) => { if (meta && v.trim())
                                                                updateTaskLabel(meta.featureId, meta.groupId, task.taskId, v.trim()); } }) }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100", children: _jsx(DisciplineBadge, { discipline: task.discipline }) }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(EstimateValueInput, { value: task.estimateValue, onCommit: (v) => { if (meta)
                                                                        updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, v, task.estimateUnit); } }), _jsx("select", { value: task.estimateUnit, className: "border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white", onChange: (e) => { if (meta)
                                                                        updateTaskEstimate(meta.featureId, meta.groupId, task.taskId, task.estimateValue, e.target.value); }, children: UNITS.map((u) => _jsx("option", { value: u, children: UNIT_LABELS[u] }, u)) })] }) }), _jsxs("td", { className: "px-3 py-2 text-xs text-gray-500 border-b border-gray-100 tabular-nums text-right", children: [task.workingDays % 1 === 0 ? task.workingDays : task.workingDays.toFixed(1), "d"] }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100 whitespace-nowrap", children: _jsx(EditableDayCell, { day: task.startDay, settings: settings, cal: cal, onCommit: (d) => setOverride(task.taskId, { startDay: d, endDay: task.endDay }) }) }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100 whitespace-nowrap", children: _jsx(EditableDayCell, { day: task.endDay, settings: settings, cal: cal, onCommit: (d) => setOverride(task.taskId, { startDay: task.startDay, endDay: d }) }) }), _jsx("td", { className: "px-3 py-2 border-b border-gray-100", children: _jsx(ResourcePicker, { taskId: task.taskId, discipline: task.discipline, assignedResourceId: task.assignedResourceId, resources: resources, onAssign: assignResource }) }), hasCosts && (_jsx("td", { className: "px-3 py-2 text-xs border-b border-gray-100 tabular-nums text-right", children: task.cost > 0
                                                            ? _jsxs("span", { className: "text-gray-700", children: [currencySymbol, Math.round(task.cost).toLocaleString()] })
                                                            : _jsx("span", { className: "text-gray-300", children: "\u2014" }) })), _jsx("td", { className: "px-3 py-2 border-b border-gray-100 min-w-[160px]", children: _jsx(EditableText, { value: overrides[task.taskId]?.notes ?? "", placeholder: "Add note\u2026", onCommit: (v) => setOverride(task.taskId, { notes: v }) }) })] }, task.taskId));
                                        }), _jsxs("tr", { className: "bg-gray-50/80 border-t border-gray-200", children: [_jsx("td", { colSpan: 4, className: "px-3 py-1.5 text-xs font-semibold text-gray-600 italic", children: group.featureName }), _jsxs("td", { className: "px-3 py-1.5 text-xs font-semibold text-gray-600 tabular-nums text-right", children: [groupWd % 1 === 0 ? groupWd : groupWd.toFixed(1), "d"] }), _jsx("td", { colSpan: hasCosts ? 3 : 3 }), hasCosts && (_jsx("td", { className: "px-3 py-1.5 text-xs font-semibold text-gray-600 tabular-nums text-right", children: groupCost > 0 ? `${currencySymbol}${Math.round(groupCost).toLocaleString()}` : "—" })), _jsx("td", {})] }, `subtotal-${group.featureId}`)] }));
                            }) }), _jsxs("tfoot", { children: [_jsxs("tr", { className: "bg-gray-50 border-t-2 border-gray-300", children: [_jsx("td", { colSpan: 4, className: "px-3 py-2 text-xs font-semibold text-gray-600", children: "Base total" }), _jsxs("td", { className: "px-3 py-2 text-xs font-semibold text-gray-700 tabular-nums text-right", children: [totalWd % 1 === 0 ? totalWd : totalWd.toFixed(1), "d"] }), _jsx("td", { colSpan: 3 }), hasCosts && _jsxs("td", { className: "px-3 py-2 text-xs font-semibold text-gray-700 tabular-nums text-right", children: [currencySymbol, Math.round(baseCost).toLocaleString()] }), _jsx("td", {})] }), hasCosts && contingencyPct > 0 && (_jsxs("tr", { className: "bg-gray-50", children: [_jsxs("td", { colSpan: 4, className: "px-3 py-2 text-xs text-gray-500 italic", children: ["Contingency (", contingencyPct, "%)"] }), _jsx("td", { colSpan: 4 }), _jsxs("td", { className: "px-3 py-2 text-xs text-gray-500 tabular-nums text-right italic", children: ["+", currencySymbol, Math.round(contCost).toLocaleString()] }), _jsx("td", {})] })), hasCosts && contingencyPct > 0 && (_jsxs("tr", { className: "bg-gray-100 border-t border-gray-200", children: [_jsx("td", { colSpan: 4, className: "px-3 py-2 text-xs font-bold text-gray-700", children: "Project total" }), _jsx("td", { colSpan: 4 }), _jsxs("td", { className: "px-3 py-2 text-xs font-bold text-gray-800 tabular-nums text-right", children: [currencySymbol, Math.round(totalCost).toLocaleString()] }), _jsx("td", {})] }))] })] }) })] }));
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function Th({ children, align }) {
    return (_jsx("th", { className: `px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${align === "right" ? "text-right" : ""}`, children: children }));
}
function DisciplineBadge({ discipline }) {
    const colors = {
        Art: "bg-orange-100 text-orange-700",
        Design: "bg-purple-100 text-purple-700",
        Code: "bg-sky-100 text-sky-700",
        Production: "bg-green-100 text-green-700",
        Custom: "bg-gray-100 text-gray-600",
    };
    return (_jsx("span", { className: `inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[discipline] ?? colors.Custom}`, children: discipline }));
}
function EstimateValueInput({ value, onCommit, }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    return (_jsx("input", { type: "number", min: 0.5, step: 0.5, className: "w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500", value: draft, onChange: (e) => setDraft(e.target.value), onBlur: () => {
            const v = parseFloat(draft);
            if (!isNaN(v) && v > 0)
                onCommit(v);
            else
                setDraft(String(value));
        }, onKeyDown: (e) => {
            if (e.key === "Enter")
                e.currentTarget.blur();
            if (e.key === "Escape") {
                setDraft(String(value));
                e.currentTarget.blur();
            }
        } }));
}
function EditableDayCell({ day, settings, cal, onCommit, }) {
    const [editing, setEditing] = useState(false);
    function label() {
        if (settings.calendarMode === "actual" && cal[day])
            return formatDateShort(cal[day]);
        const m = Math.floor(day / 20) + 1;
        const w = Math.floor((day % 20) / 5) + 1;
        return `M${m} W${w}`;
    }
    if (!editing) {
        return (_jsx("span", { className: "cursor-text text-xs text-gray-500 hover:bg-gray-100 rounded px-1 -mx-1 block whitespace-nowrap tabular-nums", title: "Click to override", onClick: () => setEditing(true), children: label() }));
    }
    if (settings.calendarMode === "actual" && cal.length > 0) {
        return (_jsx("input", { type: "date", autoFocus: true, defaultValue: cal[day] ? cal[day].toISOString().slice(0, 10) : "", className: "border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none", onBlur: (e) => {
                if (e.target.value) {
                    const target = parseISODate(e.target.value);
                    const idx = cal.findIndex((d) => d.getFullYear() === target.getFullYear() &&
                        d.getMonth() === target.getMonth() &&
                        d.getDate() === target.getDate());
                    if (idx >= 0)
                        onCommit(idx);
                }
                setEditing(false);
            }, onKeyDown: (e) => {
                if (e.key === "Enter")
                    e.currentTarget.blur();
                if (e.key === "Escape")
                    setEditing(false);
            } }));
    }
    return (_jsx("input", { type: "number", autoFocus: true, min: 0, defaultValue: day, className: "border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none w-16", onBlur: (e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= 0)
                onCommit(v);
            setEditing(false);
        }, onKeyDown: (e) => {
            if (e.key === "Enter")
                e.currentTarget.blur();
            if (e.key === "Escape")
                setEditing(false);
        } }));
}
function ResourcePicker({ taskId, discipline, assignedResourceId, resources, onAssign, }) {
    const matching = resources.filter((r) => r.role === discipline);
    if (matching.length === 0) {
        return _jsx("span", { className: "text-xs text-gray-300", children: "\u2014" });
    }
    return (_jsxs("select", { value: assignedResourceId ?? "", className: "text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 max-w-[140px]", onChange: (e) => onAssign(taskId, e.target.value || null), children: [_jsx("option", { value: "", children: "Unassigned" }), matching.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id)))] }));
}
function EditableText({ value, placeholder, onCommit, }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    if (!editing) {
        return (_jsx("span", { className: "cursor-text text-xs text-gray-700 hover:bg-gray-100 rounded px-1 -mx-1 block min-w-[60px] leading-5", onClick: () => { setDraft(value); setEditing(true); }, children: value || _jsx("span", { className: "text-gray-300", children: placeholder }) }));
    }
    return (_jsx("input", { autoFocus: true, className: "border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full", value: draft, onChange: (e) => setDraft(e.target.value), onBlur: () => { onCommit(draft); setEditing(false); }, onKeyDown: (e) => {
            if (e.key === "Enter") {
                onCommit(draft);
                setEditing(false);
            }
            if (e.key === "Escape")
                setEditing(false);
        } }));
}
