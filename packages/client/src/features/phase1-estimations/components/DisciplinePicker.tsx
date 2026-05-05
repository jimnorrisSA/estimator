import { useEffect, useRef } from "react";
import type { Discipline } from "@estimator/shared";
import { DISCIPLINE_COLORS, DEFAULT_DISCIPLINES } from "../utils/defaults.js";
import type { DisciplinePickRequest } from "../context/CanvasContext.js";

interface Props {
  req: DisciplinePickRequest;
  onPick: (featureId: string, discipline: Discipline) => void;
  onDone: () => void;
}

export function DisciplinePicker({ req, onPick, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDone();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onDone]);

  const options: Discipline[] = [...DEFAULT_DISCIPLINES, "Custom"];

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: req.x, top: req.y, zIndex: 1100 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex flex-col gap-1 min-w-36"
    >
      <p className="text-xs font-semibold text-gray-500 px-1 pb-1">Add discipline</p>
      {options.map((d) => (
        <button
          key={d}
          className="flex items-center gap-2 text-sm text-left px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
          onClick={() => {
            onPick(req.featureId, d);
            onDone();
          }}
        >
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: DISCIPLINE_COLORS[d] }}
          />
          {d}
        </button>
      ))}
    </div>
  );
}
