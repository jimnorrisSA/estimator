import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useEstimationsStore } from "../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS, getConversionRate } from "./store/schedulingStore.js";
import { runScheduler } from "./utils/scheduler.js";
import { useMilestonesStore } from "../phase3-milestones/store/milestonesStore.js";
import { buildWorkingDayCalendar, dateToWorkingDay, parseISODate } from "./utils/calendarUtils.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { Timeline } from "./components/Timeline.js";
import { SpecsTable } from "./components/SpecsTable.js";
import { TeamSidebar } from "./components/TeamSidebar.js";
const FEATURE_PALETTE = [
    "#7c3aed", "#f59e0b", "#10b981", "#ef4444",
    "#3b82f6", "#06b6d4", "#f97316", "#a78bfa",
    "#ec4899", "#14b8a6",
];
export function SchedulingPage() {
    const features = useEstimationsStore((s) => s.features);
    const { settings, overrides, resources, updateSettings, addResource, updateResource, deleteResource, condenseAllTasks } = useSchedulingStore();
    const milestones = useMilestonesStore((s) => s.milestones);
    const [viewMode, setViewMode] = useState("detailed");
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
    const symbol = CURRENCY_SYMBOLS[settings.currency];
    const conversionRate = getConversionRate(settings);
    const totalTasks = result.tasks.length;
    const totalFeatures = new Set(result.tasks.map((t) => t.featureId)).size;
    const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);
    const hasCosts = baseCost > 0;
    return (_jsxs("div", { className: "flex h-full overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col overflow-y-auto bg-[#0d0b16] min-w-0", children: [_jsx(SettingsPanel, { settings: settings, onChange: updateSettings }), _jsxs("div", { className: "flex-1 flex flex-col gap-6 p-6", children: [totalTasks > 0 && (_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Stat, { label: "Tasks", value: String(totalTasks) }), _jsx(Stat, { label: "Features", value: String(totalFeatures) }), _jsx(Stat, { label: "Team", value: String(resources.length), sub: resources.length === 0 ? "add in sidebar →" : "members" }), _jsx(Stat, { label: "Duration", value: `${result.totalDays}d`, sub: "task work" }), result.contingencyDays > 0 && _jsx(Stat, { label: "With buffers", value: `${result.projectEndDay}d`, sub: `+${result.contingencyDays}d` })] })), _jsxs("section", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "text-sm font-semibold text-[#9b93ba] uppercase tracking-wide", children: "Schedule" }), _jsx("button", { onClick: condenseAllTasks, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1d1930] border border-[#2e2848] text-[#9b93ba] hover:text-[#ece7ff] hover:border-[#7c3aed] transition-colors", title: "Remove all manual position pins and pack tasks back-to-back, skipping weekends and hardening periods", children: "Condense tasks" })] }), _jsx(Timeline, { result: result, features: features, settings: settings, viewMode: viewMode, onToggleView: () => setViewMode((v) => (v === "detailed" ? "summary" : "detailed")), resourceWindows: resourceWindows })] }), hasCosts && (_jsx(CostSummary, { tasks: result.tasks, features: features, symbol: symbol, conversionRate: conversionRate })), _jsx(SpecsTable, { tasks: result.tasks, features: features, settings: settings, currencySymbol: symbol })] })] }), _jsx(TeamSidebar, { resources: resources, currency: settings.currency, defaultMonthlyRate: settings.defaultMonthlyRate, onAdd: addResource, onUpdate: updateResource, onDelete: deleteResource })] }));
}
function Stat({ label, value, sub }) {
    return (_jsxs("div", { className: "bg-[#1d1930] rounded-xl border border-[#2e2848] px-4 py-3 flex flex-col gap-0.5 shadow-sm min-w-[100px]", children: [_jsx("span", { className: "text-xs text-[#5c5575] font-medium uppercase tracking-wide", children: label }), _jsx("span", { className: "text-xl font-bold text-[#ece7ff] tabular-nums", children: value }), sub && _jsx("span", { className: "text-xs text-[#5c5575]", children: sub })] }));
}
function CostSummary({ tasks, features, symbol, conversionRate, }) {
    const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
    if (totalCost === 0)
        return null;
    const fmt = (gbp) => `${symbol}${Math.round(gbp * conversionRate).toLocaleString()}`;
    const featureCosts = features
        .map((f, i) => ({
        id: f.id,
        name: f.name,
        color: FEATURE_PALETTE[i % FEATURE_PALETTE.length],
        cost: tasks.filter((t) => t.featureId === f.id).reduce((s, t) => s + t.cost, 0),
    }))
        .filter((f) => f.cost > 0);
    const disciplineMap = new Map();
    for (const t of tasks)
        disciplineMap.set(t.discipline, (disciplineMap.get(t.discipline) ?? 0) + t.cost);
    const disciplineCosts = [...disciplineMap.entries()]
        .map(([discipline, cost]) => ({ discipline, cost }))
        .sort((a, b) => b.cost - a.cost);
    return (_jsxs("section", { className: "flex flex-col gap-3", children: [_jsx("h2", { className: "text-sm font-semibold text-[#9b93ba] uppercase tracking-wide", children: "Project cost" }), _jsxs("div", { className: "rounded-xl border border-[#2e2848] bg-[#14112a] overflow-hidden divide-y divide-[#2e2848] md:divide-y-0 md:divide-x md:flex", children: [_jsxs("div", { className: "flex flex-col justify-center gap-1 px-8 py-6 md:min-w-[200px]", children: [_jsx("span", { className: "text-xs text-[#5c5575] font-medium uppercase tracking-wide", children: "Total" }), _jsx("span", { className: "text-4xl font-bold text-[#ece7ff] tabular-nums leading-none", children: fmt(totalCost) }), _jsxs("span", { className: "text-xs text-[#5c5575] mt-1", children: [featureCosts.length, " feature", featureCosts.length !== 1 ? "s" : "", " \u00B7 ", disciplineCosts.length, " discipline", disciplineCosts.length !== 1 ? "s" : ""] })] }), _jsxs("div", { className: "flex-1 px-6 py-5 flex flex-col gap-2.5", children: [_jsx("span", { className: "text-xs text-[#5c5575] font-medium uppercase tracking-wide", children: "By feature" }), featureCosts.map((f) => {
                                const pct = (f.cost / totalCost) * 100;
                                return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-2.5 h-2.5 rounded-sm flex-shrink-0", style: { background: f.color } }), _jsx("span", { className: "text-sm text-[#c5bedf] flex-1 truncate min-w-0", children: f.name }), _jsxs("div", { className: "flex items-center gap-2.5 flex-shrink-0", children: [_jsx("div", { className: "w-20 h-1.5 rounded-full bg-[#2e2848] overflow-hidden", children: _jsx("div", { className: "h-full rounded-full transition-all", style: { width: `${pct}%`, background: f.color } }) }), _jsxs("span", { className: "text-xs text-[#5c5575] w-7 text-right tabular-nums", children: [Math.round(pct), "%"] }), _jsx("span", { className: "text-sm font-semibold text-[#ece7ff] tabular-nums w-24 text-right", children: fmt(f.cost) })] })] }, f.id));
                            })] }), _jsxs("div", { className: "px-6 py-5 flex flex-col gap-2.5 md:min-w-[240px]", children: [_jsx("span", { className: "text-xs text-[#5c5575] font-medium uppercase tracking-wide", children: "By discipline" }), disciplineCosts.map((d) => {
                                const pct = (d.cost / totalCost) * 100;
                                return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-sm text-[#c5bedf] flex-1", children: d.discipline }), _jsxs("div", { className: "flex items-center gap-2.5 flex-shrink-0", children: [_jsx("div", { className: "w-20 h-1.5 rounded-full bg-[#2e2848] overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-[#7c3aed] transition-all", style: { width: `${pct}%` } }) }), _jsxs("span", { className: "text-xs text-[#5c5575] w-7 text-right tabular-nums", children: [Math.round(pct), "%"] }), _jsx("span", { className: "text-sm font-semibold text-[#ece7ff] tabular-nums w-24 text-right", children: fmt(d.cost) })] })] }, d.discipline));
                            })] })] })] }));
}
