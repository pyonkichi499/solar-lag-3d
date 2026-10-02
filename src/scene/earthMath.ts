// 「地球のそばの視点」の純粋な幾何計算（three.js に依存しない）。
// 座標は engine の SceneState に合わせる：黄道座標系、z = 黄道の北極。惑星の中心が原点。
export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** 惑星から太陽へ向かう単位ベクトル（惑星の日心位置の逆向き） */
export function sunDirection(planetPosition: Vec3): Vec3 {
  return norm(scale(planetPosition, -1));
}

/** 真の太陽の時角 [deg]。0 で南中、正は太陽が子午線の西側（午後） */
export function hourAngleDeg(
  localMeanTime: number,
  equationOfTime: number,
): number {
  return 15 * (localMeanTime + equationOfTime - 12);
}

/**
 * 惑星に固定した座標系の基底（すべて黄道座標系の単位ベクトル）。
 * x = 観測者の子午線の赤道上の点、z = 自転軸、y = z × x（東向き）。
 * 時角 H の太陽は、観測者の子午線から西へ H だけ離れている。
 */
export function planetFrame(
  sun: Vec3,
  axis: Vec3,
  hourAngle: number,
): { x: Vec3; y: Vec3; z: Vec3 } {
  // 太陽方向のうち赤道面に平行な成分（軸と太陽が一致する特異ケースは代用の向き）
  let s = add(sun, scale(axis, -dot(sun, axis)));
  if (Math.hypot(...s) < 1e-9) s = cross(axis, [1, 0, 0]);
  s = norm(s);
  // 子午線は太陽から東（北から見て反時計回り）へ H だけ進んだ位置
  const h = hourAngle * DEG;
  const x = add(scale(s, Math.cos(h)), scale(cross(axis, s), Math.sin(h)));
  return { x, y: cross(axis, x), z: axis };
}

/** 観測者（緯度 φ）の位置の向き（惑星中心からの単位ベクトル） */
export function observerVector(
  frame: { x: Vec3; z: Vec3 },
  latitudeDeg: number,
): Vec3 {
  const p = latitudeDeg * DEG;
  return norm(add(scale(frame.x, Math.cos(p)), scale(frame.z, Math.sin(p))));
}

/** 黄道座標のベクトルを惑星固定座標系の成分にする */
export function toPlanetFrame(
  v: Vec3,
  frame: { x: Vec3; y: Vec3; z: Vec3 },
): Vec3 {
  return [dot(v, frame.x), dot(v, frame.y), dot(v, frame.z)];
}

/** 太陽の高度の正弦（観測者の地平線から見た値）。太陽は単位ベクトル */
export function sunElevationSin(observer: Vec3, sun: Vec3): number {
  return dot(observer, sun);
}

/**
 * 惑星固定座標系での緯度円上の経度 lonRad の点が、太陽高度 h0 より上（昼）か。
 * sun は惑星固定座標系の太陽方向。
 */
export function isDaylit(
  sunLocal: Vec3,
  latitudeDeg: number,
  lonRad: number,
  h0Deg: number,
): boolean {
  const p = latitudeDeg * DEG;
  const point: Vec3 = [
    Math.cos(p) * Math.cos(lonRad),
    Math.cos(p) * Math.sin(lonRad),
    Math.sin(p),
  ];
  return dot(point, sunLocal) > Math.sin(h0Deg * DEG);
}

/** 時間 [h] を h:mm にする（分は四捨五入。60 分は繰り上げる） */
export function formatHM(hours: number): string {
  const total = Math.round(Math.max(0, hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
