import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";
const CURRENCIES = [
    { value: "GBP", label: "£ GBP" },
    { value: "USD", label: "$ USD" },
    { value: "EUR", label: "€ EUR" },
    { value: "AUD", label: "A$ AUD" },
];
export function SettingsPanel({ settings, onChange }) {
    const symbol = CURRENCY_SYMBOLS[settings.currency];
    const [dayDraft, setDayDraft] = useState(settings.defaultDailyRate > 0 ? String(settings.defaultDailyRate) : "");
    const [monthDraft, setMonthDraft] = useState(settings.defaultDailyRate > 0 ? String(settings.defaultDailyRate * 20) : "");
    function commitDayRate(raw) {
        const v = parseFloat(raw);
        const rate = isNaN(v) || v < 0 ? 0 : v;
        onChange({ defaultDailyRate: rate });
        setDayDraft(rate > 0 ? String(rate) : "");
        setMonthDraft(rate > 0 ? String(rate * 20) : "");
    }
    function commitMonthRate(raw) {
        const v = parseFloat(raw);
        const monthly = isNaN(v) || v < 0 ? 0 : v;
        const daily = monthly / 20;
        onChange({ defaultDailyRate: daily });
        setMonthDraft(monthly > 0 ? String(monthly) : "");
        setDayDraft(daily > 0 ? String(daily) : "");
    }
    return (_jsxs("div", { className: "flex items-end gap-6 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap", children: [_jsx(Field, { label: "Project name", children: _jsx("input", { className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500", value: settings.projectName, onChange: (e) => onChange({ projectName: e.target.value }) }) }), _jsx(Field, { label: "Calendar mode", children: _jsx("div", { className: "flex rounded-lg border border-gray-300 overflow-hidden text-sm", children: ["four-week", "actual"].map((mode) => (_jsx("button", { className: `px-3 py-1.5 transition-colors ${settings.calendarMode === mode
                            ? "bg-blue-600 text-white font-medium"
                            : "bg-white text-gray-600 hover:bg-gray-50"}`, onClick: () => onChange({ calendarMode: mode }), children: mode === "four-week" ? "4-week months" : "Actual dates" }, mode))) }) }), _jsx(Field, { label: "Start date", children: _jsx("input", { type: "date", className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", value: settings.startDate, onChange: (e) => onChange({ startDate: e.target.value }) }) }), _jsx(Field, { label: "Target end date", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "date", className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", value: settings.targetEndDate, onChange: (e) => onChange({ targetEndDate: e.target.value }) }), settings.targetEndDate && (_jsx("button", { className: "text-gray-300 hover:text-gray-500 text-lg leading-none", title: "Clear target", onClick: () => onChange({ targetEndDate: "" }), children: "\u00D7" }))] }) }), _jsx(Field, { label: "Contingency", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "number", min: 0, max: 100, step: 5, className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500", value: settings.contingencyPct, onChange: (e) => onChange({ contingencyPct: Math.max(0, Math.min(100, Number(e.target.value))) }) }), _jsx("span", { className: "text-sm text-gray-500", children: "%" })] }) }), _jsx(Field, { label: "Currency", children: _jsx("select", { className: "border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white", value: settings.currency, onChange: (e) => onChange({ currency: e.target.value }), children: CURRENCIES.map((c) => (_jsx("option", { value: c.value, children: c.label }, c.value))) }) }), _jsx(Field, { label: `Default rate (${symbol})`, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-gray-400", children: "Day" }), _jsx("span", { className: "text-sm text-gray-400", children: symbol }), _jsx("input", { type: "number", min: 0, step: 50, placeholder: "400", className: "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500", value: dayDraft, onChange: (e) => setDayDraft(e.target.value), onBlur: () => commitDayRate(dayDraft), onKeyDown: (e) => { if (e.key === "Enter")
                                        e.currentTarget.blur(); } })] }), _jsx("span", { className: "text-gray-300 text-sm", children: "\u00B7" }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-xs text-gray-400", children: "Month" }), _jsx("span", { className: "text-sm text-gray-400", children: symbol }), _jsx("input", { type: "number", min: 0, step: 500, placeholder: "8000", className: "border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500", value: monthDraft, onChange: (e) => setMonthDraft(e.target.value), onBlur: () => commitMonthRate(monthDraft), onKeyDown: (e) => { if (e.key === "Enter")
                                        e.currentTarget.blur(); } })] })] }) })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-gray-400 uppercase tracking-wide", children: label }), children] }));
}
