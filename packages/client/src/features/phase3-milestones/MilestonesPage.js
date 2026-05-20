import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMilestonesStore } from "./store/milestonesStore.js";
import { useEstimationsStore } from "../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS, getConversionRate } from "../phase2-scheduling/store/schedulingStore.js";
import { runScheduler } from "../phase2-scheduling/utils/scheduler.js";
import { buildWorkingDayCalendar, dateToWorkingDay, parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";
import { Timeline } from "../phase2-scheduling/components/Timeline.js";
export function MilestonesPage() {
    const { milestones: rawMilestones, addMilestone, updateMilestone, deleteMilestone } = useMilestonesStore();
    const milestones = useMemo(() => [...rawMilestones].sort((a, b) => a.startDate.localeCompare(b.startDate)), [rawMilestones]);
    const features = useEstimationsStore((s) => s.features);
    const { settings, overrides, resources } = useSchedulingStore();
    const symbol = CURRENCY_SYMBOLS[settings.currency];
    const conversionRate = getConversionRate(settings);
    const [viewMode, setViewMode] = useState("detailed");
    const [focusedMilestoneId, setFocusedMilestoneId] = useState(null);
    const cal = useMemo(() => {
        if (settings.calendarMode !== "actual")
            return [];
        return buildWorkingDayCalendar(parseISODate(settings.startDate), 500);
    }, [settings.calendarMode, settings.startDate]);
    const blockedPeriods = useMemo(() => milestones
        .filter((m) => (m.hardeningDays ?? 0) > 0)
        .map((m) => {
        const endDay = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
        const startDay = Math.max(0, endDay - (m.hardeningDays ?? 0));
        return { start: startDay, end: endDay, label: `${m.title} Hardening`, color: m.color };
    }), [milestones, settings.calendarMode, settings.startDate, cal]);
    const resourceWindows = useMemo(() => {
        const map = {};
        for (const r of resources) {
            const startDay = r.rollOnDate
                ? dateToWorkingDay(r.rollOnDate, settings.calendarMode, settings.startDate, cal)
                : 0;
            const endDay = r.rollOffDate
                ? dateToWorkingDay(r.rollOffDate, settings.calendarMode, settings.startDate, cal)
                : null;
            if (startDay > 0 || endDay !== null)
                map[r.id] = { startDay, endDay };
        }
        return map;
    }, [resources, settings.calendarMode, settings.startDate, cal]);
    const result = useMemo(() => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth), [features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth]);
    const hasCosts = result.tasks.some((t) => t.cost > 0);
    const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);
    const projectCost = baseCost * (1 + settings.contingencyPct / 100);
    const milestoneCosts = useMemo(() => milestones.map((m) => {
        const mStart = dateToWorkingDay(m.startDate, settings.calendarMode, settings.startDate, cal);
        const mEnd = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
        const matching = result.tasks.filter((t) => t.startDay >= mStart && t.startDay < mEnd);
        return {
            ...m,
            cost: matching.reduce((sum, t) => sum + t.cost, 0),
            days: matching.reduce((sum, t) => sum + t.workingDays, 0),
        };
    }), [milestones, result.tasks, cal, settings.calendarMode, settings.startDate]);
    const disciplineCosts = useMemo(() => {
        const map = new Map();
        for (const t of result.tasks) {
            const cur = map.get(t.discipline) ?? { days: 0, cost: 0 };
            map.set(t.discipline, { days: cur.days + t.workingDays, cost: cur.cost + t.cost });
        }
        return Array.from(map.entries()).map(([discipline, data]) => ({ discipline, ...data }));
    }, [result.tasks]);
    return (_jsxs("div", { className: "flex flex-col h-full overflow-y-auto bg-[#0d0b16]", children: [_jsx(MilestoneStrip, { milestones: milestones, settings: settings, onAdd: addMilestone, onUpdate: updateMilestone, onDelete: deleteMilestone }), _jsxs("div", { className: "flex-1 px-6 pb-6 flex flex-col gap-6", children: [_jsx(Timeline, { result: result, features: features, settings: settings, viewMode: viewMode, onToggleView: () => setViewMode((v) => (v === "detailed" ? "summary" : "detailed")), resourceWindows: resourceWindows, focusedMilestoneId: focusedMilestoneId, onFocusMilestone: setFocusedMilestoneId }), _jsxs("section", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-sm font-semibold text-[#9b93ba] uppercase tracking-wide", children: "Cost Breakdown" }), !hasCosts && (_jsx("p", { className: "text-sm text-[#5c5575]", children: "Add daily rates to team members in Phase 2 to see cost breakdowns." })), hasCosts && (_jsxs("div", { className: "flex flex-wrap gap-6 items-start", children: [milestones.length > 0 && (_jsx(CostTable, { label: "By Milestone", rows: milestoneCosts.map((m) => ({
                                            key: m.id,
                                            name: m.title,
                                            color: m.color,
                                            days: m.days,
                                            cost: m.cost * conversionRate,
                                        })), symbol: symbol })), _jsx(CostTable, { label: "By Discipline", rows: disciplineCosts.map(({ discipline, days, cost }) => ({
                                            key: discipline,
                                            name: discipline,
                                            days,
                                            cost: cost * conversionRate,
                                        })), symbol: symbol }), _jsxs("div", { className: "w-full flex flex-wrap gap-3 pt-2 border-t border-[#2e2848]", children: [_jsx(StatCard, { label: "Base cost", value: `${symbol}${Math.round(baseCost * conversionRate).toLocaleString()}` }), _jsx(StatCard, { label: `Contingency (${settings.contingencyPct}%)`, value: `+${symbol}${Math.round((projectCost - baseCost) * conversionRate).toLocaleString()}` }), _jsx(StatCard, { label: "Total", value: `${symbol}${Math.round(projectCost * conversionRate).toLocaleString()}`, highlight: true })] })] }))] })] })] }));
}
function MilestoneStrip({ milestones, settings, onAdd, onUpdate, onDelete }) {
    const [adding, setAdding] = useState(false);
    const [stripView, setStripView] = useState("list");
    const [draft, setDraft] = useState({ title: "", startDate: settings.startDate, endDate: "" });
    function commitAdd() {
        if (!draft.title.trim() || !draft.startDate || !draft.endDate)
            return;
        onAdd(draft.title.trim(), draft.startDate, draft.endDate);
        setDraft({ title: "", startDate: settings.startDate, endDate: "" });
        setAdding(false);
    }
    return (_jsxs("div", { className: "flex-shrink-0 border-b border-[#2e2848] bg-[#14112a] px-6 py-3 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold text-[#9b93ba] uppercase tracking-wide", children: "Milestones" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex rounded-lg border border-[#2e2848] overflow-hidden text-xs", children: ["list", "chips"].map((v) => (_jsx("button", { onClick: () => setStripView(v), className: `px-3 py-1 transition-colors ${stripView === v
                                        ? "bg-[#7c3aed] text-white font-medium"
                                        : "bg-[#1d1930] text-[#5c5575] hover:bg-[#252041]"}`, children: v === "list" ? "List" : "Chips" }, v))) }), !adding && (_jsxs("button", { className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252041] border border-[#3d366a] text-sm text-[#a78bfa] hover:bg-[#2e2848] transition-colors", onClick: () => setAdding(true), children: [_jsx("span", { className: "text-base leading-none", children: "+" }), " Add milestone"] }))] })] }), milestones.length === 0 && !adding && (_jsx("p", { className: "text-xs text-[#5c5575]", children: "No milestones yet. Add one to see it on the timeline above." })), milestones.length > 0 && stripView === "chips" && (_jsx("div", { className: "flex flex-wrap gap-2", children: milestones.map((m) => (_jsx(MilestoneChip, { milestone: m, onUpdate: onUpdate, onDelete: onDelete }, m.id))) })), milestones.length > 0 && stripView === "list" && (_jsx(MilestoneList, { milestones: milestones, onUpdate: onUpdate, onDelete: onDelete })), adding && (_jsxs("div", { className: "flex flex-wrap gap-3 items-end bg-[#0d0b16] rounded-xl border border-[#3d366a] p-3", children: [_jsx(Field, { label: "Title", children: _jsx("input", { autoFocus: true, className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", placeholder: "e.g. Alpha release", value: draft.title, onChange: (e) => setDraft((d) => ({ ...d, title: e.target.value })), onKeyDown: (e) => { if (e.key === "Enter")
                                commitAdd(); if (e.key === "Escape")
                                setAdding(false); } }) }), _jsx(Field, { label: "Start", children: _jsx("input", { type: "date", className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: draft.startDate, onChange: (e) => setDraft((d) => ({ ...d, startDate: e.target.value })) }) }), _jsx(Field, { label: "End", children: _jsx("input", { type: "date", className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: draft.endDate, onChange: (e) => setDraft((d) => ({ ...d, endDate: e.target.value })) }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "px-4 py-1.5 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-40", disabled: !draft.title.trim() || !draft.startDate || !draft.endDate, onClick: commitAdd, children: "Add" }), _jsx("button", { className: "px-3 py-1.5 rounded-lg text-[#5c5575] text-sm hover:text-[#9b93ba] transition-colors", onClick: () => setAdding(false), children: "Cancel" })] })] }))] }));
}
function MilestoneList({ milestones, onUpdate, onDelete }) {
    return (_jsx("div", { className: "rounded-xl border border-[#2e2848] overflow-hidden", children: _jsxs("table", { className: "w-full text-sm border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-[#1a1628] text-left text-xs text-[#5c5575] uppercase tracking-wide", children: [_jsx("th", { className: "px-4 py-2 font-medium", children: "Milestone" }), _jsx("th", { className: "px-4 py-2 font-medium", children: "Start" }), _jsx("th", { className: "px-4 py-2 font-medium", children: "End" }), _jsx("th", { className: "px-4 py-2 font-medium text-center", children: "Hardening" }), _jsx("th", { className: "px-4 py-2 font-medium text-center", children: "Sprints" }), _jsx("th", { className: "px-4 py-2 font-medium w-16" })] }) }), _jsx("tbody", { children: milestones.map((m, i) => (_jsx(MilestoneRow, { milestone: m, zebra: i % 2 === 1, onUpdate: onUpdate, onDelete: onDelete }, m.id))) })] }) }));
}
function MilestoneRow({ milestone: m, zebra, onUpdate, onDelete }) {
    const [editingTitle, setEditingTitle] = useState(false);
    const rowBg = zebra ? "bg-[#1a1628]" : "bg-[#14112a]";
    return (_jsxs("tr", { className: `${rowBg} border-t border-[#2e2848] group`, children: [_jsx("td", { className: "px-4 py-2.5", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("input", { type: "color", value: m.color, onChange: (e) => onUpdate(m.id, { color: e.target.value }), className: "w-4 h-4 rounded-sm border-0 cursor-pointer flex-shrink-0 bg-transparent", title: "Change colour" }), editingTitle ? (_jsx("input", { autoFocus: true, className: "bg-transparent border-b border-[#7c3aed] text-[#ece7ff] text-sm outline-none w-40 caret-[#a78bfa]", value: m.title, onChange: (e) => onUpdate(m.id, { title: e.target.value }), onBlur: () => setEditingTitle(false), onKeyDown: (e) => { if (e.key === "Enter" || e.key === "Escape")
                                setEditingTitle(false); } })) : (_jsx("span", { className: "text-[#ece7ff] font-medium cursor-pointer hover:text-[#a78bfa] transition-colors", onDoubleClick: () => setEditingTitle(true), title: "Double-click to rename", children: m.title }))] }) }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("input", { type: "date", className: "bg-transparent text-[#9b93ba] text-xs focus:outline-none focus:text-[#ece7ff] cursor-pointer", value: m.startDate, onChange: (e) => onUpdate(m.id, { startDate: e.target.value }) }) }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("input", { type: "date", className: "bg-transparent text-[#9b93ba] text-xs focus:outline-none focus:text-[#ece7ff] cursor-pointer", value: m.endDate, onChange: (e) => onUpdate(m.id, { endDate: e.target.value }) }) }), _jsx("td", { className: "px-4 py-2.5 text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-1", children: [_jsx("input", { type: "number", min: 0, step: 1, className: "w-12 text-center bg-[#1d1930] border border-[#2e2848] text-[#ece7ff] text-xs rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]", value: m.hardeningDays ?? 0, onChange: (e) => onUpdate(m.id, { hardeningDays: Math.max(0, parseInt(e.target.value) || 0) }) }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "d" })] }) }), _jsx("td", { className: "px-4 py-2.5 text-center", children: _jsx("div", { className: "flex items-center justify-center gap-0.5", children: [undefined, 2, 3].map((v) => (_jsx("button", { className: `px-2 py-0.5 text-xs rounded transition-colors ${m.sprintLengthWeeks === v
                            ? "bg-[#7c3aed] text-white font-semibold"
                            : "bg-[#1d1930] text-[#5c5575] hover:text-[#9b93ba]"}`, onClick: () => onUpdate(m.id, { sprintLengthWeeks: v }), children: v == null ? "—" : `${v}w` }, String(v)))) }) }), _jsx("td", { className: "px-4 py-2.5 text-center", children: _jsx("button", { className: "opacity-0 group-hover:opacity-100 text-[#3a3456] hover:text-red-400 transition-all text-lg leading-none", onClick: () => onDelete(m.id), title: "Delete milestone", children: "\u00D7" }) })] }));
}
function MilestoneChip({ milestone, onUpdate, onDelete }) {
    const [editing, setEditing] = useState(false);
    if (editing) {
        return (_jsxs("div", { className: "flex items-center gap-2 bg-[#1d1930] border border-[#3d366a] rounded-lg px-3 py-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm flex-shrink-0", style: { background: milestone.color } }), _jsx("input", { autoFocus: true, className: "bg-transparent text-[#ece7ff] text-sm w-32 focus:outline-none", value: milestone.title, onChange: (e) => onUpdate(milestone.id, { title: e.target.value }), onBlur: () => setEditing(false), onKeyDown: (e) => { if (e.key === "Enter" || e.key === "Escape")
                        setEditing(false); } }), _jsx("input", { type: "date", className: "bg-transparent text-[#9b93ba] text-xs focus:outline-none", value: milestone.startDate, onChange: (e) => onUpdate(milestone.id, { startDate: e.target.value }) }), _jsx("span", { className: "text-[#3a3456] text-xs", children: "\u2192" }), _jsx("input", { type: "date", className: "bg-transparent text-[#9b93ba] text-xs focus:outline-none", value: milestone.endDate, onChange: (e) => onUpdate(milestone.id, { endDate: e.target.value }) }), _jsx("button", { className: "text-[#3a3456] hover:text-[#ef4444] text-lg leading-none ml-1 transition-colors", onMouseDown: (e) => { e.preventDefault(); onDelete(milestone.id); }, children: "\u00D7" })] }));
    }
    return (_jsxs("button", { className: "flex items-center gap-2 bg-[#1d1930] border border-[#2e2848] rounded-lg px-3 py-1.5 hover:border-[#3d366a] transition-colors", onClick: () => setEditing(true), children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm flex-shrink-0", style: { background: milestone.color } }), _jsx("span", { className: "text-sm text-[#ece7ff]", children: milestone.title }), _jsxs("span", { className: "text-xs text-[#5c5575]", children: [milestone.startDate, " \u2013 ", milestone.endDate] })] }));
}
// ─── Cost tables ──────────────────────────────────────────────────────────────
function CostTable({ label, rows, symbol }) {
    return (_jsxs("div", { className: "flex-1 min-w-[240px]", children: [_jsx("h3", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-3", children: label }), _jsxs("table", { className: "w-full text-sm border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs text-[#5c5575] uppercase tracking-wide", children: [_jsx("th", { className: "pb-2 font-medium pr-4", children: "Name" }), _jsx("th", { className: "pb-2 font-medium pr-4 text-right", children: "Days" }), _jsx("th", { className: "pb-2 font-medium text-right", children: "Cost" })] }) }), _jsx("tbody", { children: rows.map(({ key, name, color, days, cost }) => (_jsxs("tr", { className: "border-t border-[#2e2848]", children: [_jsx("td", { className: "py-2.5 pr-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [color && _jsx("span", { className: "w-2.5 h-2.5 rounded-sm flex-shrink-0", style: { background: color } }), _jsx("span", { className: "text-[#ece7ff]", children: name })] }) }), _jsxs("td", { className: "py-2.5 pr-4 text-right text-[#9b93ba]", children: [Math.round(days), "d"] }), _jsx("td", { className: "py-2.5 text-right font-medium text-[#ece7ff]", children: cost > 0 ? `${symbol}${Math.round(cost).toLocaleString()}` : "—" })] }, key))) })] })] }));
}
function StatCard({ label, value, highlight }) {
    return (_jsxs("div", { className: "bg-[#1d1930] rounded-xl border border-[#2e2848] px-4 py-3 flex flex-col gap-0.5", children: [_jsx("span", { className: "text-xs text-[#5c5575] font-medium uppercase tracking-wide", children: label }), _jsx("span", { className: `text-xl font-bold tabular-nums ${highlight ? "text-[#a78bfa]" : "text-[#ece7ff]"}`, children: value })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide", children: label }), children] }));
}
