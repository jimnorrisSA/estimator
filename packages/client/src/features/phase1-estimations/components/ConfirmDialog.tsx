import { useEffect } from "react";
import { motion } from "motion/react";
import type { ConfirmRequest } from "../context/CanvasContext.js";

interface Props {
  req: ConfirmRequest;
  onDone: () => void;
}

export function ConfirmDialog({ req, onDone }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onDone}
    >
      <motion.div
        className="bg-[#1d1930] border border-[#2e2848] rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4"
        initial={{ scale: 0.94, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#ece7ff]">Are you sure?</p>
          <p className="text-sm text-[#9b93ba]">{req.message}</p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-1.5 text-sm rounded-lg border border-[#2e2848] text-[#9b93ba] hover:bg-[#252041] transition-colors"
            onClick={onDone}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition-colors"
            onClick={() => {
              req.onConfirm();
              onDone();
            }}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
