// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "./store";
import { installUrlSync } from "./urlSync";

describe("installUrlSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
    useStore.setState({ playing: false });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("起動時に URL を読み、lang は URL を最優先する", () => {
    window.history.replaceState(null, "", "/?a=eps10&b=eps20&v=b&lang=en&d=5");
    const off = installUrlSync();
    const s = useStore.getState();
    expect(s.sets.map((p) => p.epsilon)).toEqual([10, 20]);
    expect(s.activeIndex).toBe(1);
    expect(s.lang).toBe("en");
    expect(s.day).toBe(5);
    off();
  });

  it("localStorage が例外を投げても動く", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const off = installUrlSync();
    expect(["ja", "en"]).toContain(useStore.getState().lang);
    expect(() => useStore.getState().setLang("en")).not.toThrow();
    off();
  });

  it("書き込みは間引かれ、再生中は書かない", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const off = installUrlSync();
    useStore.getState().setDay(1);
    useStore.getState().setDay(2);
    useStore.getState().setDay(3);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain("d=3");

    useStore.getState().setPlaying(true);
    useStore.getState().setDay(50);
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);

    useStore.getState().setPlaying(false);
    vi.advanceTimersByTime(350);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(window.location.search).toContain("d=50");
    off();
  });

  it("解除後は書かない", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const off = installUrlSync();
    useStore.getState().setDay(9);
    off();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });
});
