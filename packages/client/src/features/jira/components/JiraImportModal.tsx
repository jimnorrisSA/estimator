import { useState } from "react";
import { api } from "../../../lib/api.js";
import type { ImportResult } from "../store/jiraStore.js";

interface Props {
  projectId: string;
  defaultProjectKey?: string;
  onClose: () => void;
  onImported: () => void;
}

export function JiraImportModal({ projectId, defaultProjectKey, onClose, onImported }: Props) {
  const [projectKey, setProjectKey] = useState(defaultProjectKey ?? "");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!projectKey.trim()) return;
    setState("loading");
    try {
      const res = await api.jira.importProject(projectId, projectKey.trim());
      if (!res.ok) {
        setError(await res.text());
        setState("error");
        return;
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setState("done");
      onImported();
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
      <div className="bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[480px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#ece7ff]">Import from Jira</h2>
            <p className="text-xs text-[#5c5575] mt-0.5">Imports epics as features and stories as tasks</p>
          </div>
          <button onClick={onClose} className="text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors">×</button>
        </div>

        {state === "done" && result ? (
          <div className="flex flex-col gap-3">
            <div className="bg-[#14112a] border border-[#2e2848] rounded-lg p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold text-[#86efac]">Import complete</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[#9b93ba]">
                <span>Features created</span><span className="text-[#ece7ff] font-semibold">{result.features_created}</span>
                <span>Features updated</span><span className="text-[#ece7ff] font-semibold">{result.features_updated}</span>
                <span>Tasks created</span><span className="text-[#ece7ff] font-semibold">{result.tasks_created}</span>
                <span>Tasks updated</span><span className="text-[#ece7ff] font-semibold">{result.tasks_updated}</span>
                <span>Skipped</span><span className="text-[#ece7ff] font-semibold">{result.skipped}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-1 border-t border-[#2e2848] pt-2">
                  <p className="text-xs text-red-400 font-semibold mb-1">{result.errors.length} error(s)</p>
                  <ul className="text-xs text-red-300 space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide">Jira project key</label>
              <input
                autoFocus
                className="border border-[#2e2848] bg-[#14112a] text-[#ece7ff] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
                placeholder="e.g. MYPROJ"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && state === "idle") handleImport(); }}
                disabled={state === "loading"}
              />
              <p className="text-xs text-[#5c5575]">The short key before issue numbers — e.g. "MYPROJ" in MYPROJ-123</p>
            </div>

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
                onClick={handleImport}
                disabled={!projectKey.trim() || state === "loading"}
                className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state === "loading" && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {state === "loading" ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
