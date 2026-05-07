import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
const DISCIPLINES = ["Art", "Design", "Code", "Production"];
const DISCIPLINE_STYLES = {
    Art: { dot: "bg-orange-400", badge: "bg-orange-50 text-orange-700" },
    Design: { dot: "bg-purple-400", badge: "bg-purple-50 text-purple-700" },
    Code: { dot: "bg-sky-400", badge: "bg-sky-50 text-sky-700" },
    Production: { dot: "bg-green-400", badge: "bg-green-50 text-green-700" },
    Custom: { dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600" },
};
export function TeamSidebar({ resources, currency, onAdd, onUpdate, onDelete }) {
    const symbol = CURRENCY_SYMBOLS[currency];
    const hasRates = resources.some((r) => r.dailyRate > 0);
    return (_jsxs("div", { className: "w-56 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-100 flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold text-gray-700", children: "Team" }), _jsxs("span", { className: "text-xs text-gray-400", children: [resources.length, " member", resources.length !== 1 ? "s" : ""] })] }), !hasRates && resources.length > 0 && (_jsx("div", { className: "mx-3 mt-3 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-600 leading-snug", children: "Add daily rates to unlock cost totals." })), _jsx("div", { className: "flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-5", children: DISCIPLINES.map((discipline) => (_jsx(DisciplineSection, { discipline: discipline, members: resources.filter((r) => r.role === discipline), symbol: symbol, onAdd: (name) => onAdd(discipline, name), onUpdate: onUpdate, onDelete: onDelete }, discipline))) }), hasRates && (_jsx(TotalCostFooter, { resources: resources, symbol: symbol }))] }));
}
// ─── Discipline section ───────────────────────────────────────────────────────
function DisciplineSection({ discipline, members, symbol, onAdd, onUpdate, onDelete, }) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const styles = DISCIPLINE_STYLES[discipline];
    function commitAdd() {
        if (newName.trim())
            onAdd(newName.trim());
        setNewName("");
        setAdding(false);
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1.5", children: [_jsx("span", { className: `w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}` }), _jsx("span", { className: "text-xs font-semibold text-gray-600", children: discipline }), members.length > 0 && (_jsx("span", { className: "text-xs text-gray-400 ml-auto", children: members.length }))] }), _jsxs("div", { className: "flex flex-col gap-1", children: [members.map((m) => (_jsx(MemberRow, { member: m, symbol: symbol, onUpdate: onUpdate, onDelete: onDelete }, m.id))), adding ? (_jsx("input", { autoFocus: true, className: "w-full text-xs border border-blue-400 rounded-lg px-2 py-1.5 focus:outline-none", placeholder: "Name\u2026", value: newName, onChange: (e) => setNewName(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                commitAdd();
                            if (e.key === "Escape") {
                                setAdding(false);
                                setNewName("");
                            }
                        }, onBlur: commitAdd })) : (_jsxs("button", { className: "text-xs text-gray-400 hover:text-blue-600 text-left py-0.5 transition-colors", onClick: () => setAdding(true), children: ["+ Add ", discipline.toLowerCase()] }))] })] }));
}
// ─── Member row ───────────────────────────────────────────────────────────────
function MemberRow({ member, symbol, onUpdate, onDelete, }) {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(member.name);
    const [draftRate, setDraftRate] = useState(String(member.dailyRate || ""));
    function commitEdit() {
        const name = draftName.trim() || member.name;
        const rate = parseFloat(draftRate);
        onUpdate(member.id, {
            name,
            dailyRate: isNaN(rate) || rate < 0 ? 0 : rate,
        });
        setEditing(false);
    }
    if (editing) {
        return (_jsxs("div", { className: "bg-gray-50 rounded-lg p-2 flex flex-col gap-1.5 border border-gray-200", children: [_jsx("input", { autoFocus: true, className: "text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full", value: draftName, onChange: (e) => setDraftName(e.target.value), placeholder: "Name", onKeyDown: (e) => { if (e.key === "Enter")
                        commitEdit(); if (e.key === "Escape")
                        setEditing(false); } }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-gray-400", children: symbol }), _jsx("input", { type: "number", min: 0, step: 50, className: "flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500", value: draftRate, onChange: (e) => setDraftRate(e.target.value), placeholder: "Daily rate", onKeyDown: (e) => { if (e.key === "Enter")
                                commitEdit(); if (e.key === "Escape")
                                setEditing(false); } })] }), _jsxs("div", { className: "flex gap-1 justify-end", children: [_jsx("button", { className: "text-xs px-2 py-0.5 rounded text-gray-500 hover:bg-gray-200 transition-colors", onClick: () => setEditing(false), children: "Cancel" }), _jsx("button", { className: "text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors", onClick: commitEdit, children: "Save" })] })] }));
    }
    return (_jsxs("div", { className: "flex items-center gap-1.5 group rounded-lg px-1.5 py-1 hover:bg-gray-50", children: [_jsx("span", { className: "flex-1 text-xs text-gray-700 truncate", children: member.name }), member.dailyRate > 0 && (_jsxs("span", { className: "text-xs text-gray-400 tabular-nums", children: [symbol, member.dailyRate.toLocaleString()] })), _jsxs("div", { className: "flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { className: "p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors", onClick: () => { setDraftName(member.name); setDraftRate(String(member.dailyRate || "")); setEditing(true); }, title: "Edit", children: _jsx("svg", { className: "w-3 h-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M8 2l2 2-6 6H2V8l6-6z" }) }) }), _jsx("button", { className: "p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors", onClick: () => onDelete(member.id), title: "Remove", children: _jsx("svg", { className: "w-3 h-3", viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: _jsx("path", { d: "M2 2l8 8M10 2l-8 8" }) }) })] })] }));
}
// ─── Cost footer ──────────────────────────────────────────────────────────────
function TotalCostFooter({ resources, symbol }) {
    const byDiscipline = DISCIPLINES.map((d) => ({
        discipline: d,
        members: resources.filter((r) => r.role === d && r.dailyRate > 0),
    })).filter((g) => g.members.length > 0);
    if (byDiscipline.length === 0)
        return null;
    return (_jsxs("div", { className: "border-t border-gray-100 px-4 py-3 flex flex-col gap-1", children: [_jsx("p", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1", children: "Daily team cost" }), byDiscipline.map(({ discipline, members }) => {
                const total = members.reduce((s, m) => s + m.dailyRate, 0);
                return (_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-gray-500", children: discipline }), _jsxs("span", { className: "text-gray-700 tabular-nums font-medium", children: [symbol, total.toLocaleString()] })] }, discipline));
            }), _jsxs("div", { className: "flex justify-between text-xs font-semibold pt-1 border-t border-gray-100 mt-0.5", children: [_jsx("span", { className: "text-gray-600", children: "Total / day" }), _jsxs("span", { className: "text-gray-800 tabular-nums", children: [symbol, resources.filter((r) => r.dailyRate > 0).reduce((s, r) => s + r.dailyRate, 0).toLocaleString()] })] })] }));
}
