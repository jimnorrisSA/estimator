import { useState } from "react";
import { api } from "../../../lib/api.js";
import type { ExportResult } from "../store/jiraStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";

interface Props {
  projectId: string;
  onClose: () => void;
  onExported: () => void;
}

export function JiraExportModal({ projectId, onClose, onExported }: Props) {
  const features = useEstimationsStore((s) => s.features);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(features.map((f) => f.id)));
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<ExportResult[]>([]);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === features.length ? new Set() : new Set(features.map((f) => f.id)));
  }

  async function handleExport() {
    setState("loading");
    try {
      const featureIds = [...selected];
      const res = await api.jira.exportEstimates(
        projectId,
        featureIds.length < features.length ? featureIds : undefined
      );
      if (!res.ok) {
        setError(await res.text());
        setState("error");
        return;
      }
      const data = (await res.json()) as ExportResult[];
      setResults(data);
      setState("done");
      onExported();
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[520px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#ece7ff]">Export to Jira</h2>
            <p className="text-xs text-[#5c5575] mt-0.5">Pushes T-shirt size estimates to Jira issues</p>
          </div>
          <button onClick={onClose} className="text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors">×</button>
        </div>

        {state === "done" ? (
          <div className="flex flex-col gap-3">
            <div className="bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#5c5575]">No results returned.</p>
              ) : results.map((r, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.error ? "bg-red-500" : "bg-green-500"}`} />
                  <span className="text-sm text-[#9b93ba] font-mono">{r.jira_issue_key || r.feature_id}</span>
                  <span className="text-xs text-[#5c5575] ml-auto">{r.error ?? r.action}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {features.length === 0 ? (
              <p className="text-sm text-[#5c5575] bg-[#14112a] border border-[#2e2848] rounded-lg px-4 py-3">
                No features to export. Add features in Phase 1 first.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide">Select features</span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors"
                  >
                    {selected.size === features.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-52 overflow-y-auto">
                  {features.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1d1930] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggle(f.id)}
                        className="accent-[#7c3aed] w-3.5 h-3.5"
                      />
                      <span className="text-sm text-[#e2ddf5]">{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {state === "error" && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={selected.size === 0 || state === "loading"}
                className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state === "loading" && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {state === "loading"
                  ? "Exporting…"
                  : `Export ${selected.size} feature${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
