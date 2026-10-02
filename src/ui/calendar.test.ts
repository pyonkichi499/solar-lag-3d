import { describe, expect, it } from "vitest";
import { calendarDate, formatCalendarDate } from "./calendar";

describe("calendarDate", () => {
  it("t = 0 は 3/20", () => {
    expect(calendarDate(0)).toEqual({ month: 3, day: 20 });
  });
  it("t = 93.x は夏至の頃の 6/21", () => {
    expect(calendarDate(93.4)).toEqual({ month: 6, day: 21 });
  });
  it("負の t は前日に遡る", () => {
    expect(calendarDate(-0.5)).toEqual({ month: 3, day: 19 });
    expect(calendarDate(-1)).toEqual({ month: 3, day: 19 });
  });
  it("1 年（365 日）で折り返し、うるう日は現れない", () => {
    expect(calendarDate(365)).toEqual({ month: 3, day: 20 });
    expect(calendarDate(-80)).toEqual(calendarDate(285));
    for (let t = -800; t < 800; t++) {
      const { month, day } = calendarDate(t);
      expect(month === 2 && day === 29).toBe(false);
    }
  });
  it("冬至の頃は 12/21", () => {
    expect(calendarDate(276)).toEqual({ month: 12, day: 21 });
  });
});

describe("formatCalendarDate", () => {
  it("ja と en で整形する", () => {
    expect(formatCalendarDate(93, "ja-JP")).toBe("6月21日");
    expect(formatCalendarDate(93, "en-US")).toBe("June 21");
  });
});
