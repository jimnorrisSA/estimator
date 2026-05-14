import { useEffect, useState } from "react";
import type { Resource } from "@estimator/shared";
import { useSchedulingStore } from "../phase2-scheduling/store/schedulingStore.js";
import { parseISODate } from "../phase2-scheduling/utils/calendarUtils.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function resourceWorkingDays(r: Resource, projectStart: string, projectEnd: string, mode: "four-week" | "actual"): number | null {
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
  return days * effectiveRate(r, defaultRate) * ((r.allocationPct ?? 100) / 100);
}

const fmtGBP = (gbp: number) => `£${Math.round(gbp).toLocaleString()}`;
const fmtUSD = (gbp: number, rate: number) => `$${Math.round(gbp * rate).toLocaleString()}`;

function Dual({ gbp, usdRate, color, size = "sm" }: { gbp: number; usdRate: number; color?: string; size?: "sm" | "lg" }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`tabular-nums font-semibold ${size === "lg" ? "text-base" : "text-sm"}`} style={{ color: color ?? "#ece7ff" }}>
        {fmtGBP(gbp)}
      </span>
      <span className="tabular-nums text-xs text-[#5c5575]">{fmtUSD(gbp, usdRate)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CostSheetPage() {
  const { settings, resources, updateSettings } = useSchedulingStore();
  const { defaultDailyRate, contingencyPct, startDate, targetEndDate, calendarMode } = settings;
  const usdRate = settings.exchangeRates?.USD ?? 1.35;
  const revenueGBP = settings.revenueGBP ?? 0;

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

  let totalMM: number | null = 0;
  for (const r of resources) {
    const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
    if (days === null) { totalMM = null; break; }
    totalMM += days * ((r.allocationPct ?? 100) / 100) / 20;
  }

  const fteSub = subtotal(fteResources);
  const contractorSub = subtotal(contractorResources);
  const grandTotal = fteSub !== null && contractorSub !== null ? fteSub + contractorSub : null;
  const contingencyAmount = grandTotal !== null ? grandTotal * (contingencyPct / 100) : null;
  const atCost = grandTotal !== null && contingencyAmount !== null ? grandTotal + contingencyAmount : null;
  const profit = atCost !== null && revenueGBP > 0 ? revenueGBP - atCost : null;
  const margin = profit !== null && revenueGBP > 0 ? (profit / revenueGBP) * 100 : null;

  const hasResources = resources.length > 0;
  const missingRates = resources.filter((r) => !effectiveRate(r, defaultDailyRate));

  return (
    <div className="flex-1 overflow-y-auto bg-[#0d0b16] p-8 flex flex-col gap-8">

      {!hasResources && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-[#5c5575] text-sm">No resources added yet.</p>
          <p className="text-[#3a3456] text-xs">Add team members in the Schedule tab to see cost breakdown here.</p>
        </div>
      )}

      {/* Financial Overview */}
      {hasResources && (
        <FinancialOverview
          totalMM={totalMM}
          atCost={atCost}
          revenueGBP={revenueGBP}
          profit={profit}
          margin={margin}
          usdRate={usdRate}
          missingRates={missingRates.map((r) => r.name || "Unnamed")}
          onRevenueChange={(gbp) => updateSettings({ revenueGBP: gbp })}
        />
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
          usdRate={usdRate}
          subtotal={fteSub}
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
          usdRate={usdRate}
          subtotal={contractorSub}
        />
      )}

      {/* Cost Breakdown */}
      {hasResources && (
        <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
          <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848] flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Cost Breakdown</h2>
            <div className="flex gap-6 text-xs font-semibold uppercase tracking-wide text-[#3a3456]">
              <span className="w-24 text-right">GBP</span>
              <span className="w-24 text-right">USD</span>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-2 bg-[#0d0b16]">
            {fteResources.length > 0 && (
              <SummaryRow label="FTE subtotal" gbp={fteSub} usdRate={usdRate} muted />
            )}
            {contractorResources.length > 0 && (
              <SummaryRow label="Contractor subtotal" gbp={contractorSub} usdRate={usdRate} muted />
            )}
            <div className="border-t border-[#2e2848] my-1" />
            <SummaryRow label="Total before contingency" gbp={grandTotal} usdRate={usdRate} />
            <SummaryRow label={`Contingency (${contingencyPct}%)`} gbp={contingencyAmount} usdRate={usdRate} muted />
            <div className="border-t border-[#2e2848] my-1" />
            <SummaryRow label="At Cost" gbp={atCost} usdRate={usdRate} highlight />
            {atCost === null && (
              <p className="text-xs text-[#5c5575] mt-1">
                Set project start/end dates and roll-on/roll-off for all team members to see totals.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Exchange rate */}
      <UsdRatePanel
        usdRate={usdRate}
        onChange={(v) => updateSettings({ exchangeRates: { ...settings.exchangeRates, USD: v } })}
      />

    </div>
  );
}

// ─── Financial overview ───────────────────────────────────────────────────────

function FinancialOverview({
  totalMM, atCost, revenueGBP, profit, margin,
  usdRate, missingRates, onRevenueChange,
}: {
  totalMM: number | null;
  atCost: number | null;
  revenueGBP: number;
  profit: number | null;
  margin: number | null;
  usdRate: number;
  missingRates: string[];
  onRevenueChange: (gbp: number) => void;
}) {
  // Revenue is entered in USD; stored as GBP
  const [revDraft, setRevDraft] = useState(revenueGBP > 0 ? String(Math.round(revenueGBP * usdRate)) : "");

  useEffect(() => {
    setRevDraft(revenueGBP > 0 ? String(Math.round(revenueGBP * usdRate)) : "");
  }, [usdRate, revenueGBP]);

  function commitRevenue() {
    const v = parseFloat(revDraft);
    onRevenueChange(isNaN(v) || v <= 0 ? 0 : v / usdRate);
  }

  const profitColor = profit === null ? "#5c5575" : profit >= 0 ? "#34d399" : "#f87171";
  const marginColor = margin === null ? "#5c5575" : margin >= 0 ? "#34d399" : "#f87171";

  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Financial Overview</h2>
      </div>

      {missingRates.length > 0 && (
        <div className="px-6 py-2.5 flex items-center gap-2 bg-amber-950/30 border-b border-amber-900/40">
          <span className="text-amber-400 text-xs">⚠</span>
          <span className="text-xs text-amber-400">
            No rate set for: {missingRates.join(", ")} — edit in the Schedule tab or they'll count as £0.
          </span>
        </div>
      )}

      <div className="px-6 py-5 bg-[#0d0b16] grid grid-cols-2 md:grid-cols-5 gap-6">

        <OverviewStat label="Total MM" sublabel="Man-months of work">
          <span className="text-lg font-bold text-[#9b93ba] tabular-nums mt-1">
            {totalMM !== null ? `${totalMM.toFixed(1)} MM` : "—"}
          </span>
        </OverviewStat>

        <OverviewStat label="At Cost" sublabel="Total delivery cost">
          {atCost !== null
            ? <Dual gbp={atCost} usdRate={usdRate} color="#a78bfa" size="lg" />
            : <span className="text-lg font-bold text-[#3a3456] mt-1">—</span>}
        </OverviewStat>

        {/* Revenue — input in USD */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#5c5575]">Revenue</span>
          <span className="text-xs text-[#3a3456]">Client contract value (USD)</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-sm text-[#5c5575]">$</span>
            <input
              type="number" min={0} step={1000} placeholder="0"
              className="flex-1 min-w-0 text-lg font-bold bg-transparent border-b border-[#2e2848] focus:border-[#7c3aed] text-[#ece7ff] outline-none pb-0.5 tabular-nums placeholder:text-[#3a3456]"
              value={revDraft}
              onChange={(e) => setRevDraft(e.target.value)}
              onBlur={commitRevenue}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </div>
          {revenueGBP > 0 && (
            <span className="text-xs text-[#5c5575] tabular-nums">= {fmtGBP(revenueGBP)}</span>
          )}
        </div>

        <OverviewStat label="Profit" sublabel="Revenue − At Cost">
          {profit !== null
            ? <Dual gbp={profit} usdRate={usdRate} color={profitColor} size="lg" />
            : <span className="text-lg font-bold text-[#3a3456] mt-1">—</span>}
        </OverviewStat>

        <OverviewStat label="Margin" sublabel="Profit as % of revenue">
          <span className="text-lg font-bold tabular-nums mt-1" style={{ color: marginColor }}>
            {margin !== null ? `${Math.round(margin)}%` : "—"}
          </span>
        </OverviewStat>

      </div>
    </div>
  );
}

function OverviewStat({ label, sublabel, children }: { label: string; sublabel: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#5c5575]">{label}</span>
      <span className="text-xs text-[#3a3456]">{sublabel}</span>
      {children}
    </div>
  );
}

// ─── Resource table ───────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, string> = {
  Art: "#f59e0b", Design: "#a78bfa", Code: "#38bdf8", Production: "#34d399", Custom: "#9ca3af",
};

function ResourceTable({
  title, accentColor, accentBg, resources, projectStart, projectEnd,
  calendarMode, defaultDailyRate, usdRate, subtotal,
}: {
  title: string; accentColor: string; accentBg: string;
  resources: Resource[]; projectStart: string; projectEnd: string;
  calendarMode: "four-week" | "actual"; defaultDailyRate: number;
  usdRate: number; subtotal: number | null;
}) {
  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      <div className="px-6 py-3 flex items-center justify-between border-b border-[#2e2848]" style={{ background: accentBg }}>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>{title}</h2>
        <span className="text-xs text-[#5c5575]">{resources.length} member{resources.length !== 1 ? "s" : ""}</span>
      </div>
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

              return (
                <tr key={r.id} className="border-b border-[#2e2848] hover:bg-[#14112a] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#ece7ff]">{r.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${DISCIPLINE_COLORS[r.role] ?? "#9ca3af"}20`, color: DISCIPLINE_COLORS[r.role] ?? "#9ca3af" }}>
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={alloc < 100 ? "text-amber-400 font-medium" : "text-[#9b93ba]"}>{alloc}%</span>
                  </td>
                  <td className="px-4 py-3">
                    {rate > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className={`tabular-nums text-sm ${isDefaultRate ? "text-[#5c5575] italic" : "text-[#ece7ff]"}`}>
                          {fmtGBP(rate)}{isDefaultRate && <span className="ml-1 text-xs not-italic">(default)</span>}
                        </span>
                        <span className="tabular-nums text-xs text-[#3a3456]">{fmtUSD(rate, usdRate)}</span>
                      </div>
                    ) : (
                      <span className="text-[#3a3456]">No rate set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#9b93ba] text-xs">
                    {formatDateRange(r.rollOnDate, r.rollOffDate) ?? <span className="text-[#3a3456]">Project dates</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right text-[#9b93ba]">
                    {days !== null ? days.toLocaleString() : <span className="text-[#3a3456]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {costGbp !== null && costGbp > 0
                      ? <Dual gbp={costGbp} usdRate={usdRate} color={accentColor} />
                      : costGbp === 0
                        ? <span className="text-[#3a3456] text-sm">No rate</span>
                        : <span className="text-[#3a3456] text-sm">—</span>}
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
                <td className="px-4 py-2.5 text-right">
                  <Dual gbp={subtotal} usdRate={usdRate} color={accentColor} size="lg" />
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

function SummaryRow({ label, gbp, usdRate, muted, highlight }: {
  label: string; gbp: number | null; usdRate: number; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${highlight ? "py-1" : ""}`}>
      <span className={`text-sm ${muted ? "text-[#5c5575]" : highlight ? "font-bold text-[#ece7ff]" : "text-[#9b93ba]"}`}>
        {label}
      </span>
      <div className="flex gap-6">
        <span className={`tabular-nums text-sm w-24 text-right ${highlight ? "font-bold text-[#a78bfa]" : muted ? "text-[#5c5575]" : "font-medium text-[#ece7ff]"}`}>
          {gbp !== null ? fmtGBP(gbp) : "—"}
        </span>
        <span className={`tabular-nums text-sm w-24 text-right ${muted ? "text-[#3a3456]" : "text-[#5c5575]"}`}>
          {gbp !== null ? fmtUSD(gbp, usdRate) : "—"}
        </span>
      </div>
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

// ─── USD rate panel ───────────────────────────────────────────────────────────

function UsdRatePanel({ usdRate, onChange }: { usdRate: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(usdRate));

  useEffect(() => { setDraft(String(usdRate)); }, [usdRate]);

  function commit() {
    const v = parseFloat(draft);
    const rate = isNaN(v) || v <= 0 ? 1.35 : v;
    onChange(rate);
    setDraft(String(rate));
  }

  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Exchange Rate</h2>
      </div>
      <div className="px-6 py-5 bg-[#0d0b16] flex items-center gap-4">
        <span className="text-sm text-[#9b93ba]">1 GBP =</span>
        <input
          type="number" min={0.01} step={0.01}
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        <span className="text-sm text-[#5c5575]">USD</span>
        <span className="text-xs text-[#3a3456] ml-2">All costs are stored in GBP — USD is shown for reference</span>
      </div>
    </div>
  );
}
