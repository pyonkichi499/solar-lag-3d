// アナレンマ（毎日同じ時刻の太陽の位置）の描画データ。縦は赤緯、横は均時差（時角に換算）。
import {
  type BodyConstants,
  EARTH,
  type Params,
  sunAt,
  timeOfLongitude,
} from "../engine";

export interface AnalemmaPoint {
  /** 春分からの経過日数 */
  t: number;
  /** 太陽の時角のずれ [deg]。地方平均時の同じ時刻に、真の太陽が子午線からどれだけ西にずれるか（15° × 均時差 [h]） */
  x: number;
  /** 赤緯 [deg] */
  y: number;
}

export interface AnalemmaModel {
  /** 1 年分の閉じた曲線 */
  curve: AnalemmaPoint[];
  /** 太陽黄経が 0・90・180・270° の点（春分・夏至・秋分・冬至に相当） */
  marks: (AnalemmaPoint & { lambda: number })[];
}

function pointAt(p: Params, body: BodyConstants, t: number): AnalemmaPoint {
  const sun = sunAt(p, body, t);
  return { t, x: 15 * sun.equationOfTime, y: sun.declination };
}

/** 年間の曲線。t は 0〜yearDays を等間隔に取る（最後の点は最初の点と同じ位置に戻る） */
export function analemmaModel(
  p: Params,
  body: BodyConstants = EARTH,
  steps = 366,
): AnalemmaModel {
  const curve: AnalemmaPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    curve.push(pointAt(p, body, (body.yearDays * i) / steps));
  }
  const marks = [0, 90, 180, 270].map((lambda) => ({
    ...pointAt(p, body, timeOfLongitude(p, body, lambda)),
    lambda,
  }));
  return { curve, marks };
}

/** 日付カーソルの位置（夏至の瞬間から day 日後） */
export function analemmaCursor(
  p: Params,
  summerSolstice: number,
  day: number,
  body: BodyConstants = EARTH,
): AnalemmaPoint {
  return pointAt(p, body, summerSolstice + day);
}

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 複数のセットを重ねるための範囲（余白つき）。縦横とも 0 を含み、幅・高さが 0 にならない */
export function analemmaBounds(models: AnalemmaModel[], pad = 0.08): Bounds {
  let xMin = 0;
  let xMax = 0;
  let yMin = 0;
  let yMax = 0;
  for (const m of models) {
    for (const q of m.curve) {
      xMin = Math.min(xMin, q.x);
      xMax = Math.max(xMax, q.x);
      yMin = Math.min(yMin, q.y);
      yMax = Math.max(yMax, q.y);
    }
  }
  const w = Math.max(xMax - xMin, 1);
  const h = Math.max(yMax - yMin, 1);
  return {
    xMin: xMin - w * pad,
    xMax: xMax + w * pad,
    yMin: yMin - h * pad,
    yMax: yMax + h * pad,
  };
}
