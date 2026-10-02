// 参考の暦日付。固定の平年（365 日）で t = 0 を 3/20 0:00 とし、UTC 固定で整形する（§3.3）。
const BASE_UTC = Date.UTC(2026, 2, 20); // 2026・2027 はどちらも平年
const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;

function dayIndex(t: number): number {
  return ((Math.floor(t) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
}

/** t（春分からの日数）が属する日の月・日。365 日で循環させる */
export function calendarDate(t: number): { month: number; day: number } {
  const d = new Date(BASE_UTC + dayIndex(t) * DAY_MS);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 「6月21日」「Jun 21」のような短い暦日付 */
export function calendarLabel(t: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(BASE_UTC + dayIndex(t) * DAY_MS));
}
