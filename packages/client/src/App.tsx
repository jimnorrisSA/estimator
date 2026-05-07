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
    <div className="flex flex-col h-full w-full bg-[#0d0b16]">
      {/* Navigation */}
      <nav className="flex items-stretch bg-[#14112a] border-b border-[#2e2848] flex-shrink-0 px-4 gap-1">
        {/* Brand */}
        <div className="flex items-center mr-4 pr-4 border-r border-[#2e2848]">
          <span className="text-sm font-bold text-[#a78bfa] tracking-tight">Estimator</span>
        </div>

        {/* Active phase tabs */}
        {TABS.map(({ phase, label, sub }) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 transition-colors ${
              activePhase === phase
                ? "border-[#8b5cf6] text-[#a78bfa]"
                : "border-transparent text-[#5c5575] hover:text-[#9b93ba] hover:border-[#3d366a]"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide leading-none">{label}</span>
            <span className="text-sm font-medium leading-tight mt-0.5">{sub}</span>
          </button>
        ))}

        {/* Future phase tabs + icon slot */}
        <div className="flex items-stretch ml-auto gap-1">
          {([3, 4] as const).map((phase) => (
            <button
              key={phase}
              disabled
              className="flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 border-transparent opacity-30 cursor-not-allowed"
            >
              <span className="text-xs font-semibold uppercase tracking-wide leading-none text-[#5c5575]">
                Phase {phase}
              </span>
              <span className="text-sm font-medium leading-tight mt-0.5 text-[#5c5575]">
                {phase === 3 ? "Roster" : "Timeline"}
              </span>
            </button>
          ))}

          {/* Icon placeholder — to be designed */}
          <div className="flex items-center pl-3 ml-1 border-l border-[#2e2848]">
            <button
              className="w-8 h-8 rounded-full bg-[#252041] border border-[#3d366a] flex items-center justify-center text-[#8b5cf6] hover:bg-[#2e2848] hover:border-[#5b4b8a] hover:text-[#a78bfa] transition-all"
              title="Account (coming soon)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
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
