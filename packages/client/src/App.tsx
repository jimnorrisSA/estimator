import { useState } from "react";
import { EstimationsPage } from "./features/phase1-estimations/EstimationsPage.js";
import { SchedulingPage } from "./features/phase2-scheduling/SchedulingPage.js";
import { MilestonesPage } from "./features/phase3-milestones/MilestonesPage.js";
import { ExportMenu } from "./features/phase2-scheduling/components/ExportMenu.js";

type Phase = 1 | 2 | 3;

const TABS: { phase: Phase; label: string; sub: string }[] = [
  { phase: 1, label: "Phase 1", sub: "Estimations" },
  { phase: 2, label: "Phase 2", sub: "Schedule" },
  { phase: 3, label: "Phase 3", sub: "Milestones" },
];

export function App() {
  const [activePhase, setActivePhase] = useState<Phase>(1);

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0b16]">
      {/* Navigation */}
      <nav className="flex items-stretch bg-[#14112a] border-b border-[#2e2848] flex-shrink-0 px-4 gap-1">
        {/* Logo / brand */}
        <div className="flex items-center pr-4 mr-2 border-r border-[#2e2848]">
          <img src="/logo.png" alt="Vigo" className="h-9 w-9 object-contain rounded-lg" />
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

        {/* Nav actions */}
        <div className="flex items-center ml-auto gap-3 pr-2">
          {activePhase === 2 && <ExportMenu />}
        </div>

        {/* Future phase tab */}
        <div className="flex items-stretch gap-1">
          <button
            disabled
            className="flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 border-transparent opacity-30 cursor-not-allowed"
          >
            <span className="text-xs font-semibold uppercase tracking-wide leading-none text-[#5c5575]">Phase 4</span>
            <span className="text-sm font-medium leading-tight mt-0.5 text-[#5c5575]">Timeline</span>
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 min-h-0">
        {activePhase === 1 && <EstimationsPage />}
        {activePhase === 2 && <SchedulingPage />}
        {activePhase === 3 && <MilestonesPage />}
      </div>
    </div>
  );
}
