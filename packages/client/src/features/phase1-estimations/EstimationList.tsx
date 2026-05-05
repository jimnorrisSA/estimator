import { useState } from "react";
import { useEstimationsStore } from "./store/estimationsStore.js";
import { DISCIPLINE_COLORS } from "./utils/defaults.js";
import type { EstimateUnit } from "@estimator/shared";
import { WORKING_DAYS } from "@estimator/shared";

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
  const updatePostItEstimate = useEstimationsStore((s) => s.updatePostItEstimate);
  const updatePostItColor = useEstimationsStore((s) => s.updatePostItColor);
  const setSelected = useEstimationsStore((s) => s.setSelected);

  // Find the selected post-it
  const selectedPostIt = features
    .flatMap((f) => f.postits.map((p) => ({ ...p, featureId: f.id })))
    .find((p) => p.id === selectedId);

  function onGenerate() {
    const names = text.split("\n").filter((n) => n.trim());
    if (names.length) generateFeatures(names);
  }

  return (
    <aside className="w-72 h-full flex flex-col bg-white border-r border-gray-200 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Estimation List</h1>
      </div>

      {/* Feature input */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-600">
          Feature names (one per line)
        </label>
        <textarea
          className="w-full h-28 text-sm border border-gray-300 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={"User login\nDashboard\nSettings page"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 rounded transition-colors"
          onClick={onGenerate}
        >
          Generate feature boxes
        </button>
      </div>

      {/* Feature list */}
      <div className="flex-1 overflow-y-auto">
        {features.length === 0 && (
          <p className="text-xs text-gray-400 px-4 py-3">No features yet.</p>
        )}
        {features.map((f) => (
          <div key={f.id} className="border-b border-gray-100">
            <button
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              onClick={() => setSelected(f.id)}
            >
              {f.name}
            </button>
            {f.postits.map((p) => (
              <button
                key={p.id}
                className={`w-full text-left px-6 py-1.5 flex items-center gap-2 text-xs hover:bg-gray-50 ${
                  selectedId === p.id ? "bg-blue-50" : ""
                }`}
                onClick={() => setSelected(p.id)}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: p.color }}
                />
                <span className="text-gray-500 w-16 shrink-0">{p.discipline}</span>
                <span className="text-gray-700 truncate">{p.taskLabel || "—"}</span>
                <span className="ml-auto text-gray-400 shrink-0">
                  {p.estimate.value}{UNIT_LABELS[p.estimate.unit][0]}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Inspector — shown when a post-it is selected */}
      {selectedPostIt && (
        <div className="border-t border-gray-200 px-4 py-3 flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {selectedPostIt.discipline} · Inspector
          </p>

          {/* Estimate editor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Estimate</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPostIt.estimate.value}
                onChange={(e) =>
                  updatePostItEstimate(
                    selectedPostIt.featureId,
                    selectedPostIt.id,
                    parseFloat(e.target.value) || 1,
                    selectedPostIt.estimate.unit
                  )
                }
              />
              <select
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPostIt.estimate.unit}
                onChange={(e) =>
                  updatePostItEstimate(
                    selectedPostIt.featureId,
                    selectedPostIt.id,
                    selectedPostIt.estimate.value,
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
            <p className="text-xs text-gray-400">
              = {WORKING_DAYS[selectedPostIt.estimate.unit] * selectedPostIt.estimate.value} working days
            </p>
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Color</label>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(DISCIPLINE_COLORS).map(([d, c]) => (
                <button
                  key={d}
                  title={d}
                  className="w-6 h-6 rounded border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: selectedPostIt.color === c ? "#3b82f6" : "transparent",
                  }}
                  onClick={() =>
                    updatePostItColor(selectedPostIt.featureId, selectedPostIt.id, c)
                  }
                />
              ))}
              <input
                type="color"
                className="w-6 h-6 rounded border border-gray-300 cursor-pointer"
                title="Custom color"
                value={selectedPostIt.color}
                onChange={(e) =>
                  updatePostItColor(selectedPostIt.featureId, selectedPostIt.id, e.target.value)
                }
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
