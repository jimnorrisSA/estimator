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
  const end   = r.rollOffDate || projectEnd;
  if (!start || !end) return null;
  return countWorkingDays(start, end, mode);
}

// Use || (not ??) so that empty-string resourceType also falls back to "Contractor"
function resourceTypeSafe(r: Resource): "FTE" | "Contractor" {
  return (r.resourceType || "Contractor") as "FTE" | "Contractor";
}

function effectiveRate(r: Resource, defaultRate: number): number {
  if (resourceTypeSafe(r) === "FTE" && !r.monthlyRate) return defaultRate;
  return r.monthlyRate;
}

function resourceCost(r: Resource, days: number | null, defaultRate: number, wdpm: number): number | null {
  if (days === null) return null;
  return (days / wdpm) * effectiveRate(r, defaultRate) * ((r.allocationPct ?? 100) / 100);
}

const fmtGBP = (gbp: number) => `£${Math.round(gbp).toLocaleString()}`;
const fmtUSD = (gbp: number, rate: number) => `$${Math.round(gbp * rate).toLocaleString()}`;

function Dual({ gbp, usdRate, color, size = "sm" }: { gbp: number; usdRate: number; color?: string; size?: "sm" | "lg" }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`tabular-nums font-semibold ${size === "lg" ? "text-lg" : "text-sm"}`} style={{ color: color ?? "#ece7ff" }}>
        {fmtGBP(gbp)}
      </span>
      <span className="tabular-nums text-xs text-[#5c5575]">{fmtUSD(gbp, usdRate)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CostSheetPage() {
  const { settings, resources, updateSettings } = useSchedulingStore();
  const { defaultMonthlyRate, contingencyPct, startDate, targetEndDate, calendarMode } = settings;
  const workingDaysPerMonth = settings.workingDaysPerMonth ?? 22;
  const usdRate    = settings.exchangeRates?.USD ?? 1.35;
  const revenueGBP = settings.revenueGBP ?? 0;

  const [contingencyEnabled, setContingencyEnabled] = useState(true);
  const [contingencyDraft,   setContingencyDraft]   = useState(String(contingencyPct));

  useEffect(() => { setContingencyDraft(String(contingencyPct)); }, [contingencyPct]);

  function commitContingency() {
    const v = parseFloat(contingencyDraft);
    const pct = isNaN(v) || v < 0 ? 0 : v;
    updateSettings({ contingencyPct: pct });
    setContingencyDraft(String(pct));
  }

  // Partial sums: resources with unknown dates are excluded but don't block the total
  function computeSubtotals(list: Resource[]): { sum: number; excluded: number } {
    let sum = 0, excluded = 0;
    for (const r of list) {
      const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
      const cost = resourceCost(r, days, defaultMonthlyRate, workingDaysPerMonth);
      if (cost === null) { excluded++; continue; }
      sum += cost;
    }
    return { sum, excluded };
  }

  const fteResources        = resources.filter((r) => resourceTypeSafe(r) === "FTE");
  const contractorResources = resources.filter((r) => resourceTypeSafe(r) === "Contractor");

  let totalMM = 0, totalMMExcluded = 0;
  for (const r of resources) {
    const days = resourceWorkingDays(r, startDate, targetEndDate, calendarMode);
    if (days === null) { totalMMExcluded++; continue; }
    totalMM += days * ((r.allocationPct ?? 100) / 100) / workingDaysPerMonth;
  }

  const fteSub        = computeSubtotals(fteResources);
  const contractorSub = computeSubtotals(contractorResources);
  const totalExcluded = fteSub.excluded + contractorSub.excluded;
  const grandTotal    = fteSub.sum + contractorSub.sum;
  const contingencyAmount = contingencyEnabled ? grandTotal * (contingencyPct / 100) : 0;
  const atCost  = grandTotal + contingencyAmount;
  const profit  = revenueGBP > 0 ? revenueGBP - atCost : null;
  const margin  = profit !== null && revenueGBP > 0 ? (profit / revenueGBP) * 100 : null;

  const missingRates = resources.filter((r) => !effectiveRate(r, defaultMonthlyRate));
  const missingDates = !startDate || !targetEndDate;

  if (resources.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-[#0d0b16] flex items-center justify-center">
        <div className="text-center flex flex-col gap-2">
          <p className="text-[#5c5575] text-sm">No resources added yet.</p>
          <p className="text-[#3a3456] text-xs">Add team members in the Schedule tab to see cost breakdown here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0d0b16] p-8 flex flex-col gap-6">

      {/* Missing dates banner */}
      {missingDates && (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-3 flex items-start gap-3">
          <span className="text-amber-400 text-sm mt-0.5">⚠</span>
          <div>
            <p className="text-sm text-amber-300 font-medium">Project dates not set</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Set a start date and target end date in Schedule → Settings to calculate working days and costs.
              Resources without individual roll-on/off dates will use the project dates.
            </p>
          </div>
        </div>
      )}

      {/* Financial Overview */}
      <FinancialOverview
        totalMM={totalMM}
        totalMMExcluded={totalMMExcluded}
        atCost={atCost}
        revenueGBP={revenueGBP}
        profit={profit}
        margin={margin}
        usdRate={usdRate}
        missingRates={missingRates.map((r) => r.name || "Unnamed")}
        onRevenueChange={(gbp) => updateSettings({ revenueGBP: gbp })}
        onUsdRateChange={(v) => updateSettings({ exchangeRates: { ...settings.exchangeRates, USD: v } })}
      />

      {/* FTE section */}
      {fteResources.length > 0 && (
        <ResourceTable
          title="FTE"
          accentColor="#6ee7b7"
          accentBg="rgba(16,185,129,0.10)"
          resources={fteResources}
          projectStart={startDate}
          projectEnd={targetEndDate}
          calendarMode={calendarMode}
          defaultMonthlyRate={defaultMonthlyRate}
          workingDaysPerMonth={workingDaysPerMonth}
          usdRate={usdRate}
          subtotal={fteSub.sum}
          excluded={fteSub.excluded}
        />
      )}

      {/* Contractor section */}
      {contractorResources.length > 0 && (
        <ResourceTable
          title="Contractors"
          accentColor="#a78bfa"
          accentBg="rgba(124,58,237,0.10)"
          resources={contractorResources}
          projectStart={startDate}
          projectEnd={targetEndDate}
          calendarMode={calendarMode}
          defaultMonthlyRate={defaultMonthlyRate}
          workingDaysPerMonth={workingDaysPerMonth}
          usdRate={usdRate}
          subtotal={contractorSub.sum}
          excluded={contractorSub.excluded}
        />
      )}

      {/* Cost Summary */}
      <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
        <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848] flex flex-wrap items-center gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Cost Summary</h2>
            <p className="text-xs text-[#3a3456] mt-0.5">Total project delivery cost including contingency</p>
          </div>

          {/* Contingency toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={contingencyEnabled}
              onChange={(e) => setContingencyEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#7c3aed] cursor-pointer"
            />
            <span className="text-xs text-[#9b93ba]">Contingency</span>
            <input
              type="number" min={0} max={100} step={1}
              className="w-14 border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7c3aed] disabled:opacity-40 tabular-nums"
              value={contingencyDraft}
              disabled={!contingencyEnabled}
              onChange={(e) => setContingencyDraft(e.target.value)}
              onBlur={commitContingency}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
            <span className="text-xs text-[#5c5575]">%</span>
          </label>

          <div className="flex gap-6 text-xs font-semibold uppercase tracking-wide text-[#3a3456]">
            <span className="w-24 text-right">GBP</span>
            <span className="w-24 text-right">USD</span>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-2 bg-[#0d0b16]">
          {fteResources.length > 0 && (
            <SummaryRow label="FTE subtotal" gbp={fteSub.sum} usdRate={usdRate} muted />
          )}
          {contractorResources.length > 0 && (
            <SummaryRow label="Contractor subtotal" gbp={contractorSub.sum} usdRate={usdRate} muted />
          )}
          {fteResources.length > 0 && contractorResources.length > 0 && (
            <>
              <div className="border-t border-[#2e2848] my-1" />
              <SummaryRow label="Total before contingency" gbp={grandTotal} usdRate={usdRate} />
            </>
          )}
          {contingencyEnabled && (
            <SummaryRow label={`Contingency (${contingencyPct}%)`} gbp={contingencyAmount} usdRate={usdRate} muted />
          )}
          <div className="border-t border-[#2e2848] my-1" />
          <SummaryRow label="At Cost" gbp={atCost} usdRate={usdRate} highlight />

          {totalExcluded > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              ⚠ {totalExcluded} member{totalExcluded !== 1 ? "s" : ""} excluded — set project dates or individual roll-on/off dates.
            </p>
          )}
          {!missingDates && grandTotal === 0 && missingRates.length > 0 && (
            <p className="text-xs text-[#5c5575] mt-1">
              All team members have no monthly rate set. Add rates in the Schedule tab or set a default monthly rate in Settings.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Financial Overview ───────────────────────────────────────────────────────

function FinancialOverview({
  totalMM, totalMMExcluded, atCost, revenueGBP, profit, margin,
  usdRate, missingRates, onRevenueChange, onUsdRateChange,
}: {
  totalMM: number; totalMMExcluded: number; atCost: number;
  revenueGBP: number; profit: number | null; margin: number | null;
  usdRate: number; missingRates: string[];
  onRevenueChange: (gbp: number) => void;
  onUsdRateChange: (v: number) => void;
}) {
  const [revDraft,  setRevDraft]  = useState(revenueGBP > 0 ? String(Math.round(revenueGBP * usdRate)) : "");
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

  return (
    <div className="rounded-2xl border border-[#2e2848] overflow-hidden">
      <div className="px-6 py-4 bg-[#14112a] border-b border-[#2e2848]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#9b93ba]">Financial Overview</h2>
      </div>

      {missingRates.length > 0 && (
        <div className="px-6 py-2.5 flex items-center gap-2 bg-amber-950/30 border-b border-amber-900/40">
          <span className="text-amber-400 text-xs">⚠</span>
          <span className="text-xs text-amber-400">
            No rate set for: {missingRates.join(", ")} — counted as £0.
          </span>
        </div>
      )}

      {/* Stats — wrap naturally on narrow screens */}
      <div className="px-6 py-5 bg-[#0d0b16]">
        <div className="flex flex-wrap gap-6">

          <OverviewStat label="Total MM" sublabel="Man-months of work">
            <span className="text-2xl font-bold text-[#9b93ba] tabular-nums leading-tight">
              {totalMM.toFixed(1)}<span className="text-base font-normal text-[#5c5575] ml-1">MM</span>
            </span>
            {totalMMExcluded > 0 && <span className="text-xs text-amber-400">+{totalMMExcluded} excluded</span>}
          </OverviewStat>

          <OverviewStat label="At Cost" sublabel="Total delivery cost">
            <Dual gbp={atCost} usdRate={usdRate} color="#a78bfa" size="lg" />
          </OverviewStat>

          <OverviewStat label="Revenue" sublabel="Client contract (USD)">
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm text-[#5c5575]">$</span>
              <input
                type="number" min={0} step={1000} placeholder="0"
                className="flex-1 min-w-0 text-2xl font-bold bg-transparent border-b border-[#2e2848] focus:border-[#7c3aed] text-[#ece7ff] outline-none pb-0.5 tabular-nums placeholder:text-[#3a3456] w-full"
                value={revDraft}
                onChange={(e) => setRevDraft(e.target.value)}
                onBlur={commitRevenue}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
            </div>
            {revenueGBP > 0 && (
              <span className="text-xs text-[#5c5575] tabular-nums">≈ {fmtGBP(revenueGBP)}</span>
            )}
          </OverviewStat>

          <OverviewStat label="Profit" sublabel="Revenue − At Cost">
            {profit !== null
              ? <Dual gbp={profit} usdRate={usdRate} color={profitColor} size="lg" />
              : <span className="text-2xl font-bold text-[#3a3456] leading-tight">—</span>}
          </OverviewStat>

          <OverviewStat label="Margin" sublabel="Profit ÷ Revenue">
            <span className="text-2xl font-bold tabular-nums leading-tight" style={{ color: marginColor }}>
              {margin !== null ? `${Math.round(margin)}%` : "—"}
            </span>
          </OverviewStat>

        </div>
      </div>

      {/* Exchange rate */}
      <div className="px-6 py-3 bg-[#0d0b16] border-t border-[#2e2848] flex flex-wrap items-center gap-3">
        <span className="text-xs text-[#5c5575]">Exchange rate:</span>
        <span className="text-xs text-[#9b93ba]">1 GBP =</span>
        <input
          type="number" min={0.01} step={0.01}
          className="border border-[#2e2848] bg-[#1a1628] text-[#ece7ff] rounded px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
          value={rateDraft}
          onChange={(e) => setRateDraft(e.target.value)}
          onBlur={commitRate}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        <span className="text-xs text-[#5c5575]">USD</span>
        <span className="text-xs text-[#3a3456]">— costs stored in GBP; USD shown for reference</span>
      </div>
    </div>
  );
}

function OverviewStat({ label, sublabel, children }: { label: string; sublabel: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#5c5575]">{label}</span>
      <span className="text-xs text-[#3a3456]">{sublabel}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ─── Resource table ───────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, string> = {
  Art: "#f59e0b", Design: "#a78bfa", Code: "#38bdf8", Production: "#34d399", Custom: "#9ca3af",
};

function ResourceTable({
  title, accentColor, accentBg, resources, projectStart, projectEnd,
  calendarMode, defaultMonthlyRate, workingDaysPerMonth, usdRate, subtotal, excluded,
}: {
  title: string; accentColor: string; accentBg: string;
  resources: Resource[]; projectStart: string; projectEnd: string;
  calendarMode: "four-week" | "actual"; defaultMonthlyRate: number;
  workingDaysPerMonth: number; usdRate: number; subtotal: number; excluded: number;
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
              <Th>Rate / month</Th>
              <Th>Dates</Th>
              <Th align="right">Working days</Th>
              <Th align="right">Total cost</Th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => {
              const days    = resourceWorkingDays(r, projectStart, projectEnd, calendarMode);
              const costGbp = resourceCost(r, days, defaultMonthlyRate, workingDaysPerMonth);
              const rate    = effectiveRate(r, defaultMonthlyRate);
              const isDefaultRate = resourceTypeSafe(r) === "FTE" && !r.monthlyRate;
              const alloc   = r.allocationPct ?? 100;

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
                  <td className="px-4 py-3 text-[#9b93ba] text-xs whitespace-nowrap">
                    {formatDateRange(r.rollOnDate, r.rollOffDate) ?? <span className="text-[#3a3456] italic">Using project dates</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right text-[#9b93ba]">
                    {days !== null ? days.toLocaleString() : <span className="text-[#3a3456]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {costGbp !== null && costGbp > 0
                      ? <Dual gbp={costGbp} usdRate={usdRate} color={accentColor} />
                      : costGbp === 0 && rate === 0
                        ? <span className="text-[#3a3456] text-sm">No rate</span>
                        : costGbp === 0
                          ? <Dual gbp={0} usdRate={usdRate} color="#3a3456" />
                          : <span className="text-[#3a3456] text-sm">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2e2848]" style={{ background: accentBg }}>
              <td colSpan={6} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                Subtotal
                {excluded > 0 && <span className="ml-2 font-normal opacity-60 normal-case">({excluded} member{excluded !== 1 ? "s" : ""} excluded — no dates)</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <Dual gbp={subtotal} usdRate={usdRate} color={accentColor} size="lg" />
              </td>
            </tr>
          </tfoot>
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
  label: string; gbp: number; usdRate: number; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${highlight ? "py-1" : ""}`}>
      <span className={`text-sm ${muted ? "text-[#5c5575]" : highlight ? "font-bold text-[#ece7ff]" : "text-[#9b93ba]"}`}>
        {label}
      </span>
      <div className="flex gap-6">
        <span className={`tabular-nums text-sm w-24 text-right ${highlight ? "font-bold text-[#a78bfa]" : muted ? "text-[#5c5575]" : "font-medium text-[#ece7ff]"}`}>
          {fmtGBP(gbp)}
        </span>
        <span className={`tabular-nums text-sm w-24 text-right ${muted ? "text-[#3a3456]" : "text-[#5c5575]"}`}>
          {fmtUSD(gbp, usdRate)}
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
