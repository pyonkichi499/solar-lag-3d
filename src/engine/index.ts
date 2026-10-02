// 計算エンジンの公開 API。React などのフレームワークに依存しない。
import type {
  BodyConstants,
  DayRow,
  Params,
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
export function sunAt(
  _params: Params,
  _body: BodyConstants,
  _t: Time,
): SunState {
  throw new Error("not implemented");
}

/** 太陽黄経が lambdaDeg になる瞬間（0 ≤ t < yearDays） */
export function timeOfLongitude(
  _params: Params,
  _body: BodyConstants,
  _lambdaDeg: number,
): Time {
  throw new Error("not implemented");
}

/** 日 n の日の出・日没・南中 */
export function dayEvents(
  _params: Params,
  _body: BodyConstants,
  _day: number,
): DayRow {
  throw new Error("not implemented");
}

export interface ComputeYearOptions {
  /** days に含める範囲（夏至からの日数）。既定は −yearDays/2 − 20 〜 +yearDays/2 + 20 */
  from?: number;
  to?: number;
}

/** 1 年分の曲線と 4 種類のズレ */
export function computeYear(
  _params: Params,
  _body: BodyConstants,
  _options?: ComputeYearOptions,
): YearResult {
  throw new Error("not implemented");
}

/** 時刻 t の 3D の状態 */
export function sceneState(
  _params: Params,
  _body: BodyConstants,
  _t: Time,
): SceneState {
  throw new Error("not implemented");
}
