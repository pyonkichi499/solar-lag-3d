// @vitest-environment jsdom
// 「縦軸を固定」のチェックボックスとストアの接続（ストアの変更を反映させるため jsdom で描く）
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupI18n } from "../i18n";
import { useStore } from "../store/store";
import { Charts } from "./Charts";

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
  useStore.setState({ lockYAxis: false });
});

function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Charts />));
}

describe("Charts の縦軸の固定", () => {
  it("チェックボックスの操作がストアに反映され、ストアの変更も表示に反映される", () => {
    mount();
    const box = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(box?.checked).toBe(false);

    act(() => box?.click());
    expect(useStore.getState().lockYAxis).toBe(true);
    expect(box?.checked).toBe(true);

    act(() => useStore.getState().setLockYAxis(false));
    expect(box?.checked).toBe(false);
  });
});
