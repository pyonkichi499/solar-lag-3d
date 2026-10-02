// 3D の純粋な幾何計算（three.js に依存しない）。座標は engine の SceneState に合わせる：
// 黄道面が xy 平面、x = 春分点方向、z = 黄道の北極、太陽が原点（焦点）、軌道長半径 = 1。
import type { BodyConstants, Params } from "../engine";
import { timeOfLongitude } from "../engine";

export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

/** 太陽黄経 λ [deg] のとき惑星を置く、太陽から見た黄道面上の位置 */
export function planetPositionAtLambda(
  e: number,
  varpiDeg: number,
  lambdaDeg: number,
): Vec3 {
  // 真近点角 ν = λ − ϖ。惑星の日心黄経は λ + 180°
  const nu = (lambdaDeg - varpiDeg) * DEG;
  const r = (1 - e * e) / (1 + e * Math.cos(nu));
  const lon = (lambdaDeg + 180) * DEG;
  return [r * Math.cos(lon), r * Math.sin(lon), 0];
}

/** 軌道の楕円を閉じた点列にしたもの（先頭と末尾が同じ点） */
export function orbitPoints(
  e: number,
  varpiDeg: number,
  segments = 256,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const lambda = varpiDeg + (360 * (i % segments)) / segments;
    pts.push(planetPositionAtLambda(e, varpiDeg, lambda));
  }
  return pts;
}

/** 近日点・遠日点の位置。遠日点は近日点の反対側 */
export function apsides(
  e: number,
  varpiDeg: number,
): { perihelion: Vec3; aphelion: Vec3 } {
  return {
    perihelion: planetPositionAtLambda(e, varpiDeg, varpiDeg),
    aphelion: planetPositionAtLambda(e, varpiDeg, varpiDeg + 180),
  };
}

/** 軌道楕円の中心。焦点（太陽）から遠日点の側へ e だけずれる */
export function orbitCenter(e: number, varpiDeg: number): Vec3 {
  const p = (varpiDeg + 180) * DEG;
  return [-e * Math.cos(p), -e * Math.sin(p), 0];
}

/** 季節の区切り（λ = 0, 90, 180, 270） */
export const SEASON_LAMBDAS = [0, 90, 180, 270] as const;

/** 季節の区切りの軌道上の位置 */
export function seasonMarkers(
  e: number,
  varpiDeg: number,
): { lambda: number; position: Vec3 }[] {
  return SEASON_LAMBDAS.map((lambda) => ({
    lambda,
    position: planetPositionAtLambda(e, varpiDeg, lambda),
  }));
}

/**
 * 太陽黄経が 0→90, 90→180, 180→270, 270→360 の区間の長さ [日]。
 * 4 つの合計は 1 年の長さに一致する。
 */
export function seasonLengths(
  params: Params,
  body: BodyConstants,
): [number, number, number, number] {
  const t = SEASON_LAMBDAS.map((l) => timeOfLongitude(params, body, l));
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    let d = (t[(i + 1) % 4] ?? 0) - (t[i] ?? 0);
    while (d <= 0) d += body.yearDays;
    out[i] = d;
  }
  return out as [number, number, number, number];
}

/** 近日点・遠日点の距離（軌道長半径 = 1） */
export function apsisDistances(e: number): {
  perihelion: number;
  aphelion: number;
} {
  return { perihelion: 1 - e, aphelion: 1 + e };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/**
 * 観測者の位置の向き（惑星中心からの単位ベクトル）。
 * 地方平均時 12h に子午線が（惑星から見た）太陽の方向を向き、1 時間で 15° 東向き（北から見て反時計回り）に回る。
 * 太陽の方向は軸に垂直な成分で近似する（見た目のための簡易表現）。
 */
export function observerDirection(
  planetPosition: Vec3,
  axis: Vec3,
  latitudeDeg: number,
  localMeanTime: number,
): Vec3 {
  const toSun = norm(scale(planetPosition, -1));
  // 太陽方向のうち赤道面に平行な成分（軸と太陽が一致する特異ケースは x 軸で代用）
  let s = add(toSun, scale(axis, -dot(toSun, axis)));
  if (Math.hypot(...s) < 1e-9) s = [1, 0, 0];
  s = norm(s);
  const ang = (localMeanTime - 12) * 15 * DEG;
  const d = add(scale(s, Math.cos(ang)), scale(cross(axis, s), Math.sin(ang)));
  const phi = latitudeDeg * DEG;
  return norm(add(scale(d, Math.cos(phi)), scale(axis, Math.sin(phi))));
}
