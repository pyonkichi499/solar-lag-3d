import { renderToString } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import type { Params } from "../engine";
import { i18n, setupI18n } from "../i18n";
import { DEFAULT_PARAMS } from "../presets";
import { yearResultFor } from "../store/derived";
import { ResultsView } from "./ResultsPanel";
import { buildResultRows, type Translate } from "./results";

const ALL = {
  latestSunset: true,
  earliestSunrise: true,
  earliestSunset: true,
  latestSunrise: true,
};

const earth: Params = { ...DEFAULT_PARAMS };

let tr: Translate;
beforeAll(() => {
  setupI18n();
  tr = (key, values) => i18n.t(key, { ...values, lng: "ja" });
});

const rowsFor = (sets: Params[], show = ALL) =>
  buildResultRows(sets.map(yearResultFor), sets, show, tr, "ja-JP");

describe("buildResultRows", () => {
  it("地球は 4 行すべて出て、日没最遅日は「+X.X日（M月D日ごろ）」", () => {
    const v = rowsFor([earth]);
    expect(v.rows.map((r) => r.kind)).toEqual([
      "latestSunset",
      "earliestSunrise",
      "earliestSunset",
      "latestSunrise",
    ]);
    expect(v.rows[0]?.cells[0]?.text).toMatch(
      /^[+\u2212]?\d+\.\d日（\d+月\d+日ごろ）$/,
    );
    expect(v.rows[0]?.cells[0]?.reference).toBe("夏至");
    expect(v.epsilonNotes).toEqual([null]);
  });

  it("show で行を絞る", () => {
    const v = rowsFor([earth], {
      ...ALL,
      latestSunrise: false,
      earliestSunset: false,
    });
    expect(v.rows.map((r) => r.kind)).toEqual([
      "latestSunset",
      "earliestSunrise",
    ]);
  });

  it("南半球は基準ラベルに 12 月至点を補足する", () => {
    const v = rowsFor([{ ...earth, phi: -35 }]);
    expect(v.rows[0]?.cells[0]?.reference).toBe("夏至（12月至点）");
    expect(v.rows[2]?.cells[0]?.reference).toBe("冬至（6月至点）");
  });

  it("ε = 0 は至点が存在しない", () => {
    const v = rowsFor([{ ...earth, epsilon: 0 }]);
    for (const r of v.rows) {
      expect(r.cells[0]?.text).toBe("至点が存在しない（昼の長さが一定）");
    }
    expect(v.references).toEqual([null]);
    expect(v.epsilonNotes).toEqual([null]);
  });

  it("ε が小さい非ゼロでは注記を出す", () => {
    const v = rowsFor([{ ...earth, epsilon: 0.3 }]);
    expect(v.epsilonNotes[0]).toContain("均時差だけで決まります");
    expect(rowsFor([{ ...earth, epsilon: 0.5 }]).epsilonNotes[0]).toBeNull();
  });

  it("極端な傾きでは白夜・極夜の境界の文言になる", () => {
    const v = rowsFor([{ ...earth, epsilon: 60, phi: 40 }]);
    const texts = v.rows.map((r) => r.cells[0]?.text ?? "");
    expect(
      texts.some((s) => /^(白夜|極夜)の(直前|直後)（(夏至|冬至)の/.test(s)),
    ).toBe(true);
  });

  it("B があれば差を出し、昼の長さの参考値は h:mm:ss", () => {
    const b = { ...earth, e: 0 };
    const v = rowsFor([earth, b]);
    expect(v.rows[0]?.cells).toHaveLength(2);
    expect(v.rows[0]?.diff).toMatch(/^[+\u2212]?\d+\.\d日$/);
    expect(v.references[0]?.atSolstice).toMatch(/^\d+:\d\d:\d\d$/);
    expect(v.references[0]?.diffText).toMatch(/^差 \d+ 秒$/);
  });
});

describe("ResultsView", () => {
  it("A と B の列と差を描画する", () => {
    const sets = [earth, { ...earth, e: 0 }];
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <ResultsView
          results={sets.map(yearResultFor)}
          sets={sets}
          show={ALL}
          onToggle={() => {}}
        />
      </I18nextProvider>,
    );
    expect(html).toContain("日没最遅日");
    expect(html).toContain("ごろ）");
    expect(html).toContain("差（B − A）");
    expect(html).toContain("昼の長さ");
  });
});
