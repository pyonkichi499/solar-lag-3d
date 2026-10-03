// @vitest-environment jsdom
// App の結線の煙テスト（ブラウザでの見た目は確認していない）
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { setupI18n } from "../i18n";
import { DEFAULT_PARAMS } from "../presets";
import { useStore } from "../store/store";

// jsdom には ResizeObserver や WebGL がないので、3D は差し替える
vi.mock("../scene/Scene", () => ({ Scene: () => null }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeAll(() => {
  setupI18n();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useStore.setState({
    sets: [{ ...DEFAULT_PARAMS }],
    presetIds: ["earth"],
    activeIndex: 0,
    lang: "ja",
  });
});

function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<App />));
}

const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  ) as HTMLButtonElement;

describe("App", () => {
  it("B の追加・削除、e = 0 での ϖ 無効化、言語切り替え", () => {
    mount();
    expect(container.textContent).toContain("日没最遅日");
    expect(
      container.querySelector('.intro a[href$="docs/guide.md"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]'),
    ).not.toBeNull();

    act(() => button("比較を追加").click());
    expect(useStore.getState().sets).toHaveLength(2);
    expect(container.textContent).toContain("B の緯度を A に揃える");

    act(() => useStore.getState().setParam(1, "e", 0));
    const varpi = container.querySelector<HTMLInputElement>(
      'input[type="range"][aria-label^="近日点通過時"]',
    );
    expect(varpi?.disabled).toBe(true);
    expect(useStore.getState().sets[1]?.varpi).toBe(283);
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("custom");

    act(() => button("✕").click());
    expect(useStore.getState().sets).toHaveLength(1);

    act(() => button("EN").click());
    expect(document.documentElement.lang).toBe("en");
    expect(container.textContent).toContain("Latest sunset");
  });
});
