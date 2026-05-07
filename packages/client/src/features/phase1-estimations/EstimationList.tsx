import { useState } from "react";
import type { EstimateUnit } from "@estimator/shared";
import { WORKING_DAYS } from "@estimator/shared";
import { useEstimationsStore } from "./store/estimationsStore.js";
import { DISCIPLINE_COLORS } from "./utils/defaults.js";

const UNITS: EstimateUnit[] = ["half_day", "day", "week", "month"];
const UNIT_LABELS: Record<EstimateUnit, string> = {
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

  const selection = (() => {
    for (const f of features) {
      for (const g of f.groups) {
        const task = g.tasks.find((t) => t.id === selectedId);
        if (task) return { feature: f, group: g, task };
      }
    }
    return null;
  })();

  function onGenerate() {
    const names = text.split("\n").filter((n) => n.trim());
    if (names.length) generateFeatures(names);
  }

  return (
    <aside className="w-72 h-full flex flex-col bg-[#14112a] border-r border-[#2e2848] shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2e2848]">
        <h1 className="text-sm font-bold text-[#a78bfa] uppercase tracking-wide">Estimation List</h1>
      </div>

      {/* Feature input */}
      <div className="px-4 py-3 border-b border-[#2e2848] flex flex-col gap-2">
        <label className="text-xs font-medium text-[#9b93ba]">Feature names (one per line)</label>
        <textarea
          className="w-full h-28 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
          placeholder={"User login\nDashboard\nSettings page"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-1.5 rounded transition-colors"
          onClick={onGenerate}
        >
          Generate feature boxes
        </button>
      </div>

      {/* Feature / group / task tree */}
      <div className="flex-1 overflow-y-auto">
        {features.length === 0 && (
          <p className="text-sm text-[#5c5575] px-4 py-3">No features yet.</p>
        )}
        {features.map((f) => (
          <div key={f.id} className="border-b border-[#2e2848]">
            {/* Feature row */}
            <button
              className="w-full text-left px-4 py-2 text-sm font-semibold text-[#ece7ff] hover:bg-[#252041] transition-colors"
              onClick={() => setSelected(f.id)}
            >
              {f.name}
            </button>

            {f.groups.map((g) => (
              <div key={g.id}>
                {/* Group row */}
                <div className="flex items-center px-5 py-1 gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: DISCIPLINE_COLORS[g.discipline] }}
                  />
                  <span className="text-xs font-medium text-[#9b93ba] flex-1">{g.discipline}</span>
                  <button
                    className="text-xs text-[#3a3456] hover:text-red-400 transition-colors"
                    title="Remove discipline"
                    onClick={() => {
                      deleteGroup(f.id, g.id);
                      setSelected(null);
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Task rows */}
                {g.tasks.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full text-left px-8 py-1 flex items-center gap-2 text-sm hover:bg-[#252041] transition-colors ${
                      selectedId === t.id ? "bg-[#1e1548]" : ""
                    }`}
                    onClick={() => setSelected(t.id)}
                  >
                    <span className="flex-1 text-[#ece7ff] truncate">{t.label || "—"}</span>
                    <span className="text-[#5c5575] shrink-0">
                      {t.estimate.value}{UNIT_LABELS[t.estimate.unit][0]}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Inspector — shown when a task is selected */}
      {selection && (
        <div className="border-t border-[#2e2848] px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#9b93ba] uppercase tracking-wide">
              {selection.group.discipline}
            </p>
            <button
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
              onClick={() => {
                deleteTask(selection.feature.id, selection.group.id, selection.task.id);
                setSelected(null);
              }}
            >
              Delete task
            </button>
          </div>

          <p className="text-sm font-medium text-[#ece7ff] truncate">
            {selection.task.label || <span className="text-[#5c5575] italic">Unlabelled task</span>}
          </p>

          {/* Estimate editor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#9b93ba]">Estimate</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="w-20 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                value={selection.task.estimate.value}
                onChange={(e) =>
                  updateTaskEstimate(
                    selection.feature.id,
                    selection.group.id,
                    selection.task.id,
                    parseFloat(e.target.value) || 1,
                    selection.task.estimate.unit
                  )
                }
              />
              <select
                className="flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                value={selection.task.estimate.unit}
                onChange={(e) =>
                  updateTaskEstimate(
                    selection.feature.id,
                    selection.group.id,
                    selection.task.id,
                    selection.task.estimate.value,
                    e.target.value as EstimateUnit
                  )
                }
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[#5c5575]">
              = {WORKING_DAYS[selection.task.estimate.unit] * selection.task.estimate.value} working days
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
