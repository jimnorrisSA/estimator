import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";

interface JiraProjectSummary {
  key: string;
  name: string;
}

interface Props {
  projectId: string;
  onClose: () => void;
  onSelected: (key: string) => void;
}

export function JiraProjectPickerModal({ projectId, onClose, onSelected }: Props) {
  const [projects, setProjects] = useState<JiraProjectSummary[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.jira.listProjects(projectId);
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(await res.text());
          setLoadState("error");
          return;
        }
        const data = (await res.json()) as JiraProjectSummary[];
        setProjects(data);
        setLoadState("ready");
      } catch (e) {
        if (!cancelled) {
          setLoadError(String(e));
          setLoadState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const filtered = projects.filter((p) => {
    const q = filter.toLowerCase();
    return p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await api.jira.updateConfig(projectId, { jira_project_key: selected });
      if (!res.ok) {
        setSaveError(await res.text());
        setSaving(false);
        return;
      }
      onSelected(selected);
      onClose();
    } catch (e) {
      setSaveError(String(e));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[480px] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#ece7ff]">Select Jira Project</h2>
            <p className="text-xs text-[#5c5575] mt-0.5">Choose the Jira project to link with this estimator project</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {loadState === "loading" && (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {loadState === "error" && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
            {loadError || "Failed to load Jira projects."}
          </p>
        )}

        {loadState === "ready" && (
          <>
            {/* Search */}
            <input
              type="text"
              placeholder="Filter projects…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#ece7ff] placeholder-[#3a3456] focus:outline-none focus:border-[#7c3aed] transition-colors"
            />

            {/* Project list */}
            <div className="bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#5c5575]">
                  {projects.length === 0 ? "No Jira projects found." : "No projects match your filter."}
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelected(p.key)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#1d1930] transition-colors ${
                      selected === p.key ? "bg-[#1e1548]" : ""
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${
                        selected === p.key
                          ? "border-[#7c3aed] bg-[#7c3aed]"
                          : "border-[#3a3456] bg-transparent"
                      }`}
                    />
                    <span className="font-mono text-xs text-[#a78bfa] w-20 flex-shrink-0">{p.key}</span>
                    <span className="text-sm text-[#ece7ff] truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {saveError && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
            {saveError}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            )}
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
