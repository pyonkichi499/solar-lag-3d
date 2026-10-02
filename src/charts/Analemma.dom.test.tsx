// @vitest-environment jsdom
// Analemma の描画の煙テスト（ストアの変更を反映させるため、サーバー描画ではなく jsdom で描く）
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupI18n } from "../i18n";
import { DEFAULT_PARAMS } from "../presets";
import { useStore } from "../store/store";
import { Analemma } from "./Analemma";

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
    day: 0,
  });
});

function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Analemma />));
}

describe("Analemma", () => {
  it("A のみでは曲線 1 本、B を追加すると 2 本になる", () => {
    mount();
    expect(container.querySelectorAll("path").length).toBe(1);
    act(() => useStore.getState().addSet());
    expect(container.querySelectorAll("path").length).toBe(2);
  });

  it("ε=0・e=0 でも描画できる（1 点に潰れる）", () => {
    mount();
    act(() => {
      useStore.getState().setParam(0, "epsilon", 0);
      useStore.getState().setParam(0, "e", 0);
    });
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("path").length).toBe(1);
  });

  it("日付カーソルの位置（太い輪の円）が日付で動く", () => {
    mount();
    const ring = () =>
      container.querySelector('circle[r="5.5"]')?.getAttribute("cy");
    const before = ring();
    act(() => useStore.getState().setDay(-90));
    expect(ring()).not.toBe(before);
  });
});
