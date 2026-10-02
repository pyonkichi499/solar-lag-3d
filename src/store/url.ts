// ストアの状態と URL クエリの相互変換（docs/requirements.md §5）。純粋関数のみ。
import type { LagKind, Params } from "../engine";
import { EARTH } from "../engine";
import type { PresetId } from "../presets";
import { DEFAULT_PARAMS, PRESETS, RANGES } from "../presets";
import type { AppState, Lang } from "./types";

/** URL に載せる部分（presetIds は値から復元する） */
export type UrlState = Pick<
  AppState,
  "sets" | "activeIndex" | "day" | "lang" | "show"
>;

export const SHOW_CODES: Record<LagKind, string> = {
  latestSunset: "ls",
  earliestSunrise: "er",
  earliestSunset: "es",
  latestSunrise: "lr",
};
const KINDS = Object.keys(SHOW_CODES) as LagKind[];

const DAY_LIMIT = EARTH.yearDays / 2;

// キーと名前、小数桁数
const FIELDS: { key: keyof Params; name: string; digits: number }[] = [
  { key: "epsilon", name: "eps", digits: 2 },
  { key: "e", name: "e", digits: 4 },
  { key: "varpi", name: "w", digits: 2 },
  { key: "phi", name: "lat", digits: 2 },
  { key: "h0", name: "h", digits: 3 },
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** 固定桁に丸め、-0 と末尾の 0 を落とす */
const fmt = (v: number, digits: number) => {
  const n = Number(v.toFixed(digits));
  return String(n === 0 ? 0 : n);
};

export function encodeParams(p: Params): string {
  return FIELDS.map((f) => `${f.name}${fmt(p[f.key], f.digits)}`).join("_");
}

export function decodeParams(text: string | null): Params {
  const out: Params = { ...DEFAULT_PARAMS };
  if (!text) return out;
  for (const part of text.split("_")) {
    const m = /^([a-z]+)(-?\d+(?:\.\d+)?)$/.exec(part);
    const f = m && FIELDS.find((x) => x.name === m[1]);
    if (!m || !f) continue;
    const v = Number(m[2]);
    if (!Number.isFinite(v)) continue;
    out[f.key] =
      f.key === "varpi"
        ? ((v % 360) + 360) % 360
        : clamp(v, RANGES[f.key].min, RANGES[f.key].max);
  }
  return out;
}

export function encodeShow(show: Record<LagKind, boolean>): string | null {
  if (KINDS.every((k) => show[k])) return null;
  return KINDS.filter((k) => show[k])
    .map((k) => SHOW_CODES[k])
    .join(",");
}

export function decodeShow(text: string): Record<LagKind, boolean> {
  const codes = new Set(text.split(","));
  return Object.fromEntries(
    KINDS.map((k) => [k, codes.has(SHOW_CODES[k])]),
  ) as Record<LagKind, boolean>;
}

export function encodeState(s: UrlState): string {
  const q = new URLSearchParams();
  if (s.sets[0]) q.set("a", encodeParams(s.sets[0]));
  if (s.sets[1]) q.set("b", encodeParams(s.sets[1]));
  q.set("d", fmt(s.day, 2));
  q.set("v", s.activeIndex === 1 && s.sets[1] ? "b" : "a");
  q.set("lang", s.lang);
  const show = encodeShow(s.show);
  if (show !== null) q.set("show", show);
  return q.toString().replace(/%2C/g, ",");
}

/** 値からプリセットを逆引きする（一致しなければ「カスタム」） */
export function presetIdFor(p: Params): PresetId | null {
  const hit = PRESETS.find(
    (x) =>
      x.epsilon === p.epsilon &&
      x.e === p.e &&
      (x.varpi === undefined || x.varpi === p.varpi),
  );
  return hit?.id ?? null;
}

/** 読めない値は既定値に、範囲外は範囲内に。例外は投げない */
export function decodeState(
  search: string,
): Omit<UrlState, "lang"> & { lang: Lang | null } {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    q = new URLSearchParams();
  }
  const sets = [decodeParams(q.get("a"))];
  if (q.has("b")) sets.push(decodeParams(q.get("b")));
  const dRaw = q.get("d");
  const d = Number(dRaw);
  const day =
    dRaw !== null && dRaw.trim() !== "" && Number.isFinite(d)
      ? clamp(d, -DAY_LIMIT, DAY_LIMIT)
      : 0;
  const lang = q.get("lang");
  const showText = q.get("show");
  return {
    sets,
    activeIndex: q.get("v") === "b" && sets.length > 1 ? 1 : 0,
    day,
    lang: lang === "ja" || lang === "en" ? lang : null,
    show: decodeShow(showText ?? KINDS.map((k) => SHOW_CODES[k]).join(",")),
  };
}
