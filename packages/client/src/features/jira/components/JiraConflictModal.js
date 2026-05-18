import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../../../lib/api.js";
export function JiraConflictModal({ projectId, conflicts, onClose, onResolved }) {
    const [decisions, setDecisions] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    function pick(mappingId, winner) {
        setDecisions((d) => ({ ...d, [mappingId]: winner }));
    }
    async function handleSave() {
        setSaving(true);
        setError("");
        try {
            for (const [mappingId, winner] of Object.entries(decisions)) {
                const res = await api.jira.resolveConflict(projectId, mappingId, winner);
                if (!res.ok)
                    throw new Error(await res.text());
            }
            onResolved();
            onClose();
        }
        catch (e) {
            setError(String(e));
            setSaving(false);
        }
    }
    const decidedCount = Object.keys(decisions).length;
    const allDecided = conflicts.length > 0 && decidedCount === conflicts.length;
    return (_jsx("div", { className: "fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[560px] max-h-[80vh] flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between flex-shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-[#ece7ff]", children: "Resolve sync conflicts" }), _jsxs("p", { className: "text-xs text-[#5c5575] mt-0.5", children: [conflicts.length, " conflict", conflicts.length !== 1 ? "s" : "", " \u2014 choose which version wins"] })] }), _jsx("button", { onClick: onClose, className: "text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors", children: "\u00D7" })] }), _jsx("div", { className: "flex-1 overflow-y-auto flex flex-col gap-2 min-h-0", children: conflicts.map((c) => {
                        const winner = decisions[c.id];
                        return (_jsxs("div", { className: "bg-[#14112a] border border-[#2e2848] rounded-lg p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-mono text-[#a78bfa] bg-[#2e2848] px-1.5 py-0.5 rounded", children: c.jiraIssueKey }), _jsx("span", { className: "text-xs text-[#5c5575] capitalize", children: c.estimatorType }), _jsx("span", { className: "text-xs text-[#3a3456] ml-auto", children: c.direction })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("button", { onClick: () => pick(c.id, "estimator"), className: `p-3 rounded-lg border text-left transition-all ${winner === "estimator"
                                                ? "border-[#7c3aed] bg-[#2e2848]"
                                                : "border-[#2e2848] bg-[#1d1930] hover:border-[#5b4b8a]"}`, children: [_jsx("p", { className: "text-xs font-semibold text-[#7c3aed] mb-1", children: "Keep Estimator" }), _jsx("p", { className: "text-xs text-[#9b93ba] leading-snug", children: "Use values from this tool" })] }), _jsxs("button", { onClick: () => pick(c.id, "jira"), className: `p-3 rounded-lg border text-left transition-all ${winner === "jira"
                                                ? "border-blue-500 bg-blue-500/10"
                                                : "border-[#2e2848] bg-[#1d1930] hover:border-[#5b4b8a]"}`, children: [_jsx("p", { className: "text-xs font-semibold text-blue-400 mb-1", children: "Keep Jira" }), _jsx("p", { className: "text-xs text-[#9b93ba] leading-snug", children: "Use values from Jira" })] })] })] }, c.id));
                    }) }), error && (_jsx("p", { className: "text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 flex-shrink-0", children: error })), _jsxs("div", { className: "flex justify-between items-center flex-shrink-0", children: [_jsxs("span", { className: "text-xs text-[#5c5575]", children: [decidedCount, " of ", conflicts.length, " decided"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleSave, disabled: !allDecided || saving, className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2", children: [saving && (_jsx("span", { className: "w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" })), saving ? "Saving…" : "Save resolutions"] })] })] })] }) }));
}
