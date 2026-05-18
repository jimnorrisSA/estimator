import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useProjectsStore } from "../../../store/projectsStore.js";
import { useJiraStore } from "../store/jiraStore.js";
import { api } from "../../../lib/api.js";
import { JiraImportModal } from "./JiraImportModal.js";
import { JiraExportModal } from "./JiraExportModal.js";
import { JiraConflictModal } from "./JiraConflictModal.js";
import { JiraProjectPickerModal } from "./JiraProjectPickerModal.js";
export function JiraMenu() {
    const [open, setOpen] = useState(false);
    const [modal, setModal] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [conflicts, setConflicts] = useState([]);
    const [justConnected, setJustConnected] = useState(false);
    const getActiveProject = useProjectsStore((s) => s.getActiveProject);
    const activeProject = getActiveProject();
    const projectId = activeProject?.apiId ?? null;
    const { syncState, config, loading, fetchSyncState, fetchConfig } = useJiraStore();
    const refresh = useCallback(async () => {
        if (!projectId)
            return;
        await fetchSyncState(projectId);
        fetchConfig(projectId);
    }, [projectId, fetchSyncState, fetchConfig]);
    // Fetch actual conflict records when count > 0
    const fetchConflicts = useCallback(async () => {
        if (!projectId || !syncState || syncState.pendingConflicts === 0) {
            setConflicts([]);
            return;
        }
        try {
            const res = await api.jira.syncConflicts(projectId);
            if (res.ok)
                setConflicts((await res.json()));
        }
        catch {
            // ignore
        }
    }, [projectId, syncState]);
    useEffect(() => { refresh(); }, [refresh]);
    useEffect(() => { fetchConflicts(); }, [fetchConflicts]);
    // Re-check after returning from the Atlassian OAuth tab
    useEffect(() => {
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [refresh]);
    // Detect redirect back from OAuth (?jira=connected in URL) — open the project picker
    useEffect(() => {
        if (window.location.search.includes("jira=connected")) {
            window.history.replaceState({}, "", window.location.pathname);
            setJustConnected(true);
            refresh();
            setModal("pick-project");
            setTimeout(() => setJustConnected(false), 4000);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    async function handleConnect() {
        if (!projectId)
            return;
        setConnecting(true);
        setOpen(false);
        try {
            const res = await api.jira.oauthStart(projectId);
            if (!res.ok) {
                setConnecting(false);
                return;
            }
            const { auth_url } = (await res.json());
            window.location.href = auth_url;
        }
        catch {
            setConnecting(false);
        }
    }
    async function handleDisconnect() {
        if (!projectId)
            return;
        setOpen(false);
        await api.jira.disconnect(projectId);
        refresh();
    }
    const isConnected = syncState?.isConnected ?? false;
    const conflictCount = syncState?.pendingConflicts ?? 0;
    const lastSynced = syncState?.lastSyncedAt && syncState.lastSyncedAt !== "0001-01-01T00:00:00Z"
        ? new Date(syncState.lastSyncedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : null;
    if (!projectId)
        return null;
    return (_jsxs(_Fragment, { children: [justConnected && (_jsxs("div", { className: "fixed bottom-6 right-6 z-[3000] bg-[#14112a] border border-green-500/40 text-green-300 text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" }), "Jira connected successfully"] })), _jsxs("div", { className: "relative self-start", children: [_jsxs("button", { className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252041] border border-[#3d366a] text-sm text-[#a78bfa] hover:bg-[#2e2848] hover:border-[#5b4b8a] transition-colors", onClick: () => setOpen((o) => !o), title: "Jira integration", children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", children: [_jsx("path", { d: "M13 3L4 12l9 9", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", opacity: "0.5" }), _jsx("path", { d: "M20 3l-9 9 9 9", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" })] }), _jsx("span", { children: connecting ? "Connecting…" : "Jira" }), !loading && isConnected && (_jsx("span", { className: `w-1.5 h-1.5 rounded-full flex-shrink-0 ${conflictCount > 0 ? "bg-amber-400" : "bg-green-400"}` })), conflictCount > 0 && (_jsx("span", { className: "bg-amber-500/20 text-amber-300 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none", children: conflictCount })), _jsx("svg", { width: "10", height: "10", viewBox: "0 0 10 10", fill: "none", children: _jsx("path", { d: "M2 3.5L5 6.5L8 3.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) })] }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false) }), _jsx("div", { className: "absolute right-0 top-full mt-1 z-50 w-64 bg-[#14112a] border border-[#2e2848] rounded-xl shadow-xl shadow-black/60 overflow-hidden", children: loading ? (_jsx("div", { className: "px-4 py-6 flex justify-center", children: _jsx("span", { className: "w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" }) })) : isConnected ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "px-4 py-3 border-b border-[#1e1a2e]", children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" }), _jsx("span", { className: "text-xs font-semibold text-[#86efac]", children: "Connected" })] }), config?.jiraInstanceUrl && (_jsx("p", { className: "text-xs text-[#5c5575] truncate", children: config.jiraInstanceUrl })), config?.jiraProjectKey ? (_jsxs("p", { className: "text-xs text-[#9b93ba] font-mono mt-0.5 flex items-center gap-1.5", children: ["Project: ", _jsx("span", { className: "text-[#a78bfa]", children: config.jiraProjectKey }), _jsx("button", { className: "text-[#5c5575] hover:text-[#9b93ba] text-xs underline underline-offset-2 transition-colors", onClick: () => { setOpen(false); setModal("pick-project"); }, children: "Change" })] })) : (_jsx("button", { className: "mt-1.5 w-full text-left px-2.5 py-1.5 rounded-lg bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-xs font-semibold text-[#a78bfa] hover:bg-[#7c3aed]/30 transition-colors", onClick: () => { setOpen(false); setModal("pick-project"); }, children: "Set Jira project \u2192" })), lastSynced && (_jsxs("p", { className: "text-xs text-[#3a3456] mt-0.5", children: ["Last synced ", lastSynced] }))] }), _jsxs("button", { className: "w-full text-left px-4 py-2.5 hover:bg-[#1e1548] transition-colors flex flex-col border-b border-[#1e1a2e]", onClick: () => { setOpen(false); setModal("import"); }, children: [_jsx("span", { className: "text-sm font-medium text-[#ece7ff]", children: "Import from Jira" }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "Pull epics and stories as features" })] }), _jsxs("button", { className: "w-full text-left px-4 py-2.5 hover:bg-[#1e1548] transition-colors flex flex-col border-b border-[#1e1a2e]", onClick: () => { setOpen(false); setModal("export"); }, children: [_jsx("span", { className: "text-sm font-medium text-[#ece7ff]", children: "Export to Jira" }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "Push estimates to Jira issues" })] }), conflictCount > 0 && (_jsxs("button", { className: "w-full text-left px-4 py-2.5 hover:bg-[#1e1548] transition-colors flex items-center justify-between border-b border-[#1e1a2e]", onClick: () => { setOpen(false); setModal("conflicts"); }, children: [_jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium text-amber-300", children: "Resolve conflicts" }), _jsxs("span", { className: "text-xs text-[#5c5575]", children: [conflictCount, " item", conflictCount !== 1 ? "s" : "", " need attention"] })] }), _jsx("span", { className: "bg-amber-500/20 text-amber-300 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0", children: conflictCount })] })), _jsxs("button", { className: "w-full text-left px-4 py-2.5 hover:bg-[#1e1548] transition-colors", onClick: handleDisconnect, children: [_jsx("span", { className: "text-sm font-medium text-red-400", children: "Disconnect Jira" }), _jsx("p", { className: "text-xs text-[#5c5575] mt-0.5", children: "Revokes access and clears token" })] })] })) : (_jsxs("button", { className: "w-full text-left px-4 py-3.5 hover:bg-[#1e1548] transition-colors", onClick: handleConnect, children: [_jsx("span", { className: "text-sm font-medium text-[#ece7ff]", children: "Connect Jira" }), _jsx("p", { className: "text-xs text-[#5c5575] mt-0.5", children: "Authorise via Atlassian OAuth" })] })) })] }))] }), modal === "import" && projectId && (_jsx(JiraImportModal, { projectId: projectId, defaultProjectKey: config?.jiraProjectKey, onClose: () => setModal(null), onImported: refresh })), modal === "export" && projectId && (_jsx(JiraExportModal, { projectId: projectId, onClose: () => setModal(null), onExported: refresh })), modal === "conflicts" && projectId && conflicts.length > 0 && (_jsx(JiraConflictModal, { projectId: projectId, conflicts: conflicts, onClose: () => setModal(null), onResolved: () => { refresh(); setConflicts([]); } })), modal === "pick-project" && projectId && (_jsx(JiraProjectPickerModal, { projectId: projectId, onClose: () => setModal(null), onSelected: () => { refresh(); setModal(null); } }))] }));
}
