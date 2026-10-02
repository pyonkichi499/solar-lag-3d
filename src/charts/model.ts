// グラフの純粋なモデル（描画しない）。曲線の分割・白夜の帯・マーカー・軸の範囲を決める。
import { scaleLinear } from "d3-scale";
import type { LagKind, Params, YearResult } from "../engine";
import { EARTH } from "../engine";

export type Pt = [x: number, y: number];

export interface PolarBand {
  kind: "polarDay" | "polarNight";
  x0: number;
  x1: number;
}

export interface LagMarker {
  kind: LagKind;
  style: "peak" | "boundary";
  x: number;
  y: number;
  lagDays: number;
}

export interface SetModel {
  index: number;
  sunrise: Pt[][];
  sunset: Pt[][];
  transit: Pt[][];
  /** 均時差（表示単位） */
  eot: Pt[];
  bands: PolarBand[];
  markers: LagMarker[];
  /** 夏至は常に x = 0 */
  winterX: number;
  /** ε = 0 のときの形式上の至点 */
  formalSolstice: boolean;
  hemisphere: "north" | "south";
}

export type EotUnit = "min" | "h";
export interface Domains {
  time: [number, number];
  eot: { domain: [number, number]; unit: EotUnit };
}

export interface ChartModel {
  xDomain: [number, number];
  domains: Domains;
  sets: SetModel[];
}

export interface BuildOptions {
  show: Record<LagKind, boolean>;
  /** 縦軸の固定時に使う範囲（前回の自動範囲） */
  locked?: Domains | null;
}

const HALF = EARTH.yearDays / 2;
const LAG_ROW: Record<LagKind, "sunrise" | "sunset"> = {
  latestSunset: "sunset",
  earliestSunset: "sunset",
  earliestSunrise: "sunrise",
  latestSunrise: "sunrise",
};

/** 白夜・極夜で曲線を途切れさせ、連続する区間ごとの点列にする */
function splitSeries(
  rows: YearResult["days"],
  key: "sunrise" | "sunset",
): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const r of rows) {
    const ev = r[key];
    if (ev.kind === "event") cur.push([r.daysFromSolstice, ev.hours]);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function polarBands(rows: YearResult["days"]): PolarBand[] {
  const bands: PolarBand[] = [];
  let cur: PolarBand | null = null;
  for (const r of rows) {
    const k =
      r.sunrise.kind !== "event"
        ? r.sunrise.kind
        : r.sunset.kind !== "event"
          ? r.sunset.kind
          : null;
    if (k && cur && cur.kind === k) {
      cur.x1 = r.daysFromSolstice + 1;
    } else {
      cur = k
        ? { kind: k, x0: r.daysFromSolstice, x1: r.daysFromSolstice + 1 }
        : null;
      if (cur) bands.push(cur);
    }
  }
  return bands;
}

function lagMarkers(
  r: YearResult,
  show: Record<LagKind, boolean>,
): LagMarker[] {
  const out: LagMarker[] = [];
  for (const kind of Object.keys(LAG_ROW) as LagKind[]) {
    if (!show[kind]) continue;
    const lag = r.lags[kind];
    if (lag.kind === "peak") {
      out.push({
        kind,
        style: "peak",
        x: lag.t - r.summerSolstice,
        y: lag.hours,
        lagDays: lag.lagDays,
      });
    } else if (lag.kind === "polarBoundary") {
      // 境界に最も近い日の値に載せる
      const x = lag.t - r.summerSolstice;
      const key = LAG_ROW[kind];
      let best: { d: number; y: number } | null = null;
      for (const row of r.days) {
        const ev = row[key];
        if (ev.kind !== "event") continue;
        const d = Math.abs(row.daysFromSolstice - x);
        if (!best || d < best.d) best = { d, y: ev.hours };
      }
      if (best)
        out.push({
          kind,
          style: "boundary",
          x,
          y: best.y,
          lagDays: lag.lagDays,
        });
    }
  }
  return out;
}

/** 冬至の x。±yearDays だけずらした候補のうち原点に近いほうを採る */
function winterOffset(r: YearResult): number {
  const d = r.winterSolstice - r.summerSolstice;
  const cands = [d, d - EARTH.yearDays, d + EARTH.yearDays];
  return cands.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
}

export function buildChartModel(
  results: YearResult[],
  params: Params[],
  opts: BuildOptions,
): ChartModel {
  const xDomain: [number, number] = [-HALF, HALF];
  const inRange = (x: number) => x >= xDomain[0] && x <= xDomain[1];

  // 均時差の単位は全セットの最大振幅で決める（A/B 共通）
  let eotMax = 0;
  for (const r of results)
    for (const d of r.days)
      if (inRange(d.daysFromSolstice))
        eotMax = Math.max(eotMax, Math.abs(d.equationOfTime));
  const unit: EotUnit =
    opts.locked?.eot.unit ?? (eotMax * 60 <= 90 ? "min" : "h");
  const f = unit === "min" ? 60 : 1;

  let tMin = Infinity;
  let tMax = -Infinity;
  let eMin = 0;
  let eMax = 0;

  const sets: SetModel[] = results.map((r, index) => {
    const rows = r.days;
    const sunrise = splitSeries(rows, "sunrise");
    const sunset = splitSeries(rows, "sunset");
    const transit: Pt[][] = [
      rows.map((d): Pt => [d.daysFromSolstice, d.transit]),
    ];
    for (const seg of [...sunrise, ...sunset, ...transit])
      for (const [x, y] of seg)
        if (inRange(x)) {
          tMin = Math.min(tMin, y);
          tMax = Math.max(tMax, y);
        }
    const eot = rows.map((d): Pt => [d.daysFromSolstice, d.equationOfTime * f]);
    for (const [x, y] of eot)
      if (inRange(x)) {
        eMin = Math.min(eMin, y);
        eMax = Math.max(eMax, y);
      }
    return {
      index,
      sunrise,
      sunset,
      transit,
      eot,
      bands: polarBands(rows),
      markers: lagMarkers(r, opts.show),
      winterX: winterOffset(r),
      formalSolstice: params[index]?.epsilon === 0,
      hemisphere: r.hemisphere,
    };
  });

  let time: [number, number];
  if (Number.isFinite(tMin)) {
    time = [Math.floor(tMin - 0.25), Math.ceil(tMax + 0.25)];
  } else time = [0, 24];

  const pad = (eMax - eMin) * 0.1 || 1;
  const eotDomain: [number, number] = [eMin - pad, eMax + pad];

  const auto: Domains = { time, eot: { domain: eotDomain, unit } };
  return {
    xDomain,
    domains: opts.locked ?? auto,
    sets,
  };
}

export interface Margin {
  l: number;
  r: number;
  t: number;
  b: number;
}

export function xScaleOf(m: ChartModel, width: number, margin: Margin) {
  return scaleLinear()
    .domain(m.xDomain)
    .range([margin.l, width - margin.r]);
}

export function yScaleOf(
  domain: [number, number],
  height: number,
  margin: Margin,
) {
  return scaleLinear()
    .domain(domain)
    .range([height - margin.b, margin.t]);
}

/** 連続値の時刻 [h] を「25:10」形式に（分に丸めて繰り上げる） */
export function formatClock(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total - h * 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 縦軸の目盛り（時刻は 1・2・3・4・6・12 時間刻みから 8 本以内で選ぶ） */
export function timeTicks(domain: [number, number]): number[] {
  const span = domain[1] - domain[0];
  const step = [1, 2, 3, 4, 6, 12].find((s) => span / s <= 8) ?? 24;
  const out: number[] = [];
  for (let v = Math.ceil(domain[0] / step) * step; v <= domain[1]; v += step)
    out.push(v);
  return out;
}

/** 横軸の目盛り（夏至からの日数、30 日刻み） */
export function dayTicks(domain: [number, number], step = 30): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(domain[0] / step) * step; v <= domain[1]; v += step)
    out.push(v);
  return out;
}

export function formatSigned(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
