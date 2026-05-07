import { useState } from "react";
import type { Currency, ScheduleSettings } from "../store/schedulingStore.js";
import { CURRENCY_SYMBOLS } from "../store/schedulingStore.js";

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "GBP", label: "£ GBP" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "AUD", label: "A$ AUD" },
];

interface Props {
  settings: ScheduleSettings;
  onChange: (patch: Partial<ScheduleSettings>) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [rateDraft, setRateDraft] = useState(settings.defaultDailyRate > 0 ? String(settings.defaultDailyRate) : "");
  const symbol = CURRENCY_SYMBOLS[settings.currency];

  return (
    <div className="flex items-end gap-6 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
      <Field label="Project name">
        <input
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={settings.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
        />
      </Field>

      <Field label="Calendar mode">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(["four-week", "actual"] as const).map((mode) => (
            <button
              key={mode}
              className={`px-3 py-1.5 transition-colors ${
                settings.calendarMode === mode
                  ? "bg-blue-600 text-white font-medium"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => onChange({ calendarMode: mode })}
            >
              {mode === "four-week" ? "4-week months" : "Actual dates"}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Start date">
        <input
          type="date"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={settings.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </Field>

      <Field label="Target end date">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={settings.targetEndDate}
            onChange={(e) => onChange({ targetEndDate: e.target.value })}
          />
          {settings.targetEndDate && (
            <button
              className="text-gray-300 hover:text-gray-500 text-lg leading-none"
              title="Clear target"
              onClick={() => onChange({ targetEndDate: "" })}
            >
              ×
            </button>
          )}
        </div>
      </Field>

      <Field label="Contingency">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={settings.contingencyPct}
            onChange={(e) =>
              onChange({ contingencyPct: Math.max(0, Math.min(100, Number(e.target.value))) })
            }
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </Field>

      <Field label="Currency">
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={settings.currency}
          onChange={(e) => onChange({ currency: e.target.value as Currency })}
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Field>

      <Field label={`Default day rate (${symbol})`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-400">{symbol}</span>
          <input
            type="number"
            min={0}
            step={50}
            placeholder="e.g. 400"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={() => {
              const v = parseFloat(rateDraft);
              onChange({ defaultDailyRate: isNaN(v) || v < 0 ? 0 : v });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
