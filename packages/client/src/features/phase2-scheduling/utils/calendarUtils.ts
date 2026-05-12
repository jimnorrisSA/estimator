export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function buildWorkingDayCalendar(startDate: Date, n: number): Date[] {
  if (n <= 0) return [];
  const result: Date[] = [];
  const d = new Date(startDate);
  result.push(new Date(d));
  while (result.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) result.push(new Date(d));
  }
  return result;
}

export function dateToWorkingDay(
  dateStr: string,
  calendarMode: string,
  startDate: string,
  cal: Date[]
): number {
  const date = parseISODate(dateStr);
  if (calendarMode === "actual" && cal.length > 0) {
    const idx = cal.findIndex((d) => d >= date);
    return idx >= 0 ? idx : cal.length;
  }
  const start = parseISODate(startDate);
  const calDays = Math.round((date.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.round((calDays * 5) / 7));
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
