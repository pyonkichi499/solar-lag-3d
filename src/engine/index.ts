// 計算エンジンの公開 API。React などのフレームワークに依存しない。
import { riseSetOf, transitOf } from "./events";
import { findLag } from "./extrema";
import { DEG, wrap } from "./orbit";
import {
  summerSolsticeTime,
  sunStateAt,
  timeOfLongitudeImpl,
  winterSolsticeTime,
} from "./sun";
import type {
  BodyConstants,
  DayRow,
  LagKind,
  LagResult,
  Params,
  RiseSetEvent,
  SceneState,
  SunState,
  Time,
  YearResult,
} from "./types";

export type * from "./types";

export const EARTH: BodyConstants = {
  yearDays: 365.2422,
  siderealDayRatio: 365.2422 / 366.2422,
};

/** 時刻 t の太陽の状態 */
export function sunAt(params: Params, body: BodyConstants, t: Time): SunState {
  return sunStateAt(params, body, t);
}

/** 太陽黄経が lambdaDeg になる瞬間（0 ≤ t < yearDays） */
export function timeOfLongitude(
  params: Params,
  body: BodyConstants,
  lambdaDeg: number,
): Time {
  return timeOfLongitudeImpl(params, body, lambdaDeg);
}

function dayLengthOf(rise: RiseSetEvent, set: RiseSetEvent): number {
  if (rise.kind === "polarDay" || set.kind === "polarDay") return 24;
  if (rise.kind === "polarNight" || set.kind === "polarNight") return 0;
  return set.hours - rise.hours;
}

/** 実数の日 n での昼の長さ（日の出と日没の両方があるときだけ。なければ null） */
function continuousDayLength(
  params: Params,
  body: BodyConstants,
  n: number,
): number | null {
  const { sunrise, sunset } = dayEvents(params, body, n);
  if (sunrise.kind !== "event" || sunset.kind !== "event") return null;
  return sunset.hours - sunrise.hours;
}

function refineMaxDayLength(
  params: Params,
  body: BodyConstants,
  lo: number,
  hi: number,
): number {
  const golden = (Math.sqrt(5) - 1) / 2;
  const f = (n: number) =>
    continuousDayLength(params, body, n) ?? Number.NEGATIVE_INFINITY;
  let a = lo;
  let b = hi;
  let c = b - golden * (b - a);
  let d = a + golden * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 60; i++) {
    if (fc >= fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - golden * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + golden * (b - a);
      fd = f(d);
    }
  }
  return Math.max(fc, fd);
}

/** 日 n の日の出・日没・南中 */
export function dayEvents(
  params: Params,
  body: BodyConstants,
  day: number,
): DayRow {
  const transit = transitOf(params, body, day);
  const sunrise = riseSetOf(params, body, day, -1, transit);
  const sunset = riseSetOf(params, body, day, 1, transit);
  return {
    day,
    daysFromSolstice: day - summerSolsticeTime(params, body),
    sunrise,
    sunset,
    transit: transit.hours,
    equationOfTime: transit.sun.equationOfTime,
    dayLength: dayLengthOf(sunrise, sunset),
  };
}

export interface ComputeYearOptions {
  /** days に含める範囲（夏至からの日数）。既定は −yearDays/2 − 20 〜 +yearDays/2 + 20 */
  from?: number;
  to?: number;
}

const LAG_KINDS: LagKind[] = [
  "latestSunset",
  "earliestSunrise",
  "earliestSunset",
  "latestSunrise",
];

/** 1 年分の曲線と 4 種類のズレ */
export function computeYear(
  params: Params,
  body: BodyConstants,
  options: ComputeYearOptions = {},
): YearResult {
  const half = body.yearDays / 2;
  const from = options.from ?? -half - 20;
  const to = options.to ?? half + 20;
  const ts = summerSolsticeTime(params, body);
  const tw = winterSolsticeTime(params, body);

  const days: DayRow[] = [];
  for (let n = Math.ceil(ts + from); n <= ts + to; n++)
    days.push(dayEvents(params, body, n));

  const lags = {} as Record<LagKind, LagResult>;
  for (const k of LAG_KINDS) lags[k] = findLag(params, body, k);

  let dayLength: YearResult["dayLength"] = null;
  if (params.epsilon !== 0) {
    // 夏至の前後半年は整数日ごとの昼の長さの最大を取る（夏至を含む日を必ず含む）
    // 夏至の瞬間がちょうど正午（日の中央）に来る日の昼の長さ。日の境界の取り方に依存しない
    const atSolstice = dayEvents(params, body, ts - 0.5).dayLength;
    let max = atSolstice;
    let bestN = Math.round(ts);
    for (let n = Math.ceil(ts - half); n <= ts + half; n++) {
      const len = dayEvents(params, body, n).dayLength;
      if (len > max) {
        max = len;
        bestN = n;
      }
    }
    // 整数日の最大の前後 1 日を、実数の日として黄金分割探索で精密化する
    max = Math.max(max, refineMaxDayLength(params, body, bestN - 1, bestN + 1));
    dayLength = { atSolstice, max };
  }

  return {
    hemisphere: params.phi >= 0 ? "north" : "south",
    summerSolstice: ts,
    winterSolstice: tw,
    days,
    lags,
    dayLength,
  };
}

/**
 * 時刻 t の 3D の状態。
 * 惑星は黄経 λ + 180° の方向（太陽から見て）に置く。
 * 自転軸は慣性空間で固定の (0, sin ε, cos ε)。λ = 90°（6 月至点）では惑星が −y 側にあり、
 * 太陽方向は +y なので、北極が太陽側に傾く。赤緯は sin δ = 軸 · 太陽方向 = sin ε sin λ と一致する。
 */
export function sceneState(
  params: Params,
  body: BodyConstants,
  t: Time,
): SceneState {
  const sun = sunStateAt(params, body, t);
  const lonPlanet = (sun.lambda + 180) * DEG;
  const eps = params.epsilon * DEG;
  const perihelion = (params.varpi + 180) * DEG;
  return {
    sun,
    planetPosition: [
      sun.distance * Math.cos(lonPlanet),
      sun.distance * Math.sin(lonPlanet),
      0,
    ],
    axisDirection: [0, Math.sin(eps), Math.cos(eps)],
    perihelionDirection: [Math.cos(perihelion), Math.sin(perihelion), 0],
    localMeanTime: wrap(t, 1) * 24,
  };
}
