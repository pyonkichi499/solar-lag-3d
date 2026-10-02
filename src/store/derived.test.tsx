// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { YearResult } from "../engine";
import { useYearResults } from "./derived";
import { useStore } from "./store";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("useYearResults", () => {
  it("パラメータの値が変わったときだけ再計算する", () => {
    const seen: YearResult[][] = [];
    function Probe() {
      seen.push(useYearResults());
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    const first = seen[seen.length - 1];

    // day / playing / presetIds / 同じ値の sets 置き換えでは同じ参照のまま
    act(() => useStore.getState().setDay(10));
    act(() => useStore.getState().setPlaying(true));
    act(() => useStore.getState().setPlaying(false));
    act(() =>
      useStore.setState((s) => ({ sets: s.sets.map((p) => ({ ...p })) })),
    );
    expect(seen[seen.length - 1]).toBe(first);

    act(() => useStore.getState().setParam(0, "e", 0.05));
    expect(seen[seen.length - 1]).not.toBe(first);
    expect(seen[seen.length - 1]?.[0]).not.toBe(first?.[0]);

    act(() => root.unmount());
  });
});
