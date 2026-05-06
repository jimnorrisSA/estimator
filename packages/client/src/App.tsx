import { useState } from "react";
import { EstimationsPage } from "./features/phase1-estimations/EstimationsPage.js";
import { SchedulingPage } from "./features/phase2-scheduling/SchedulingPage.js";

type Phase = 1 | 2;

const TABS: { phase: Phase; label: string; sub: string }[] = [
  { phase: 1, label: "Phase 1", sub: "Estimations" },
  { phase: 2, label: "Phase 2", sub: "Schedule" },
];

export function App() {
  const [activePhase, setActivePhase] = useState<Phase>(1);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Navigation */}
      <nav className="flex items-stretch bg-white border-b border-gray-200 flex-shrink-0 px-4 gap-1">
        <div className="flex items-center mr-4 pr-4 border-r border-gray-200">
          <span className="text-sm font-bold text-gray-800 tracking-tight">Estimator</span>
        </div>
        {TABS.map(({ phase, label, sub }) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 transition-colors ${
              activePhase === phase
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide leading-none">{label}</span>
            <span className="text-sm font-medium leading-tight mt-0.5">{sub}</span>
          </button>
        ))}
        <div className="flex items-stretch ml-auto gap-1">
          {([3, 4] as const).map((phase) => (
            <button
              key={phase}
              disabled
              className="flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 border-transparent opacity-40 cursor-not-allowed"
            >
              <span className="text-xs font-semibold uppercase tracking-wide leading-none text-gray-400">
                Phase {phase}
              </span>
              <span className="text-sm font-medium leading-tight mt-0.5 text-gray-400">
                {phase === 3 ? "Roster" : "Timeline"}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 min-h-0">
        {activePhase === 1 && <EstimationsPage />}
        {activePhase === 2 && <SchedulingPage />}
      </div>
    </div>
  );
}
