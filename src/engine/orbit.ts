// 軌道（ケプラー方程式）まわりの内部関数。角度はラジアン。
import type { BodyConstants, Params } from "./types";

export const DEG = Math.PI / 180;
export const TWO_PI = 2 * Math.PI;

const KEPLER_TOL = 1e-12;
const KEPLER_MAX_ITER = 50;

/** ケプラー方程式 E − e sin E = M を Newton 法で解く。M は任意の値でよい */
export function solveKepler(m: number, e: number): number {
  const k = Math.round(m / TWO_PI);
  const mr = m - k * TWO_PI;
  let ea = mr;
  for (let i = 0; i < KEPLER_MAX_ITER; i++) {
    const d = (ea - e * Math.sin(ea) - mr) / (1 - e * Math.cos(ea));
    ea -= d;
    if (Math.abs(d) < KEPLER_TOL) break;
  }
  return ea + k * TWO_PI;
}

/** 離心近点角 → 真近点角（(−π, π]） */
export function trueFromEccentric(ea: number, e: number): number {
  return Math.atan2(Math.sqrt(1 - e * e) * Math.sin(ea), Math.cos(ea) - e);
}

/** 真近点角 → 平均近点角。真近点角が連続なら連続な値を返す範囲は (−π, π] */
export function meanFromTrue(nu: number, e: number): number {
  const ea = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
  return ea - e * Math.sin(ea);
}

/** 春分（λ = 0、ν = −ϖ）の瞬間の平均近点角 M₀ */
export function meanAnomalyAtEquinox(p: Params): number {
  return meanFromTrue(-p.varpi * DEG, p.e);
}

/** 時刻 t の平均近点角（折り返さない連続値） */
export function meanAnomalyAt(p: Params, b: BodyConstants, t: number): number {
  return meanAnomalyAtEquinox(p) + (TWO_PI / b.yearDays) * t;
}

/** [0, mod) に折り返す */
export function wrap(x: number, mod: number): number {
  const r = x % mod;
  return r < 0 ? r + mod : r;
}
