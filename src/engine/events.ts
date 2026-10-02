// 日の出・日没・南中。反復は 1 秒より十分に細かく収束させる（極値探索のノイズを避けるため）。
import { DEG } from "./orbit";
import { sunStateAt } from "./sun";
import type {
  BodyConstants,
  Params,
  RiseSetEvent,
  SunState,
  Time,
} from "./types";

const TOL_DAYS = 1e-12;
const MAX_ITER = 100;

export interface Transit {
  t: Time;
  /** 日の 0 時からの時刻 [h] */
  hours: number;
  sun: SunState;
}

/** 日 n（実数も可）の真の南中。t = n + (12 − E(t)) / 24 の不動点 */
export function transitOf(p: Params, b: BodyConstants, n: number): Transit {
  let t = n + 0.5;
  let sun = sunStateAt(p, b, t);
  for (let i = 0; i < MAX_ITER; i++) {
    const tn = n + (12 - sun.equationOfTime) / 24;
    const d = Math.abs(tn - t);
    t = tn;
    sun = sunStateAt(p, b, t);
    if (d < TOL_DAYS) break;
  }
  return { t, hours: 24 * (t - n), sun };
}

function cosHourAngle(p: Params, sun: SunState): number {
  const phi = p.phi * DEG;
  const dec = sun.declination * DEG;
  return (
    (Math.sin(p.h0 * DEG) - Math.sin(phi) * Math.sin(dec)) /
    (Math.cos(phi) * Math.cos(dec))
  );
}

/** 日没（sign = +1）または日の出（sign = −1）の時刻 [h]（t での太陽の状態から） */
function eventHours(p: Params, sun: SunState, sign: 1 | -1): number {
  const c = Math.max(-1, Math.min(1, cosHourAngle(p, sun)));
  return 12 + (sign * Math.acos(c)) / DEG / 15 - sun.equationOfTime;
}

/** 日 n（実数も可）の日没・日の出。極値探索では n を実数で連続に動かす */
export function riseSetOf(
  p: Params,
  b: BodyConstants,
  n: number,
  sign: 1 | -1,
  transit: Transit = transitOf(p, b, n),
): RiseSetEvent {
  const c = cosHourAngle(p, transit.sun);
  if (c > 1) return { kind: "polarNight" };
  if (c < -1) return { kind: "polarDay" };

  let t = transit.t;
  let converged = false;
  for (let i = 0; i < MAX_ITER; i++) {
    const tn = n + eventHours(p, sunStateAt(p, b, t), sign) / 24;
    const d = Math.abs(tn - t);
    t = tn;
    if (d < TOL_DAYS) {
      converged = true;
      break;
    }
  }
  if (!converged) t = bisect(p, b, n, sign, transit.t) ?? t;
  return { kind: "event", t, hours: 24 * (t - n) };
}

// 境界のごく近くで不動点反復が収束しないときの保険
function bisect(
  p: Params,
  b: BodyConstants,
  n: number,
  sign: 1 | -1,
  tTransit: number,
): number | null {
  const g = (t: number) =>
    24 * (t - n) - eventHours(p, sunStateAt(p, b, t), sign);
  let lo = tTransit - 0.75;
  let hi = tTransit + 0.75;
  if (g(lo) > 0 || g(hi) < 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
