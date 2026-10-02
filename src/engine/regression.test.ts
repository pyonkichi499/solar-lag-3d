// 白夜・極夜の近くで存在しない日没・日の出を返す不具合（#2）の回帰テスト。
import { describe, expect, test } from "vitest";
import type { Params, RiseSetEvent } from "./index";
import { computeYear, dayEvents, EARTH, sunAt } from "./index";

const DEG = Math.PI / 180;

const base: Params = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35.68,
  h0: -0.833,
};

/** 瞬間 t・日 n での太陽中心の高度 [deg]。エンジンとは独立に、時角から計算する */
function altitude(p: Params, n: number, t: number): number {
  const sun = sunAt(p, EARTH, t);
  const ha = 15 * (24 * (t - n) + sun.equationOfTime - 12) * DEG;
  const phi = p.phi * DEG;
  const dec = sun.declination * DEG;
  const s =
    Math.sin(phi) * Math.sin(dec) +
    Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

const cases: Params[] = [
  { ...base, epsilon: 60, phi: 45 },
  { ...base, epsilon: 60, phi: 35.68 },
  { ...base, epsilon: 60, phi: 30 },
  { ...base, phi: 66 },
  { ...base, epsilon: 77.46, e: 0.0497, varpi: 160.04, phi: -54.62, h0: 0.583 },
  { ...base, epsilon: 85, phi: 20 },
];

describe("日没・日の出の高度は h₀ に一致する", () => {
  test.each(cases)("%o", (p) => {
    let events = 0;
    for (let n = -183; n <= 183; n += 0.5) {
      const day = Math.round(n * 2) / 2;
      const row = dayEvents(p, EARTH, Math.floor(day));
      for (const ev of [row.sunrise, row.sunset] as RiseSetEvent[]) {
        if (ev.kind !== "event") continue;
        events++;
        const dayN = Math.floor(ev.t - ev.hours / 24 + 1e-9);
        // 日の番号は t − hours/24 に一致する整数
        expect(
          Math.abs(altitude(p, Math.round(dayN), ev.t) - p.h0),
        ).toBeLessThan(1e-6);
      }
    }
    expect(events).toBeGreaterThan(0);
  });
});

describe("緯度 ±89.9° の高緯度でも窓を見落とさない（南北で同じ種類の結果）", () => {
  test("4 種類とも noEvents にならない", () => {
    for (const phi of [89.9, -89.9]) {
      const y = computeYear({ ...base, phi }, EARTH);
      for (const lag of Object.values(y.lags)) {
        expect(lag.kind).not.toBe("undefined");
      }
    }
  });
});

describe("極端な傾き（ε=60°）のズレ", () => {
  test("東京では夏至側が polarBoundary になり、境界の瞬間で高度が h₀ に一致する", () => {
    const p = { ...base, epsilon: 60 };
    const y = computeYear(p, EARTH);
    const lag = y.lags.latestSunset;
    expect(lag.kind).toBe("polarBoundary");
    if (lag.kind !== "polarBoundary") return;
    // 実数の日 n を動かして、日没が存在する最後の n を二分法で探す。
    // その日没の瞬間が境界の瞬間に一致し、高度は h₀ に等しい
    let lo = Math.floor(lag.t) - 3;
    let hi = Math.floor(lag.t) + 1;
    expect(dayEvents(p, EARTH, lo).sunset.kind).toBe("event");
    expect(dayEvents(p, EARTH, hi).sunset.kind).toBe("polarDay");
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (dayEvents(p, EARTH, mid).sunset.kind === "event") lo = mid;
      else hi = mid;
    }
    const ev = dayEvents(p, EARTH, lo).sunset;
    if (ev.kind !== "event") throw new Error("unreachable");
    expect(Math.abs(ev.t - lag.t)).toBeLessThan(1e-6);
    expect(Math.abs(altitude(p, lo, ev.t) - p.h0)).toBeLessThan(1e-6);
  });
});

// 総当たり（0.02 日刻み）との比較。エンジンが返した極値が、その前後の局所的な最大・最小になっていること
describe("総当たりの走査との比較（日没最遅日）", () => {
  const params: Params[] = [
    base,
    {
      ...base,
      epsilon: 77.46,
      e: 0.0497,
      varpi: 160.04,
      phi: -54.62,
      h0: 0.583,
    },
    { ...base, epsilon: 60, phi: 45 },
    { ...base, e: 0.4, varpi: 100 },
    { ...base, phi: 0 },
  ];
  test.each(params)("%o", (p) => {
    const y = computeYear(p, EARTH);
    const lag = y.lags.latestSunset;
    if (lag.kind === "undefined") return;
    // 極値の瞬間から ±3 日の範囲で、日没の瞬間の連続値（時計の時刻）が最大のものを探す
    const around = lag.t;
    let best = Number.NEGATIVE_INFINITY;
    let bestT = Number.NaN;
    for (let n = around - 4; n <= around + 1; n += 0.02) {
      const ev = dayEvents(p, EARTH, n).sunset;
      if (ev.kind !== "event") continue;
      // hours は実数の日 n の 0 時からの時刻。エンジンの極値探索と同じ連続曲線
      if (ev.hours > best) {
        best = ev.hours;
        bestT = ev.t;
      }
    }
    expect(Math.abs(bestT - lag.t)).toBeLessThan(0.05);
  });
});

describe("極端なパラメータでも反復が収束する", () => {
  const extremes: Params[] = [
    { epsilon: 89.9, e: 0.5, varpi: 0, phi: 45, h0: -0.833 },
    { epsilon: 89.9, e: 0.5, varpi: 180, phi: -45, h0: 2 },
    { epsilon: 89.9, e: 0.5, varpi: 283, phi: 0, h0: -2 },
    { epsilon: 0.01, e: 0.5, varpi: 90, phi: 89.9, h0: 0 },
  ];
  test.each(extremes)("%o", (p) => {
    const y = computeYear(p, EARTH);
    for (const d of y.days) {
      expect(Number.isFinite(d.transit)).toBe(true);
      // 南中の不動点 t = n + (12 − E(t))/24 を満たす
      const t = d.day + d.transit / 24;
      expect(
        Math.abs(d.day + (12 - sunAt(p, EARTH, t).equationOfTime) / 24 - t),
      ).toBeLessThan(1e-9);
      for (const ev of [d.sunrise, d.sunset]) {
        if (ev.kind === "event") expect(Number.isFinite(ev.hours)).toBe(true);
      }
    }
  });
});

describe("昼の長さの最大は連続値で求める", () => {
  test("整数日の最大以上で、その差は 1 秒未満程度の小ささ", () => {
    const y = computeYear(base, EARTH);
    const integerMax = Math.max(...y.days.map((d) => d.dayLength));
    expect(y.dayLength).not.toBeNull();
    expect((y.dayLength?.max ?? 0) - integerMax).toBeGreaterThanOrEqual(-1e-9);
    expect((y.dayLength?.max ?? 0) - integerMax).toBeLessThan(1 / 3600);
  });
});
