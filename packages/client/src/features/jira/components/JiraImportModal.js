import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../../../lib/api.js";
export function JiraImportModal({ projectId, defaultProjectKey, onClose, onImported }) {
    const [projectKey, setProjectKey] = useState(defaultProjectKey ?? "");
    const [state, setState] = useState("idle");
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    async function handleImport() {
        if (!projectKey.trim())
            return;
        setState("loading");
        try {
            const res = await api.jira.importProject(projectId, projectKey.trim());
            if (!res.ok) {
                setError(await res.text());
                setState("error");
                return;
            }
            const data = (await res.json());
            setResult(data);
            setState("done");
            onImported();
        }
        catch (e) {
            setError(String(e));
            setState("error");
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm", onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs("div", { className: "bg-[#1a1628] border border-[#2e2848] rounded-xl shadow-xl p-6 w-[480px] flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-[#ece7ff]", children: "Import from Jira" }), _jsx("p", { className: "text-xs text-[#5c5575] mt-0.5", children: "Imports epics as features and stories as tasks" })] }), _jsx("button", { onClick: onClose, className: "text-[#3a3456] hover:text-[#9b93ba] text-xl leading-none transition-colors", children: "\u00D7" })] }), state === "done" && result ? (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "bg-[#14112a] border border-[#2e2848] rounded-lg p-4 flex flex-col gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-[#86efac]", children: "Import complete" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[#9b93ba]", children: [_jsx("span", { children: "Features created" }), _jsx("span", { className: "text-[#ece7ff] font-semibold", children: result.features_created }), _jsx("span", { children: "Features updated" }), _jsx("span", { className: "text-[#ece7ff] font-semibold", children: result.features_updated }), _jsx("span", { children: "Tasks created" }), _jsx("span", { className: "text-[#ece7ff] font-semibold", children: result.tasks_created }), _jsx("span", { children: "Tasks updated" }), _jsx("span", { className: "text-[#ece7ff] font-semibold", children: result.tasks_updated }), _jsx("span", { children: "Skipped" }), _jsx("span", { className: "text-[#ece7ff] font-semibold", children: result.skipped })] }), result.errors.length > 0 && (_jsxs("div", { className: "mt-1 border-t border-[#2e2848] pt-2", children: [_jsxs("p", { className: "text-xs text-red-400 font-semibold mb-1", children: [result.errors.length, " error(s)"] }), _jsx("ul", { className: "text-xs text-red-300 space-y-0.5 max-h-24 overflow-y-auto", children: result.errors.map((e, i) => _jsx("li", { children: e }, i)) })] }))] }), _jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors", children: "Done" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide", children: "Jira project key" }), _jsx("input", { autoFocus: true, className: "border border-[#2e2848] bg-[#14112a] text-[#ece7ff] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", placeholder: "e.g. MYPROJ", value: projectKey, onChange: (e) => setProjectKey(e.target.value.toUpperCase()), onKeyDown: (e) => { if (e.key === "Enter" && state === "idle")
                                        handleImport(); }, disabled: state === "loading" }), _jsx("p", { className: "text-xs text-[#5c5575]", children: "The short key before issue numbers \u2014 e.g. \"MYPROJ\" in MYPROJ-123" })] }), state === "error" && (_jsx("p", { className: "text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2", children: error })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 rounded-lg bg-[#14112a] border border-[#2e2848] text-[#9b93ba] text-sm hover:text-[#ece7ff] hover:border-[#5b4b8a] transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleImport, disabled: !projectKey.trim() || state === "loading", className: "px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2", children: [state === "loading" && (_jsx("span", { className: "w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" })), state === "loading" ? "Importing…" : "Import"] })] })] }))] }) }));
}
