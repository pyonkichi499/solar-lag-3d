import { describe, expect, it } from "vitest";
import {
  computeYear,
  dayEvents,
  EARTH,
  sceneState,
  sunAt,
  timeOfLongitude,
} from "./index";
import { solveKepler } from "./orbit";
import type { Params } from "./types";

const earth: Params = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35.68,
  h0: -0.833,
};

describe("solveKepler", () => {
  it("残差が十分小さい", () => {
    for (const e of [0, 0.0167, 0.3, 0.5]) {
      for (let m = -10; m <= 10; m += 0.37) {
        const ea = solveKepler(m, e);
        expect(Math.abs(ea - e * Math.sin(ea) - m)).toBeLessThan(1e-10);
      }
    }
  });
});

describe("sunAt / timeOfLongitude", () => {
  it("t = 0 で黄経 0°", () => {
    const s = sunAt(earth, EARTH, 0);
    const d = ((s.lambda + 180) % 360) - 180;
    expect(Math.abs(d)).toBeLessThan(1e-9);
  });

  it("timeOfLongitude と sunAt が往復で一致する", () => {
    for (const lam of [0, 45, 90, 180, 270, 359]) {
      for (const p of [earth, { ...earth, e: 0.5, varpi: 100 }]) {
        const t = timeOfLongitude(p, EARTH, lam);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(EARTH.yearDays);
        const d = ((sunAt(p, EARTH, t).lambda - lam + 540) % 360) - 180;
        expect(Math.abs(d)).toBeLessThan(1e-7);
      }
    }
  });

  it("近日点で距離最小、近日点通過時の黄経が ϖ", () => {
    const t = timeOfLongitude(earth, EARTH, 283);
    expect(sunAt(earth, EARTH, t).distance).toBeCloseTo(1 - earth.e, 9);
  });

  it("ε = 0, e = 0 で均時差 0", () => {
    const p = { ...earth, epsilon: 0, e: 0 };
    for (let t = 0; t < 366; t += 7)
      expect(Math.abs(sunAt(p, EARTH, t).equationOfTime)).toBeLessThan(1e-9);
  });

  it("均時差は連続（年をまたいでも跳ばない）", () => {
    let prev = sunAt(earth, EARTH, -400).equationOfTime;
    for (let t = -399; t < 800; t++) {
      const cur = sunAt(earth, EARTH, t).equationOfTime;
      expect(Math.abs(cur - prev)).toBeLessThan(0.1);
      prev = cur;
    }
  });
});

describe("dayEvents", () => {
  it("春分の頃は昼がほぼ 12 時間、日没が日の出より後", () => {
    const d = dayEvents({ ...earth, h0: 0 }, EARTH, 0);
    if (d.sunrise.kind !== "event" || d.sunset.kind !== "event")
      throw new Error();
    expect(d.dayLength).toBeGreaterThan(11.9);
    expect(d.dayLength).toBeLessThan(12.3);
    expect(d.sunset.hours).toBeGreaterThan(d.sunrise.hours);
  });

  it("高緯度の夏至で白夜、冬至で極夜", () => {
    const p = { ...earth, phi: 80 };
    const ts = timeOfLongitude(p, EARTH, 90);
    const tw = timeOfLongitude(p, EARTH, 270);
    expect(dayEvents(p, EARTH, Math.round(ts)).sunset.kind).toBe("polarDay");
    expect(dayEvents(p, EARTH, Math.round(ts)).dayLength).toBe(24);
    expect(dayEvents(p, EARTH, Math.round(tw)).sunrise.kind).toBe("polarNight");
    expect(dayEvents(p, EARTH, Math.round(tw)).dayLength).toBe(0);
  });

  it("日没の瞬間の高度が h₀", () => {
    const d = dayEvents(earth, EARTH, 100);
    if (d.sunset.kind !== "event") throw new Error();
    const s = sunAt(earth, EARTH, d.sunset.t);
    const phi = (earth.phi * Math.PI) / 180;
    const dec = (s.declination * Math.PI) / 180;
    const ha = ((d.sunset.hours - 12 + s.equationOfTime) * 15 * Math.PI) / 180;
    const alt = Math.asin(
      Math.sin(phi) * Math.sin(dec) +
        Math.cos(phi) * Math.cos(dec) * Math.cos(ha),
    );
    expect((alt * 180) / Math.PI).toBeCloseTo(earth.h0, 6);
  });
});

describe("computeYear", () => {
  it("地球・東京: 日没最遅日は夏至の後、日の出最早日は前", () => {
    const r = computeYear(earth, EARTH);
    const ls = r.lags.latestSunset;
    const es = r.lags.earliestSunrise;
    if (ls.kind !== "peak" || es.kind !== "peak")
      throw new Error("peak expected");
    expect(ls.lagDays).toBeGreaterThan(0);
    expect(ls.lagDays).toBeLessThan(15);
    expect(es.lagDays).toBeLessThan(0);
    expect(r.hemisphere).toBe("north");
    expect(r.dayLength?.max).toBeGreaterThanOrEqual(
      r.dayLength?.atSolstice ?? Number.POSITIVE_INFINITY,
    );
  });

  it("既定の範囲と指定範囲", () => {
    const r = computeYear(earth, EARTH);
    expect(r.days[0]?.daysFromSolstice).toBeGreaterThanOrEqual(
      -EARTH.yearDays / 2 - 20,
    );
    expect(r.days[0]?.daysFromSolstice).toBeLessThan(-EARTH.yearDays / 2 - 19);
    const r2 = computeYear(earth, EARTH, { from: -3, to: 3 });
    expect(r2.days.length).toBeGreaterThanOrEqual(6);
    expect(r2.days.length).toBeLessThanOrEqual(7);
  });

  it("ε = 0 はすべて noSolstice、dayLength は null", () => {
    const r = computeYear({ ...earth, epsilon: 0 }, EARTH);
    for (const k of Object.values(r.lags))
      expect(k).toEqual({ kind: "undefined", reason: "noSolstice" });
    expect(r.dayLength).toBeNull();
  });

  it("南半球では夏至が λ = 270°", () => {
    const r = computeYear({ ...earth, phi: -35.68 }, EARTH, {
      from: -1,
      to: 1,
    });
    expect(r.hemisphere).toBe("south");
    expect(r.summerSolstice).toBeCloseTo(
      timeOfLongitude({ ...earth, phi: -35.68 }, EARTH, 270),
      9,
    );
  });

  it("北半球と南半球で対称に近い（e = 0）", () => {
    const p = { ...earth, e: 0 };
    const n = computeYear(p, EARTH, { from: 0, to: 0 }).lags.latestSunset;
    const s = computeYear({ ...p, phi: -p.phi }, EARTH, { from: 0, to: 0 }).lags
      .latestSunset;
    if (n.kind !== "peak" || s.kind !== "peak") throw new Error();
    expect(s.lagDays).toBeCloseTo(n.lagDays, 4);
  });

  it("極端な傾きで白夜境界が出る", () => {
    const r = computeYear({ ...earth, epsilon: 60, phi: 45 }, EARTH, {
      from: 0,
      to: 0,
    });
    const kinds = Object.values(r.lags).map((l) => l.kind);
    expect(kinds).toContain("polarBoundary");
  });
});

describe("sceneState", () => {
  it("6 月至点で北極が太陽側に傾く", () => {
    const t = timeOfLongitude(earth, EARTH, 90);
    const s = sceneState(earth, EARTH, t);
    const [px, py, pz] = s.planetPosition;
    const [ax, ay, az] = s.axisDirection;
    const dot = -px * ax - py * ay - pz * az;
    const r = Math.hypot(px, py, pz);
    expect(dot / r).toBeCloseTo(Math.sin((earth.epsilon * Math.PI) / 180), 9);
    expect(Math.hypot(...s.axisDirection)).toBeCloseTo(1, 12);
  });

  it("近日点で惑星が近日点方向にある", () => {
    const t = timeOfLongitude(earth, EARTH, 283);
    const s = sceneState(earth, EARTH, t);
    const r = Math.hypot(...s.planetPosition);
    s.planetPosition.forEach((x, i) => {
      expect(x / r).toBeCloseTo(s.perihelionDirection[i] ?? Number.NaN, 9);
    });
  });

  it("localMeanTime は 0〜24", () => {
    expect(sceneState(earth, EARTH, 10.25).localMeanTime).toBeCloseTo(6, 9);
    expect(sceneState(earth, EARTH, -0.25).localMeanTime).toBeCloseTo(18, 9);
  });
});
