import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";
export function JiraProjectPickerModal({ projectId, onClose, onSelected }) {
    const [projects, setProjects] = useState([]);
    const [loadState, setLoadState] = useState("loading");
    const [loadError, setLoadError] = useState("");
    const [filter, setFilter] = useState("");
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.jira.listProjects(projectId);
                if (cancelled)
                    return;
                if (!res.ok) {
                    setLoadError(await res.text());
                    setLoadState("error");
                    return;
                }
                const data = (await res.json());
                setProjects(data);
                setLoadState("ready");
            }
            catch (e) {
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
        if (!selected)
            return;
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
        }
        catch (e) {
            setSaveError(String(e));
            setSaving(false);
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[480px] flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-[#ece7ff]", children: "Select Jira Project" }), _jsx("p", { className: "text-xs text-[#5c5575] mt-0.5", children: "Choose the Jira project to link with this estimator project" })] }), _jsx("button", { onClick: onClose, className: "text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors", children: "\u00D7" })] }), loadState === "loading" && (_jsx("div", { className: "flex justify-center py-8", children: _jsx("span", { className: "w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" }) })), loadState === "error" && (_jsx("p", { className: "text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2", children: loadError || "Failed to load Jira projects." })), loadState === "ready" && (_jsxs(_Fragment, { children: [_jsx("input", { type: "text", placeholder: "Filter projects\u2026", value: filter, onChange: (e) => setFilter(e.target.value), className: "w-full bg-[#14112a] border border-[#2e2848] rounded-lg px-3 py-2 text-sm text-[#ece7ff] placeholder-[#3a3456] focus:outline-none focus:border-[#7c3aed] transition-colors" }), _jsx("div", { className: "bg-[#14112a] border border-[#2e2848] rounded-lg divide-y divide-[#2e2848] max-h-60 overflow-y-auto", children: filtered.length === 0 ? (_jsx("p", { className: "px-4 py-3 text-sm text-[#5c5575]", children: projects.length === 0 ? "No Jira projects found." : "No projects match your filter." })) : (filtered.map((p) => (_jsxs("button", { onClick: () => setSelected(p.key), className: `w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#1d1930] transition-colors ${selected === p.key ? "bg-[#1e1548]" : ""}`, children: [_jsx("span", { className: `w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${selected === p.key
                                            ? "border-[#7c3aed] bg-[#7c3aed]"
                                            : "border-[#3a3456] bg-transparent"}` }), _jsx("span", { className: "font-mono text-xs text-[#a78bfa] w-20 flex-shrink-0", children: p.key }), _jsx("span", { className: "text-sm text-[#ece7ff] truncate", children: p.name })] }, p.key)))) })] })), saveError && (_jsx("p", { className: "text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2", children: saveError })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleConfirm, disabled: !selected || saving, className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2", children: [saving && (_jsx("span", { className: "w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" })), saving ? "Saving…" : "Confirm"] })] })] }) }));
}
