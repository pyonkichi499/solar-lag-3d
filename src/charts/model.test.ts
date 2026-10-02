import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../presets";
import { yearResultFor } from "../store/derived";
import {
  buildChartModel,
  dayTicks,
  formatClock,
  type Margin,
  timeTicks,
  xScaleOf,
  yScaleOf,
} from "./model";

const allShown = {
  latestSunset: true,
  earliestSunrise: true,
  earliestSunset: true,
  latestSunrise: true,
};
const earth = { ...DEFAULT_PARAMS };
function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("undefined");
  return v;
}
const margin: Margin = { l: 50, r: 10, t: 10, b: 30 };

describe("formatClock", () => {
  it("24 時を超える値を連続値のまま表示する", () => {
    expect(formatClock(25 + 10 / 60)).toBe("25:10");
    expect(formatClock(6.5)).toBe("6:30");
    expect(formatClock(5.9999)).toBe("6:00");
  });
});

describe("ticks", () => {
  it("時刻の目盛りは 8 本以内", () => {
    expect(timeTicks([4, 20])).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(timeTicks([0, 30]).length).toBeLessThanOrEqual(9);
  });
  it("日数の目盛りは 30 日刻み", () => {
    expect(dayTicks([-182, 182])).toEqual([
      -180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180,
    ]);
  });
});

describe("buildChartModel", () => {
  const m = buildChartModel([yearResultFor(earth)], [earth], {
    show: allShown,
  });

  it("横軸は ±yearDays/2、スケールは端点に写る", () => {
    expect(m.xDomain[0]).toBeCloseTo(-182.6211);
    const x = xScaleOf(m, 500, margin);
    expect(x(m.xDomain[0])).toBe(50);
    expect(x(m.xDomain[1])).toBe(490);
  });

  it("縦軸の範囲は全曲線を含む", () => {
    const [lo, hi] = m.domains.time;
    for (const seg of [...must(m.sets[0]).sunrise, ...must(m.sets[0]).sunset])
      for (const [, y] of seg) {
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
    const y = yScaleOf(m.domains.time, 300, margin);
    expect(y(lo)).toBe(270);
    expect(y(hi)).toBe(10);
  });

  it("地球の均時差は分単位で、最大でも約 17 分", () => {
    expect(m.domains.eot.unit).toBe("min");
    const max = Math.max(...must(m.sets[0]).eot.map(([, v]) => Math.abs(v)));
    expect(max).toBeGreaterThan(14);
    expect(max).toBeLessThan(17);
  });

  it("4 種類のマーカーが出て、夏至は x = 0", () => {
    const s = must(m.sets[0]);
    expect(s.markers.map((k) => k.kind).sort()).toEqual(
      Object.keys(allShown).sort(),
    );
    const ls = must(s.markers.find((k) => k.kind === "latestSunset"));
    expect(ls.style).toBe("peak");
    expect(ls.x).toBeGreaterThan(0);
    expect(Math.abs(s.winterX)).toBeGreaterThan(150);
  });

  it("show で外した種類はマーカーに出ない", () => {
    const m2 = buildChartModel([yearResultFor(earth)], [earth], {
      show: { ...allShown, latestSunset: false },
    });
    expect(
      must(m2.sets[0]).markers.some((k) => k.kind === "latestSunset"),
    ).toBe(false);
  });

  it("縦軸固定では渡した範囲をそのまま使う", () => {
    const locked = buildChartModel([yearResultFor(earth)], [earth], {
      show: allShown,
      locked: { time: [0, 24], eot: { domain: [-1, 1], unit: "h" } },
    });
    expect(locked.domains.time).toEqual([0, 24]);
    expect(locked.domains.eot.unit).toBe("h");
  });

  it("ε = 0 は形式上の至点として印を付け、マーカーはなし", () => {
    const p = { ...earth, epsilon: 0 };
    const m0 = buildChartModel([yearResultFor(p)], [p], { show: allShown });
    expect(must(m0.sets[0]).formalSolstice).toBe(true);
    expect(must(m0.sets[0]).markers).toEqual([]);
  });

  it("白夜・極夜は曲線を途切れさせ帯にする", () => {
    const p = { ...earth, phi: 70 };
    const mp = buildChartModel([yearResultFor(p)], [p], { show: allShown });
    const s = must(mp.sets[0]);
    // 極夜は範囲の両端に分かれて 2 本になりうる
    expect(new Set(s.bands.map((b) => b.kind))).toEqual(
      new Set(["polarDay", "polarNight"]),
    );
    // 日没の曲線は帯の外側にだけ存在する
    const day = must(s.bands.find((b) => b.kind === "polarDay"));
    for (const seg of s.sunset)
      for (const [x] of seg) expect(x < day.x0 || x >= day.x1).toBe(true);
    expect(s.sunset.length).toBeGreaterThan(1);
    // 南中は途切れない
    expect(s.transit.length).toBe(1);
  });

  it("A/B で均時差の範囲は共通", () => {
    const b = { ...earth, e: 0, epsilon: 60 };
    const mm = buildChartModel(
      [yearResultFor(earth), yearResultFor(b)],
      [earth, b],
      { show: allShown },
    );
    expect(mm.sets.length).toBe(2);
    for (const s of mm.sets)
      for (const [, v] of s.eot) {
        expect(v).toBeGreaterThanOrEqual(mm.domains.eot.domain[0]);
        expect(v).toBeLessThanOrEqual(mm.domains.eot.domain[1]);
      }
  });
});
