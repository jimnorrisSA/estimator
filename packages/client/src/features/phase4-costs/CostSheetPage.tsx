import { useState } from "react";
import type { Resource } from "@estimator/shared";
import { useSchedulingStore, CURRENCY_SYMBOLS, type Currency } from "../phase2-scheduling/store/schedulingStore.js";
import { parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";

// ─── Working day helpers ──────────────────────────────────────────────────────

function countWorkingDays(startStr: string, endStr: string, mode: "four-week" | "actual"): number {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  if (end <= start) return 0;
  if (mode === "four-week") {
    const calDays = (end.getTime() - start.getTime()) / 86400000;
    return Math.max(0, Math.round(calDays * 5 / 7));
  }
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function resourceWorkingDays(
  r: Resource,
  projectStart: string,
  projectEnd: string,
  mode: "four-week" | "actual"
): number | null {
  const start = r.rollOnDate || projectStart;
  const end = r.rollOffDate || projectEnd;
  if (!start || !end) return null;
  return countWorkingDays(start, end, mode);
}

function effectiveRate(r: Resource, defaultRate: number): number {
  if (r.resourceType === "FTE" && !r.dailyRate) return defaultRate;
  return r.dailyRate;
}

function resourceCost(r: Resource, days: number | null, defaultRate: number): number | null {
  if (days === null) return null;
  const rate = effectiveRate(r, defaultRate);
  if (!rate) return null;
  return days * rate * ((r.allocationPct ?? 100) / 100);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CostSheetPage() {
  const { settings, resources, updateSettings } = useSchedulingStore();
  const { currency, defaultDailyRate, contingencyPct, startDate, targetEndDate, calendarMode } = settings;
  const symbol = CURRENCY_SYMBOLS[currency];
  const convRate = currency === "GBP" ? 1 : (settings.exchangeRates?.[currency] ?? 1);

  const fmt = (gbp: number) =>
    `${symbol}${Math.round(gbp * convRate).toLocaleString()}`;

  const fteResources = resources.filter((r) => (r.resourceType ?? "Contractor") === "FTE");
  const contractorResources = resources.filter((r) => (r.resourceType ?? "Contractor") === "Contractor");

  function subtotal(list: Resource[]): number | null {
    let total = 0;
    for (const r of list) {
      const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
      const cost = resourceCost(r, days, defaultDailyRate);
      if (cost === null) return null;
      total += cost;
    }
    return total;
  }

  const fteSub = subtotal(fteResources);
  const contractorSub = subtotal(contractorResources);
  const grandTotal = fteSub !== null && contractorSub !== null ? fteSub + contractorSub : null;
  const contingencyAmount = grandTotal !== null ? grandTotal * (contingencyPct / 100) : null;
  const totalWithContingency = grandTotal !== null && contingencyAmount !== null ? grandTotal + contingencyAmount : null;

  const hasResources = resources.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0d0b16] p-8 flex flex-col gap-8">

      {!hasResources && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-[#5c5575] text-sm">No resources added yet.</p>
          <p className="text-[#3a3456] text-xs">Add team members in the Schedule tab to see cost breakdown here.</p>
        </div>
      )}

      {/* FTE section */}
      {fteResources.length > 0 && (
        <ResourceTable
          title="FTE"
          accentColor="#6ee7b7"
          accentBg="rgba(16,185,129,0.12)"
          resources={fteResources}
          projectStart={startDate}
          projectEnd={targetEndDate}
          calendarMode={calendarMode}
          defaultDailyRate={defaultDailyRate}
          symbol={symbol}
          convRate={convRate}
          subtotal={fteSub}
          fmt={fmt}
        />
      )}

      {/* Contractor section */}
      {contractorResources.length > 0 && (
        <ResourceTable
          title="Contractors"
          accentColor="#a78bfa"
          accentBg="rgba(124,58,237,0.12)"
          resources={contractorResources}
          projectStart={startDate}
          projectEnd={targetEndDate}
          calendarMode={calendarMode}
          defaultDailyRate={defaultDailyRate}
          symbol={symbol}
          convRate={convRate}
          subtotal={contractorSub}
          fmt={fmt}
        />
      )}

      {/* Summary */}
      {hasResources && (
        <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
          <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Summary</h2>
          </div>
          <div className="px-6 py-4 flex flex-col gap-2 bg-[#0d0b16]">
            {fteResources.length > 0 && (
              <SummaryRow
                label="FTE subtotal"
                value={fteSub !== null ? fmt(fteSub) : null}
                muted
              />
            )}
            {contractorResources.length > 0 && (
              <SummaryRow
                label="Contractor subtotal"
                value={contractorSub !== null ? fmt(contractorSub) : null}
                muted
              />
            )}
            <div className="border-t border-[#2e2848] my-1" />
            <SummaryRow
              label="Total (ex. contingency)"
              value={grandTotal !== null ? fmt(grandTotal) : null}
            />
            <SummaryRow
              label={`Contingency (${contingencyPct}%)`}
              value={contingencyAmount !== null ? fmt(contingencyAmount) : null}
              muted
            />
            <div className="border-t border-[#2e2848] my-1" />
            <SummaryRow
              label="Total with contingency"
              value={totalWithContingency !== null ? fmt(totalWithContingency) : null}
              highlight
            />
            {grandTotal === null && (
              <p className="text-xs text-[#5c5575] mt-1">
                Set project start/end dates and roll-on/roll-off for all team members to see totals.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Exchange rates */}
      <ExchangeRatesPanel
        currency={currency}
        exchangeRates={settings.exchangeRates}
        onChangeCurrency={(c) => updateSettings({ currency: c })}
        onChangeRate={(c, v) => updateSettings({ exchangeRates: { ...settings.exchangeRates, [c]: v } })}
      />
    </div>
  );
}

// ─── Resource table ───────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, string> = {
  Art:        "#f59e0b",
  Design:     "#a78bfa",
  Code:       "#38bdf8",
  Production: "#34d399",
  Custom:     "#9ca3af",
};

function ResourceTable({
  title, accentColor, accentBg,
  resources, projectStart, projectEnd, calendarMode,
  defaultDailyRate, symbol, convRate, subtotal, fmt,
}: {
  title: string;
  accentColor: string;
  accentBg: string;
  resources: Resource[];
  projectStart: string;
  projectEnd: string;
  calendarMode: "four-week" | "actual";
  defaultDailyRate: number;
  symbol: string;
  convRate: number;
  subtotal: number | null;
  fmt: (gbp: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      {/* Section header */}
      <div
        className="px-6 py-3 flex items-center justify-between border-b border-[#2e2848]"
        style={{ background: accentBg }}
      >
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {title}
        </h2>
        <span className="text-xs text-[#5c5575]">{resources.length} member{resources.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#14112a] border-b border-[#2e2848]">
              <Th>Name</Th>
              <Th>Role</Th>
              <Th align="center">Allocation</Th>
              <Th>Rate / day</Th>
              <Th>Roll-on → Roll-off</Th>
              <Th align="right">Working days</Th>
              <Th align="right">Total cost</Th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => {
              const days = resourceWorkingDays(r, projectStart, projectEnd, calendarMode);
              const costGbp = resourceCost(r, days, defaultDailyRate);
              const rate = effectiveRate(r, defaultDailyRate);
              const isDefaultRate = r.resourceType === "FTE" && !r.dailyRate;
              const alloc = r.allocationPct ?? 100;
              const dateRange = formatDateRange(r.rollOnDate, r.rollOffDate);

              return (
                <tr key={r.id} className="border-b border-[#2e2848] hover:bg-[#14112a] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#ece7ff]">{r.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${DISCIPLINE_COLORS[r.role] ?? "#9ca3af"}20`, color: DISCIPLINE_COLORS[r.role] ?? "#9ca3af" }}
                    >
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={alloc < 100 ? "text-amber-400 font-medium" : "text-[#9b93ba]"}>
                      {alloc}%
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {rate > 0 ? (
                      <span className={isDefaultRate ? "text-[#5c5575] italic" : "text-[#ece7ff]"}>
                        {symbol}{Math.round(rate * convRate).toLocaleString()}
                        {isDefaultRate && <span className="ml-1 text-xs not-italic">(default)</span>}
                      </span>
                    ) : (
                      <span className="text-[#3a3456]">No rate set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#9b93ba] text-xs">
                    {dateRange ?? <span className="text-[#3a3456]">Project dates</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right text-[#9b93ba]">
                    {days !== null ? days.toLocaleString() : <span className="text-[#3a3456]">—</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right font-medium" style={{ color: accentColor }}>
                    {costGbp !== null ? fmt(costGbp) : <span className="text-[#3a3456]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {subtotal !== null && (
            <tfoot>
              <tr className="border-t border-[#2e2848]" style={{ background: accentBg }}>
                <td colSpan={6} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                  {title} subtotal
                </td>
                <td className="px-4 py-2.5 tabular-nums text-right text-sm font-bold" style={{ color: accentColor }}>
                  {fmt(subtotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#5c5575] text-${align}`}>
      {children}
    </th>
  );
}

function SummaryRow({ label, value, muted, highlight }: { label: string; value: string | null; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${highlight ? "py-1" : ""}`}>
      <span className={`text-sm ${muted ? "text-[#5c5575]" : highlight ? "font-bold text-[#ece7ff]" : "text-[#9b93ba]"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums text-sm ${
          highlight ? "font-bold text-[#a78bfa] text-base" : muted ? "text-[#5c5575]" : "font-medium text-[#ece7ff]"
        }`}
      >
        {value ?? <span className="text-[#3a3456]">—</span>}
      </span>
    </div>
  );
}

function formatDateRange(rollOn: string, rollOff: string): string | null {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]}`;
  };
  if (rollOn && rollOff) return `${fmt(rollOn)} → ${fmt(rollOff)}`;
  if (rollOn) return `From ${fmt(rollOn)}`;
  if (rollOff) return `Until ${fmt(rollOff)}`;
  return null;
}

// ─── Exchange rates panel ─────────────────────────────────────────────────────

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: "GBP", label: "GBP", symbol: "£" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "AUD", label: "AUD", symbol: "A$" },
];

function ExchangeRatesPanel({
  currency,
  exchangeRates,
  onChangeCurrency,
  onChangeRate,
}: {
  currency: Currency;
  exchangeRates: Record<string, number>;
  onChangeCurrency: (c: Currency) => void;
  onChangeRate: (currency: string, rate: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848] flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Display Currency & Exchange Rates</h2>
        <p className="text-xs text-[#3a3456]">All costs are stored in GBP and converted for display</p>
      </div>
      <div className="px-6 py-5 bg-[#0d0b16] flex flex-wrap gap-8 items-start">

        {/* Currency picker */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5c5575]">Display currency</p>
          <div className="flex rounded-lg border border-[#2e2848] overflow-hidden">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onChangeCurrency(c.value)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  currency === c.value
                    ? "bg-[#7c3aed] text-white"
                    : "bg-[#1a1628] text-[#5c5575] hover:text-[#9b93ba]"
                }`}
              >
                {c.symbol} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rate inputs */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5c5575]">Rates (1 GBP =)</p>
          <div className="flex flex-wrap gap-4">
            {CURRENCIES.filter((c) => c.value !== "GBP").map((c) => (
              <RateInput
                key={c.value}
                label={c.label}
                symbol={c.symbol}
                value={exchangeRates[c.value] ?? 1}
                onChange={(v) => onChangeRate(c.value, v)}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function RateInput({ label, symbol, value, onChange }: { label: string; symbol: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const v = parseFloat(draft);
    const rate = isNaN(v) || v <= 0 ? 1 : v;
    onChange(rate);
    setDraft(String(rate));
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#5c5575]">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0.01}
          step={0.01}
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        <span className="text-sm text-[#5c5575]">{symbol}</span>
      </div>
    </div>
  );
}
