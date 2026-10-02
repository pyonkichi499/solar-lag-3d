// 計算エンジンの公開型。仕様は docs/requirements.md §3, §8.1。
// 角度はすべて度、時刻は地方平均時の時間（h）、日数は平均太陽日。

/** ユーザーが操作するパラメータ */
export interface Params {
  /** 地軸の傾き ε [deg]（0〜89.9） */
  epsilon: number;
  /** 離心率 e（0〜0.5） */
  e: number;
  /** 近日点通過時の太陽黄経 ϖ [deg]（0〜360、地球は 283） */
  varpi: number;
  /** 緯度 φ [deg]（−89.9〜89.9） */
  phi: number;
  /** 日没・日の出とみなす太陽中心の高度 h₀ [deg] */
  h0: number;
}

/** 天体の定数。R1 では EARTH 固定 */
export interface BodyConstants {
  /** 1 年の長さ [平均太陽日] */
  yearDays: number;
  /** 恒星日 / 平均太陽日 */
  siderealDayRatio: number;
}

/**
 * 時刻 t：春分（太陽黄経 0°）の瞬間からの経過日数。
 * 春分の瞬間を暦の 3/20 0:00（地方平均時）とみなすので、整数の t は各日の 0 時にあたる。
 * 日 n の時刻 h の瞬間は t = n + h / 24。
 */
export type Time = number;

/** ある瞬間の太陽の状態 */
export interface SunState {
  /** 太陽黄経 λ [deg]（0〜360） */
  lambda: number;
  /** 赤経 α [deg]（平均黄経 L に最も近い分枝。連続） */
  rightAscension: number;
  /** 赤緯 δ [deg] */
  declination: number;
  /** 均時差 E = (L − α) / 15 [h]。真の南中 = 12h − E */
  equationOfTime: number;
  /** 太陽との距離 [軌道長半径 = 1] */
  distance: number;
  /** 平均近点角 M [deg] */
  meanAnomaly: number;
  /** 真近点角 ν [deg] */
  trueAnomaly: number;
}

/** 日の出・日没の結果 */
export type RiseSetEvent =
  | {
      kind: "event";
      /** 発生の瞬間 */
      t: Time;
      /** その日の 0 時からの時刻 [h]。24 時で折り返さない連続値 */
      hours: number;
    }
  | { kind: "polarDay" }
  | { kind: "polarNight" };

/** 1 日分の値 */
export interface DayRow {
  /** 日の番号 n（その日の 0 時が t = n） */
  day: number;
  /** 基準の夏至の瞬間からの日数（その日の 0 時基準） */
  daysFromSolstice: number;
  sunrise: RiseSetEvent;
  sunset: RiseSetEvent;
  /** 真の南中時刻 [h] */
  transit: number;
  /** 南中時の均時差 [h] */
  equationOfTime: number;
  /** 昼の長さ [h]。白夜は 24、極夜は 0 */
  dayLength: number;
}

export type LagKind =
  | "latestSunset" // 夏至基準・日没時刻の極大
  | "earliestSunrise" // 夏至基準・日の出時刻の極小
  | "earliestSunset" // 冬至基準・日没時刻の極小
  | "latestSunrise"; // 冬至基準・日の出時刻の極大

/** ズレの結果（§3.4） */
export type LagResult =
  | {
      kind: "peak";
      /** 基準の至点の瞬間から、極値となるイベントの瞬間までの日数 */
      lagDays: number;
      /** イベントの瞬間 */
      t: Time;
      /** イベントの時刻 [h] */
      hours: number;
      /** 至点の前後半年の範囲にある、採用しなかった局所極値の数 */
      otherExtrema: number;
    }
  | {
      kind: "polarBoundary";
      /** 基準の至点の瞬間から、白夜・極夜の境界の瞬間までの日数 */
      lagDays: number;
      t: Time;
      boundary: "polarDay" | "polarNight";
      /** 至点の前後半年の範囲にある、滑らかな局所極値（山）の数 */
      otherExtrema: number;
    }
  | {
      kind: "undefined";
      /** noSolstice: ε = 0。noEvents: 範囲内にイベントが存在しない */
      reason: "noSolstice" | "noEvents";
    };

export interface YearResult {
  /** 緯度 ≥ 0 なら north（夏至 = λ 90°）、緯度 < 0 なら south（夏至 = λ 270°） */
  hemisphere: "north" | "south";
  /** 基準の夏至・冬至の瞬間 */
  summerSolstice: Time;
  winterSolstice: Time;
  /** グラフ用の日ごとの値。範囲は夏至の前後（computeYear の options で指定） */
  days: DayRow[];
  lags: Record<LagKind, LagResult>;
  /** 参考値（§3.4, Q42）。ε = 0 のときは null */
  dayLength: {
    /** 夏至を含む日の昼の長さ [h] */
    atSolstice: number;
    /** 夏至の前後半年で最長の昼の長さ [h] */
    max: number;
  } | null;
}

/** 3D 描画用の状態（黄道座標系・右手系・距離は軌道長半径 = 1） */
export interface SceneState {
  sun: SunState;
  /** 太陽を原点とした惑星の位置。x 軸 = 春分点方向、z 軸 = 黄道の北極 */
  planetPosition: [number, number, number];
  /** 自転軸（北極）の向き。単位ベクトル */
  axisDirection: [number, number, number];
  /** 近日点の方向（太陽から見た単位ベクトル） */
  perihelionDirection: [number, number, number];
  /** 観測者の子午線の地方平均時 [h]（0〜24） */
  localMeanTime: number;
}
