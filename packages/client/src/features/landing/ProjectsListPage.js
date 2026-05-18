import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useProjectsStore, emptySnapshot } from "../../store/projectsStore.js";
import { useAuth } from "../auth/AuthGate.js";
import { api } from "../../lib/api.js";
export function ProjectsListPage({ onOpenProject, onBack }) {
    const { projects, openProject, createProject, deleteProject, renameProject, setApiId, syncFromServer } = useProjectsStore();
    const auth = useAuth();
    const [naming, setNaming] = useState(false);
    const [newName, setNewName] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const [checkoutError, setCheckoutError] = useState(null);
    const [publishingId, setPublishingId] = useState(null);
    const [syncing, setSyncing] = useState(false);
    useEffect(() => { handleSync(); }, []);
    async function handleSync() {
        setSyncing(true);
        await syncFromServer();
        setSyncing(false);
    }
    const myProjects = projects.filter((p) => !p.owner || p.owner === auth?.email);
    const teamProjects = projects.filter((p) => p.owner && p.owner !== auth?.email);
    function handleCreate() {
        const name = newName.trim() || "Untitled Project";
        const localId = createProject(name, emptySnapshot());
        setNaming(false);
        setNewName("");
        // Push to server in background
        api.projects.create(name).then(async (res) => {
            if (res.ok) {
                const sp = await res.json();
                setApiId(localId, sp.id);
            }
        });
        openProject(localId);
        onOpenProject();
    }
    function handleOpen(id) {
        openProject(id);
        onOpenProject();
    }
    async function handleCheckout(id) {
        const project = projects.find((p) => p.id === id);
        if (!project?.apiId)
            return;
        const res = await api.projects.checkout(project.apiId);
        if (res.ok) {
            await syncFromServer();
            openProject(id);
            onOpenProject();
        }
        else {
            const body = await res.json();
            setCheckoutError(body.error ?? "Could not check out project");
            setTimeout(() => setCheckoutError(null), 4000);
        }
    }
    async function handleTogglePublish(id) {
        setPublishingId(id);
        try {
            let project = useProjectsStore.getState().projects.find((p) => p.id === id);
            if (!project)
                return;
            if (!project.apiId) {
                await useProjectsStore.getState().pushToServer(id);
                project = useProjectsStore.getState().projects.find((p) => p.id === id);
                if (!project?.apiId) {
                    setCheckoutError("Could not sync project to server. Please try again.");
                    setTimeout(() => setCheckoutError(null), 5000);
                    return;
                }
            }
            const res = await api.projects.update(project.apiId, { published: !project.published });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setCheckoutError(body.error ?? "Could not update sharing. Please try again.");
                setTimeout(() => setCheckoutError(null), 5000);
                return;
            }
            await syncFromServer();
        }
        catch (err) {
            setCheckoutError("Network error — could not reach server.");
            setTimeout(() => setCheckoutError(null), 5000);
        }
        finally {
            setPublishingId(null);
        }
    }
    async function handleCheckin(id) {
        const project = projects.find((p) => p.id === id);
        if (!project?.apiId)
            return;
        await api.projects.checkin(project.apiId);
        await syncFromServer();
    }
    function handleRename(id) {
        const trimmed = editingName.trim();
        if (trimmed)
            renameProject(id, trimmed);
        setEditingId(null);
        setEditingName("");
    }
    function formatDate(iso) {
        return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    return (_jsxs("div", { className: "flex flex-col h-full w-full bg-[#0d0b16]", children: [_jsxs("header", { className: "flex items-center px-6 py-4 border-b border-[#2e2848] bg-[#14112a] gap-4 flex-shrink-0", children: [_jsx("button", { onClick: onBack, className: "flex items-center gap-2 text-sm text-[#5c5575] hover:text-[#9b93ba] transition-colors", children: "\u2190 Back" }), _jsxs("div", { className: "flex items-center gap-3 ml-2", children: [_jsx("img", { src: "/HERO.png", alt: "Vigo", className: "w-7 h-7 object-contain rounded-md" }), _jsx("span", { className: "text-sm font-bold tracking-widest uppercase text-[#9b93ba]", children: "Vigo" })] }), _jsxs("div", { className: "ml-auto flex items-center gap-3", children: [auth && _jsx("span", { className: "text-xs text-[#3a3456]", children: auth.email }), _jsx("button", { type: "button", onClick: handleSync, disabled: syncing, className: "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50", style: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#5c5575" }, title: "Refresh project list", children: syncing ? "↻ Syncing…" : "↻ Refresh" }), _jsx("button", { onClick: () => setNaming(true), className: "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)", boxShadow: "0 0 16px rgba(124,58,237,0.35)" }, children: "+ New Project" })] })] }), checkoutError && (_jsx("div", { className: "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 shadow-lg", children: checkoutError })), naming && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "flex flex-col gap-5 p-8 rounded-2xl", style: { background: "#14112a", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", minWidth: 360 }, children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-widest text-[#9b93ba]", children: "New Project" }), _jsx("input", { autoFocus: true, type: "text", placeholder: "Project name\u2026", value: newName, onChange: (e) => setNewName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter")
                                handleCreate(); if (e.key === "Escape") {
                                setNaming(false);
                                setNewName("");
                            } }, className: "w-full text-xl font-semibold text-white bg-transparent border-b-2 border-[#7c3aed] outline-none pb-2 placeholder:text-[#3a3456] caret-[#a78bfa]" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleCreate, className: "flex-1 py-2.5 rounded-xl text-sm font-semibold text-white", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }, children: "Create" }), _jsx("button", { onClick: () => { setNaming(false); setNewName(""); }, className: "flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba]", style: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }, children: "Cancel" })] })] }) })), confirmDelete && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "flex flex-col gap-5 p-8 rounded-2xl", style: { background: "#14112a", border: "1px solid rgba(239,68,68,0.3)", minWidth: 320 }, children: [_jsx("p", { className: "text-base font-semibold text-white", children: "Delete this project?" }), _jsx("p", { className: "text-sm text-[#5c5575]", children: "This cannot be undone." }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => { deleteProject(confirmDelete); setConfirmDelete(null); }, className: "flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors", children: "Delete" }), _jsx("button", { onClick: () => setConfirmDelete(null), className: "flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba]", style: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }, children: "Cancel" })] })] }) })), _jsxs("div", { className: "flex-1 overflow-y-auto p-8 flex flex-col gap-10", children: [_jsxs("section", { children: [_jsx("h2", { className: "text-2xl font-bold text-white mb-1", children: "My Projects" }), _jsxs("p", { className: "text-sm text-[#5c5575] mb-6", children: [myProjects.length, " project", myProjects.length !== 1 ? "s" : ""] }), myProjects.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 gap-3 text-center", children: [_jsx("p", { className: "text-[#5c5575] text-sm", children: "No projects yet." }), _jsx("button", { onClick: () => setNaming(true), className: "px-6 py-2.5 rounded-lg text-sm font-semibold text-white", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }, children: "+ New Project" })] })) : (_jsx(ProjectGrid, { children: [...myProjects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((project) => (_jsxs(ProjectCard, { children: [_jsx(ProjectName, { project: project, editingId: editingId, editingName: editingName, setEditingId: setEditingId, setEditingName: setEditingName, onRename: handleRename }), _jsxs("div", { className: "flex flex-col gap-1 text-xs text-[#5c5575]", children: [_jsxs("span", { children: [project.snapshot.features.length, " feature", project.snapshot.features.length !== 1 ? "s" : ""] }), _jsxs("span", { children: ["Updated ", formatDate(project.updatedAt)] })] }), _jsxs("div", { className: "flex items-center gap-2 mt-auto pt-3 border-t border-[#2e2848]", children: [_jsx("button", { onClick: () => handleOpen(project.id), className: "flex-1 py-2 rounded-lg text-sm font-semibold text-white", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }, children: "Open \u2192" }), _jsx("button", { type: "button", onClick: () => handleTogglePublish(project.id), disabled: publishingId === project.id, className: "px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait hover:brightness-125", style: project.published
                                                        ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.5)", color: "#a78bfa" }
                                                        : { background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.5)", color: "#c4b5fd" }, title: project.published ? "Unshare with team" : "Share with team", children: publishingId === project.id ? "…" : project.published ? "Shared" : "Share" }), _jsx("button", { onClick: () => setConfirmDelete(project.id), className: "p-2 rounded-lg text-[#3a3456] hover:text-red-400 transition-colors", style: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }, children: "\u00D7" })] })] }, project.id))) }))] }), teamProjects.length > 0 && (_jsxs("section", { children: [_jsx("h2", { className: "text-2xl font-bold text-white mb-1", children: "Team Projects" }), _jsx("p", { className: "text-sm text-[#5c5575] mb-6", children: "Shared by your team" }), _jsx(ProjectGrid, { children: teamProjects.map((project) => {
                                    const checkedOutByMe = project.checkedOutBy === auth?.email;
                                    const lockedByOther = project.checkedOutBy && !checkedOutByMe;
                                    return (_jsxs(ProjectCard, { children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("h3", { className: "text-base font-semibold text-white", children: project.name }), lockedByOther && (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full flex-shrink-0", style: { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }, children: "Locked" })), checkedOutByMe && (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full flex-shrink-0", style: { background: "rgba(124,58,237,0.2)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.4)" }, children: "Checked out" }))] }), _jsxs("div", { className: "flex flex-col gap-1 text-xs text-[#5c5575]", children: [_jsxs("span", { children: ["by ", project.owner] }), _jsxs("span", { children: [project.snapshot.features.length, " feature", project.snapshot.features.length !== 1 ? "s" : ""] }), lockedByOther && _jsxs("span", { className: "text-red-400", children: ["Editing: ", project.checkedOutBy] })] }), _jsx("div", { className: "flex items-center gap-2 mt-auto pt-3 border-t border-[#2e2848]", children: checkedOutByMe ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleOpen(project.id), className: "flex-1 py-2 rounded-lg text-sm font-semibold text-white", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }, children: "Open \u2192" }), _jsx("button", { onClick: () => handleCheckin(project.id), className: "px-3 py-2 rounded-lg text-xs font-semibold text-[#5c5575] hover:text-[#9b93ba]", style: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }, children: "Check in" })] })) : lockedByOther ? (_jsx("button", { disabled: true, className: "flex-1 py-2 rounded-lg text-sm font-semibold text-[#3a3456] cursor-not-allowed", style: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }, children: "Unavailable" })) : (_jsx("button", { onClick: () => handleCheckout(project.id), className: "flex-1 py-2 rounded-lg text-sm font-semibold text-white", style: { background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }, children: "Check Out \u2192" })) })] }, project.id));
                                }) })] }))] })] }));
}
function ProjectGrid({ children }) {
    return _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5", children: children });
}
function ProjectCard({ children }) {
    return (_jsxs("div", { className: "group flex flex-col rounded-2xl border border-[#2e2848] bg-[#14112a] overflow-hidden transition-all duration-200 hover:border-[#7c3aed]/60 hover:shadow-[0_0_24px_rgba(124,58,237,0.15)]", children: [_jsx("div", { className: "h-1.5 w-full", style: { background: "linear-gradient(90deg, #7c3aed, #5b21b6)" } }), _jsx("div", { className: "flex flex-col gap-3 p-5 flex-1", children: children })] }));
}
function ProjectName({ project, editingId, editingName, setEditingId, setEditingName, onRename }) {
    if (editingId === project.id) {
        return (_jsx("input", { autoFocus: true, className: "text-base font-semibold text-white bg-transparent border-b border-[#7c3aed] outline-none caret-[#a78bfa] pb-0.5", value: editingName, onChange: (e) => setEditingName(e.target.value), onBlur: () => onRename(project.id), onKeyDown: (e) => { if (e.key === "Enter")
                onRename(project.id); if (e.key === "Escape")
                setEditingId(null); } }));
    }
    return (_jsx("h3", { className: "text-base font-semibold text-white cursor-pointer hover:text-[#a78bfa] transition-colors", onDoubleClick: () => { setEditingId(project.id); setEditingName(project.name); }, title: "Double-click to rename", children: project.name }));
}
