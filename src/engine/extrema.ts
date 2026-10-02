// 日没・日の出時刻の極値探索（至点の前後半年）。
import { riseSetOf } from "./events";
import { summerSolsticeTime, winterSolsticeTime } from "./sun";
import type { BodyConstants, LagKind, LagResult, Params } from "./types";

interface Spec {
  sign: 1 | -1; // 1 = 日没、−1 = 日の出
  /** 1 = 極大を探す、−1 = 極小を探す */
  dir: 1 | -1;
  summer: boolean;
}

const SPECS: Record<LagKind, Spec> = {
  latestSunset: { sign: 1, dir: 1, summer: true },
  earliestSunrise: { sign: -1, dir: -1, summer: true },
  earliestSunset: { sign: 1, dir: -1, summer: false },
  latestSunrise: { sign: -1, dir: 1, summer: false },
};

const GOLDEN = (Math.sqrt(5) - 1) / 2;

interface Sample {
  n: number;
  /** 極大化する向きに符号をそろえた値。白夜・極夜は null */
  v: number | null;
  polar: "polarDay" | "polarNight" | null;
}

interface Candidate {
  peak: boolean;
  lag: number;
  t: number;
  hours: number;
  boundary?: "polarDay" | "polarNight";
}

export function findLag(p: Params, b: BodyConstants, kind: LagKind): LagResult {
  if (p.epsilon === 0) return { kind: "undefined", reason: "noSolstice" };
  const spec = SPECS[kind];
  const ts = spec.summer ? summerSolsticeTime(p, b) : winterSolsticeTime(p, b);
  const y = b.yearDays;
  const count = Math.ceil(y);
  const step = y / count;

  const sampleAt = (n: number): Sample => {
    const ev = riseSetOf(p, b, n, spec.sign);
    if (ev.kind === "event") return { n, v: spec.dir * ev.hours, polar: null };
    return { n, v: null, polar: ev.kind };
  };
  const samples: Sample[] = [];
  for (let k = 0; k <= count; k++)
    samples.push(sampleAt(ts - y / 2 + k * step));

  const value = (n: number): number => {
    const ev = riseSetOf(p, b, n, spec.sign);
    return ev.kind === "event" ? spec.dir * ev.hours : Number.NEGATIVE_INFINITY;
  };

  const cands: Candidate[] = [];
  const addPeak = (n: number) => {
    const ev = riseSetOf(p, b, n, spec.sign);
    if (ev.kind === "event")
      cands.push({ peak: true, lag: ev.t - ts, t: ev.t, hours: ev.hours });
  };
  // 極値の向きに連続の端（白夜・極夜との境界）を見つける
  const addBoundary = (valid: Sample, other: Sample) => {
    let nv = valid.n;
    let np = other.n;
    for (let i = 0; i < 80; i++) {
      const mid = (nv + np) / 2;
      if (riseSetOf(p, b, mid, spec.sign).kind === "event") nv = mid;
      else np = mid;
    }
    const ev = riseSetOf(p, b, nv, spec.sign);
    if (ev.kind === "event" && other.polar) {
      cands.push({
        peak: false,
        lag: ev.t - ts,
        t: ev.t,
        hours: ev.hours,
        boundary: other.polar,
      });
    }
  };

  for (let k = 1; k < count; k++) {
    const before = samples[k - 1];
    const at = samples[k];
    const after = samples[k + 1];
    if (!before || !at || !after || at.v === null) continue;
    const prev = before.v;
    const next = after.v;
    if (prev !== null && next !== null) {
      if (at.v > prev && at.v >= next)
        addPeak(goldenMax(value, before.n, after.n));
    } else if (prev !== null && next === null) {
      if (at.v > prev) addBoundary(at, after);
    } else if (prev === null && next !== null) {
      if (at.v > next) addBoundary(at, before);
    } else if (prev === null && next === null) {
      // 有効な標本が 1 点だけ孤立している（分点付近の短い窓）。
      // 日没は H が大きいほど遅く、日の出は H が大きいほど早い。極値の向きに合う側の境界を採る
      const want = spec.sign * spec.dir === 1 ? "polarDay" : "polarNight";
      if (before.polar === want) addBoundary(at, before);
      if (after.polar === want) addBoundary(at, after);
    }
  }

  if (cands.length === 0) return { kind: "undefined", reason: "noEvents" };
  const best = cands.reduce((x, c) =>
    Math.abs(c.lag) < Math.abs(x.lag) ? c : x,
  );

  if (best.peak) {
    const others = cands.filter((c) => c.peak && c !== best).length;
    return {
      kind: "peak",
      lagDays: best.lag,
      t: best.t,
      hours: best.hours,
      otherExtrema: others,
    };
  }
  return {
    kind: "polarBoundary",
    lagDays: best.lag,
    t: best.t,
    boundary: best.boundary ?? "polarDay",
  };
}

/** 黄金分割探索で f の極大点（n）を求める */
function goldenMax(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 80; i++) {
    if (fc >= fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}
