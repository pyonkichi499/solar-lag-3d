// astronomy-engine との照合（docs/requirements.md §9.1）。
//
// 手順：実際の太陽の見かけの黄経 λ を astronomy-engine から取り、同じ λ になる
// モデルの瞬間 timeOfLongitude(λ) と比べる。暦（実際の日付）とモデルの暦は
// 端数日ずれるので、絶対時刻ではなく「地方平均時の時刻（その日の 0 時からの h）」で比較する。
// 観測者は東経 135°（地方平均時 = UTC + 9h）。
//
// 基準年の軌道要素（モデルへの入力値。年央の平均要素）：
//  - ϖ：地球の日心近日点黄経の平均要素 102.93735° + 1.71946°·T（+0.00046°·T²）に 180° を足したもの
//  - e：平均離心率 0.016708634 − 0.000042037·T（− 1.267e-7·T²）
//  - ε：平均黄道傾斜（IAU 2006 の多項式）
//  （T は J2000 からのユリウス世紀。いずれも年央の値）
//
// 近日点（SearchPlanetApsis）の瞬間から直接導出した ϖ・e は、平均要素と比べる照合用に残す。
// 実際の近日点の瞬間は月・惑星の摂動で平均から ±1.5° 前後（≒ ±1.5 日）ずれる
// （2000 年 −0.81°、2026 年 −0.07°、2050 年 +0.83°、2100 年 −1.42°）。
// これを ϖ に使うと、近日点・遠日点付近（1/4・7/15 ごろ）の均時差が cos M 項で
// ϖ のずれ × 2e ≒ 数秒〜十数秒だけずれる（実測：2000 年 10.3 秒、2050 年 10.4 秒、2100 年 14.5 秒）。
// 2 体の楕円軌道モデルの精度の問題ではなく、入力に摂動で揺れた瞬間値を使ったための誤差なので、
// 入力は平均要素にしている（許容誤差は 6 秒のまま）。
//
// モデルが省いているもの：章動、歳差による ϖ の年内変化、惑星・月による摂動、
// 光行差（見かけの黄経に含まれる −20.5″ ≒ 1.4 秒分）。
//
// 検証の範囲：基準年 2000・2026・2050・2100 × 観測者経度 0°・−75°・135°・175°
// × 緯度 −60°・−33.87°・0°・35.68°・60°（各 31 日付）。地方平均時 = UTC + 経度/15 h なので、
// 実側の地方 0 時は経度ごとの UTC オフセットで求める。日付はどの組でも 31/31 で比較できた
// （緯度 60° でも日の出・日没のない日はない。なければ読み飛ばし、8 割以上の比較を要求する）。
//
// 実測した最大誤差（基準年・経度をまたいだ最悪値。経度による差は 0.1 秒未満）：
//  - 均時差（各年）：2000 年 1.5 秒、2026 年 2.1 秒、2050 年 1.4 秒、2100 年 1.5 秒
//  - 日没：φ=−60 で 5.1 秒（2026 年 6/9）、φ=−33.87 で 3.1 秒、φ=0 で 2.7 秒、
//    φ=35.68 で 2.7 秒、φ=60 で 4.5 秒（2050 年）
//  - 日の出：φ=−60 で 3.8 秒、φ=−33.87 で 1.9 秒、φ=0 で 2.1 秒、
//    φ=35.68 で 2.7 秒、φ=60 で 4.4 秒（2100 年）
//  - 高緯度（±60°）で大きくなるのは、日の出・日没の時刻が太陽の高度（赤緯）に敏感で、
//    省略した章動・光行差・摂動の赤緯誤差が時刻誤差に拡大されるため
//    （1/cos φ·cos δ·sin H に比例）。基準年による差は平均要素を使えば 1 秒程度。

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

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** 許容誤差 [秒]。実測は最大 数秒（章動・光行差・摂動の省略分）なので 6 秒に締める */
const TOLERANCE_S = 6;
/** 実際の太陽に日の出・日没がある日のうち、比較できた日の割合の下限 */
const MIN_COVERAGE = 0.8;

// ---------------------------------------------------------------- 基準年・経度ごとの文脈

/**
 * 基準年の軌道要素（モデルへの入力値）。
 *  - ϖ・e：平均要素（Simon et al. 1994 / IAU の年代式）の年央値
 *  - ε：IAU 2006 の平均黄道傾斜の年央値
 * 近日点の瞬間から直接導出した値（apsisVarpi・apsisE）は、照合用に併せて返す。
 */
function referenceElements(year: number) {
  const first = SearchPlanetApsis(Body.Earth, new Date(Date.UTC(year, 0, 1)));
  const second = NextPlanetApsis(Body.Earth, first);
  const [peri, aph] =
    first.kind === ApsisKind.Pericenter ? [first, second] : [second, first];
  const apsisVarpi = SunPosition(peri.time).elon;
  const apsisE = (aph.dist_au - peri.dist_au) / (aph.dist_au + peri.dist_au);
  // T は J2000 からのユリウス世紀（年央）
  const T = (year + 0.5 - 2000) / 100;
  // 太陽の見かけの黄経での近日点 = 地球の日心近日点黄経（当日の春分点基準）+ 180°
  const varpi = 180 + 102.93735 + 1.71946 * T + 0.00046 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  // 平均黄道傾斜 [″]（IAU 2006）
  const epsilon = (84381.406 - 46.836769 * T - 0.0001831 * T * T) / 3600;
  return {
    varpi,
    e,
    epsilon,
    apsisVarpi,
    apsisE,
    periTime: peri.time.date,
  };
}

/** 基準年 × 観測者経度ごとの定数・ヘルパー */
function createContext(year: number, longitude: number) {
  // モデルの「時」は地方平均時 = UTC + 経度/15 h
  const utcOffsetH = longitude / 15;
  const elements = referenceElements(year);

  const earthParams = (phi: number): Params => ({
    epsilon: elements.epsilon,
    e: elements.e,
    varpi: elements.varpi,
    phi,
    h0: -0.833,
  });

  /** 観測日（地方日付）の 0 時（地方平均時）の UTC ミリ秒 */
  const localMidnightMs = (month: number, day: number): number =>
    Date.UTC(year, month, day) - utcOffsetH * HOUR_MS;

  /**
   * 太陽中心の幾何学的高度が h0 になる、その日の日の出(+1)/日没(−1)。
   * 極夜・白夜などでその日に起きなければ null
   */
  const realRiseSet = (
    phi: number,
    direction: 1 | -1,
    midnightMs: number,
    h0 = -0.833,
  ): Date | null => {
    const observer = new Observer(phi, longitude, 0);
    const t = SearchAltitude(
      Body.Sun,
      observer,
      direction,
      new Date(midnightMs),
      1,
      h0,
    );
    return t === null ? null : t.date;
  };

  /** 検証する日付（基準年を約 12 日おきに）。[月(0 始まり), 日] */
  const dates: [number, number][] = [];
  for (let doy = 3; doy < 365; doy += 12) {
    const d = new Date(Date.UTC(year, 0, 1 + doy));
    dates.push([d.getUTCMonth(), d.getUTCDate()]);
  }

  return {
    year,
    longitude,
    utcOffsetH,
    elements,
    earthParams,
    localMidnightMs,
    realRiseSet,
    dates,
  };
}

type Context = ReturnType<typeof createContext>;

// 既存の自己検証は 2026 年・東経 135° の文脈で行う
const REF = createContext(2026, 135);
const REF_YEAR = REF.year;
const LONGITUDE = REF.longitude;
const ELEMENTS = REF.elements;
const localMidnightMs = REF.localMidnightMs;
const realRiseSet = (
  phi: number,
  direction: 1 | -1,
  midnightMs: number,
): Date => {
  const t = REF.realRiseSet(phi, direction, midnightMs);
  if (t === null) throw new Error("rise/set not found");
  return t;
};

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

/** 時刻 t_s の近傍 3 日のイベントから、t_s での時刻 [h] を 2 次補間で求める。起きない日があれば null */
function modelEventHours(
  params: Params,
  kind: "sunrise" | "sunset",
  tS: number,
): number | null {
  const pick = (n: number) => {
    const ev = dayEvents(params, EARTH, n)[kind];
    return ev.kind === "event" ? ev : null;
  };
  // t_s にいちばん近いイベントの日を探す
  const base = Math.floor(tS);
  let best = base;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let n = base - 1; n <= base + 1; n++) {
    const ev = pick(n);
    if (ev === null) return null;
    const gap = Math.abs(ev.t - tS);
    if (gap < bestGap) {
      bestGap = gap;
      best = n;
    }
  }
  const pts: { t: number; h: number }[] = [];
  for (const n of [best - 1, best, best + 1]) {
    const ev = pick(n);
    if (ev === null) return null;
    pts.push({ t: ev.t, h: ev.hours });
  }
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

/** 日の出・日没を比較し、最悪誤差と比較できた日数を返す */
function compareRiseSet(ctx: Context, phi: number, kind: "sunrise" | "sunset") {
  const direction = kind === "sunset" ? -1 : 1;
  const p = ctx.earthParams(phi);
  const worst: Worst = { errS: 0, label: "" };
  let compared = 0;
  for (const [m, d] of ctx.dates) {
    const mid = ctx.localMidnightMs(m, d);
    const ev = ctx.realRiseSet(phi, direction, mid);
    if (ev === null) continue; // 実際の太陽に日の出・日没がない日
    const realH = (ev.getTime() - mid) / HOUR_MS;
    const lam = apparentLongitude(ev);
    const tS = timeOfLongitude(p, EARTH, lam);
    const modelH = modelEventHours(p, kind, tS);
    if (modelH === null) continue; // モデル側に日の出・日没がない（境界日）
    compared++;
    trackWorst(
      worst,
      wrap12(modelH - realH) * 3600,
      `${m + 1}/${d} λ=${lam.toFixed(3)}`,
    );
  }
  return { worst, compared };
}

describe("モデル（地球パラメータ）と astronomy-engine の照合", () => {
  const params = REF.earthParams(35.68);

  it("timeOfLongitude は指定した黄経の瞬間を返す", () => {
    for (const lam of [0, 90, 180, 270, 283, 359]) {
      const t = timeOfLongitude(params, EARTH, lam);
      const got = sunAt(params, EARTH, t).lambda;
      expect(Math.abs(wrap12((got - lam) / 15) * 15)).toBeLessThan(1e-6);
    }
  });

  it("均時差が一致する（同じ見かけの黄経どうし）", () => {
    const worst: Worst = { errS: 0, label: "" };
    for (const [m, d] of REF.dates) {
      const date = new Date(Date.UTC(REF_YEAR, m, d, 12));
      const lam = apparentLongitude(date);
      const t = timeOfLongitude(params, EARTH, lam);
      const modelS = sunAt(params, EARTH, t).equationOfTime * 3600;
      const realS = realEquationOfTime(date) * 3600;
      trackWorst(worst, modelS - realS, `${m + 1}/${d} λ=${lam.toFixed(3)}`);
    }
    expect(Math.abs(worst.errS), worst.label).toBeLessThan(TOLERANCE_S);
  });
});

// ---------------------------------------------------------------- 基準年 × 経度 × 緯度の網羅

const YEARS = [2000, 2026, 2050, 2100];
const LONGITUDES = [0, -75, 135, 175];
const LATITUDES = [-60, -33.87, 0, 35.68, 60];

describe("基準年ごとの軌道要素の導出", () => {
  for (const year of YEARS) {
    it(`${year} 年：近日点が 1 月上旬、要素が妥当な範囲にある`, () => {
      const el = createContext(year, 0).elements;
      expect(el.periTime.getUTCMonth()).toBe(0);
      expect(el.periTime.getUTCDate()).toBeGreaterThanOrEqual(1);
      expect(el.periTime.getUTCDate()).toBeLessThanOrEqual(6);
      // 平均要素と、近日点の瞬間から直接導出した値は摂動の分（ϖ ±2°、e ±0.0001）しか違わない
      expect(Math.abs(el.varpi - el.apsisVarpi)).toBeLessThan(2);
      expect(Math.abs(el.e - el.apsisE)).toBeLessThan(0.0001);
      expect(el.varpi).toBeGreaterThan(282.5);
      expect(el.varpi).toBeLessThan(285);
      expect(el.e).toBeGreaterThan(0.0165);
      expect(el.e).toBeLessThan(0.0169);
      expect(el.epsilon).toBeGreaterThan(23.4);
      expect(el.epsilon).toBeLessThan(23.45);
    });
  }
});

describe("均時差：基準年ごとの照合", () => {
  for (const year of YEARS) {
    it(`${year} 年`, () => {
      const ctx = createContext(year, 0);
      const p = ctx.earthParams(0);
      const worst: Worst = { errS: 0, label: "" };
      for (const [m, d] of ctx.dates) {
        const date = new Date(Date.UTC(year, m, d, 12));
        const lam = apparentLongitude(date);
        const t = timeOfLongitude(p, EARTH, lam);
        const modelS = sunAt(p, EARTH, t).equationOfTime * 3600;
        trackWorst(
          worst,
          modelS - realEquationOfTime(date) * 3600,
          `${m + 1}/${d}`,
        );
      }
      expect(Math.abs(worst.errS), worst.label).toBeLessThan(TOLERANCE_S);
    });
  }
});

describe("日の出・日没：基準年 × 経度 × 緯度", () => {
  for (const year of YEARS) {
    for (const lon of LONGITUDES) {
      const ctx = createContext(year, lon);
      for (const phi of LATITUDES) {
        for (const kind of ["sunset", "sunrise"] as const) {
          it(`${year} 年 経度${lon}° 緯度${phi}° ${kind === "sunset" ? "日没" : "日の出"}`, () => {
            const { worst, compared } = compareRiseSet(ctx, phi, kind);
            expect(compared / ctx.dates.length).toBeGreaterThanOrEqual(
              MIN_COVERAGE,
            );
            expect(Math.abs(worst.errS), worst.label).toBeLessThan(TOLERANCE_S);
          });
        }
      }
    }
  }
});
