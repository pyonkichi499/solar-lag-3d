// 太陽の状態（黄経・赤緯・赤経・均時差）。
import {
  DEG,
  meanAnomalyAt,
  meanAnomalyAtEquinox,
  meanFromTrue,
  solveKepler,
  TWO_PI,
  trueFromEccentric,
  wrap,
} from "./orbit";
import type { BodyConstants, Params, SunState, Time } from "./types";

export function sunStateAt(p: Params, b: BodyConstants, t: Time): SunState {
  const m = meanAnomalyAt(p, b, t);
  const ea = solveKepler(m, p.e);
  const nu = trueFromEccentric(ea, p.e);
  const varpi = p.varpi * DEG;
  const lam = nu + varpi;
  const eps = p.epsilon * DEG;

  const sinDec = Math.sin(eps) * Math.sin(lam);
  const declination = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  // 赤経は平均黄経 L に最も近い分枝に取り、時間に対して連続にする
  const meanLon = m + varpi;
  const alpha0 = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const alpha = alpha0 + TWO_PI * Math.round((meanLon - alpha0) / TWO_PI);

  return {
    lambda: wrap(lam / DEG, 360),
    rightAscension: alpha / DEG,
    declination: declination / DEG,
    equationOfTime: (meanLon - alpha) / DEG / 15,
    distance: 1 - p.e * Math.cos(ea),
    meanAnomaly: wrap(m / DEG, 360),
    trueAnomaly: wrap(nu / DEG, 360),
  };
}

/** 太陽黄経が lambdaDeg になる瞬間（0 ≤ t < yearDays） */
export function timeOfLongitudeImpl(
  p: Params,
  b: BodyConstants,
  lambdaDeg: number,
): Time {
  const nu = (lambdaDeg - p.varpi) * DEG;
  const dm = meanFromTrue(nu, p.e) - meanAnomalyAtEquinox(p);
  const t = wrap(dm / (TWO_PI / b.yearDays), b.yearDays);
  return t > b.yearDays - 1e-10 ? 0 : t;
}

/** 夏至（北半球 λ = 90°、南半球 λ = 270°）の瞬間 */
export function summerSolsticeTime(p: Params, b: BodyConstants): Time {
  return timeOfLongitudeImpl(p, b, p.phi >= 0 ? 90 : 270);
}

export function winterSolsticeTime(p: Params, b: BodyConstants): Time {
  return timeOfLongitudeImpl(p, b, p.phi >= 0 ? 270 : 90);
}
