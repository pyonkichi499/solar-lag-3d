// 派生データ。パラメータの値をキーにして年間の計算結果を再利用する（§8.2）。
import { useMemo } from "react";
import type { Params, YearResult } from "../engine";
import { computeYear, EARTH } from "../engine";
import { useStore } from "./store";

const cache = new Map<string, YearResult>();

const paramsKey = (p: Params) =>
  `${p.epsilon}|${p.e}|${p.varpi}|${p.phi}|${p.h0}`;

function parseKey(k: string): Params {
  const [epsilon = 0, e = 0, varpi = 0, phi = 0, h0 = 0] = k
    .split("|")
    .map(Number);
  return { epsilon, e, varpi, phi, h0 };
}

export function yearResultFor(p: Params): YearResult {
  const key = paramsKey(p);
  let r = cache.get(key);
  if (!r) {
    r = computeYear(p, EARTH);
    if (cache.size > 64) cache.clear();
    cache.set(key, r);
  }
  return r;
}

/** 各セットの 1 年分の結果（sets と同じ順）。パラメータの値が変わったときだけ再計算する */
export function useYearResults(): YearResult[] {
  // 文字列の選択なので、値が同じなら再描画も再計算も起きない
  const key = useStore((s) => s.sets.map(paramsKey).join(";"));
  return useMemo(
    () => key.split(";").map((k) => yearResultFor(parseKey(k))),
    [key],
  );
}
