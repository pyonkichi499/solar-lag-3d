// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EARTH } from "../engine";
import { usePlayback, wrapDay } from "./playback";
import { useStore } from "./store";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Host() {
  usePlayback();
  return null;
}

describe("wrapDay", () => {
  it("[-yearDays/2, yearDays/2) に収める", () => {
    const y = EARTH.yearDays;
    expect(wrapDay(0, y)).toBeCloseTo(0, 9);
    expect(wrapDay(y / 2 + 1, y)).toBeCloseTo(-y / 2 + 1, 9);
    expect(wrapDay(-y / 2 - 1, y)).toBeCloseTo(y / 2 - 1, 9);
  });
});

describe("usePlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    useStore.setState({ day: 0, playing: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("playing の間だけ day が進み、アンマウントで止まる", () => {
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Host />));
    vi.advanceTimersByTime(500);
    expect(useStore.getState().day).toBe(0);

    act(() => useStore.getState().setPlaying(true));
    vi.advanceTimersByTime(1000);
    const advanced = useStore.getState().day;
    expect(advanced).toBeGreaterThan(20);
    expect(advanced).toBeLessThan(40);

    act(() => useStore.getState().setPlaying(false));
    const stopped = useStore.getState().day;
    vi.advanceTimersByTime(500);
    expect(useStore.getState().day).toBe(stopped);

    act(() => useStore.getState().setPlaying(true));
    act(() => root.unmount());
    const after = useStore.getState().day;
    vi.advanceTimersByTime(500);
    expect(useStore.getState().day).toBe(after);
  });
});
