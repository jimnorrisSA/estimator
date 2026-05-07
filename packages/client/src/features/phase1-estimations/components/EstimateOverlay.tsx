import { useEffect, useRef, useState } from "react";
import type { EstimateUnit } from "@estimator/shared";
import type { EstimateEditRequest } from "../context/CanvasContext.js";

const UNITS: { unit: EstimateUnit; label: string }[] = [
  { unit: "half_day", label: "½d" },
  { unit: "day", label: "d" },
  { unit: "week", label: "w" },
  { unit: "month", label: "mo" },
];

interface Props {
  edit: EstimateEditRequest;
  onDone: () => void;
}

export function EstimateOverlay({ edit, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(String(edit.value));
  const [unit, setUnit] = useState<EstimateUnit>(edit.unit);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    const n = parseFloat(value);
    if (!isNaN(n) && n > 0) edit.onCommit(n, unit);
    onDone();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") onDone();
  }

  // OVERLAY_W must be wide enough for the input + 4 unit buttons
  const OVERLAY_W = 168;

  return (
    <div
      style={{
        position: "fixed",
        left: edit.x - OVERLAY_W,
        top: edit.y - 4,
        zIndex: 1001,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-1 bg-white border-2 border-blue-500 rounded-lg shadow-lg px-2 py-1"
        style={{ width: OVERLAY_W }}
      >
        <input
          ref={inputRef}
          type="number"
          min={0.5}
          step={0.5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="w-12 text-right text-sm font-mono border-none outline-none bg-transparent"
        />
        <div className="flex gap-0.5">
          {UNITS.map(({ unit: u, label }) => (
            <button
              key={u}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setUnit(u); }}
              className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                unit === u
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
