import { useEffect, useMemo, useState } from "react";
import { EstimationList } from "./EstimationList.js";
import { EstimationCanvas } from "./components/EstimationCanvas.js";
import { useEstimationsStore } from "./store/estimationsStore.js";
import { useSchedulingStore, CURRENCY_SYMBOLS } from "../phase2-scheduling/store/schedulingStore.js";
import { useMilestonesStore } from "../phase3-milestones/store/milestonesStore.js";
import { runScheduler } from "../phase2-scheduling/utils/scheduler.js";
import type { ResourceWindow } from "../phase2-scheduling/utils/scheduler.js";
import { buildWorkingDayCalendar, dateToWorkingDay, parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";
import { SpecsTable } from "../phase2-scheduling/components/SpecsTable.js";

export function EstimationsPage() {
  const undo = useEstimationsStore((s) => s.undo);
  const redo = useEstimationsStore((s) => s.redo);
  const features = useEstimationsStore((s) => s.features);

  const { settings, overrides, resources } = useSchedulingStore();
  const milestones = useMilestonesStore((s) => s.milestones);
  const symbol = CURRENCY_SYMBOLS[settings.currency];

  const [specsOpen, setSpecsOpen] = useState(true);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault(); redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const cal = useMemo(() => {
    if (settings.calendarMode !== "actual") return [];
    return buildWorkingDayCalendar(parseISODate(settings.startDate), 500);
  }, [settings.calendarMode, settings.startDate]);

  const blockedPeriods = useMemo(() =>
    milestones
      .filter((m) => (m.hardeningDays ?? 0) > 0)
      .map((m) => {
        const endDay = dateToWorkingDay(m.endDate, settings.calendarMode, settings.startDate, cal);
        const startDay = Math.max(0, endDay - (m.hardeningDays ?? 0));
        return { start: startDay, end: endDay, label: `${m.title} Hardening`, color: m.color };
      }),
    [milestones, settings.calendarMode, settings.startDate, cal]
  );

  const resourceWindows = useMemo(() => {
    const map: Record<string, ResourceWindow> = {};
    for (const r of resources) {
      const startDay = r.rollOnDate ? dateToWorkingDay(r.rollOnDate, settings.calendarMode, settings.startDate, cal) : 0;
      const endDay = r.rollOffDate ? dateToWorkingDay(r.rollOffDate, settings.calendarMode, settings.startDate, cal) : null;
      if (startDay > 0 || endDay !== null) map[r.id] = { startDay, endDay };
    }
    return map;
  }, [resources, settings.calendarMode, settings.startDate, cal]);

  const result = useMemo(
    () => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth),
    [features, settings.contingencyPct, overrides, resources, settings.defaultMonthlyRate, blockedPeriods, resourceWindows, settings.workingDaysPerMonth]
  );

  const hasTasks = result.tasks.length > 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">

      {/* Canvas + list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <EstimationList />
        <EstimationCanvas />
      </div>

      {/* Specs panel toggle bar */}
      {hasTasks && (
        <div className="flex-shrink-0 border-t border-[#2e2848] bg-[#14112a]">
          <button
            className="w-full flex items-center gap-2 px-5 py-2 text-xs font-semibold text-[#5c5575] hover:text-[#9b93ba] transition-colors uppercase tracking-wide"
            onClick={() => setSpecsOpen((v) => !v)}
          >
            <span className="transition-transform" style={{ display: "inline-block", transform: specsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            Task Specifications
            <span className="ml-auto text-[#3a3456] font-normal normal-case tracking-normal">
              {result.tasks.length} task{result.tasks.length !== 1 ? "s" : ""}
            </span>
          </button>
        </div>
      )}

      {/* Specs table */}
      {hasTasks && specsOpen && (
        <div className="flex-shrink-0 h-72 border-t border-[#2e2848] overflow-y-auto bg-[#0d0b16]">
          <SpecsTable
            tasks={result.tasks}
            features={features}
            settings={settings}
            currencySymbol={symbol}
          />
        </div>
      )}

    </div>
  );
}
