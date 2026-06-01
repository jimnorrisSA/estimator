import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
// ─── Helpers ──────────────────────────────────────────────────────────────────
const EXTRA_MONTHS = 6; // columns to show beyond the furthest date
function monthRange(startDate, projectEnd, resources) {
    if (!startDate)
        return [];
    // Find the furthest month with any allocation set across all resources
    let furthestAlloc = "";
    for (const r of resources) {
        for (const m of Object.keys(r.monthlyAllocations ?? {})) {
            if (m > furthestAlloc)
                furthestAlloc = m;
        }
    }
    // Effective end = max(projectEnd, furthestAlloc), then pad by EXTRA_MONTHS
    const baseEnd = [projectEnd?.slice(0, 7), furthestAlloc].filter(Boolean).sort().at(-1) ?? "";
    const endDate = (() => {
        const d = baseEnd
            ? new Date(baseEnd + "-01")
            : (() => { const d2 = new Date(startDate.slice(0, 7) + "-01"); d2.setMonth(d2.getMonth() + 11); return d2; })();
        d.setMonth(d.getMonth() + EXTRA_MONTHS);
        return d;
    })();
    const months = [];
    const cur = new Date(startDate.slice(0, 7) + "-01");
    while (cur <= endDate) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
        cur.setMonth(cur.getMonth() + 1);
    }
    return months;
}
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtMonth(ym) {
    const [y, m] = ym.split("-");
    return { label: MONTH_NAMES[parseInt(m) - 1], year: y.slice(2) };
}
const DISC_COLOR = {
    Art: "#f59e0b",
    Design: "#a78bfa",
    Code: "#38bdf8",
    Production: "#34d399",
    Custom: "#9ca3af",
};
function effectiveRate(r, defaultRate) {
    return (r.resourceType === "FTE" && !r.monthlyRate) ? defaultRate : r.monthlyRate;
}
function fmtAlloc(v) {
    if (v === 0)
        return "";
    return v % 1 === 0 ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}
export function TeamAllocationTable({ resources, projectStart, projectEnd, currency, defaultMonthlyRate, onSetAllocation, }) {
    const months = monthRange(projectStart, projectEnd, resources);
    const symbol = CURRENCY_SYMBOLS[currency];
    if (resources.length === 0 || months.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center h-16 text-sm text-[#5c5575] border border-dashed border-[#2e2848] rounded-xl", children: resources.length === 0
                ? "Add team members in the sidebar to set monthly allocations."
                : "Set a project start and end date in Settings to enable the allocation grid." }));
    }
    // Head-count and cost totals per month
    const hcTotals = months.map((m) => resources.reduce((s, r) => s + (r.monthlyAllocations?.[m] ?? 0), 0));
    const costTotals = months.map((m) => resources.reduce((s, r) => {
        const alloc = r.monthlyAllocations?.[m] ?? 0;
        return s + alloc * effectiveRate(r, defaultMonthlyRate);
    }, 0));
    const LABEL_W = 168;
    const COL_W = 52;
    return (_jsxs("section", { className: "flex flex-col gap-3", children: [_jsx("h2", { className: "text-sm font-semibold text-[#9b93ba] uppercase tracking-wide", children: "Team Allocation" }), _jsx("div", { className: "rounded-xl border border-[#2e2848] overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "text-sm border-collapse", style: { width: LABEL_W + COL_W * months.length }, children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-[#1a1628]", children: [_jsx("th", { className: "sticky left-0 z-10 bg-[#1a1628] border-b border-r border-[#2e2848] text-left px-3 py-2 text-xs font-medium text-[#5c5575] uppercase tracking-wide", style: { width: LABEL_W, minWidth: LABEL_W }, children: "Member" }), months.map((m) => {
                                            const { label, year } = fmtMonth(m);
                                            return (_jsxs("th", { className: "border-b border-[#2e2848] py-1.5 text-center", style: { width: COL_W, minWidth: COL_W }, children: [_jsx("div", { className: "text-xs font-semibold text-[#9b93ba] leading-none", children: label }), _jsx("div", { className: "text-[10px] text-[#5c5575] mt-0.5", children: year })] }, m));
                                        })] }) }), _jsxs("tbody", { children: [resources.map((r, i) => (_jsx(ResourceRow, { resource: r, months: months, symbol: symbol, defaultMonthlyRate: defaultMonthlyRate, zebra: i % 2 === 1, labelW: LABEL_W, onSet: (month, val) => onSetAllocation(r.id, month, val) }, r.id))), _jsxs("tr", { className: "bg-[#0d0b16] border-t-2 border-[#2e2848]", children: [_jsx("td", { className: "sticky left-0 z-10 bg-[#0d0b16] px-3 py-2 border-r border-t-2 border-[#2e2848] text-xs font-semibold text-[#5c5575] uppercase tracking-wide", style: { width: LABEL_W }, children: "Head Count" }), hcTotals.map((total, i) => (_jsx("td", { className: "py-2 text-center", children: total > 0 && (_jsx("span", { className: "text-xs font-bold text-[#9b93ba] tabular-nums", children: fmtAlloc(total) })) }, months[i])))] }), _jsxs("tr", { className: "bg-[#0d0b16] border-t border-[#2e2848]", children: [_jsx("td", { className: "sticky left-0 z-10 bg-[#0d0b16] px-3 py-2 border-r border-[#2e2848] text-xs font-semibold text-[#5c5575] uppercase tracking-wide", style: { width: LABEL_W }, children: "Monthly Cost" }), costTotals.map((cost, i) => (_jsx("td", { className: "py-2 text-center", children: cost > 0 && (_jsxs("span", { className: "text-xs font-medium text-[#a78bfa] tabular-nums", children: [symbol, Math.round(cost).toLocaleString()] })) }, months[i])))] })] })] }) }) })] }));
}
// ─── Resource row ─────────────────────────────────────────────────────────────
function ResourceRow({ resource, months, symbol, defaultMonthlyRate, zebra, labelW, onSet, }) {
    const rate = effectiveRate(resource, defaultMonthlyRate);
    const color = DISC_COLOR[resource.role] ?? "#9ca3af";
    const rowBg = zebra ? "#1a1628" : "#14112a";
    return (_jsxs("tr", { className: "border-t border-[#2e2848]", style: { background: rowBg }, children: [_jsx("td", { className: "sticky left-0 z-10 px-3 py-2 border-r border-[#2e2848]", style: { background: rowBg, width: labelW }, children: _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full flex-shrink-0", style: { background: color } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-sm text-[#ece7ff] truncate leading-tight", children: resource.name || "—" }), _jsx("div", { className: "text-xs text-[#5c5575] leading-tight mt-0.5", children: rate > 0 ? `${symbol}${rate.toLocaleString()}/mo` : _jsx("span", { className: "text-amber-600", children: "no rate" }) })] })] }) }), months.map((m) => (_jsx(AllocCell, { value: resource.monthlyAllocations?.[m] ?? 0, onCommit: (v) => onSet(m, v) }, m)))] }));
}
// ─── Allocation cell ──────────────────────────────────────────────────────────
function AllocCell({ value, onCommit }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    function startEdit() {
        setDraft(value > 0 ? fmtAlloc(value) : "");
        setEditing(true);
    }
    function commit() {
        const v = parseFloat(draft);
        onCommit(isNaN(v) || v < 0 ? 0 : v);
        setEditing(false);
    }
    if (editing) {
        return (_jsx("td", { className: "px-0.5 py-0.5 text-center", children: _jsx("input", { autoFocus: true, type: "number", min: 0, max: 3, step: 0.25, className: "w-10 text-xs text-center bg-[#1d1930] border border-[#7c3aed] rounded px-1 py-1 text-[#ece7ff] focus:outline-none tabular-nums", value: draft, onChange: (e) => setDraft(e.target.value), onBlur: commit, onKeyDown: (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    }
                    if (e.key === "Tab") {
                        e.preventDefault();
                        commit();
                    }
                    if (e.key === "Escape") {
                        setEditing(false);
                    }
                    if (e.key === "Delete" || e.key === "Backspace")
                        setDraft("");
                } }) }));
    }
    const hasValue = value > 0;
    return (_jsx("td", { className: "py-2 text-center cursor-pointer select-none transition-colors hover:bg-[#1d1930]", onClick: startEdit, title: hasValue ? `${value} — click to edit` : "Click to set allocation", children: hasValue ? (_jsx("span", { className: "inline-block text-sm font-semibold tabular-nums rounded px-1", style: {
                color: value >= 1 ? "#ece7ff" : "#9b93ba",
                background: value >= 1 ? "rgba(124,58,237,0.18)" : "transparent",
            }, children: fmtAlloc(value) })) : (_jsx("span", { className: "text-[#2e2848] text-xs select-none", children: "\u00B7" })) }));
}
