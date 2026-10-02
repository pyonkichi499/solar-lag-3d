import { describe, expect, it } from "vitest";
import { calendarDate, calendarLabel } from "./calendar";

describe("calendar", () => {
  it("t = 0 は 3/20", () => {
    expect(calendarDate(0)).toEqual({ month: 3, day: 20 });
    expect(calendarDate(0.9)).toEqual({ month: 3, day: 20 });
  });
  it("夏至（約 t = 93）は 6/21 ごろ", () => {
    expect(calendarDate(93.4)).toEqual({ month: 6, day: 21 });
  });
  it("負の t と 1 年以上先は循環する", () => {
    expect(calendarDate(-1)).toEqual({ month: 3, day: 19 });
    expect(calendarDate(365)).toEqual({ month: 3, day: 20 });
    expect(calendarDate(365 + 93)).toEqual({ month: 6, day: 21 });
  });
  it("2/29 は現れない", () => {
    for (let t = 0; t < 365; t++) {
      const d = calendarDate(t);
      expect(d.month === 2 && d.day === 29).toBe(false);
    }
  });
  it("整形はロケールに従う", () => {
    expect(calendarLabel(93, "en")).toBe("Jun 21");
    expect(calendarLabel(93, "ja")).toBe("6月21日");
  });
});
