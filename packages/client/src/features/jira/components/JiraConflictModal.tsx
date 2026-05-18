import { useState } from "react";
import { api } from "../../../lib/api.js";
import type { PendingConflict } from "../store/jiraStore.js";

interface Props {
  projectId: string;
  conflicts: PendingConflict[];
  onClose: () => void;
  onResolved: () => void;
}

export function JiraConflictModal({ projectId, conflicts, onClose, onResolved }: Props) {
  const [decisions, setDecisions] = useState<Record<string, "estimator" | "jira">>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function pick(mappingId: string, winner: "estimator" | "jira") {
    setDecisions((d) => ({ ...d, [mappingId]: winner }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      for (const [mappingId, winner] of Object.entries(decisions)) {
        const res = await api.jira.resolveConflict(projectId, mappingId, winner);
        if (!res.ok) throw new Error(await res.text());
      }
      onResolved();
      onClose();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  const decidedCount = Object.keys(decisions).length;
  const allDecided = conflicts.length > 0 && decidedCount === conflicts.length;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[620px] max-h-[80vh] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#ece7ff]">Resolve sync conflicts</h2>
            <p className="text-xs text-[#5c5575] mt-0.5">
              {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} — choose which version to keep
            </p>
          </div>
          <button onClick={onClose} className="text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors">×</button>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
          {conflicts.map((c) => {
            const winner = decisions[c.mapping_id];
            return (
              <div key={c.mapping_id} className="bg-[#14112a] border border-[#2e2848] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#7c3aed] bg-[#2e2848] px-1.5 py-0.5 rounded">
                    {c.jira_issue_key}
                  </span>
                  {c.field && (
                    <span className="text-xs text-[#5c5575]">Field: {c.field}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => pick(c.mapping_id, "estimator")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      winner === "estimator"
                        ? "border-[#7c3aed] bg-[#2e2848]"
                        : "border-[#2e2848] bg-[#1d1930] hover:border-[#5b4b8a]"
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#7c3aed] mb-1">Estimator</p>
                    <p className="text-sm text-[#ece7ff] break-words leading-snug">
                      {c.estimator_value || c.estimator_label || "—"}
                    </p>
                  </button>
                  <button
                    onClick={() => pick(c.mapping_id, "jira")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      winner === "jira"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[#2e2848] bg-[#1d1930] hover:border-[#5b4b8a]"
                    }`}
                  >
                    <p className="text-xs font-semibold text-blue-400 mb-1">Jira</p>
                    <p className="text-sm text-[#ece7ff] break-words leading-snug">
                      {c.jira_value || c.jira_summary || "—"}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 flex-shrink-0">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-[#5c5575]">
            {decidedCount} of {conflicts.length} decided
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!allDecided || saving}
              className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              )}
              {saving ? "Saving…" : "Save resolutions"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
