// 地平線の視点の純粋な計算（three.js 非依存）。
// 座標：東 = +x、北 = +y、天頂 = +z。方位角は北 = 0°、東回り。
import { type BodyConstants, EARTH, type Params, sunAt } from "../engine";
import type { Vec3 } from "./geometry";

const DEG = Math.PI / 180;

export interface AltAz {
  altitudeDeg: number;
  /** 北 = 0、東 = 90、南 = 180、西 = 270 */
  azimuthDeg: number;
}

/**
 * 緯度 phi、赤緯 decl、均時差 E [h]、地方平均時 lmt [h] での太陽の高度・方位角。
 * 時角 H = 15°·(lmt + E − 12)（真の南中 = 12h − E）。午後（H > 0）は西側。
 */
export function altAzOf(
  phi: number,
  decl: number,
  equationOfTime: number,
  lmt: number,
): AltAz {
  const H = 15 * (lmt + equationOfTime - 12) * DEG;
  const p = phi * DEG;
  const d = decl * DEG;
  const sinAlt =
    Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
  const east = -Math.cos(d) * Math.sin(H);
  const north =
    Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H);
  const az = Math.atan2(east, north) / DEG;
  return {
    altitudeDeg: Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG,
    azimuthDeg: (az + 360) % 360,
  };
}

/** モデル時刻 t（t = 0 が地方平均時の 0 時）の太陽の高度・方位角 */
export function sunAltAz(
  params: Params,
  t: number,
  body: BodyConstants = EARTH,
): AltAz {
  const s = sunAt(params, body, t);
  const lmt = 24 * (t - Math.floor(t));
  return altAzOf(params.phi, s.declination, s.equationOfTime, lmt);
}

/**
 * 空のドーム上の点。南中が必ず画面の正面（−y）に来るよう、南半球では全体を 180° 回す。
 * yawDeg = 0 なら実際の方位どおり。
 */
export function domePoint(a: AltAz, radius: number, yawDeg: number): Vec3 {
  const alt = a.altitudeDeg * DEG;
  const az = (a.azimuthDeg + yawDeg) * DEG;
  return [
    radius * Math.cos(alt) * Math.sin(az),
    radius * Math.cos(alt) * Math.cos(az),
    radius * Math.sin(alt),
  ];
}

/** 南中の方向を正面にするための回転角。北半球は南を向く（回転なし）、南半球は北を向く */
export const viewYaw = (phi: number): number => (phi >= 0 ? 0 : 180);

/** その日（整数日 day）の 0〜24 時（地方平均時）の太陽の位置。samples + 1 点 */
export function dayPath(params: Params, day: number, samples = 96): AltAz[] {
  return Array.from({ length: samples + 1 }, (_, i) =>
    sunAltAz(params, day + i / samples),
  );
}

/**
 * アナレンマ：現在の日（t の整数部）から 1 年かけて、同じ地方平均時の太陽の位置。
 * 先頭（k = 0）が現在の日。
 */
export function analemmaPoints(
  params: Params,
  t: number,
  yearDays: number = EARTH.yearDays,
  samples = 73,
): AltAz[] {
  const day = Math.floor(t);
  const frac = t - day;
  return Array.from({ length: samples }, (_, k) =>
    sunAltAz(params, day + (k * yearDays) / samples + frac),
  );
}

/** 時刻 [h] を h:mm に（24 時で折り返す） */
export function formatHm(hours: number): string {
  const total = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 時間の長さ [h] を h:mm に（折り返さない） */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
