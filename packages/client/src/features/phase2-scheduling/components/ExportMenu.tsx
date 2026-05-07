import { useState } from "react";
import type { ScheduledTask, ScheduleResult } from "../utils/scheduler.js";
import type { ScheduleSettings } from "../store/schedulingStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "../store/schedulingStore.js";
import {
  exportTimelinePng,
  exportCsv,
  exportJson,
  exportPdf,
  exportDocx,
} from "../utils/exports.js";

interface Props {
  tasks: ScheduledTask[];
  settings: ScheduleSettings;
  result: ScheduleResult;
}

interface ExportItem {
  label: string;
  sub: string;
  action: () => void | Promise<void>;
}

export function ExportMenu({ tasks, settings, result }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const features = useEstimationsStore((s) => s.features);
  const overrides = useSchedulingStore((s) => s.overrides);
  const resources = useSchedulingStore((s) => s.resources);

  async function run(label: string, fn: () => void | Promise<void>) {
    setBusy(label);
    setOpen(false);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const items: ExportItem[] = [
    {
      label: "PDF report",
      sub: "Detailed task table",
      action: () => exportPdf(tasks, settings, result),
    },
    {
      label: "Word document",
      sub: "Editable .docx",
      action: () => exportDocx(tasks, settings, result),
    },
    {
      label: "Timeline PNG",
      sub: "Image for slides",
      action: () => exportTimelinePng(settings.projectName),
    },
    {
      label: "CSV",
      sub: "Spreadsheet data",
      action: () => exportCsv(tasks, settings),
    },
    {
      label: "JSON",
      sub: "Full project data",
      action: () =>
        exportJson(
          { features, settings, overrides, resources, schedule: result },
          settings.projectName
        ),
    },
  ];

  return (
    <div className="relative self-start">
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252041] border border-[#3d366a] text-sm text-[#a78bfa] hover:bg-[#2e2848] hover:border-[#5b4b8a] transition-colors disabled:opacity-50"
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null || tasks.length === 0}
        title={tasks.length === 0 ? "Add tasks to export" : undefined}
      >
        {busy ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin inline-block" />
            <span>{busy}…</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v8M4 6l3 3 3-3M2 10v1.5A1.5 1.5 0 003.5 13h7A1.5 1.5 0 0012 11.5V10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Export</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[#14112a] border border-[#2e2848] rounded-xl shadow-xl shadow-black/60 overflow-hidden">
            {items.map((item) => (
              <button
                key={item.label}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e1548] transition-colors flex flex-col border-b border-[#1e1a2e] last:border-b-0"
                onClick={() => run(item.label, item.action)}
              >
                <span className="text-sm font-medium text-[#ece7ff]">{item.label}</span>
                <span className="text-xs text-[#5c5575]">{item.sub}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
