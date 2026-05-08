import { useEffect, useState } from "react";
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
  const symbol = CURRENCY_SYMBOLS[settings.currency];
  const conversionRate = settings.currency === "GBP" ? 1 : (settings.exchangeRates?.[settings.currency] ?? 1);

  const toDisplay = (gbp: number) => Math.round(gbp * conversionRate);
  const toGbp = (display: number) => display / conversionRate;

  const [dayDraft, setDayDraft] = useState(
    settings.defaultDailyRate > 0 ? String(toDisplay(settings.defaultDailyRate)) : ""
  );
  const [monthDraft, setMonthDraft] = useState(
    settings.defaultDailyRate > 0 ? String(toDisplay(settings.defaultDailyRate * 20)) : ""
  );
  const [rateDraft, setRateDraft] = useState(String(conversionRate));

  useEffect(() => {
    const rate = settings.currency === "GBP" ? 1 : (settings.exchangeRates?.[settings.currency] ?? 1);
    setRateDraft(String(rate));
    setDayDraft(settings.defaultDailyRate > 0 ? String(Math.round(settings.defaultDailyRate * rate)) : "");
    setMonthDraft(settings.defaultDailyRate > 0 ? String(Math.round(settings.defaultDailyRate * 20 * rate)) : "");
  }, [settings.currency, settings.exchangeRates, settings.defaultDailyRate]);

  function commitDayRate(raw: string) {
    const v = parseFloat(raw);
    const displayVal = isNaN(v) || v < 0 ? 0 : v;
    const gbp = toGbp(displayVal);
    onChange({ defaultDailyRate: gbp });
    setDayDraft(gbp > 0 ? String(Math.round(gbp * conversionRate)) : "");
    setMonthDraft(gbp > 0 ? String(Math.round(gbp * 20 * conversionRate)) : "");
  }

  function commitMonthRate(raw: string) {
    const v = parseFloat(raw);
    const displayMonthly = isNaN(v) || v < 0 ? 0 : v;
    const gbp = toGbp(displayMonthly) / 20;
    onChange({ defaultDailyRate: gbp });
    setMonthDraft(displayMonthly > 0 ? String(Math.round(displayMonthly)) : "");
    setDayDraft(gbp > 0 ? String(Math.round(gbp * conversionRate)) : "");
  }

  return (
    <div className="flex items-end gap-6 px-6 py-3 bg-[#14112a] border-b border-[#2e2848] flex-shrink-0 flex-wrap relative">
      <Field label="Project name">
        <input
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
          value={settings.projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
        />
      </Field>

      <Field label="Calendar mode">
        <div className="flex rounded-lg border border-[#2e2848] overflow-hidden text-sm">
          {(["four-week", "actual"] as const).map((mode) => (
            <button
              key={mode}
              className={`px-3 py-1.5 transition-colors ${
                settings.calendarMode === mode
                  ? "bg-[#7c3aed] text-white font-medium"
                  : "bg-[#1a1628] text-[#9b93ba] hover:bg-[#252041]"
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
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
          value={settings.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </Field>

      <Field label="Target end date">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
            value={settings.targetEndDate}
            onChange={(e) => onChange({ targetEndDate: e.target.value })}
          />
          {settings.targetEndDate && (
            <button
              className="text-[#3a3456] hover:text-[#9b93ba] text-lg leading-none transition-colors"
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
            className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
            value={settings.contingencyPct}
            onChange={(e) =>
              onChange({ contingencyPct: Math.max(0, Math.min(100, Number(e.target.value))) })
            }
          />
          <span className="text-sm text-[#5c5575]">%</span>
        </div>
      </Field>

      <Field label="Currency">
        <select
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
          value={settings.currency}
          onChange={(e) => onChange({ currency: e.target.value as Currency })}
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Field>

      {settings.currency !== "GBP" && (
        <Field label={`1 GBP =`}>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              onBlur={() => {
                const v = parseFloat(rateDraft);
                const rate = isNaN(v) || v <= 0 ? 1 : v;
                onChange({ exchangeRates: { ...settings.exchangeRates, [settings.currency]: rate } });
                setRateDraft(String(rate));
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
            <span className="text-sm text-[#5c5575]">{symbol}</span>
          </div>
        </Field>
      )}

      <Field label={`Default rate (${symbol})`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#5c5575]">Day</span>
            <span className="text-sm text-[#5c5575]">{symbol}</span>
            <input
              type="number"
              min={0}
              step={50}
              placeholder="400"
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
              value={dayDraft}
              onChange={(e) => setDayDraft(e.target.value)}
              onBlur={() => commitDayRate(dayDraft)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </div>
          <span className="text-[#3a3456] text-sm">·</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#5c5575]">Month</span>
            <span className="text-sm text-[#5c5575]">{symbol}</span>
            <input
              type="number"
              min={0}
              step={500}
              placeholder="8000"
              className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] placeholder:text-[#3a3456]"
              value={monthDraft}
              onChange={(e) => setMonthDraft(e.target.value)}
              onBlur={() => commitMonthRate(monthDraft)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </div>
        </div>
      </Field>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#5c5575] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
