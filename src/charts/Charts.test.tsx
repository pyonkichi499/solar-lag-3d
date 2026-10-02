import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useStore } from "../store/store";
import { Charts } from "./Charts";

describe("Charts（サーバー描画での煙テスト）", () => {
  it("A のみ・A/B・白夜ありのいずれでも描画できる", () => {
    const html1 = renderToString(<Charts />);
    expect(html1).toContain("<svg");
    expect(html1).toContain('type="range"');

    useStore.getState().addSet();
    useStore.getState().setParam(1, "phi", 70);
    const html2 = renderToString(<Charts />);
    expect(html2.match(/<svg/g)?.length).toBeGreaterThanOrEqual(2);

    useStore.getState().setParam(0, "epsilon", 0);
    expect(renderToString(<Charts />)).toContain("<path");
  });
});
