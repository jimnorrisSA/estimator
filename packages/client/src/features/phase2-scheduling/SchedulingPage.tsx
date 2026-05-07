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
  const { settings, overrides, resources, updateSettings, addResource, updateResource, deleteResource } =
    useSchedulingStore();

  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");

  const result = useMemo(
    () => runScheduler(features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate),
    [features, settings.contingencyPct, overrides, resources, settings.defaultDailyRate]
  );

  const symbol = CURRENCY_SYMBOLS[settings.currency];
  const totalTasks = result.tasks.length;
  const totalFeatures = new Set(result.tasks.map((t) => t.featureId)).size;
  const baseCost = result.tasks.reduce((s, t) => s + t.cost, 0);
  const projectCost = baseCost * (1 + settings.contingencyPct / 100);
  const contingencyCost = projectCost - baseCost;
  const hasCosts = baseCost > 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main scrollable area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50 min-w-0">
        <SettingsPanel settings={settings} onChange={updateSettings} />

        <div className="flex-1 flex flex-col gap-6 p-6">
          {/* Summary stats */}
          {totalTasks > 0 && (
            <div className="flex flex-wrap gap-3">
              <Stat label="Tasks" value={String(totalTasks)} />
              <Stat label="Features" value={String(totalFeatures)} />
              <Stat label="Team" value={String(resources.length)} sub={resources.length === 0 ? "add in sidebar →" : "members"} />
              <Stat label="Duration" value={`${result.totalDays}d`} sub="excl. contingency" />
              <Stat label="With contingency" value={`${result.projectEndDay}d`} sub={`+${result.contingencyDays}d`} />
              {hasCosts && <Stat label="Base cost" value={`${symbol}${Math.round(baseCost).toLocaleString()}`} sub="excl. contingency" />}
              {hasCosts && contingencyCost > 0 && <Stat label="Contingency" value={`+${symbol}${Math.round(contingencyCost).toLocaleString()}`} sub={`${settings.contingencyPct}%`} />}
              {hasCosts && contingencyCost > 0 && <Stat label="Total cost" value={`${symbol}${Math.round(projectCost).toLocaleString()}`} />}
            </div>
          )}

          {/* Timeline */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Schedule</h2>
            <Timeline
              result={result}
              features={features}
              settings={settings}
              viewMode={viewMode}
              onToggleView={() => setViewMode((v) => (v === "detailed" ? "summary" : "detailed"))}
            />
          </section>

          {/* Specs table */}
          <SpecsTable
            tasks={result.tasks}
            features={features}
            settings={settings}
            currencySymbol={symbol}
            contingencyPct={settings.contingencyPct}
          />
        </div>
      </div>

      {/* Team sidebar */}
      <TeamSidebar
        resources={resources}
        currency={settings.currency}
        onAdd={addResource}
        onUpdate={updateResource}
        onDelete={deleteResource}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm min-w-[100px]">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-800 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
