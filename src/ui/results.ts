// 結果欄の表示用データ。React に依存しない純粋関数（§2.3）
import type { LagKind, LagResult, Params, YearResult } from "../engine";
import type { UiKey } from "../i18n";
import { formatCalendarDate } from "./calendar";
import { formatHms, formatSigned } from "./format";

export type Translate = (
  key: UiKey,
  values?: Record<string, string | number>,
) => string;

export const LAG_KINDS: LagKind[] = [
  "latestSunset",
  "earliestSunrise",
  "earliestSunset",
  "latestSunrise",
];

/** 各ズレの基準が夏至か冬至か、探す極値が最遅か最早か */
const KIND_INFO: Record<
  LagKind,
  { solstice: "summer" | "winter"; extreme: "latest" | "earliest" }
> = {
  latestSunset: { solstice: "summer", extreme: "latest" },
  earliestSunrise: { solstice: "summer", extreme: "earliest" },
  earliestSunset: { solstice: "winter", extreme: "earliest" },
  latestSunrise: { solstice: "winter", extreme: "latest" },
};

/** ε がこの値より小さい（0 を除く）と、昼の長さの変化が小さい旨を注記する */
export const SMALL_EPSILON = 0.5;

export interface CellView {
  result: LagResult["kind"];
  /** 主表示。例：「+X.X日（6月XX日ごろ）」 */
  text: string;
  /** 注記（ほかにも山があります、など） */
  notes: string[];
  /** 基準の至点のラベル。南半球では「夏至（12月至点）」 */
  reference: string;
  /** 差の計算に使う値（peak・polarBoundary のとき） */
  lagDays: number | null;
  boundary: "polarDay" | "polarNight" | null;
}

export interface RowView {
  kind: LagKind;
  label: string;
  cells: CellView[];
  /** B − A。比較できないときは null */
  diff: string | null;
}

export interface ReferenceView {
  atSolstice: string;
  max: string;
  diffText: string;
}

export interface ResultsView {
  rows: RowView[];
  /** セットごとの参考値（夏至がなければ null） */
  references: (ReferenceView | null)[];
  /** セットごとの ε が小さい旨の注記（なければ null） */
  epsilonNotes: (string | null)[];
}

export function solsticeLabel(
  solstice: "summer" | "winter",
  hemisphere: YearResult["hemisphere"],
  t: Translate,
  full: boolean,
): string {
  if (full && hemisphere === "south") {
    return t(
      solstice === "summer" ? "summerSolsticeSouth" : "winterSolsticeSouth",
    );
  }
  return t(solstice === "summer" ? "summerSolstice" : "winterSolstice");
}

export function buildCell(
  kind: LagKind,
  result: YearResult,
  t: Translate,
  locale: string,
): CellView {
  const info = KIND_INFO[kind];
  const lag = result.lags[kind];
  const reference = solsticeLabel(info.solstice, result.hemisphere, t, true);
  const base: CellView = {
    result: lag.kind,
    text: "",
    notes: [],
    reference,
    lagDays: null,
    boundary: null,
  };
  if (lag.kind === "peak") {
    return {
      ...base,
      text: t("lagPeak", {
        lag: formatSigned(lag.lagDays),
        date: formatCalendarDate(lag.t, locale),
      }),
      notes: lag.otherExtrema > 0 ? [t("otherExtrema")] : [],
      lagDays: lag.lagDays,
    };
  }
  if (lag.kind === "polarBoundary") {
    return {
      ...base,
      text: t("lagPolarBoundary", {
        boundary: t(
          lag.boundary === "polarDay"
            ? "boundaryPolarDay"
            : "boundaryPolarNight",
        ),
        side: t(lag.lagDays < 0 ? "sideBefore" : "sideAfter"),
        ref: solsticeLabel(info.solstice, result.hemisphere, t, false),
        lag: formatSigned(lag.lagDays),
        extreme: t(
          info.extreme === "latest" ? "extremeLatest" : "extremeEarliest",
        ),
      }),
      lagDays: lag.lagDays,
      boundary: lag.boundary,
    };
  }
  return {
    ...base,
    text: t(lag.reason === "noSolstice" ? "noSolstice" : "noEvents"),
  };
}

/** B − A。同じ種類の結果どうしでだけ出す */
export function buildDiff(
  a: CellView,
  b: CellView,
  t: Translate,
): string | null {
  if (a.lagDays === null || b.lagDays === null) return null;
  if (a.result !== b.result || a.boundary !== b.boundary) return null;
  return t("diffDays", { lag: formatSigned(b.lagDays - a.lagDays) });
}

export function buildReference(
  result: YearResult,
  t: Translate,
): ReferenceView | null {
  const d = result.dayLength;
  if (!d) return null;
  const seconds = Math.round((d.max - d.atSolstice) * 3600);
  return {
    atSolstice: formatHms(d.atSolstice),
    max: formatHms(d.max),
    diffText: t("dayLengthDiff", { seconds }),
  };
}

export function buildResultRows(
  results: YearResult[],
  sets: Params[],
  show: Record<LagKind, boolean>,
  t: Translate,
  locale: string,
): ResultsView {
  const rows = LAG_KINDS.filter((k) => show[k]).map((kind): RowView => {
    const cells = results.map((r) => buildCell(kind, r, t, locale));
    const [a, b] = cells;
    return {
      kind,
      label: t(`kind_${kind}`),
      cells,
      diff: a && b ? buildDiff(a, b, t) : null,
    };
  });
  return {
    rows,
    references: results.map((r) => buildReference(r, t)),
    epsilonNotes: sets.map((p) =>
      p.epsilon > 0 && p.epsilon < SMALL_EPSILON ? t("smallEpsilonNote") : null,
    ),
  };
}
