// 参考の暦日付（§3.3）。t = 0 を平年の 3/20 0:00（UTC 固定）とみなす
const BASE_YEAR = 2025; // 平年
const DAYS_PER_YEAR = 365;

/** t を「3/20 を起点とした平年の何日目か」(0〜364) にそろえる */
export function dayOfCalendar(t: number): number {
  const n = Math.floor(t);
  return ((n % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
}

function dateOf(t: number): Date {
  return new Date(Date.UTC(BASE_YEAR, 2, 20 + dayOfCalendar(t)));
}

/** t に対応する月日。1 年を超える・負の t は 365 日で折り返す */
export function calendarDate(t: number): { month: number; day: number } {
  const d = dateOf(t);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 「6月21日」「June 21」のような月日。タイムゾーンに依存しない */
export function formatCalendarDate(t: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOf(t));
}
