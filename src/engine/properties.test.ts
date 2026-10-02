// 計算エンジンの性質ベースのテスト。公開 API（./index）だけを通して検証する。
// 期待値は docs/requirements.md §3 の定義から独立に導く。
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type BodyConstants,
  computeYear,
  dayEvents,
  EARTH,
  type Params,
  type RiseSetEvent,
  sceneState,
  sunAt,
  timeOfLongitude,
} from "./index";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const SEC = 1 / 3600; // 1 秒 [h]

/** 角度を (−180, 180] に畳む */
const wrap180 = (x: number): number => {
  const r = ((((x + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
};
/** 周期 360 での差の絶対値 */
const circDiff = (a: number, b: number): number => Math.abs(wrap180(a - b));
/** 周期 period での差の絶対値 */
const periodicDiff = (a: number, b: number, period: number): number => {
  const d = (((a - b) % period) + period) % period;
  return Math.min(d, period - d);
};

const dbl = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

// 生成範囲は §3.1 の内側。φ は ±89.9 の厳密に内側に限る（§9.2）
const paramsArb: fc.Arbitrary<Params> = fc.record({
  epsilon: dbl(0, 89.9),
  e: dbl(0, 0.5),
  varpi: dbl(0, 360),
  phi: dbl(-89.89, 89.89),
  h0: dbl(-2, 2),
});

// 極域に近づかず日の出・日没の反復が素直に収束する範囲
const mildParamsArb: fc.Arbitrary<Params> = fc.record({
  epsilon: dbl(0, 30),
  e: dbl(0, 0.3),
  varpi: dbl(0, 360),
  phi: dbl(-55, 55),
  h0: dbl(-2, 2),
});

// 地球に近いパラメータ（ズレが滑らかな peak になる範囲）
const earthLikeArb: fc.Arbitrary<Params> = fc.record({
  epsilon: dbl(20, 40),
  e: dbl(0.01, 0.1),
  varpi: dbl(0, 360),
  phi: dbl(20, 50),
  h0: dbl(-1.5, 0),
});

const tArb = dbl(-800, 800);
const TOKYO: Params = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35.68,
  h0: -0.833,
};

const eventHours = (ev: RiseSetEvent): number | null =>
  ev.kind === "event" ? ev.hours : null;

/** オブジェクト中の数値がすべて有限であること */
const assertFiniteDeep = (v: unknown, path = "$"): void => {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`non-finite at ${path}: ${v}`);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => {
      assertFiniteDeep(x, `${path}[${i}]`);
    });
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) assertFiniteDeep(x, `${path}.${k}`);
  }
};

describe("sunAt", () => {
  it("t = 0 で太陽黄経 λ = 0（赤緯・赤経も 0）", () => {
    fc.assert(
      fc.property(paramsArb, (p) => {
        const s = sunAt(p, EARTH, 0);
        // 角度の許容 1e-7°: Newton 法の収束 1e-12 rad に対して十分な余裕
        expect(circDiff(s.lambda, 0)).toBeLessThan(1e-7);
        expect(Math.abs(s.declination)).toBeLessThan(1e-7);
        expect(circDiff(s.rightAscension, 0)).toBeLessThan(1e-7);
      }),
      { numRuns: 100 },
    );
  });

  it("平均近点角は 360 / yearDays [deg/日] で進む", () => {
    fc.assert(
      fc.property(paramsArb, tArb, dbl(0, 400), (p, t, dt) => {
        const a = sunAt(p, EARTH, t).meanAnomaly;
        const b = sunAt(p, EARTH, t + dt).meanAnomaly;
        const expected = (360 * dt) / EARTH.yearDays;
        // 周期 360 での比較。1e-6° は浮動小数の丸めと mod の誤差に対する余裕
        expect(circDiff(b - a, expected)).toBeLessThan(1e-6);
      }),
      { numRuns: 100 },
    );
  });

  it("別の天体定数（1 年の長さ）でも平均運動は 360 / yearDays", () => {
    const body: BodyConstants = { yearDays: 500, siderealDayRatio: 500 / 501 };
    fc.assert(
      fc.property(paramsArb, dbl(0, 500), (p, dt) => {
        const a = sunAt(p, body, 0).meanAnomaly;
        const b = sunAt(p, body, dt).meanAnomaly;
        expect(circDiff(b - a, (360 * dt) / 500)).toBeLessThan(1e-6);
      }),
      { numRuns: 50 },
    );
  });

  it("ケプラー方程式と距離: M = E − e sin E, r = 1 − e cos E = (1−e²)/(1+e cos ν)", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const s = sunAt(p, EARTH, t);
        const nu = s.trueAnomaly * RAD;
        // 真近点角から離心近点角を独立に復元する
        const ecc =
          2 *
          Math.atan2(
            Math.sqrt(1 - p.e) * Math.sin(nu / 2),
            Math.sqrt(1 + p.e) * Math.cos(nu / 2),
          );
        const m = (ecc - p.e * Math.sin(ecc)) * DEG;
        // 1e-6°: Newton 法の収束判定 1e-12 rad を度に直しても十分に小さい
        expect(circDiff(s.meanAnomaly, m)).toBeLessThan(1e-6);
        expect(Math.abs(s.distance - (1 - p.e * Math.cos(ecc)))).toBeLessThan(
          1e-9,
        );
        expect(
          Math.abs(s.distance - (1 - p.e * p.e) / (1 + p.e * Math.cos(nu))),
        ).toBeLessThan(1e-9);
        // λ = ν + ϖ
        expect(circDiff(s.lambda, s.trueAnomaly + p.varpi)).toBeLessThan(1e-9);
      }),
      { numRuns: 100 },
    );
  });

  it("距離は 1−e 以上 1+e 以下。e = 0 なら常に 1", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const d = sunAt(p, EARTH, t).distance;
        expect(d).toBeGreaterThanOrEqual(1 - p.e - 1e-12);
        expect(d).toBeLessThanOrEqual(1 + p.e + 1e-12);
        expect(
          Math.abs(sunAt({ ...p, e: 0 }, EARTH, t).distance - 1),
        ).toBeLessThan(1e-12);
      }),
      { numRuns: 100 },
    );
  });

  it("近日点（λ = ϖ）で距離 1−e、遠日点（λ = ϖ+180）で 1+e", () => {
    fc.assert(
      fc.property(paramsArb, (p) => {
        const tp = timeOfLongitude(p, EARTH, p.varpi % 360);
        const ta = timeOfLongitude(p, EARTH, (p.varpi + 180) % 360);
        // 極値まわりでは距離は 2 次でしか変わらないので、t の誤差 1e-6 日でも 1e-8 で収まる
        expect(Math.abs(sunAt(p, EARTH, tp).distance - (1 - p.e))).toBeLessThan(
          1e-8,
        );
        expect(Math.abs(sunAt(p, EARTH, ta).distance - (1 + p.e))).toBeLessThan(
          1e-8,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("1 年後は同じ状態（λ, δ, 距離, 均時差）に戻る", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const a = sunAt(p, EARTH, t);
        const b = sunAt(p, EARTH, t + EARTH.yearDays);
        expect(circDiff(a.lambda, b.lambda)).toBeLessThan(1e-6);
        expect(Math.abs(a.declination - b.declination)).toBeLessThan(1e-6);
        expect(Math.abs(a.distance - b.distance)).toBeLessThan(1e-9);
        // α は L に最も近い分枝なので 1 年後も均時差は連続して同じ値になる（1e-6 h ≈ 4 ms）
        expect(Math.abs(a.equationOfTime - b.equationOfTime)).toBeLessThan(
          1e-6,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("太陽黄経は時間とともに単調に増える", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const a = sunAt(p, EARTH, t).lambda;
        const b = sunAt(p, EARTH, t + 0.01).lambda;
        const d = wrap180(b - a);
        expect(d).toBeGreaterThan(0);
        // e = 0.5 の近日点でも最大 ≈ 6.4°/日 なので 0.01 日で 0.1° 未満
        expect(d).toBeLessThan(0.2);
      }),
      { numRuns: 100 },
    );
  });

  it("赤緯・赤経の球面三角: sin δ = sin ε sin λ, tan α = cos ε tan λ", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const s = sunAt(p, EARTH, t);
        const lam = s.lambda * RAD;
        const eps = p.epsilon * RAD;
        const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * DEG;
        const ra =
          Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * DEG;
        // 1e-6°: λ の丸め誤差が ε = 89.9° 付近で α に増幅される分を見込む
        expect(Math.abs(s.declination - dec)).toBeLessThan(1e-6);
        expect(circDiff(s.rightAscension, ra)).toBeLessThan(1e-5);
      }),
      { numRuns: 100 },
    );
  });
});

describe("均時差", () => {
  it("E = wrap(L − α)/15。L = M + ϖ, α = atan2(cos ε sin λ, cos λ)", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const s = sunAt(p, EARTH, t);
        const lam = s.lambda * RAD;
        const alpha =
          Math.atan2(Math.cos(p.epsilon * RAD) * Math.sin(lam), Math.cos(lam)) *
          DEG;
        const big = s.meanAnomaly + p.varpi;
        // 「L に最も近い分枝」なので差は ±180° に畳まれる。1e-5° ≈ 4e-7 h
        const expected = wrap180(big - alpha) / 15;
        expect(Math.abs(s.equationOfTime - expected)).toBeLessThan(1e-6);
        expect(Math.abs(s.equationOfTime)).toBeLessThanOrEqual(12 + 1e-9);
      }),
      { numRuns: 100 },
    );
  });

  it("e = 0: 均時差は黄道傾斜の項だけ。L = λ = 360 t / yearDays", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p0, t) => {
        const p = { ...p0, e: 0 };
        const s = sunAt(p, EARTH, t);
        const big = (360 * t) / EARTH.yearDays; // e = 0 では λ(t) は一様に進む
        expect(circDiff(s.lambda, big)).toBeLessThan(1e-6);
        const alpha =
          Math.atan2(
            Math.cos(p.epsilon * RAD) * Math.sin(big * RAD),
            Math.cos(big * RAD),
          ) * DEG;
        expect(
          Math.abs(s.equationOfTime - wrap180(big - alpha) / 15),
        ).toBeLessThan(1e-6);
      }),
      { numRuns: 100 },
    );
  });

  it("ε = 0: 均時差は中心差 (M − ν)/15、赤経 = 黄経、赤緯 = 0", () => {
    fc.assert(
      fc.property(
        dbl(0, 360),
        dbl(0, 0.5),
        dbl(-60, 60),
        tArb,
        (varpi, e, phi, t) => {
          const p: Params = { epsilon: 0, e, varpi, phi, h0: -0.833 };
          const s = sunAt(p, EARTH, t);
          expect(Math.abs(s.declination)).toBeLessThan(1e-9);
          expect(circDiff(s.rightAscension, s.lambda)).toBeLessThan(1e-9);
          expect(
            Math.abs(
              s.equationOfTime - wrap180(s.meanAnomaly - s.trueAnomaly) / 15,
            ),
          ).toBeLessThan(1e-6);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("ε = 0 かつ e = 0: 均時差は常に 0、昼の長さは一定", () => {
    fc.assert(
      fc.property(
        dbl(0, 360),
        dbl(-89.89, 89.89),
        dbl(-2, 2),
        tArb,
        (varpi, phi, h0, t) => {
          const p: Params = { epsilon: 0, e: 0, varpi, phi, h0 };
          expect(Math.abs(sunAt(p, EARTH, t).equationOfTime)).toBeLessThan(
            1e-9,
          );
          const rows = [0, 50, 100, 200, 300].map((d) =>
            dayEvents(p, EARTH, d),
          );
          for (const r of rows) {
            expect(Math.abs(r.equationOfTime)).toBeLessThan(1e-9);
            // 昼の長さは日をまたいで同一（白夜 24・極夜 0 の場合も定数）。1e-6 h ≈ 4 ms
            expect(
              Math.abs(r.dayLength - (rows[0]?.dayLength ?? 0)),
            ).toBeLessThan(1e-6);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("timeOfLongitude", () => {
  it("sunAt(timeOfLongitude(λ)).lambda = λ、t は [0, yearDays)", () => {
    fc.assert(
      fc.property(paramsArb, dbl(0, 359.999), (p, lam) => {
        const t = timeOfLongitude(p, EARTH, lam);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(EARTH.yearDays);
        // 1e-6°: 反転の数値誤差（Newton 法 1e-12 rad）に対する余裕
        expect(circDiff(sunAt(p, EARTH, t).lambda, lam)).toBeLessThan(1e-6);
      }),
      { numRuns: 100 },
    );
  });

  it("λ が増えると t も増える（0 ≤ λ₁ < λ₂ < 360）", () => {
    fc.assert(
      fc.property(paramsArb, dbl(0, 358), dbl(0.01, 1), (p, a, d) => {
        expect(timeOfLongitude(p, EARTH, a + d)).toBeGreaterThan(
          timeOfLongitude(p, EARTH, a),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("e = 0 なら t = yearDays · λ / 360", () => {
    fc.assert(
      fc.property(paramsArb, dbl(0, 359.999), (p, lam) => {
        const t = timeOfLongitude({ ...p, e: 0 }, EARTH, lam);
        expect(Math.abs(t - (EARTH.yearDays * lam) / 360)).toBeLessThan(1e-6);
      }),
      { numRuns: 100 },
    );
  });
});

describe("日ごとの値 dayEvents", () => {
  it("南中 + 均時差 = 12 h（ちょうど）、南中の均時差は sunAt と 2 秒以内で一致", () => {
    fc.assert(
      fc.property(paramsArb, fc.integer({ min: -30, max: 400 }), (p, n) => {
        const r = dayEvents(p, EARTH, n);
        expect(r.day).toBe(n);
        // 定義式の恒等式なので浮動小数の丸めだけ許す
        expect(Math.abs(r.transit + r.equationOfTime - 12)).toBeLessThan(1e-9);
        // 南中の瞬間の反復収束は 1 秒未満（§3.5）。余裕を見て 2 秒
        const e = sunAt(p, EARTH, n + r.transit / 24).equationOfTime;
        expect(Math.abs(e - r.equationOfTime)).toBeLessThan(2 * SEC);
      }),
      { numRuns: 100 },
    );
  });

  it("日の出・日没の瞬間で太陽中心高度 = h₀（hours は t と整合）", () => {
    fc.assert(
      fc.property(mildParamsArb, fc.integer({ min: 0, max: 365 }), (p, n) => {
        const r = dayEvents(p, EARTH, n);
        for (const ev of [r.sunrise, r.sunset]) {
          expect(ev.kind).toBe("event");
          if (ev.kind !== "event") continue;
          expect(Math.abs(ev.t - (n + ev.hours / 24))).toBeLessThan(1e-9);
          const s = sunAt(p, EARTH, ev.t);
          // 時角: 真の南中は hours = 12 − E なので H = 15 (hours − 12 + E)
          const h = 15 * (ev.hours - 12 + s.equationOfTime) * RAD;
          const phi = p.phi * RAD;
          const dec = s.declination * RAD;
          const alt =
            Math.asin(
              Math.sin(phi) * Math.sin(dec) +
                Math.cos(phi) * Math.cos(dec) * Math.cos(h),
            ) * DEG;
          // 反復の収束は 1 秒未満。高度の変化率は最大 15°/h = 0.0042°/s なので 0.01° で十分
          expect(Math.abs(alt - p.h0)).toBeLessThan(0.01);
        }
        expect(
          r.sunrise.kind === "event" &&
            r.sunset.kind === "event" &&
            r.sunrise.hours < r.transit &&
            r.transit < r.sunset.hours,
        ).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("昼の長さ = 日没 − 日の出（白夜 24、極夜 0）", () => {
    fc.assert(
      fc.property(paramsArb, fc.integer({ min: 0, max: 365 }), (p, n) => {
        const r = dayEvents(p, EARTH, n);
        if (r.sunrise.kind === "event" && r.sunset.kind === "event") {
          expect(
            Math.abs(r.dayLength - (r.sunset.hours - r.sunrise.hours)),
          ).toBeLessThan(1e-9);
        } else if (
          r.sunrise.kind === "polarDay" &&
          r.sunset.kind === "polarDay"
        ) {
          expect(r.dayLength).toBe(24);
        } else if (
          r.sunrise.kind === "polarNight" &&
          r.sunset.kind === "polarNight"
        ) {
          expect(r.dayLength).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("日の出・日没は南中のまわりでほぼ対称（太陽の動きによる非対称の範囲内）", () => {
    // 日の出から日没までの約半日の間に δ と E が動く分だけ非対称になる。
    // ε ≤ 25, e ≤ 0.1, |φ| ≤ 45 では δ の変化 ≤ 0.35°/半日、dH/dδ ≲ 1.5、E の変化 ≲ 45 s なので 0.06 h で抑えられる
    const arb = fc.record({
      epsilon: dbl(0, 25),
      e: dbl(0, 0.1),
      varpi: dbl(0, 360),
      phi: dbl(-45, 45),
      h0: dbl(-2, 2),
    });
    fc.assert(
      fc.property(arb, fc.integer({ min: 0, max: 365 }), (p, n) => {
        const r = dayEvents(p, EARTH, n);
        if (r.sunrise.kind !== "event" || r.sunset.kind !== "event")
          throw new Error("event expected");
        expect(
          Math.abs(r.sunset.hours - r.transit - (r.transit - r.sunrise.hours)),
        ).toBeLessThan(0.06);
      }),
      { numRuns: 100 },
    );
    // ε ≤ 3, e ≤ 0.02 ではほぼ δ も E も動かないので 0.01 h（36 秒）まで締める
    const tight = fc.record({
      epsilon: dbl(0, 3),
      e: dbl(0, 0.02),
      varpi: dbl(0, 360),
      phi: dbl(-45, 45),
      h0: dbl(-2, 2),
    });
    fc.assert(
      fc.property(tight, fc.integer({ min: 0, max: 365 }), (p, n) => {
        const r = dayEvents(p, EARTH, n);
        if (r.sunrise.kind !== "event" || r.sunset.kind !== "event")
          throw new Error("event expected");
        expect(
          Math.abs(r.sunset.hours - r.transit - (r.transit - r.sunrise.hours)),
        ).toBeLessThan(0.01);
      }),
      { numRuns: 100 },
    );
  });

  it("ε = 0: 日没・日の出の時角 ±H は一定で cos H = sin h₀ / cos φ", () => {
    // δ = 0 なので H は日によらない。時計の南中からの差 (sunset − transit) は e > 0 では秒単位で揺れるため、
    // 日没の瞬間の均時差を使って時角そのものを復元して比較する
    fc.assert(
      fc.property(
        dbl(0, 360),
        dbl(0, 0.5),
        dbl(-80, 80),
        dbl(-2, 2),
        fc.integer({ min: 0, max: 365 }),
        (varpi, e, phi, h0, n) => {
          const p: Params = { epsilon: 0, e, varpi, phi, h0 };
          const r = dayEvents(p, EARTH, n);
          const c = Math.sin(h0 * RAD) / Math.cos(phi * RAD);
          if (Math.abs(c) >= 1) {
            expect(r.sunrise.kind).not.toBe("event");
            return;
          }
          const hDeg = Math.acos(c) * DEG;
          if (r.sunrise.kind !== "event" || r.sunset.kind !== "event")
            throw new Error("event expected");
          const hs =
            15 *
            (r.sunset.hours - 12 + sunAt(p, EARTH, r.sunset.t).equationOfTime);
          const hr =
            15 *
            (r.sunrise.hours -
              12 +
              sunAt(p, EARTH, r.sunrise.t).equationOfTime);
          // 反復収束 1 秒未満 → 時角で 0.0042°。余裕を見て 0.01°
          expect(Math.abs(hs - hDeg)).toBeLessThan(0.01);
          expect(Math.abs(hr + hDeg)).toBeLessThan(0.01);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("h₀ = 0 では φ と −φ の昼の長さの和がほぼ 24 h（cos H の符号反転）", () => {
    // cos H = −tan φ tan δ なので H(−φ) = 180° − H(φ)。日没・日の出の瞬間が違う分の δ, E のずれを 0.1 h で許す
    const arb = fc.record({
      epsilon: dbl(0, 25),
      e: dbl(0, 0.1),
      varpi: dbl(0, 360),
      phi: dbl(0.1, 40),
    });
    fc.assert(
      fc.property(arb, fc.integer({ min: 0, max: 365 }), (q, n) => {
        const base = { epsilon: q.epsilon, e: q.e, varpi: q.varpi, h0: 0 };
        const a = dayEvents({ ...base, phi: q.phi }, EARTH, n).dayLength;
        const b = dayEvents({ ...base, phi: -q.phi }, EARTH, n).dayLength;
        expect(Math.abs(a + b - 24)).toBeLessThan(0.1);
      }),
      { numRuns: 100 },
    );
  });
});

describe("computeYear の構造", () => {
  it("hemisphere と夏至・冬至: φ ≥ 0 は λ=90° を夏至、φ < 0 は λ=270° を夏至", () => {
    fc.assert(
      fc.property(paramsArb, (p) => {
        const y = computeYear(p, EARTH);
        const t90 = timeOfLongitude(p, EARTH, 90);
        const t270 = timeOfLongitude(p, EARTH, 270);
        // 反転の誤差 1e-6 日
        const north = p.phi >= 0;
        expect(y.hemisphere).toBe(north ? "north" : "south");
        expect(
          periodicDiff(y.summerSolstice, north ? t90 : t270, EARTH.yearDays),
        ).toBeLessThan(1e-6);
        expect(
          periodicDiff(y.winterSolstice, north ? t270 : t90, EARTH.yearDays),
        ).toBeLessThan(1e-6);
      }),
      { numRuns: 25 },
    );
  });

  it("φ → −φ（ほかは同じ）で夏至と冬至が入れ替わる", () => {
    fc.assert(
      fc.property(paramsArb, dbl(0.1, 89.89), (p, phi) => {
        const n = computeYear({ ...p, phi }, EARTH);
        const s = computeYear({ ...p, phi: -phi }, EARTH);
        expect(n.hemisphere).toBe("north");
        expect(s.hemisphere).toBe("south");
        expect(
          periodicDiff(n.summerSolstice, s.winterSolstice, EARTH.yearDays),
        ).toBeLessThan(1e-9);
        expect(
          periodicDiff(n.winterSolstice, s.summerSolstice, EARTH.yearDays),
        ).toBeLessThan(1e-9);
      }),
      { numRuns: 25 },
    );
  });

  it("鏡像対称: (ϖ+180°, −φ) は (ϖ, φ) の太陽を λ+180° ずらしたもの", () => {
    // 軌道は同じで春分の起点だけ半年ずれる。T = timeOfLongitude(λ=180°) として
    // 状態は S'(t) = S(t + T) の写像: λ' = λ+180°, δ' = −δ, 均時差・距離は同じ
    fc.assert(
      fc.property(paramsArb, dbl(0, 360), (p, t) => {
        const q: Params = { ...p, varpi: (p.varpi + 180) % 360, phi: -p.phi };
        const big = timeOfLongitude(p, EARTH, 180);
        const a = sunAt(p, EARTH, t + big);
        const b = sunAt(q, EARTH, t);
        expect(circDiff(b.lambda, a.lambda + 180)).toBeLessThan(1e-5);
        expect(Math.abs(b.declination + a.declination)).toBeLessThan(1e-5);
        expect(Math.abs(b.distance - a.distance)).toBeLessThan(1e-8);
        // 均時差は 1e-5 h: T の反転誤差 × 変化率（最大で毎日 1 h 未満）に対する余裕
        expect(Math.abs(b.equationOfTime - a.equationOfTime)).toBeLessThan(
          1e-5,
        );
      }),
      { numRuns: 50 },
    );
  });

  it("鏡像対称: 南半球のズレ・昼の長さは北半球の鏡像と一致する", () => {
    // 鏡像では時計の位相（時角と時刻の対応）が小数日だけずれるが、極値は G(t) = 12 + H(t)/15 − E(t) の
    // 停留点そのものなので、夏至からの日数と極値の時刻値は変わらない。
    // 平坦な極値の位置は数値の反復誤差で動きうるため lag は 1 日、hours は 0.01 h（36 秒）まで許す
    fc.assert(
      fc.property(earthLikeArb, (p) => {
        // 白夜・極夜の境界（φ + ε − 90 = ±h₀）ちょうどでは、日の出・日没が存在するかが
        // 1e-9 程度の数値の差で決まる。南北で別々に丸められるので、鏡像の比較から外す
        const edge = p.phi + p.epsilon - 90;
        fc.pre(Math.abs(edge - p.h0) > 0.05 && Math.abs(edge + p.h0) > 0.05);
        const q: Params = { ...p, varpi: (p.varpi + 180) % 360, phi: -p.phi };
        const a = computeYear(p, EARTH);
        const b = computeYear(q, EARTH);
        expect(a.hemisphere).toBe("north");
        expect(b.hemisphere).toBe("south");
        for (const kind of [
          "latestSunset",
          "earliestSunrise",
          "earliestSunset",
          "latestSunrise",
        ] as const) {
          const x = a.lags[kind];
          const y = b.lags[kind];
          expect(y.kind).toBe(x.kind);
          if (x.kind === "peak" && y.kind === "peak") {
            // 実測（300 組）の最大差は lag 1.6e-4 日、hours 2e-12 h。約 6 倍の余裕を取る
            expect(Math.abs(x.lagDays - y.lagDays)).toBeLessThan(1e-3);
            expect(Math.abs(x.hours - y.hours)).toBeLessThan(1e-6);
          }
        }
        if (a.dayLength && b.dayLength) {
          // 昼の長さは夏至の瞬間を日の中央にとる連続値で求めるので、鏡像とほぼ厳密に一致する
          // （実測 3000 組の最大差は 1.7e-12 h。1e-6 h = 3.6 ミリ秒まで許す）
          expect(Math.abs(a.dayLength.max - b.dayLength.max)).toBeLessThan(
            1e-6,
          );
          expect(
            Math.abs(a.dayLength.atSolstice - b.dayLength.atSolstice),
          ).toBeLessThan(1e-6);
        }
      }),
      { numRuns: 40 },
    );
    // 全テストの並列実行で CPU が競合しても間に合うよう、既定の 5 秒より長くする
  }, 30_000);

  it("days は連続した整数日で、daysFromSolstice = day − summerSolstice、既定範囲を覆う", () => {
    const y = computeYear(TOKYO, EARTH);
    const half = EARTH.yearDays / 2 + 20;
    expect(y.days.length).toBeGreaterThan(EARTH.yearDays + 39);
    for (const [i, d] of y.days.entries()) {
      expect(Number.isInteger(d.day)).toBe(true);
      if (i > 0) expect(d.day - (y.days[i - 1]?.day ?? Number.NaN)).toBe(1);
      // 恒等式（1e-9）
      expect(
        Math.abs(d.daysFromSolstice - (d.day - y.summerSolstice)),
      ).toBeLessThan(1e-9);
      expect(Math.abs(d.transit + d.equationOfTime - 12)).toBeLessThan(1e-9);
    }
    // 日単位の刻みなので端は 1 日までの余裕を見る
    expect(y.days[0]?.daysFromSolstice).toBeLessThanOrEqual(-half + 1);
    expect(y.days.at(-1)?.daysFromSolstice).toBeGreaterThanOrEqual(half - 1);
  });

  it("options の from / to で範囲を絞れる", () => {
    const y = computeYear(TOKYO, EARTH, { from: -10, to: 10 });
    expect(y.days.length).toBeGreaterThanOrEqual(20);
    expect(y.days.length).toBeLessThanOrEqual(22);
    for (const d of y.days) {
      expect(d.daysFromSolstice).toBeGreaterThanOrEqual(-10 - 1);
      expect(d.daysFromSolstice).toBeLessThanOrEqual(10 + 1);
    }
  });
});

describe("ε = 0（至点が存在しない）", () => {
  it("4 種類のズレはすべて undefined / noSolstice、dayLength は null", () => {
    fc.assert(
      fc.property(
        dbl(0, 0.5),
        dbl(0, 360),
        dbl(-89.89, 89.89),
        dbl(-2, 2),
        (e, varpi, phi, h0) => {
          const y = computeYear({ epsilon: 0, e, varpi, phi, h0 }, EARTH);
          for (const kind of [
            "latestSunset",
            "earliestSunrise",
            "earliestSunset",
            "latestSunrise",
          ] as const) {
            expect(y.lags[kind]).toEqual({
              kind: "undefined",
              reason: "noSolstice",
            });
          }
          expect(y.dayLength).toBeNull();
        },
      ),
      { numRuns: 25 },
    );
  });
});

describe("極域", () => {
  // 夏至で最小高度 = δ + |φ| − 90 = |φ| + ε − 90 が h₀ を超えれば白夜。余裕 0.5° を取る
  // 冬至で最大高度 = 90 − |φ| − ε が h₀ を下回れば極夜。h₀ ≤ 0 なので |φ| > 90 − ε + |h₀| + 0.5 なら両方成り立つ
  const polarArb = fc
    .record({
      epsilon: dbl(10, 60),
      e: dbl(0, 0.2),
      varpi: dbl(0, 360),
      h0: dbl(-2, 0),
      sign: fc.constantFrom(1, -1),
      u: dbl(0, 1),
    })
    .map(({ epsilon, e, varpi, h0, sign, u }) => {
      const lo = 90 - epsilon + Math.abs(h0) + 0.5;
      // φ が極に近すぎると、分点付近の「太陽が出入りする窓」が日単位の標本間隔より狭くなり、
      // 日ごとの日没・日の出の曲線そのものが存在しない（物理的に noEvents）。
      // 赤緯は分点で最大 ε·2π/365 度/日 で動き、窓の幅は ≈ 2(90−|φ|−|h₀|)/その速度 日なので、
      // 窓が 6 日以上になるよう 90−|φ| ≥ |h₀| + 3·ε·2π/365 に制限する
      const hi = Math.min(
        89.89,
        90 - Math.abs(h0) - 3 * epsilon * ((2 * Math.PI) / 365),
      );
      const phi = sign * (lo + u * (hi - lo));
      return { epsilon, e, varpi, phi, h0 } satisfies Params;
    });

  it("夏至のころは白夜、冬至のころは極夜の行がある", () => {
    fc.assert(
      fc.property(polarArb, (p) => {
        const y = computeYear(p, EARTH);
        // 離心率が大きいと冬至は既定の days の範囲外になりうるので、dayEvents で直接引く
        const s = dayEvents(p, EARTH, Math.round(y.summerSolstice));
        expect(s.sunrise.kind).toBe("polarDay");
        expect(s.sunset.kind).toBe("polarDay");
        expect(s.dayLength).toBe(24);
        const w = dayEvents(p, EARTH, Math.round(y.winterSolstice));
        expect(w.sunrise.kind).toBe("polarNight");
        expect(w.sunset.kind).toBe("polarNight");
        expect(w.dayLength).toBe(0);
      }),
      { numRuns: 25 },
    );
  });

  it("日没最遅・日の出最早は白夜の境界、日没最早・日の出最遅は極夜の境界で途切れる", () => {
    fc.assert(
      fc.property(polarArb, (p) => {
        const y = computeYear(p, EARTH);
        const expected = {
          latestSunset: "polarDay",
          earliestSunrise: "polarDay",
          earliestSunset: "polarNight",
          latestSunrise: "polarNight",
        } as const;
        for (const kind of Object.keys(expected) as (keyof typeof expected)[]) {
          const l = y.lags[kind];
          expect(l.kind).toBe("polarBoundary");
          if (l.kind === "polarBoundary") {
            expect(l.boundary).toBe(expected[kind]);
            // 境界は至点から半年以内にある
            expect(Math.abs(l.lagDays)).toBeLessThanOrEqual(
              EARTH.yearDays / 2 + 1e-6,
            );
          }
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe("地球・東京の妥当性", () => {
  const y = computeYear(TOKYO, EARTH);

  it("日没最遅日は夏至より 0〜15 日後の peak", () => {
    const l = y.lags.latestSunset;
    expect(l.kind).toBe("peak");
    if (l.kind !== "peak") return;
    expect(l.lagDays).toBeGreaterThan(0);
    expect(l.lagDays).toBeLessThan(15);
    // lagDays は「夏至の瞬間 → イベントの瞬間」
    expect(Math.abs(l.t - y.summerSolstice - l.lagDays)).toBeLessThan(1e-9);
    // 周辺の日の日没は極大値以下（連続の極値なので日単位の標本より大きいか同じ）。許容 5e-4 h ≈ 1.8 秒
    const n = Math.floor(l.t);
    for (let d = n - 8; d <= n + 8; d++) {
      const h = eventHours(dayEvents(TOKYO, EARTH, d).sunset);
      expect(h).not.toBeNull();
      expect(h as number).toBeLessThanOrEqual(l.hours + 5e-4);
    }
  });

  it("日の出最早日は夏至より前（負）の peak で、周辺の日の出は極小値以上", () => {
    const l = y.lags.earliestSunrise;
    expect(l.kind).toBe("peak");
    if (l.kind !== "peak") return;
    expect(l.lagDays).toBeLessThan(0);
    expect(l.lagDays).toBeGreaterThan(-20);
    const n = Math.floor(l.t);
    for (let d = n - 8; d <= n + 8; d++) {
      const h = eventHours(dayEvents(TOKYO, EARTH, d).sunrise);
      expect(h as number).toBeGreaterThanOrEqual(l.hours - 5e-4);
    }
  });

  it("冬至基準: 日没最早日は冬至より前、日の出最遅日は冬至より後", () => {
    const a = y.lags.earliestSunset;
    const b = y.lags.latestSunrise;
    expect(a.kind).toBe("peak");
    expect(b.kind).toBe("peak");
    if (a.kind === "peak") {
      expect(a.lagDays).toBeLessThan(0);
      expect(a.lagDays).toBeGreaterThan(-40);
      expect(Math.abs(a.t - y.winterSolstice - a.lagDays)).toBeLessThan(1e-9);
    }
    if (b.kind === "peak") {
      expect(b.lagDays).toBeGreaterThan(0);
      expect(b.lagDays).toBeLessThan(30);
    }
  });

  it("夏至の日の昼の長さは年間最長とほぼ同じ", () => {
    expect(y.dayLength).not.toBeNull();
    if (!y.dayLength) return;
    // 日単位の標本で最大が夏至の日から最大 1 日ずれても、夏至付近の曲率（≈1.3 秒/日²）から 2 秒以内
    expect(y.dayLength.max).toBeGreaterThanOrEqual(
      y.dayLength.atSolstice - 1e-9,
    );
    expect(y.dayLength.max - y.dayLength.atSolstice).toBeLessThan(2 * SEC);
    // 東京の夏至の昼は約 14.5 h
    expect(y.dayLength.atSolstice).toBeGreaterThan(14.2);
    expect(y.dayLength.atSolstice).toBeLessThan(14.8);
  });
});

describe("sceneState", () => {
  it("惑星位置のノルム = 距離、位置は太陽の反対側、軸・近日点方向は単位ベクトル", () => {
    fc.assert(
      fc.property(paramsArb, tArb, (p, t) => {
        const s = sceneState(p, EARTH, t);
        const [x, y, z] = s.planetPosition;
        // 1e-9: 浮動小数の丸めのみ
        expect(Math.abs(Math.hypot(x, y, z) - s.sun.distance)).toBeLessThan(
          1e-9,
        );
        expect(Math.abs(Math.hypot(...s.axisDirection) - 1)).toBeLessThan(1e-9);
        expect(Math.abs(Math.hypot(...s.perihelionDirection) - 1)).toBeLessThan(
          1e-9,
        );
        expect(s.localMeanTime).toBeGreaterThanOrEqual(0);
        expect(s.localMeanTime).toBeLessThanOrEqual(24);
        // 太陽の状態は sunAt と一致
        expect(circDiff(s.sun.lambda, sunAt(p, EARTH, t).lambda)).toBeLessThan(
          1e-9,
        );
        // 軸の傾き ε: 黄道の北極（z 軸）との角が ε
        expect(
          Math.abs(s.axisDirection[2] - Math.cos(p.epsilon * RAD)),
        ).toBeLessThan(1e-9);
      }),
      { numRuns: 100 },
    );
  });

  it("近日点の瞬間（λ = ϖ）、惑星は近日点方向に距離 1−e の位置にある", () => {
    fc.assert(
      fc.property(paramsArb, (p) => {
        const t = timeOfLongitude(p, EARTH, p.varpi % 360);
        const s = sceneState(p, EARTH, t);
        const d = 1 - p.e;
        // 近日点付近では位置の 1 次の誤差が出るので 1e-6
        for (const i of [0, 1, 2] as const) {
          expect(
            Math.abs(s.planetPosition[i] - d * s.perihelionDirection[i]),
          ).toBeLessThan(1e-6);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("範囲内のパラメータでは例外を投げず有限値を返す", () => {
  it("ランダムなパラメータ", () => {
    fc.assert(
      fc.property(
        paramsArb,
        tArb,
        fc.integer({ min: -30, max: 400 }),
        (p, t, n) => {
          assertFiniteDeep(sunAt(p, EARTH, t));
          assertFiniteDeep(timeOfLongitude(p, EARTH, ((t % 360) + 360) % 360));
          assertFiniteDeep(dayEvents(p, EARTH, n));
          assertFiniteDeep(sceneState(p, EARTH, t));
          assertFiniteDeep(computeYear(p, EARTH));
        },
      ),
      { numRuns: 30 },
    );
  });

  it("範囲の隅（ε, e, φ, h₀ の最小・最大）", () => {
    for (const epsilon of [0, 0.001, 89.9]) {
      for (const e of [0, 0.5]) {
        for (const phi of [-89.9, 0, 89.9]) {
          for (const h0 of [-2, 2]) {
            const p: Params = { epsilon, e, varpi: 283, phi, h0 };
            assertFiniteDeep(computeYear(p, EARTH));
            assertFiniteDeep(sunAt(p, EARTH, 123.4));
          }
        }
      }
    }
  });
});
