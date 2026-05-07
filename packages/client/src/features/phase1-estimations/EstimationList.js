import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { WORKING_DAYS } from "@estimator/shared";
import { useEstimationsStore } from "./store/estimationsStore.js";
import { DISCIPLINE_COLORS } from "./utils/defaults.js";
const UNITS = ["half_day", "day", "week", "month"];
const UNIT_LABELS = {
    half_day: "half-day",
    day: "day",
    week: "week",
    month: "month",
};
export function EstimationList() {
    const [text, setText] = useState("");
    const features = useEstimationsStore((s) => s.features);
    const selectedId = useEstimationsStore((s) => s.selectedId);
    const generateFeatures = useEstimationsStore((s) => s.generateFeatures);
    const updateTaskEstimate = useEstimationsStore((s) => s.updateTaskEstimate);
    const deleteTask = useEstimationsStore((s) => s.deleteTask);
    const deleteGroup = useEstimationsStore((s) => s.deleteGroup);
    const setSelected = useEstimationsStore((s) => s.setSelected);
    // Find the selected task and its context
    const selection = (() => {
        for (const f of features) {
            for (const g of f.groups) {
                const task = g.tasks.find((t) => t.id === selectedId);
                if (task)
                    return { feature: f, group: g, task };
            }
        }
        return null;
    })();
    function onGenerate() {
        const names = text.split("\n").filter((n) => n.trim());
        if (names.length)
            generateFeatures(names);
    }
    return (_jsxs("aside", { className: "w-72 h-full flex flex-col bg-white border-r border-gray-200 shrink-0", children: [_jsx("div", { className: "px-4 py-3 border-b border-gray-200", children: _jsx("h1", { className: "text-sm font-bold text-gray-900 uppercase tracking-wide", children: "Estimation List" }) }), _jsxs("div", { className: "px-4 py-3 border-b border-gray-200 flex flex-col gap-2", children: [_jsx("label", { className: "text-xs font-medium text-gray-600", children: "Feature names (one per line)" }), _jsx("textarea", { className: "w-full h-28 text-sm border border-gray-300 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "User login\nDashboard\nSettings page", value: text, onChange: (e) => setText(e.target.value) }), _jsx("button", { className: "w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 rounded transition-colors", onClick: onGenerate, children: "Generate feature boxes" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [features.length === 0 && (_jsx("p", { className: "text-xs text-gray-400 px-4 py-3", children: "No features yet." })), features.map((f) => (_jsxs("div", { className: "border-b border-gray-100", children: [_jsx("button", { className: "w-full text-left px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50", onClick: () => setSelected(f.id), children: f.name }), f.groups.map((g) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center px-5 py-1 gap-2", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm shrink-0", style: { background: DISCIPLINE_COLORS[g.discipline] } }), _jsx("span", { className: "text-xs font-medium text-gray-500 flex-1", children: g.discipline }), _jsx("button", { className: "text-xs text-gray-300 hover:text-red-400 transition-colors", title: "Remove discipline", onClick: () => {
                                                    deleteGroup(f.id, g.id);
                                                    setSelected(null);
                                                }, children: "\u00D7" })] }), g.tasks.map((t) => (_jsxs("button", { className: `w-full text-left px-8 py-1 flex items-center gap-2 text-xs hover:bg-gray-50 ${selectedId === t.id ? "bg-blue-50" : ""}`, onClick: () => setSelected(t.id), children: [_jsx("span", { className: "flex-1 text-gray-700 truncate", children: t.label || "—" }), _jsxs("span", { className: "text-gray-400 shrink-0", children: [t.estimate.value, UNIT_LABELS[t.estimate.unit][0]] })] }, t.id)))] }, g.id)))] }, f.id)))] }), selection && (_jsxs("div", { className: "border-t border-gray-200 px-4 py-3 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-bold text-gray-500 uppercase tracking-wide", children: selection.group.discipline }), _jsx("button", { className: "text-xs text-red-400 hover:text-red-600 transition-colors", onClick: () => {
                                    deleteTask(selection.feature.id, selection.group.id, selection.task.id);
                                    setSelected(null);
                                }, children: "Delete task" })] }), _jsx("p", { className: "text-sm font-medium text-gray-800 truncate", children: selection.task.label || _jsx("span", { className: "text-gray-400 italic", children: "Unlabelled task" }) }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-600", children: "Estimate" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "number", min: 0.5, step: 0.5, className: "w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500", value: selection.task.estimate.value, onChange: (e) => updateTaskEstimate(selection.feature.id, selection.group.id, selection.task.id, parseFloat(e.target.value) || 1, selection.task.estimate.unit) }), _jsx("select", { className: "flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500", value: selection.task.estimate.unit, onChange: (e) => updateTaskEstimate(selection.feature.id, selection.group.id, selection.task.id, selection.task.estimate.value, e.target.value), children: UNITS.map((u) => (_jsx("option", { value: u, children: UNIT_LABELS[u] }, u))) })] }), _jsxs("p", { className: "text-xs text-gray-400", children: ["= ", WORKING_DAYS[selection.task.estimate.unit] * selection.task.estimate.value, " working days"] })] })] }))] }));
}
