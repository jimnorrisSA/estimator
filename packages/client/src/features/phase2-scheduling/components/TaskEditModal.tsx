import { useEffect, useRef, useState } from "react";
import type { EstimateUnit, Resource } from "@estimator/shared";
import type { ScheduledTask } from "../utils/scheduler.js";

interface SavePayload {
  label: string;
  estimateValue: number;
  estimateUnit: EstimateUnit;
  assignedResourceId: string | null;
  notes: string;
}

interface Props {
  task: ScheduledTask;
  resources: Resource[];
  onSave: (changes: SavePayload) => void;
  onUnpin: () => void;
  onClose: () => void;
}

export function TaskEditModal({ task, resources, onSave, onUnpin, onClose }: Props) {
  const [label, setLabel] = useState(task.label);
  const [estimateValue, setEstimateValue] = useState(String(task.estimateValue));
  const [estimateUnit, setEstimateUnit] = useState<EstimateUnit>(task.estimateUnit);
  const [assignedResourceId, setAssignedResourceId] = useState(task.assignedResourceId ?? "");
  const [notes, setNotes] = useState(task.notes);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelRef.current?.focus();
    labelRef.current?.select();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const disciplineResources = resources.filter((r) => r.role === task.discipline);

  function handleSave() {
    const parsedValue = parseFloat(estimateValue);
    onSave({
      label: label.trim() || task.label,
      estimateValue: isNaN(parsedValue) || parsedValue <= 0 ? task.estimateValue : parsedValue,
      estimateUnit,
      assignedResourceId: assignedResourceId || null,
      notes,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl w-[420px] max-w-[90vw] p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-[#5c5575] mb-0.5">{task.featureName} · {task.discipline}</p>
            <h2 className="text-base font-semibold text-[#e2ddf5]">Edit Task</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#5c5575] hover:text-[#9b93ba] text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Label */}
          <div>
            <label className="block text-xs text-[#5c5575] mb-1">Task name</label>
            <input
              ref={labelRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>

          {/* Estimate */}
          <div>
            <label className="block text-xs text-[#5c5575] mb-1">Estimate</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={estimateValue}
                onChange={(e) => setEstimateValue(e.target.value)}
                className="w-24 bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
              <select
                value={estimateUnit}
                onChange={(e) => setEstimateUnit(e.target.value as EstimateUnit)}
                className="flex-1 bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="half_day">Half day</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>

          {/* Assigned resource */}
          <div>
            <label className="block text-xs text-[#5c5575] mb-1">Assigned to</label>
            <select
              value={assignedResourceId}
              onChange={(e) => setAssignedResourceId(e.target.value)}
              className="w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors"
            >
              <option value="">Unassigned</option>
              {disciplineResources.length === 0 && task.assignedResourceId && (
                <option value={task.assignedResourceId} disabled>
                  (resource removed)
                </option>
              )}
              {disciplineResources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {disciplineResources.length === 0 && (
              <p className="text-xs text-[#5c5575] mt-1">
                No {task.discipline} team members — add them in the Team panel.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-[#5c5575] mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#e2ddf5] focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2e2848]">
          <div>
            {task.isPinned && (
              <button
                onClick={() => { onUnpin(); onClose(); }}
                className="text-xs text-[#5c5575] hover:text-[#9b93ba] underline underline-offset-2 transition-colors"
              >
                Unpin task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-[#5c5575] hover:text-[#9b93ba] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm font-medium bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
