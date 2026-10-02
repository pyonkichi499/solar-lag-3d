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

  // 不動点反復で収束し、その点でも cos H が [−1, 1] に収まるなら本物の日没・日の出
  let t = transit.t;
  let converged = false;
  for (let i = 0; i < MAX_ITER; i++) {
    const sun = sunStateAt(p, b, t);
    if (Math.abs(cosHourAngle(p, sun)) > 1) break;
    const tn = n + eventHours(p, sun, sign) / 24;
    const d = Math.abs(tn - t);
    t = tn;
    if (d < TOL_DAYS) {
      converged = true;
      break;
    }
  }
  if (converged && Math.abs(cosHourAngle(p, sunStateAt(p, b, t))) <= 1)
    return { kind: "event", t, hours: 24 * (t - n) };

  // 白夜・極夜の境界の近くでは、日没・日の出の瞬間に太陽が h₀ を横切らないことがある。
  // 高度が h₀ を横切る点を南中から前後に走査して求め、なければ白夜・極夜とする
  const root = crossing(p, b, n, sign, transit);
  if (root === null) return { kind: "polarDay" };
  return { kind: "event", t: root, hours: 24 * (root - n) };
}

/** sin(高度) − sin(h₀)。時刻 t（実数の日）での値 */
function altitudeExcess(p: Params, b: BodyConstants, n: number, t: number) {
  const sun = sunStateAt(p, b, t);
  const phi = p.phi * DEG;
  const dec = sun.declination * DEG;
  const ha = 15 * (24 * (t - n) + sun.equationOfTime - 12) * DEG;
  return (
    Math.sin(phi) * Math.sin(dec) +
    Math.cos(phi) * Math.cos(dec) * Math.cos(ha) -
    Math.sin(p.h0 * DEG)
  );
}

const SCAN_STEPS = 48;
const SCAN_SPAN = 0.6;

// 南中（高度 > h₀）から日没側（sign = +1）・日の出側（−1）へ走査し、
// 高度が h₀ を下回る最初の点を二分法で求める。見つからなければ null
function crossing(
  p: Params,
  b: BodyConstants,
  n: number,
  sign: 1 | -1,
  transit: Transit,
): number | null {
  const f = (t: number) => altitudeExcess(p, b, n, t);
  let prev = transit.t;
  for (let i = 1; i <= SCAN_STEPS; i++) {
    const cur = transit.t + (sign * i * SCAN_SPAN) / SCAN_STEPS;
    if (f(cur) < 0) {
      let above = prev;
      let below = cur;
      for (let k = 0; k < 100; k++) {
        const mid = (above + below) / 2;
        if (f(mid) >= 0) above = mid;
        else below = mid;
      }
      return (above + below) / 2;
    }
    prev = cur;
  }
  return null;
}
