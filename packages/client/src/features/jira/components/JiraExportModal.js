import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../../../lib/api.js";
import { useJiraStore } from "../store/jiraStore.js";
import { useEstimationsStore } from "../../phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "../../phase2-scheduling/store/schedulingStore.js";
import { useMilestonesStore } from "../../phase3-milestones/store/milestonesStore.js";
import { useProjectsStore } from "../../../store/projectsStore.js";
export function JiraExportModal({ projectId, onClose, onExported }) {
    const features = useEstimationsStore((s) => s.features);
    const markFeaturesSynced = useJiraStore((s) => s.markFeaturesSynced);
    const [selected, setSelected] = useState(() => new Set(features.map((f) => f.id)));
    const [state, setState] = useState("idle");
    const [results, setResults] = useState([]);
    const [error, setError] = useState("");
    function toggle(id) {
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
            // Flush current canvas state to the server so the export reads fresh data.
            const { saveActiveSnapshot, pushToServer, getActiveProject } = useProjectsStore.getState();
            const active = getActiveProject();
            const currentFeatures = useEstimationsStore.getState().features;
            console.log("[jira-export] active project:", active?.id, "apiId:", active?.apiId, "projectId prop:", projectId);
            console.log("[jira-export] features to save:", currentFeatures.length, currentFeatures.map(f => ({ id: f.id, name: f.name, groups: f.groups.length, tasks: f.groups.flatMap(g => g.tasks).length })));
            if (active) {
                saveActiveSnapshot({
                    features: currentFeatures,
                    schedulingSettings: useSchedulingStore.getState().settings,
                    overrides: useSchedulingStore.getState().overrides,
                    resources: useSchedulingStore.getState().resources,
                    milestones: useMilestonesStore.getState().milestones,
                });
                await pushToServer(active.id);
                console.log("[jira-export] snapshot pushed to server");
            }
            else {
                console.warn("[jira-export] no active project — snapshot NOT saved");
            }
            const featureIds = [...selected];
            const res = await api.jira.exportEstimates(projectId, featureIds.length < features.length ? featureIds : undefined);
            console.log("[jira-export] response status:", res.status);
            if (!res.ok) {
                const errText = await res.text();
                console.error("[jira-export] error response:", errText);
                setError(errText);
                setState("error");
                return;
            }
            const data = (await res.json());
            console.log("[jira-export] results:", JSON.stringify(data, null, 2));
            setResults(data ?? []);
            if (data)
                markFeaturesSynced(data);
            setState("done");
            onExported();
        }
        catch (e) {
            setError(String(e));
            setState("error");
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[520px] flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-[#ece7ff]", children: "Export to Jira" }), _jsx("p", { className: "text-xs text-[#5c5575] mt-0.5", children: "Pushes T-shirt size estimates to Jira issues" })] }), _jsx("button", { onClick: onClose, className: "text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors", children: "\u00D7" })] }), state === "done" ? (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-64 overflow-y-auto", children: results.length === 0 ? (_jsx("p", { className: "px-4 py-3 text-sm text-[#5c5575]", children: "No results returned." })) : results.map((r, i) => (_jsxs("div", { className: "px-4 py-2.5 flex items-center gap-3", children: [_jsx("span", { className: `w-2 h-2 rounded-full flex-shrink-0 ${r.errorMessage ? "bg-red-500" : "bg-green-500"}` }), _jsx("span", { className: "text-sm text-[#9b93ba] font-mono", children: r.jiraKey || r.estimatorId }), _jsx("span", { className: "text-xs text-[#5c5575] ml-auto", children: r.errorMessage ?? r.status })] }, i))) }), _jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors", children: "Done" })] })) : (_jsxs(_Fragment, { children: [features.length === 0 ? (_jsx("p", { className: "text-sm text-[#5c5575] bg-[#14112a] border border-[#2e2848] rounded-lg px-4 py-3", children: "No features to export. Add features in Phase 1 first." })) : (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide", children: "Select features" }), _jsx("button", { onClick: toggleAll, className: "text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors", children: selected.size === features.length ? "Deselect all" : "Select all" })] }), _jsx("div", { className: "bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-52 overflow-y-auto", children: features.map((f) => (_jsxs("label", { className: "flex items-center gap-3 px-4 py-2.5 hover:bg-[#1d1930] cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: selected.has(f.id), onChange: () => toggle(f.id), className: "accent-[#7c3aed] w-3.5 h-3.5" }), _jsx("span", { className: "text-sm text-[#e2ddf5]", children: f.name })] }, f.id))) })] })), state === "error" && (_jsx("p", { className: "text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2", children: error })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleExport, disabled: selected.size === 0 || state === "loading", className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2", children: [state === "loading" && (_jsx("span", { className: "w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" })), state === "loading"
                                            ? "Exporting…"
                                            : `Export ${selected.size} feature${selected.size !== 1 ? "s" : ""}`] })] })] }))] }) }));
}
