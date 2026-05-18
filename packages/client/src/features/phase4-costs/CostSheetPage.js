import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useSchedulingStore } from "../phase2-scheduling/store/schedulingStore.js";
import { parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";
// ─── Helpers ──────────────────────────────────────────────────────────────────
function countWorkingDays(startStr, endStr, mode) {
    const start = parseISODate(startStr);
    const end = parseISODate(endStr);
    if (end <= start)
        return 0;
    if (mode === "four-week") {
        const calDays = (end.getTime() - start.getTime()) / 86400000;
        return Math.max(0, Math.round(calDays * 5 / 7));
    }
    let count = 0;
    const d = new Date(start);
    while (d < end) {
        if (d.getDay() !== 0 && d.getDay() !== 6)
            count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}
function resourceWorkingDays(r, projectStart, projectEnd, mode) {
    const start = r.rollOnDate || projectStart;
    const end = r.rollOffDate || projectEnd;
    if (!start || !end)
        return null;
    return countWorkingDays(start, end, mode);
}
// Use || (not ??) so that empty-string resourceType also falls back to "Contractor"
function resourceTypeSafe(r) {
    return (r.resourceType || "Contractor");
}
function effectiveRate(r, defaultRate) {
    if (resourceTypeSafe(r) === "FTE" && !r.monthlyRate)
        return defaultRate;
    return r.monthlyRate;
}
function resourceCost(r, days, defaultRate, wdpm) {
    if (days === null)
        return null;
    return (days / wdpm) * effectiveRate(r, defaultRate) * ((r.allocationPct ?? 100) / 100);
}
const fmtGBP = (gbp) => `£${Math.round(gbp).toLocaleString()}`;
const fmtUSD = (gbp, rate) => `$${Math.round(gbp * rate).toLocaleString()}`;
function Dual({ gbp, usdRate, color, size = "sm" }) {
    return (_jsxs("div", { className: "flex flex-col items-end gap-0.5", children: [_jsx("span", { className: `tabular-nums font-semibold ${size === "lg" ? "text-lg" : "text-sm"}`, style: { color: color ?? "#ece7ff" }, children: fmtGBP(gbp) }), _jsx("span", { className: "tabular-nums text-xs text-[#5c5575]", children: fmtUSD(gbp, usdRate) })] }));
}
// ─── Page ─────────────────────────────────────────────────────────────────────
export function CostSheetPage() {
    const { settings, resources, updateSettings } = useSchedulingStore();
    const { defaultMonthlyRate, contingencyPct, startDate, targetEndDate, calendarMode } = settings;
    const workingDaysPerMonth = settings.workingDaysPerMonth ?? 22;
    const usdRate = settings.exchangeRates?.USD ?? 1.35;
    const revenueGBP = settings.revenueGBP ?? 0;
    const agencyFeePct = settings.agencyFeePct ?? 10;
    const agencyFeeLabel = settings.agencyFeeLabel ?? "DDM";
    const [contingencyEnabled, setContingencyEnabled] = useState(true);
    const [contingencyDraft, setContingencyDraft] = useState(String(contingencyPct));
    const [agencyFeeEnabled, setAgencyFeeEnabled] = useState(true);
    const [agencyFeePctDraft, setAgencyFeePctDraft] = useState(String(agencyFeePct));
    const [agencyFeeLabelDraft, setAgencyFeeLabelDraft] = useState(agencyFeeLabel);
    useEffect(() => { setContingencyDraft(String(contingencyPct)); }, [contingencyPct]);
    useEffect(() => { setAgencyFeePctDraft(String(agencyFeePct)); }, [agencyFeePct]);
    useEffect(() => { setAgencyFeeLabelDraft(agencyFeeLabel); }, [agencyFeeLabel]);
    function commitContingency() {
        const v = parseFloat(contingencyDraft);
        const pct = isNaN(v) || v < 0 ? 0 : v;
        updateSettings({ contingencyPct: pct });
        setContingencyDraft(String(pct));
    }
    function commitAgencyFeePct() {
        const v = parseFloat(agencyFeePctDraft);
        const pct = isNaN(v) || v < 0 ? 0 : v;
        updateSettings({ agencyFeePct: pct });
        setAgencyFeePctDraft(String(pct));
    }
    function commitAgencyFeeLabel() {
        const label = agencyFeeLabelDraft.trim() || "Agency";
        updateSettings({ agencyFeeLabel: label });
        setAgencyFeeLabelDraft(label);
    }
    // Partial sums: resources with unknown dates are excluded but don't block the total
    function computeSubtotals(list) {
        let sum = 0, excluded = 0;
        for (const r of list) {
            const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
            const cost = resourceCost(r, days, defaultMonthlyRate, workingDaysPerMonth);
            if (cost === null) {
                excluded++;
                continue;
            }
            sum += cost;
        }
        return { sum, excluded };
    }
    const fteResources = resources.filter((r) => resourceTypeSafe(r) === "FTE");
    const contractorResources = resources.filter((r) => resourceTypeSafe(r) === "Contractor");
    let totalMM = 0, totalMMExcluded = 0;
    for (const r of resources) {
        const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
        if (days === null) {
            totalMMExcluded++;
            continue;
        }
        totalMM += days * ((r.allocationPct ?? 100) / 100) / workingDaysPerMonth;
    }
    const fteSub = computeSubtotals(fteResources);
    const contractorSub = computeSubtotals(contractorResources);
    const totalExcluded = fteSub.excluded + contractorSub.excluded;
    const grandTotal = fteSub.sum + contractorSub.sum;
    const contingencyAmount = contingencyEnabled ? grandTotal * (contingencyPct / 100) : 0;
    const atCost = grandTotal + contingencyAmount;
    const agencyFeeAmount = agencyFeeEnabled ? atCost * (agencyFeePct / 100) : 0;
    const totalDelivery = atCost + agencyFeeAmount;
    const profit = revenueGBP > 0 ? revenueGBP - totalDelivery : null;
    const margin = profit !== null && revenueGBP > 0 ? (profit / revenueGBP) * 100 : null;
    const missingRates = resources.filter((r) => !effectiveRate(r, defaultMonthlyRate));
    const missingDates = !startDate || !targetEndDate;
    if (resources.length === 0) {
        return (_jsx("div", { className: "h-full overflow-y-auto bg-[#0d0b16] flex items-center justify-center", children: _jsxs("div", { className: "text-center flex flex-col gap-2", children: [_jsx("p", { className: "text-[#5c5575] text-sm", children: "No resources added yet." }), _jsx("p", { className: "text-[#3a3456] text-xs", children: "Add team members in the Schedule tab to see cost breakdown here." })] }) }));
    }
    return (_jsxs("div", { className: "h-full overflow-y-auto bg-[#0d0b16] p-8 flex flex-col gap-6", children: [missingDates && (_jsxs("div", { className: "rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-3 flex items-start gap-3", children: [_jsx("span", { className: "text-amber-400 text-sm mt-0.5", children: "\u26A0" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-amber-300 font-medium", children: "Project dates not set" }), _jsx("p", { className: "text-xs text-amber-600 mt-0.5", children: "Set a start date and target end date in Schedule \u2192 Settings to calculate working days and costs. Resources without individual roll-on/off dates will use the project dates." })] })] })), _jsx(FinancialOverview, { totalMM: totalMM, totalMMExcluded: totalMMExcluded, atCost: totalDelivery, revenueGBP: revenueGBP, profit: profit, margin: margin, usdRate: usdRate, missingRates: missingRates.map((r) => r.name || "Unnamed"), onRevenueChange: (gbp) => updateSettings({ revenueGBP: gbp }), onUsdRateChange: (v) => updateSettings({ exchangeRates: { ...settings.exchangeRates, USD: v } }) }), fteResources.length > 0 && (_jsx(ResourceTable, { title: "FTE", accentColor: "#6ee7b7", accentBg: "rgba(16,185,129,0.10)", resources: fteResources, projectStart: startDate, projectEnd: targetEndDate, calendarMode: calendarMode, defaultMonthlyRate: defaultMonthlyRate, workingDaysPerMonth: workingDaysPerMonth, usdRate: usdRate, subtotal: fteSub.sum, excluded: fteSub.excluded })), contractorResources.length > 0 && (_jsx(ResourceTable, { title: "Contractors", accentColor: "#a78bfa", accentBg: "rgba(124,58,237,0.10)", resources: contractorResources, projectStart: startDate, projectEnd: targetEndDate, calendarMode: calendarMode, defaultMonthlyRate: defaultMonthlyRate, workingDaysPerMonth: workingDaysPerMonth, usdRate: usdRate, subtotal: contractorSub.sum, excluded: contractorSub.excluded })), _jsxs("div", { className: "rounded-2xl border border-[#2e2848] overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 bg-[#14112a] border-b border-[#2e2848] flex flex-wrap items-center gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-bold uppercase tracking-widest text-[#9b93ba]", children: "Cost Summary" }), _jsx("p", { className: "text-xs text-[#3a3456] mt-0.5", children: "Total project delivery cost including all fees" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none ml-auto", children: [_jsx("input", { type: "checkbox", checked: contingencyEnabled, onChange: (e) => setContingencyEnabled(e.target.checked), className: "w-4 h-4 accent-[#7c3aed] cursor-pointer" }), _jsx("span", { className: "text-xs text-[#9b93ba]", children: "Contingency" }), _jsx("input", { type: "number", min: 0, max: 100, step: 1, className: "w-14 border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7c3aed] disabled:opacity-40 tabular-nums", value: contingencyDraft, disabled: !contingencyEnabled, onChange: (e) => setContingencyDraft(e.target.value), onBlur: commitContingency, onKeyDown: (e) => { if (e.key === "Enter")
                                            e.currentTarget.blur(); } }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "%" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: agencyFeeEnabled, onChange: (e) => setAgencyFeeEnabled(e.target.checked), className: "w-4 h-4 accent-[#7c3aed] cursor-pointer" }), _jsx("input", { type: "text", className: "w-16 border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7c3aed] disabled:opacity-40", value: agencyFeeLabelDraft, disabled: !agencyFeeEnabled, onChange: (e) => setAgencyFeeLabelDraft(e.target.value), onBlur: commitAgencyFeeLabel, onKeyDown: (e) => { if (e.key === "Enter")
                                            e.currentTarget.blur(); }, title: "Agency name" }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "fee" }), _jsx("input", { type: "number", min: 0, max: 100, step: 0.5, className: "w-14 border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7c3aed] disabled:opacity-40 tabular-nums", value: agencyFeePctDraft, disabled: !agencyFeeEnabled, onChange: (e) => setAgencyFeePctDraft(e.target.value), onBlur: commitAgencyFeePct, onKeyDown: (e) => { if (e.key === "Enter")
                                            e.currentTarget.blur(); } }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "%" })] }), _jsxs("div", { className: "flex gap-6 text-xs font-semibold uppercase tracking-wide text-[#3a3456]", children: [_jsx("span", { className: "w-24 text-right", children: "GBP" }), _jsx("span", { className: "w-24 text-right", children: "USD" })] })] }), _jsxs("div", { className: "px-6 py-4 flex flex-col gap-2 bg-[#0d0b16]", children: [fteResources.length > 0 && (_jsx(SummaryRow, { label: "FTE subtotal", gbp: fteSub.sum, usdRate: usdRate, muted: true })), contractorResources.length > 0 && (_jsx(SummaryRow, { label: "Contractor subtotal", gbp: contractorSub.sum, usdRate: usdRate, muted: true })), fteResources.length > 0 && contractorResources.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "border-t border-[#2e2848] my-1" }), _jsx(SummaryRow, { label: "Total before contingency", gbp: grandTotal, usdRate: usdRate })] })), contingencyEnabled && (_jsx(SummaryRow, { label: `Contingency (${contingencyPct}%)`, gbp: contingencyAmount, usdRate: usdRate, muted: true })), agencyFeeEnabled && (_jsxs(_Fragment, { children: [_jsx("div", { className: "border-t border-[#2e2848] my-1" }), _jsx(SummaryRow, { label: `${agencyFeeLabel} fee (${agencyFeePct}% of at-cost)`, gbp: agencyFeeAmount, usdRate: usdRate, muted: true })] })), _jsx("div", { className: "border-t border-[#2e2848] my-1" }), _jsx(SummaryRow, { label: "Total delivery cost", gbp: totalDelivery, usdRate: usdRate, highlight: true }), totalExcluded > 0 && (_jsxs("p", { className: "text-xs text-amber-400 mt-1", children: ["\u26A0 ", totalExcluded, " member", totalExcluded !== 1 ? "s" : "", " excluded \u2014 set project dates or individual roll-on/off dates."] })), !missingDates && grandTotal === 0 && missingRates.length > 0 && (_jsx("p", { className: "text-xs text-[#5c5575] mt-1", children: "All team members have no monthly rate set. Add rates in the Schedule tab or set a default monthly rate in Settings." }))] })] })] }));
}
// ─── Financial Overview ───────────────────────────────────────────────────────
function FinancialOverview({ totalMM, totalMMExcluded, atCost, revenueGBP, profit, margin, usdRate, missingRates, onRevenueChange, onUsdRateChange, }) {
    const [revDraft, setRevDraft] = useState(revenueGBP > 0 ? String(Math.round(revenueGBP * usdRate)) : "");
    const [rateDraft, setRateDraft] = useState(String(usdRate));
    useEffect(() => {
        setRevDraft(revenueGBP > 0 ? String(Math.round(revenueGBP * usdRate)) : "");
    }, [usdRate, revenueGBP]);
    useEffect(() => { setRateDraft(String(usdRate)); }, [usdRate]);
    function commitRevenue() {
        const v = parseFloat(revDraft);
        onRevenueChange(isNaN(v) || v <= 0 ? 0 : v / usdRate);
    }
    function commitRate() {
        const v = parseFloat(rateDraft);
        const rate = isNaN(v) || v <= 0 ? 1.35 : v;
        onUsdRateChange(rate);
        setRateDraft(String(rate));
    }
    const profitColor = profit === null ? "#5c5575" : profit >= 0 ? "#34d399" : "#f87171";
    const marginColor = margin === null ? "#5c5575" : margin >= 0 ? "#34d399" : "#f87171";
    return (_jsxs("div", { className: "rounded-2xl border border-[#2e2848] overflow-hidden", children: [_jsx("div", { className: "px-6 py-4 bg-[#14112a] border-b border-[#2e2848]", children: _jsx("h2", { className: "text-sm font-bold uppercase tracking-widest text-[#9b93ba]", children: "Financial Overview" }) }), missingRates.length > 0 && (_jsxs("div", { className: "px-6 py-2.5 flex items-center gap-2 bg-amber-950/30 border-b border-amber-900/40", children: [_jsx("span", { className: "text-amber-400 text-xs", children: "\u26A0" }), _jsxs("span", { className: "text-xs text-amber-400", children: ["No rate set for: ", missingRates.join(", "), " \u2014 counted as \u00A30."] })] })), _jsx("div", { className: "px-6 py-5 bg-[#0d0b16]", children: _jsxs("div", { className: "flex flex-wrap gap-6", children: [_jsxs(OverviewStat, { label: "Total MM", sublabel: "Man-months of work", children: [_jsxs("span", { className: "text-2xl font-bold text-[#9b93ba] tabular-nums leading-tight", children: [totalMM.toFixed(1), _jsx("span", { className: "text-base font-normal text-[#5c5575] ml-1", children: "MM" })] }), totalMMExcluded > 0 && _jsxs("span", { className: "text-xs text-amber-400", children: ["+", totalMMExcluded, " excluded"] })] }), _jsx(OverviewStat, { label: "At Cost", sublabel: "Total delivery cost", children: _jsx(Dual, { gbp: atCost, usdRate: usdRate, color: "#a78bfa", size: "lg" }) }), _jsxs(OverviewStat, { label: "Revenue", sublabel: "Client contract (USD)", children: [_jsxs("div", { className: "flex items-baseline gap-1 mt-1", children: [_jsx("span", { className: "text-sm text-[#5c5575]", children: "$" }), _jsx("input", { type: "number", min: 0, step: 1000, placeholder: "0", className: "flex-1 min-w-0 text-2xl font-bold bg-transparent border-b border-[#2e2848] focus:border-[#7c3aed] text-[#ece7ff] outline-none pb-0.5 tabular-nums placeholder:text-[#3a3456] w-full", value: revDraft, onChange: (e) => setRevDraft(e.target.value), onBlur: commitRevenue, onKeyDown: (e) => { if (e.key === "Enter")
                                                e.currentTarget.blur(); } })] }), revenueGBP > 0 && (_jsxs("span", { className: "text-xs text-[#5c5575] tabular-nums", children: ["\u2248 ", fmtGBP(revenueGBP)] }))] }), _jsx(OverviewStat, { label: "Profit", sublabel: "Revenue \u2212 At Cost", children: profit !== null
                                ? _jsx(Dual, { gbp: profit, usdRate: usdRate, color: profitColor, size: "lg" })
                                : _jsx("span", { className: "text-2xl font-bold text-[#3a3456] leading-tight", children: "\u2014" }) }), _jsx(OverviewStat, { label: "Margin", sublabel: "Profit \u00F7 Revenue", children: _jsx("span", { className: "text-2xl font-bold tabular-nums leading-tight", style: { color: marginColor }, children: margin !== null ? `${Math.round(margin)}%` : "—" }) })] }) }), _jsxs("div", { className: "px-6 py-3 bg-[#0d0b16] border-t border-[#2e2848] flex flex-wrap items-center gap-3", children: [_jsx("span", { className: "text-xs text-[#5c5575]", children: "Exchange rate:" }), _jsx("span", { className: "text-xs text-[#9b93ba]", children: "1 GBP =" }), _jsx("input", { type: "number", min: 0.01, step: 0.01, className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]", value: rateDraft, onChange: (e) => setRateDraft(e.target.value), onBlur: commitRate, onKeyDown: (e) => { if (e.key === "Enter")
                            e.currentTarget.blur(); } }), _jsx("span", { className: "text-xs text-[#5c5575]", children: "USD" }), _jsx("span", { className: "text-xs text-[#3a3456]", children: "\u2014 costs stored in GBP; USD shown for reference" })] })] }));
}
function OverviewStat({ label, sublabel, children }) {
    return (_jsxs("div", { className: "flex flex-col gap-1 flex-1 min-w-[140px]", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wide text-[#5c5575]", children: label }), _jsx("span", { className: "text-xs text-[#3a3456]", children: sublabel }), _jsx("div", { className: "mt-1", children: children })] }));
}
// ─── Resource table ───────────────────────────────────────────────────────────
const DISCIPLINE_COLORS = {
    Art: "#f59e0b", Design: "#a78bfa", Code: "#38bdf8", Production: "#34d399", Custom: "#9ca3af",
};
function ResourceTable({ title, accentColor, accentBg, resources, projectStart, projectEnd, calendarMode, defaultMonthlyRate, workingDaysPerMonth, usdRate, subtotal, excluded, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[#2e2848] overflow-hidden", children: [_jsxs("div", { className: "px-6 py-3 flex items-center justify-between border-b border-[#2e2848]", style: { background: accentBg }, children: [_jsx("h2", { className: "text-sm font-bold uppercase tracking-widest", style: { color: accentColor }, children: title }), _jsxs("span", { className: "text-xs text-[#5c5575]", children: [resources.length, " member", resources.length !== 1 ? "s" : ""] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-[#14112a] border-b border-[#2e2848]", children: [_jsx(Th, { children: "Name" }), _jsx(Th, { children: "Role" }), _jsx(Th, { align: "center", children: "Allocation" }), _jsx(Th, { children: "Rate / month" }), _jsx(Th, { children: "Dates" }), _jsx(Th, { align: "right", children: "Working days" }), _jsx(Th, { align: "right", children: "Total cost" })] }) }), _jsx("tbody", { children: resources.map((r) => {
                                const days = resourceWorkingDays(r, projectStart, projectEnd, calendarMode);
                                const costGbp = resourceCost(r, days, defaultMonthlyRate, workingDaysPerMonth);
                                const rate = effectiveRate(r, defaultMonthlyRate);
                                const isDefaultRate = resourceTypeSafe(r) === "FTE" && !r.monthlyRate;
                                const alloc = r.allocationPct ?? 100;
                                return (_jsxs("tr", { className: "border-b border-[#2e2848] hover:bg-[#14112a] transition-colors", children: [_jsx("td", { className: "px-4 py-3 font-medium text-[#ece7ff]", children: r.name || "—" }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-xs px-2 py-0.5 rounded-full font-medium", style: { background: `${DISCIPLINE_COLORS[r.role] ?? "#9ca3af"}20`, color: DISCIPLINE_COLORS[r.role] ?? "#9ca3af" }, children: r.role }) }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("span", { className: alloc < 100 ? "text-amber-400 font-medium" : "text-[#9b93ba]", children: [alloc, "%"] }) }), _jsx("td", { className: "px-4 py-3", children: rate > 0 ? (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsxs("span", { className: `tabular-nums text-sm ${isDefaultRate ? "text-[#5c5575] italic" : "text-[#ece7ff]"}`, children: [fmtGBP(rate), isDefaultRate && _jsx("span", { className: "ml-1 text-xs not-italic", children: "(default)" })] }), _jsx("span", { className: "tabular-nums text-xs text-[#3a3456]", children: fmtUSD(rate, usdRate) })] })) : (_jsx("span", { className: "text-[#3a3456]", children: "No rate set" })) }), _jsx("td", { className: "px-4 py-3 text-[#9b93ba] text-xs whitespace-nowrap", children: formatDateRange(r.rollOnDate, r.rollOffDate) ?? _jsx("span", { className: "text-[#3a3456] italic", children: "Using project dates" }) }), _jsx("td", { className: "px-4 py-3 tabular-nums text-right text-[#9b93ba]", children: days !== null ? days.toLocaleString() : _jsx("span", { className: "text-[#3a3456]", children: "\u2014" }) }), _jsx("td", { className: "px-4 py-3 text-right", children: costGbp !== null && costGbp > 0
                                                ? _jsx(Dual, { gbp: costGbp, usdRate: usdRate, color: accentColor })
                                                : costGbp === 0 && rate === 0
                                                    ? _jsx("span", { className: "text-[#3a3456] text-sm", children: "No rate" })
                                                    : costGbp === 0
                                                        ? _jsx(Dual, { gbp: 0, usdRate: usdRate, color: "#3a3456" })
                                                        : _jsx("span", { className: "text-[#3a3456] text-sm", children: "\u2014" }) })] }, r.id));
                            }) }), _jsx("tfoot", { children: _jsxs("tr", { className: "border-t-2 border-[#2e2848]", style: { background: accentBg }, children: [_jsxs("td", { colSpan: 6, className: "px-4 py-3 text-xs font-semibold uppercase tracking-wide", style: { color: accentColor }, children: ["Subtotal", excluded > 0 && _jsxs("span", { className: "ml-2 font-normal opacity-60 normal-case", children: ["(", excluded, " member", excluded !== 1 ? "s" : "", " excluded \u2014 no dates)"] })] }), _jsx("td", { className: "px-4 py-3 text-right", children: _jsx(Dual, { gbp: subtotal, usdRate: usdRate, color: accentColor, size: "lg" }) })] }) })] }) })] }));
}
function Th({ children, align = "left" }) {
    return (_jsx("th", { className: `px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#5c5575] text-${align}`, children: children }));
}
function SummaryRow({ label, gbp, usdRate, muted, highlight }) {
    return (_jsxs("div", { className: `flex justify-between items-center ${highlight ? "py-1" : ""}`, children: [_jsx("span", { className: `text-sm ${muted ? "text-[#5c5575]" : highlight ? "font-bold text-[#ece7ff]" : "text-[#9b93ba]"}`, children: label }), _jsxs("div", { className: "flex gap-6", children: [_jsx("span", { className: `tabular-nums text-sm w-24 text-right ${highlight ? "font-bold text-[#a78bfa]" : muted ? "text-[#5c5575]" : "font-medium text-[#ece7ff]"}`, children: fmtGBP(gbp) }), _jsx("span", { className: `tabular-nums text-sm w-24 text-right ${muted ? "text-[#3a3456]" : "text-[#5c5575]"}`, children: fmtUSD(gbp, usdRate) })] })] }));
}
function formatDateRange(rollOn, rollOff) {
    const fmt = (s) => {
        const [, m, d] = s.split("-");
        return `${parseInt(d)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m) - 1]}`;
    };
    if (rollOn && rollOff)
        return `${fmt(rollOn)} → ${fmt(rollOff)}`;
    if (rollOn)
        return `From ${fmt(rollOn)}`;
    if (rollOff)
        return `Until ${fmt(rollOff)}`;
    return null;
}
