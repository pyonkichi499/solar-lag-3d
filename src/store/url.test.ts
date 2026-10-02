import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../presets";
import {
  decodeParams,
  decodeState,
  encodeParams,
  encodeState,
  presetIdFor,
} from "./url";

const allShow = {
  latestSunset: true,
  earliestSunrise: true,
  earliestSunset: true,
  latestSunrise: true,
};

describe("url", () => {
  it("既定値のエンコードが仕様の形式になる", () => {
    expect(encodeParams({ ...DEFAULT_PARAMS })).toBe(
      "eps23.44_e0.0167_w283_lat35.68_h-0.833",
    );
  });

  it("decode(encode(x)) が安定する", () => {
    const p = {
      epsilon: 12.3456,
      e: 0.123456,
      varpi: 12.345,
      phi: -45.678,
      h0: 0.12345,
    };
    const once = decodeParams(encodeParams(p));
    expect(decodeParams(encodeParams(once))).toEqual(once);
    expect(encodeParams(decodeParams(encodeParams(once)))).toBe(
      encodeParams(once),
    );
  });

  it("状態全体が往復する", () => {
    const s = {
      sets: [{ ...DEFAULT_PARAMS }, { ...DEFAULT_PARAMS, e: 0, phi: -33.5 }],
      activeIndex: 1,
      day: 8.1,
      lang: "en" as const,
      show: { ...allShow, latestSunrise: false },
    };
    const q = encodeState(s);
    expect(q).toContain("show=ls,er,es");
    expect(decodeState(q)).toEqual(s);
  });

  it("show は全部 true のとき出さない", () => {
    const q = encodeState({
      sets: [{ ...DEFAULT_PARAMS }],
      activeIndex: 0,
      day: 0,
      lang: "ja",
      show: allShow,
    });
    expect(q).not.toContain("show");
  });

  it("b がなければ B なし、v=b でも A", () => {
    const d = decodeState("?a=eps10&v=b");
    expect(d.sets).toHaveLength(1);
    expect(d.activeIndex).toBe(0);
    expect(d.sets[0]?.epsilon).toBe(10);
  });

  it("読めない値は既定値、範囲外は丸める、未知の名前は無視", () => {
    const p = decodeParams("eps999_e-3_w725_latabc_h1.5_zzz9_foo");
    expect(p.epsilon).toBe(89.9);
    expect(p.e).toBe(0);
    expect(p.varpi).toBe(5);
    expect(p.phi).toBe(DEFAULT_PARAMS.phi);
    expect(p.h0).toBe(1.5);
  });

  it("壊れた入力でも例外を投げない", () => {
    for (const s of [
      "",
      "?",
      "?a=%E0%A4%A&d=x&show=,,",
      "?d=&lang=fr&v=",
      "?a=eps1e5",
    ]) {
      expect(() => decodeState(s)).not.toThrow();
    }
    const d = decodeState("?d=abc&lang=fr");
    expect(d.day).toBe(0);
    expect(d.lang).toBeNull();
    expect(decodeState("?d=9999").day).toBeCloseTo(182.62, 1);
  });

  it("プリセットを値から復元する", () => {
    expect(presetIdFor({ ...DEFAULT_PARAMS })).toBe("earth");
    expect(presetIdFor({ ...DEFAULT_PARAMS, e: 0.02 })).toBeNull();
  });
});
