// 派生データ。パラメータの値をキーにして年間の計算結果を再利用する（§8.2）。
import { useMemo } from "react";
import type { Params, YearResult } from "../engine";
import { computeYear, EARTH } from "../engine";
import { useStore } from "./store";

const cache = new Map<string, YearResult>();

export function yearResultFor(p: Params): YearResult {
  const key = `${p.epsilon}|${p.e}|${p.varpi}|${p.phi}|${p.h0}`;
  let r = cache.get(key);
  if (!r) {
    r = computeYear(p, EARTH);
    if (cache.size > 64) cache.clear();
    cache.set(key, r);
  }
  return r;
}

/** 各セットの 1 年分の結果（sets と同じ順） */
export function useYearResults(): YearResult[] {
  const sets = useStore((s) => s.sets);
  return useMemo(() => sets.map(yearResultFor), [sets]);
}
