// 結果欄：A と B を 2 列に並べ、その下に差（B − A）を出す（§2.2, §2.3）

import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { LagKind, Params, YearResult } from "../engine";
import { INTL_LOCALES } from "../i18n";
import { useYearResults } from "../store/derived";
import { useStore } from "../store/store";
import { SET_COLORS, SET_NAMES } from "../theme";
import { buildResultRows, LAG_KINDS, type Translate } from "./results";

interface ViewProps {
  results: YearResult[];
  sets: Params[];
  show: Record<LagKind, boolean>;
  onToggle: (kind: LagKind) => void;
}

function colorOf(i: number): CSSProperties {
  return { "--set-color": SET_COLORS[i] ?? SET_COLORS[0] } as CSSProperties;
}

/** ストアに依存しない表示部分（テスト用に分離） */
export function ResultsView({ results, sets, show, onToggle }: ViewProps) {
  const { t, i18n } = useTranslation();
  const tr: Translate = (key, values) => t(key, values);
  const locale =
    INTL_LOCALES[i18n.language as keyof typeof INTL_LOCALES] ?? "en-US";
  const view = buildResultRows(results, sets, show, tr, locale);
  const hasB = results.length > 1;

  return (
    <section className="panel results" aria-labelledby="results-heading">
      <h2 id="results-heading">{t("resultsHeading")}</h2>

      <fieldset className="show-select">
        <legend>{t("showHeading")}</legend>
        {LAG_KINDS.map((kind) => (
          <label key={kind} className="check">
            <input
              type="checkbox"
              checked={show[kind]}
              onChange={() => onToggle(kind)}
            />
            {t(`kind_${kind}`)}
          </label>
        ))}
      </fieldset>

      {view.rows.map((row) => (
        <article
          key={row.kind}
          className={`lag-row${row.kind === "latestSunset" ? " main" : ""}`}
          data-kind={row.kind}
        >
          <h3>{row.label}</h3>
          <div className="lag-cells">
            {row.cells.map((cell, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: セットは位置で識別する
                key={i}
                className="lag-cell"
                style={colorOf(i)}
              >
                {hasB && <span className="set-tag">{SET_NAMES[i]}</span>}
                <p className="lag-value" data-result={cell.result}>
                  {cell.text}
                </p>
                {cell.notes.map((n) => (
                  <p key={n} className="note">
                    {n}
                  </p>
                ))}
                <p className="ref">
                  {t("reference", { label: cell.reference })}
                </p>
              </div>
            ))}
          </div>
          {hasB && (
            <p className="lag-diff">
              <span className="diff-tag">{t("diffHeading")}</span>{" "}
              <span className="lag-value">{row.diff ?? t("noValue")}</span>
            </p>
          )}
        </article>
      ))}

      {view.epsilonNotes.map(
        (note, i) =>
          note && (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: セットは位置で識別する
              key={i}
              className="note epsilon-note"
              style={colorOf(i)}
            >
              {hasB ? `${SET_NAMES[i]}：` : ""}
              {note}
            </p>
          ),
      )}

      <h3 className="ref-heading">{t("referenceHeading")}</h3>
      <div className="lag-cells">
        {view.references.map((ref, i) => (
          <dl
            // biome-ignore lint/suspicious/noArrayIndexKey: セットは位置で識別する
            key={i}
            className="lag-cell day-length"
            style={colorOf(i)}
          >
            {hasB && <span className="set-tag">{SET_NAMES[i]}</span>}
            {ref ? (
              <>
                <dt>{t("dayLengthAtSolstice")}</dt>
                <dd>{ref.atSolstice}</dd>
                <dt>{t("dayLengthMax")}</dt>
                <dd>{ref.max}</dd>
                <dd className="note">{ref.diffText}</dd>
              </>
            ) : (
              <dd className="note">{t("dayLengthNone")}</dd>
            )}
          </dl>
        ))}
      </div>
    </section>
  );
}

export function ResultsPanel() {
  const results = useYearResults();
  const sets = useStore((s) => s.sets);
  const show = useStore((s) => s.show);
  const toggleShow = useStore((s) => s.toggleShow);
  return (
    <ResultsView
      results={results}
      sets={sets}
      show={show}
      onToggle={toggleShow}
    />
  );
}
