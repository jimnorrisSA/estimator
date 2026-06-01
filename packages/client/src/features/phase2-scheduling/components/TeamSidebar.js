import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "motion/react";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
const DISCIPLINES = ["Art", "Design", "Code", "Production", "Custom"];
const DISCIPLINE_STYLES = {
    Art: { dot: "bg-amber-500", badge: "bg-amber-900/30 text-amber-400" },
    Design: { dot: "bg-purple-500", badge: "bg-purple-900/30 text-purple-400" },
    Code: { dot: "bg-sky-500", badge: "bg-sky-900/30 text-sky-400" },
    Production: { dot: "bg-green-500", badge: "bg-green-900/30 text-green-400" },
    Custom: { dot: "bg-gray-500", badge: "bg-gray-800 text-gray-400" },
};
export function TeamSidebar({ resources, currency, defaultMonthlyRate, onAdd, onUpdate, onDelete }) {
    const symbol = CURRENCY_SYMBOLS[currency];
    const hasRates = resources.some((r) => r.monthlyRate > 0 || ((r.resourceType || "Contractor") === "FTE" && defaultMonthlyRate > 0));
    return (_jsxs("div", { className: "w-56 flex-shrink-0 border-l border-[#2e2848] bg-[#14112a] flex flex-col h-full", children: [_jsxs("div", { className: "px-4 py-3 border-b border-[#2e2848] flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold text-[#ece7ff]", children: "Team" }), _jsxs("span", { className: "text-sm text-[#5c5575]", children: [resources.length, " member", resources.length !== 1 ? "s" : ""] })] }), !hasRates && resources.length > 0 && (_jsx("div", { className: "mx-3 mt-3 px-3 py-2 bg-[#1e1548] rounded-lg text-sm text-[#a78bfa] leading-snug", children: "Add daily rates to unlock cost totals." })), _jsx("div", { className: "flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-5", children: DISCIPLINES.map((discipline) => (_jsx(DisciplineSection, { discipline: discipline, members: resources.filter((r) => r.role === discipline), symbol: symbol, defaultMonthlyRate: defaultMonthlyRate, onAdd: (name) => onAdd(discipline, name), onUpdate: onUpdate, onDelete: onDelete }, discipline))) }), hasRates && (_jsx(TotalCostFooter, { resources: resources, symbol: symbol, defaultMonthlyRate: defaultMonthlyRate }))] }));
}
// ─── Discipline section ───────────────────────────────────────────────────────
function DisciplineSection({ discipline, members, symbol, defaultMonthlyRate, onAdd, onUpdate, onDelete, }) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const styles = DISCIPLINE_STYLES[discipline];
    function commitAdd() {
        if (newName.trim())
            onAdd(newName.trim());
        setNewName("");
        setAdding(false);
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1.5", children: [_jsx("span", { className: `w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}` }), _jsx("span", { className: "text-sm font-semibold text-[#9b93ba]", children: discipline }), members.length > 0 && (_jsx("span", { className: "text-sm text-[#5c5575] ml-auto", children: members.length }))] }), _jsxs("div", { className: "flex flex-col gap-1", children: [members.map((m) => (_jsx(MemberRow, { member: m, symbol: symbol, defaultMonthlyRate: defaultMonthlyRate, onUpdate: onUpdate, onDelete: onDelete }, m.id))), adding ? (_jsx("input", { autoFocus: true, className: "w-full text-sm border border-[#7c3aed] bg-[#1a1628] text-[#ece7ff] rounded-lg px-2 py-1.5 focus:outline-none placeholder:text-[#3a3456]", placeholder: "Name\u2026", value: newName, onChange: (e) => setNewName(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                commitAdd();
                            if (e.key === "Escape") {
                                setAdding(false);
                                setNewName("");
                            }
                        }, onBlur: commitAdd })) : (_jsxs("button", { className: "text-sm text-[#5c5575] hover:text-[#a78bfa] text-left py-0.5 transition-colors", onClick: () => setAdding(true), children: ["+ Add ", discipline.toLowerCase()] }))] })] }));
}
// ─── Member row ───────────────────────────────────────────────────────────────
function formatDateHint(rollOnDate, rollOffDate) {
    const fmt = (s) => {
        const [, m, d] = s.split("-");
        return `${parseInt(d)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]}`;
    };
    if (rollOnDate && rollOffDate)
        return `${fmt(rollOnDate)} – ${fmt(rollOffDate)}`;
    if (rollOnDate)
        return `From ${fmt(rollOnDate)}`;
    if (rollOffDate)
        return `Until ${fmt(rollOffDate)}`;
    return null;
}
function MemberRow({ member, symbol, defaultMonthlyRate, onUpdate, onDelete, }) {
    const [editing, setEditing] = useState(false);
    const effectiveType = (member.resourceType || "Contractor");
    const [draftName, setDraftName] = useState(member.name);
    const [draftEmail, setDraftEmail] = useState(member.email || "");
    const [draftJiraId, setDraftJiraId] = useState(member.jiraId || "");
    const [draftType, setDraftType] = useState(effectiveType);
    const [draftRate, setDraftRate] = useState(String(member.monthlyRate || ""));
    const [useDefault, setUseDefault] = useState(effectiveType === "FTE" && !member.monthlyRate);
    const [draftAlloc, setDraftAlloc] = useState(String(member.allocationPct ?? 100));
    const [draftRollOn, setDraftRollOn] = useState(member.rollOnDate || "");
    const [draftRollOff, setDraftRollOff] = useState(member.rollOffDate || "");
    function openEdit() {
        const t = (member.resourceType || "Contractor");
        setDraftName(member.name);
        setDraftEmail(member.email || "");
        setDraftJiraId(member.jiraId || "");
        setDraftType(t);
        setDraftRate(String(member.monthlyRate || ""));
        setUseDefault(t === "FTE" && !member.monthlyRate);
        setDraftAlloc(String(member.allocationPct ?? 100));
        setDraftRollOn(member.rollOnDate || "");
        setDraftRollOff(member.rollOffDate || "");
        setEditing(true);
    }
    function handleTypeChange(t) {
        setDraftType(t);
        if (t === "FTE")
            setUseDefault(!member.monthlyRate);
    }
    function commitEdit() {
        const name = draftName.trim() || member.name;
        const rate = (draftType === "FTE" && useDefault) ? 0 : (parseFloat(draftRate) || 0);
        const alloc = Math.min(100, Math.max(1, parseInt(draftAlloc) || 100));
        onUpdate(member.id, {
            name,
            email: draftEmail.trim() || undefined,
            jiraId: draftJiraId.trim() || undefined,
            resourceType: draftType,
            monthlyRate: rate,
            allocationPct: alloc,
            rollOnDate: draftRollOn || "",
            rollOffDate: draftRollOff || "",
        });
        setEditing(false);
    }
    const dateHint = formatDateHint(member.rollOnDate, member.rollOffDate);
    const displayRate = effectiveType === "FTE" && !member.monthlyRate ? defaultMonthlyRate : member.monthlyRate;
    const allocLabel = (member.allocationPct ?? 100) < 100 ? ` · ${member.allocationPct}%` : "";
    if (editing) {
        return (_jsxs("div", { className: "bg-[#1d1930] rounded-lg p-2 flex flex-col gap-2 border border-[#2e2848]", children: [_jsx("input", { autoFocus: true, className: "text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]", value: draftName, onChange: (e) => setDraftName(e.target.value), placeholder: "Name", onKeyDown: (e) => { if (e.key === "Enter")
                        commitEdit(); if (e.key === "Escape")
                        setEditing(false); } }), _jsx("input", { type: "email", className: "text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]", value: draftEmail, onChange: (e) => setDraftEmail(e.target.value), placeholder: "Email (optional)", onKeyDown: (e) => { if (e.key === "Enter")
                        commitEdit(); if (e.key === "Escape")
                        setEditing(false); } }), _jsx("input", { type: "text", className: "text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] w-full placeholder:text-[#3a3456]", value: draftJiraId, onChange: (e) => setDraftJiraId(e.target.value), placeholder: "Jira account ID (optional)", onKeyDown: (e) => { if (e.key === "Enter")
                        commitEdit(); if (e.key === "Escape")
                        setEditing(false); } }), _jsx("div", { className: "flex rounded-lg overflow-hidden border border-[#2e2848]", children: ["FTE", "Contractor"].map((t) => (_jsx("button", { type: "button", onClick: () => handleTypeChange(t), className: `flex-1 text-xs py-1 font-semibold transition-colors ${draftType === t
                            ? "bg-[#7c3aed] text-white"
                            : "bg-[#1a1628] text-[#5c5575] hover:text-[#9b93ba]"}`, children: t }, t))) }), draftType === "FTE" ? (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: useDefault, onChange: (e) => setUseDefault(e.target.checked), className: "accent-[#7c3aed]" }), _jsxs("span", { className: "text-xs text-[#9b93ba]", children: ["Use project default", defaultMonthlyRate > 0 && ` (${symbol}${defaultMonthlyRate.toLocaleString()}/mo)`] })] }), !useDefault && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-sm text-[#5c5575]", children: symbol }), _jsx("input", { type: "number", min: 0, step: 50, className: "flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", value: draftRate, onChange: (e) => setDraftRate(e.target.value), placeholder: "Override rate", onKeyDown: (e) => { if (e.key === "Enter")
                                        commitEdit(); if (e.key === "Escape")
                                        setEditing(false); } })] }))] })) : (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-sm text-[#5c5575]", children: symbol }), _jsx("input", { type: "number", min: 0, step: 50, className: "flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", value: draftRate, onChange: (e) => setDraftRate(e.target.value), placeholder: "Monthly rate", onKeyDown: (e) => { if (e.key === "Enter")
                                commitEdit(); if (e.key === "Escape")
                                setEditing(false); } })] })), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-[#5c5575] w-16 flex-shrink-0", children: "Allocation" }), _jsx("input", { type: "number", min: 1, max: 100, step: 10, className: "flex-1 text-sm border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]", value: draftAlloc, onChange: (e) => setDraftAlloc(e.target.value), onKeyDown: (e) => { if (e.key === "Enter")
                                commitEdit(); if (e.key === "Escape")
                                setEditing(false); } }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "%" })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "text-xs text-[#5c5575]", children: "Availability" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-[#5c5575] w-10 flex-shrink-0", children: "From" }), _jsx("input", { type: "date", className: "flex-1 text-xs border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]", value: draftRollOn, onChange: (e) => setDraftRollOn(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-[#5c5575] w-10 flex-shrink-0", children: "Until" }), _jsx("input", { type: "date", className: "flex-1 text-xs border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]", value: draftRollOff, onChange: (e) => setDraftRollOff(e.target.value) })] })] }), _jsxs("div", { className: "flex gap-1 justify-end", children: [_jsx("button", { className: "text-sm px-2 py-0.5 rounded text-[#9b93ba] hover:bg-[#252041] transition-colors", onClick: () => setEditing(false), children: "Cancel" }), _jsx("button", { className: "text-sm px-2 py-0.5 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors", onClick: commitEdit, children: "Save" })] })] }));
    }
    return (_jsxs(motion.div, { className: "flex items-start gap-1.5 group rounded-lg px-1.5 py-1 hover:bg-[#1d1930] transition-colors", initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }, children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "flex-1 text-sm text-[#ece7ff] truncate", children: member.name }), displayRate > 0 && (_jsxs("span", { className: "text-sm text-[#5c5575] tabular-nums flex-shrink-0", children: [symbol, displayRate.toLocaleString()] }))] }), _jsxs("div", { className: "flex items-center gap-1.5 mt-0.5", children: [effectiveType === "FTE" ? (_jsx("span", { className: "text-xs px-1 rounded", style: { background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }, children: "FTE" })) : (_jsx("span", { className: "text-xs px-1 rounded", style: { background: "rgba(124,58,237,0.15)", color: "#a78bfa" }, children: "Contractor" })), allocLabel && _jsx("span", { className: "text-xs text-[#5c5575]", children: allocLabel }), dateHint && _jsx("span", { className: "text-xs text-[#5c5575] truncate", children: dateHint })] }), member.email && (_jsx("span", { className: "text-xs text-[#5c5575] truncate mt-0.5", children: member.email })), member.jiraId && (_jsxs("span", { className: "text-xs text-[#5c5575] truncate mt-0.5 flex items-center gap-1", children: [_jsx("span", { style: { color: "#2d7ff9" }, children: "J" }), member.jiraId] }))] }), _jsxs("div", { className: "flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0", children: [_jsx("button", { className: "p-0.5 rounded text-[#5c5575] hover:text-[#a78bfa] hover:bg-[#252041] transition-colors", onClick: openEdit, title: "Edit", children: _jsx("svg", { className: "w-3 h-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M8 2l2 2-6 6H2V8l6-6z" }) }) }), _jsx("button", { className: "p-0.5 rounded text-[#5c5575] hover:text-red-400 hover:bg-red-900/20 transition-colors", onClick: () => onDelete(member.id), title: "Remove", children: _jsx("svg", { className: "w-3 h-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M2 2l8 8M10 2l-8 8" }) }) })] })] }));
}
// ─── Cost footer ──────────────────────────────────────────────────────────────
function TotalCostFooter({ resources, symbol, defaultMonthlyRate }) {
    const byDiscipline = DISCIPLINES.map((d) => ({
        discipline: d,
        members: resources.filter((r) => r.role === d).filter((r) => {
            const rate = (r.resourceType === "FTE" && !r.monthlyRate) ? defaultMonthlyRate : r.monthlyRate;
            return rate > 0;
        }),
    })).filter((g) => g.members.length > 0);
    if (byDiscipline.length === 0)
        return null;
    const effectiveRate = (r) => (r.resourceType === "FTE" && !r.monthlyRate) ? defaultMonthlyRate : r.monthlyRate;
    return (_jsxs("div", { className: "border-t border-[#2e2848] px-4 py-3 flex flex-col gap-1", children: [_jsx("p", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide mb-1", children: "Monthly team cost" }), byDiscipline.map(({ discipline, members }) => {
                const total = members.reduce((s, m) => s + effectiveRate(m), 0);
                return (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-[#9b93ba]", children: discipline }), _jsxs("span", { className: "text-[#ece7ff] tabular-nums font-medium", children: [symbol, total.toLocaleString()] })] }, discipline));
            }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t border-[#2e2848] mt-0.5", children: [_jsx("span", { className: "text-[#9b93ba]", children: "Total / month" }), _jsxs("span", { className: "text-[#a78bfa] tabular-nums", children: [symbol, resources.reduce((s, r) => s + effectiveRate(r), 0).toLocaleString()] })] })] }));
}
