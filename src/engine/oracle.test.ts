// astronomy-engine との照合（docs/requirements.md §9.1）。
//
// 手順：実際の太陽の見かけの黄経 λ を astronomy-engine から取り、同じ λ になる
// モデルの瞬間 timeOfLongitude(λ) と比べる。暦（実際の日付）とモデルの暦は
// 端数日ずれるので、絶対時刻ではなく「地方平均時の時刻（その日の 0 時からの h）」で比較する。
// 観測者は東経 135°（地方平均時 = UTC + 9h）。
//
// 基準年 2026 の軌道要素（実際の天体暦から導出。モデルへの入力値）：
//  - ϖ：近日点（SearchPlanetApsis）の瞬間の、太陽の見かけの黄経（= 日心近日点黄経 + 180°）
//  - e：近日点・遠日点の距離から (ra − rp) / (ra + rp)
//  - ε：2026 年中頃の平均黄道傾斜（IAU 2006 の多項式）
//
// 導出結果：近日点 2026-01-03 16:42 UTC、ϖ ≒ 283.315°（当年の春分点基準）、e ≒ 0.016673、ε ≒ 23.4359°。
//
// モデルが省いているもの：章動、歳差による ϖ の年内変化、惑星・月による摂動、
// 光行差（見かけの黄経に含まれる −20.5″ ≒ 1.4 秒分）。
//
// 実測した最大誤差（約 30 日付のうち最悪値）：
//  - 均時差：1.4 秒（12/30）
//  - 日没：φ=35.68 で 2.6 秒、φ=-33.87 で 2.2 秒
//  - 日の出：φ=35.68 で 1.2 秒、φ=-33.87 で 1.6 秒

import {
  ApsisKind,
  Body,
  Equator,
  EquatorFromVector,
  GeoVector,
  Horizon,
  NextPlanetApsis,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchAltitude,
  SearchPlanetApsis,
  SiderealTime,
  SunPosition,
} from "astronomy-engine";
import { describe, expect, it } from "vitest";
import type { Params } from "./index";
import { dayEvents, EARTH, sunAt, timeOfLongitude } from "./index";

const REF_YEAR = 2026;
const LONGITUDE = 135;
const UTC_OFFSET_H = LONGITUDE / 15;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** 許容誤差 [秒]。実測は最大 2.6 秒（章動・光行差・摂動の省略分 ≒ 数秒）なので 6 秒に締める */
const TOLERANCE_S = 6;

// ---------------------------------------------------------------- 基準年の軌道要素

function referenceElements() {
  const first = SearchPlanetApsis(
    Body.Earth,
    new Date(Date.UTC(REF_YEAR, 0, 1)),
  );
  const second = NextPlanetApsis(Body.Earth, first);
  const [peri, aph] =
    first.kind === ApsisKind.Pericenter ? [first, second] : [second, first];
  const varpi = SunPosition(peri.time).elon;
  const e = (aph.dist_au - peri.dist_au) / (aph.dist_au + peri.dist_au);
  // 平均黄道傾斜 [″]（IAU 2006）。T は J2000 からのユリウス世紀
  const T = (REF_YEAR + 0.5 - 2000) / 100;
  const epsilon = (84381.406 - 46.836769 * T - 0.0001831 * T * T) / 3600;
  return { varpi, e, epsilon, periTime: peri.time.date };
}

const ELEMENTS = referenceElements();

function earthParams(phi: number): Params {
  return {
    epsilon: ELEMENTS.epsilon,
    e: ELEMENTS.e,
    varpi: ELEMENTS.varpi,
    phi,
    h0: -0.833,
  };
}

// ---------------------------------------------------------------- astronomy-engine 側

/** [−12, 12) に折り返す */
function wrap12(h: number): number {
  return ((((h + 12) % 24) + 24) % 24) - 12;
}

/** 見かけの太陽黄経 [deg]（0〜360） */
function apparentLongitude(date: Date): number {
  return SunPosition(date).elon;
}

/** 均時差 [h]（見かけの太陽時 − 平均太陽時。モデルの E と同じ符号：正なら南中が早い） */
function realEquationOfTime(date: Date): number {
  // 見かけの赤経（真の春分点・光行差込み、地心）
  const eqj = GeoVector(Body.Sun, date, true);
  const ofDate = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), eqj));
  const gast = SiderealTime(date); // グリニッジ視恒星時 [h]
  const utcH = (date.getTime() % DAY_MS) / HOUR_MS;
  // 見かけの太陽時 = 12h + 時角、平均太陽時 = UT。経度は両辺で相殺される
  return wrap12(12 + gast - ofDate.ra - utcH);
}

/** 観測日（地方日付）の 0 時（地方平均時）の UTC ミリ秒 */
function localMidnightMs(month: number, day: number): number {
  return Date.UTC(REF_YEAR, month, day) - UTC_OFFSET_H * HOUR_MS;
}

/** 太陽中心の幾何学的高度が h0 になる、その日の日の出(+1)/日没(−1) */
function realRiseSet(
  phi: number,
  direction: 1 | -1,
  midnightMs: number,
  h0 = -0.833,
): Date {
  const observer = new Observer(phi, LONGITUDE, 0);
  const t = SearchAltitude(
    Body.Sun,
    observer,
    direction,
    new Date(midnightMs),
    1,
    h0,
  );
  if (t === null) throw new Error("rise/set not found");
  return t.date;
}

/** 検証する日付（2026 年を約 12 日おきに）。[月(0 始まり), 日] */
const DATES: [number, number][] = [];
for (let doy = 3; doy < 365; doy += 12) {
  const d = new Date(Date.UTC(REF_YEAR, 0, 1 + doy));
  DATES.push([d.getUTCMonth(), d.getUTCDate()]);
}

// ---------------------------------------------------------------- astronomy-engine 側の自己検証

describe("astronomy-engine 側の自己検証", () => {
  it("基準年の軌道要素が文献値の範囲にある", () => {
    expect(ELEMENTS.periTime.getUTCMonth()).toBe(0);
    expect(ELEMENTS.periTime.getUTCDate()).toBeGreaterThanOrEqual(2);
    expect(ELEMENTS.periTime.getUTCDate()).toBeLessThanOrEqual(5);
    expect(ELEMENTS.varpi).toBeGreaterThan(282.5);
    expect(ELEMENTS.varpi).toBeLessThan(283.5);
    expect(ELEMENTS.e).toBeGreaterThan(0.0166);
    expect(ELEMENTS.e).toBeLessThan(0.0168);
    expect(ELEMENTS.epsilon).toBeGreaterThan(23.43);
    expect(ELEMENTS.epsilon).toBeLessThan(23.44);
  });

  it("均時差の極値が既知の値（11 月初旬 +16.4 分、2 月中旬 −14.2 分）に合う", () => {
    let max = { v: -Infinity, d: new Date(0) };
    let min = { v: Infinity, d: new Date(0) };
    for (let doy = 0; doy < 365; doy++) {
      const d = new Date(Date.UTC(REF_YEAR, 0, 1 + doy, 12));
      const v = realEquationOfTime(d) * 60;
      if (v > max.v) max = { v, d };
      if (v < min.v) min = { v, d };
    }
    expect(max.v).toBeGreaterThan(16.2);
    expect(max.v).toBeLessThan(16.6);
    expect(max.d.getUTCMonth()).toBe(10); // 11 月
    expect(max.d.getUTCDate()).toBeLessThanOrEqual(5);
    expect(min.v).toBeGreaterThan(-14.4);
    expect(min.v).toBeLessThan(-14.0);
    expect(min.d.getUTCMonth()).toBe(1); // 2 月
    expect(min.d.getUTCDate()).toBeGreaterThanOrEqual(8);
    expect(min.d.getUTCDate()).toBeLessThanOrEqual(14);
  });

  it("均時差が 4/15・6/13・9/1・12/25 付近でほぼ 0 になる", () => {
    for (const [m, d] of [
      [3, 15],
      [5, 13],
      [8, 1],
      [11, 25],
    ] as const) {
      const v = realEquationOfTime(new Date(Date.UTC(REF_YEAR, m, d, 12)));
      expect(Math.abs(v * 60)).toBeLessThan(1.5);
    }
  });

  it("SearchAltitude の結果は中心の幾何学的高度 −0.833° になっている", () => {
    const observer = new Observer(35.68, LONGITUDE, 0);
    for (const dir of [1, -1] as const) {
      const t = realRiseSet(35.68, dir, localMidnightMs(5, 21));
      const eq = Equator(Body.Sun, t, observer, true, true);
      const alt = Horizon(t, observer, eq.ra, eq.dec).altitude;
      expect(alt).toBeCloseTo(-0.833, 3);
    }
  });

  it("夏至・冬至の日没・日の出が球面三角法の概算に合う（φ=35.68°）", () => {
    const hours = (t: Date, m: number, d: number) =>
      (t.getTime() - localMidnightMs(m, d)) / HOUR_MS;
    // 6/21 日没 ≒ 19.3h、12/21 日の出 ≒ 7.1h
    expect(
      hours(realRiseSet(35.68, -1, localMidnightMs(5, 21)), 5, 21),
    ).toBeCloseTo(19.3, 1);
    expect(
      hours(realRiseSet(35.68, 1, localMidnightMs(11, 21)), 11, 21),
    ).toBeCloseTo(7.1, 1);
  });

  it("SunPosition は春分の黄経 0° を再現する（見かけの黄経）", () => {
    const lon = apparentLongitude(new Date(Date.UTC(REF_YEAR, 2, 20, 14, 46)));
    // 2026 年の春分は 3/20 14:46 UTC ごろ。±2 分 ≒ ±0.0014°
    expect(Math.abs(wrap12(lon / 15) * 15)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------- モデル側との比較

/** 時刻 t_s の近傍 3 日のイベントから、t_s での時刻 [h] を 2 次補間で求める */
function modelEventHours(
  params: Params,
  kind: "sunrise" | "sunset",
  tS: number,
): number {
  const pick = (n: number) => {
    const ev = dayEvents(params, EARTH, n)[kind];
    if (ev.kind !== "event") throw new Error(`no ${kind} on day ${n}`);
    return ev;
  };
  // t_s にいちばん近いイベントの日を探す
  const base = Math.floor(tS);
  let best = base;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let n = base - 1; n <= base + 1; n++) {
    const gap = Math.abs(pick(n).t - tS);
    if (gap < bestGap) {
      bestGap = gap;
      best = n;
    }
  }
  const pts = [best - 1, best, best + 1].map((n) => {
    const ev = pick(n);
    return { t: ev.t, h: ev.hours };
  });
  // ラグランジュ補間（イベントの時刻 t に対する、その日の時刻 h）
  let sum = 0;
  for (const [i, pi] of pts.entries()) {
    let w = 1;
    for (const [j, pj] of pts.entries()) {
      if (i !== j) w *= (tS - pj.t) / (pi.t - pj.t);
    }
    sum += w * pi.h;
  }
  return sum;
}

interface Worst {
  errS: number;
  label: string;
}

function trackWorst(worst: Worst, errS: number, label: string): void {
  if (Math.abs(errS) > Math.abs(worst.errS)) {
    worst.errS = errS;
    worst.label = label;
  }
}

describe("モデル（地球パラメータ）と astronomy-engine の照合", () => {
  const params = earthParams(35.68);

  it("timeOfLongitude は指定した黄経の瞬間を返す", () => {
    for (const lam of [0, 90, 180, 270, 283, 359]) {
      const t = timeOfLongitude(params, EARTH, lam);
      const got = sunAt(params, EARTH, t).lambda;
      expect(Math.abs(wrap12((got - lam) / 15) * 15)).toBeLessThan(1e-6);
    }
  });

  it("均時差が一致する（同じ見かけの黄経どうし）", () => {
    const worst: Worst = { errS: 0, label: "" };
    for (const [m, d] of DATES) {
      const date = new Date(Date.UTC(REF_YEAR, m, d, 12));
      const lam = apparentLongitude(date);
      const t = timeOfLongitude(params, EARTH, lam);
      const modelS = sunAt(params, EARTH, t).equationOfTime * 3600;
      const realS = realEquationOfTime(date) * 3600;
      trackWorst(worst, modelS - realS, `${m + 1}/${d} λ=${lam.toFixed(3)}`);
    }
    expect(Math.abs(worst.errS), worst.label).toBeLessThan(TOLERANCE_S);
  });

  for (const phi of [35.68, -33.87]) {
    for (const [kind, direction] of [
      ["sunset", -1],
      ["sunrise", 1],
    ] as const) {
      it(`${kind === "sunset" ? "日没" : "日の出"}の地方平均時が一致する（φ=${phi}°）`, () => {
        const p = earthParams(phi);
        const worst: Worst = { errS: 0, label: "" };
        for (const [m, d] of DATES) {
          const mid = localMidnightMs(m, d);
          const ev = realRiseSet(phi, direction, mid);
          const realH = (ev.getTime() - mid) / HOUR_MS;
          const lam = apparentLongitude(ev);
          const tS = timeOfLongitude(p, EARTH, lam);
          const modelH = modelEventHours(p, kind, tS);
          const errS = wrap12(modelH - realH) * 3600;
          trackWorst(worst, errS, `${m + 1}/${d} λ=${lam.toFixed(3)}`);
        }
        expect(Math.abs(worst.errS), worst.label).toBeLessThan(TOLERANCE_S);
      });
    }
  }
});
