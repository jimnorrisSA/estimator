import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { EstimationsPage } from "./features/phase1-estimations/EstimationsPage.js";
import { SchedulingPage } from "./features/phase2-scheduling/SchedulingPage.js";
const TABS = [
    { phase: 1, label: "Phase 1", sub: "Estimations" },
    { phase: 2, label: "Phase 2", sub: "Schedule" },
];
export function App() {
    const [activePhase, setActivePhase] = useState(1);
    return (_jsxs("div", { className: "flex flex-col h-full w-full", children: [_jsxs("nav", { className: "flex items-stretch bg-white border-b border-gray-200 flex-shrink-0 px-4 gap-1", children: [_jsx("div", { className: "flex items-center mr-4 pr-4 border-r border-gray-200", children: _jsx("span", { className: "text-sm font-bold text-gray-800 tracking-tight", children: "Estimator" }) }), TABS.map(({ phase, label, sub }) => (_jsxs("button", { onClick: () => setActivePhase(phase), className: `flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 transition-colors ${activePhase === phase
                            ? "border-blue-600 text-blue-700"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`, children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wide leading-none", children: label }), _jsx("span", { className: "text-sm font-medium leading-tight mt-0.5", children: sub })] }, phase))), _jsx("div", { className: "flex items-stretch ml-auto gap-1", children: [3, 4].map((phase) => (_jsxs("button", { disabled: true, className: "flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 border-transparent opacity-40 cursor-not-allowed", children: [_jsxs("span", { className: "text-xs font-semibold uppercase tracking-wide leading-none text-gray-400", children: ["Phase ", phase] }), _jsx("span", { className: "text-sm font-medium leading-tight mt-0.5 text-gray-400", children: phase === 3 ? "Roster" : "Timeline" })] }, phase))) })] }), _jsxs("div", { className: "flex-1 min-h-0", children: [activePhase === 1 && _jsx(EstimationsPage, {}), activePhase === 2 && _jsx(SchedulingPage, {})] })] }));
}
