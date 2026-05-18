import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
const CURRENCIES = [
    { value: "GBP", label: "£ GBP" },
    { value: "USD", label: "$ USD" },
    { value: "EUR", label: "€ EUR" },
    { value: "AUD", label: "A$ AUD" },
];
export function SettingsPanel({ settings, onChange }) {
    const symbol = CURRENCY_SYMBOLS[settings.currency];
    const conversionRate = settings.currency === "GBP" ? 1 : (settings.exchangeRates?.[settings.currency] ?? 1);
    const toDisplay = (gbp) => Math.round(gbp * conversionRate);
    const [monthDraft, setMonthDraft] = useState(settings.defaultMonthlyRate > 0 ? String(toDisplay(settings.defaultMonthlyRate)) : "");
    useEffect(() => {
        setMonthDraft(settings.defaultMonthlyRate > 0 ? String(Math.round(settings.defaultMonthlyRate * conversionRate)) : "");
    }, [settings.currency, settings.exchangeRates, settings.defaultMonthlyRate, conversionRate]);
    const [wdpmDraft, setWdpmDraft] = useState(String(settings.workingDaysPerMonth ?? 22));
    useEffect(() => { setWdpmDraft(String(settings.workingDaysPerMonth ?? 22)); }, [settings.workingDaysPerMonth]);
    function commitMonthRate(raw) {
        const v = parseFloat(raw);
        const monthly = isNaN(v) || v < 0 ? 0 : v;
        const gbp = monthly / conversionRate;
        onChange({ defaultMonthlyRate: gbp });
        setMonthDraft(monthly > 0 ? String(Math.round(monthly)) : "");
    }
    return (_jsxs("div", { className: "flex items-end gap-6 px-6 py-3 bg-[#14112a] border-b border-[#2e2848] flex-shrink-0 flex-wrap relative", children: [_jsx(Field, { label: "Project name", children: _jsx("input", { className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", value: settings.projectName, onChange: (e) => onChange({ projectName: e.target.value }) }) }), _jsx(Field, { label: "Calendar mode", children: _jsx("div", { className: "flex rounded-lg border border-[#2e2848] overflow-hidden text-sm", children: ["four-week", "actual"].map((mode) => (_jsx("button", { className: `px-3 py-1.5 transition-colors ${settings.calendarMode === mode
                            ? "bg-[#7c3aed] text-white font-medium"
                            : "bg-[#1a1628] text-[#9b93ba] hover:bg-[#252041]"}`, onClick: () => onChange({ calendarMode: mode }), children: mode === "four-week" ? "4-week months" : "Actual dates" }, mode))) }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { type: "date", className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: settings.startDate, onChange: (e) => onChange({ startDate: e.target.value }) }) }), _jsx(Field, { label: "Target end date", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "date", className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: settings.targetEndDate, onChange: (e) => onChange({ targetEndDate: e.target.value }) }), settings.targetEndDate && (_jsx("button", { className: "text-[#3a3456] hover:text-[#9b93ba] text-lg leading-none transition-colors", title: "Clear target", onClick: () => onChange({ targetEndDate: "" }), children: "\u00D7" }))] }) }), _jsx(Field, { label: "Contingency", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "number", min: 0, max: 100, step: 5, className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: settings.contingencyPct, onChange: (e) => onChange({ contingencyPct: Math.max(0, Math.min(100, Number(e.target.value))) }) }), _jsx("span", { className: "text-sm text-[#5c5575]", children: "%" })] }) }), _jsx(Field, { label: "Currency", children: _jsx("select", { className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: settings.currency, onChange: (e) => onChange({ currency: e.target.value }), children: CURRENCIES.map((c) => (_jsx("option", { value: c.value, children: c.label }, c.value))) }) }), _jsx(Field, { label: `Default monthly rate (${symbol})`, children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-sm text-[#5c5575]", children: symbol }), _jsx("input", { type: "number", min: 0, step: 500, placeholder: "e.g. 6700", className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]", value: monthDraft, onChange: (e) => setMonthDraft(e.target.value), onBlur: () => commitMonthRate(monthDraft), onKeyDown: (e) => { if (e.key === "Enter")
                                e.currentTarget.blur(); } })] }) }), _jsx(Field, { label: "Working days / month", children: _jsx("input", { type: "number", min: 1, max: 31, step: 1, className: "border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]", value: wdpmDraft, onChange: (e) => setWdpmDraft(e.target.value), onBlur: () => {
                        const v = parseInt(wdpmDraft, 10);
                        const clamped = isNaN(v) || v < 1 ? 22 : Math.min(v, 31);
                        onChange({ workingDaysPerMonth: clamped });
                        setWdpmDraft(String(clamped));
                    }, onKeyDown: (e) => { if (e.key === "Enter")
                        e.currentTarget.blur(); } }) })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-[#5c5575] uppercase tracking-wide", children: label }), children] }));
}
