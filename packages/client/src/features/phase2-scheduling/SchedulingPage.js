import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useEstimationsStore } from "../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS } from "./store/schedulingStore.js";
import { runScheduler } from "./utils/scheduler.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { Timeline } from "./components/Timeline.js";
import { SpecsTable } from "./components/SpecsTable.js";
import { TeamSidebar } from "./components/TeamSidebar.js";
export function SchedulingPage() {
    const features = useEstimationsStore((s) => s.features);
    const { settings, overrides, resources, updateSettings, addResource, updateResource, deleteResource } = useSchedulingStore();
    const [viewMode, setViewMode] = useState("detailed");
    const result = useMemo(() => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate), [features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate]);
    const symbol = CURRENCY_SYMBOLS[settings.currency];
    const totalTasks = result.tasks.length;
    const totalFeatures = new Set(result.tasks.map((t) => t.featureId)).size;
    const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);
    const projectCost = baseCost * (1 + settings.contingencyPct / 100);
    const contingencyCost = projectCost - baseCost;
    const hasCosts = baseCost > 0;
    return (_jsxs("div", { className: "flex h-full overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col overflow-y-auto bg-gray-50 min-w-0", children: [_jsx(SettingsPanel, { settings: settings, onChange: updateSettings }), _jsxs("div", { className: "flex-1 flex flex-col gap-6 p-6", children: [totalTasks > 0 && (_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Stat, { label: "Tasks", value: String(totalTasks) }), _jsx(Stat, { label: "Features", value: String(totalFeatures) }), _jsx(Stat, { label: "Team", value: String(resources.length), sub: resources.length === 0 ? "add in sidebar →" : "members" }), _jsx(Stat, { label: "Duration", value: `${result.totalDays}d`, sub: "excl. contingency" }), _jsx(Stat, { label: "With contingency", value: `${result.projectEndDay}d`, sub: `+${result.contingencyDays}d` }), hasCosts && _jsx(Stat, { label: "Base cost", value: `${symbol}${Math.round(baseCost).toLocaleString()}`, sub: "excl. contingency" }), hasCosts && contingencyCost > 0 && _jsx(Stat, { label: "Contingency", value: `+${symbol}${Math.round(contingencyCost).toLocaleString()}`, sub: `${settings.contingencyPct}%` }), hasCosts && contingencyCost > 0 && _jsx(Stat, { label: "Total cost", value: `${symbol}${Math.round(projectCost).toLocaleString()}` })] })), _jsxs("section", { className: "flex flex-col gap-3", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Schedule" }), _jsx(Timeline, { result: result, features: features, settings: settings, viewMode: viewMode, onToggleView: () => setViewMode((v) => (v === "detailed" ? "summary" : "detailed")) })] }), _jsx(SpecsTable, { tasks: result.tasks, features: features, settings: settings, currencySymbol: symbol, contingencyPct: settings.contingencyPct })] })] }), _jsx(TeamSidebar, { resources: resources, currency: settings.currency, onAdd: addResource, onUpdate: updateResource, onDelete: deleteResource })] }));
}
function Stat({ label, value, sub }) {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm min-w-[100px]", children: [_jsx("span", { className: "text-xs text-gray-400 font-medium uppercase tracking-wide", children: label }), _jsx("span", { className: "text-xl font-bold text-gray-800 tabular-nums", children: value }), sub && _jsx("span", { className: "text-xs text-gray-400", children: sub })] }));
}
