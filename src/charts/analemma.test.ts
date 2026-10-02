import { describe, expect, it } from "vitest";
import { EARTH, type Params } from "../engine";
import { analemmaBounds, analemmaCursor, analemmaModel } from "./analemma";

const earth: Params = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35.68,
  h0: -0.833,
};

describe("analemmaModel", () => {
  it("地球では赤緯が ±ε、均時差が約 +16.4 分・−14.2 分の 8 の字になる", () => {
    const m = analemmaModel(earth);
    const ys = m.curve.map((q) => q.y);
    expect(Math.max(...ys)).toBeCloseTo(23.44, 2);
    expect(Math.min(...ys)).toBeCloseTo(-23.44, 2);
    const eotMin = m.curve.map((q) => (q.x / 15) * 60);
    expect(Math.max(...eotMin)).toBeGreaterThan(16);
    expect(Math.max(...eotMin)).toBeLessThan(17);
    expect(Math.min(...eotMin)).toBeLessThan(-14);
    expect(Math.min(...eotMin)).toBeGreaterThan(-15);
  });

  it("曲線は閉じている（最初と最後の点が一致する）", () => {
    const m = analemmaModel(earth);
    const a = m.curve[0];
    const b = m.curve[m.curve.length - 1];
    expect(Math.abs((a?.x ?? 0) - (b?.x ?? 1))).toBeLessThan(1e-9);
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(1e-9);
  });

  it("傾き 0・真円軌道では 1 点に潰れる", () => {
    const m = analemmaModel({ ...earth, epsilon: 0, e: 0 });
    for (const q of m.curve) {
      expect(Math.abs(q.x)).toBeLessThan(1e-9);
      expect(Math.abs(q.y)).toBeLessThan(1e-9);
    }
  });

  it("傾き 0 では縦に潰れた横線（均時差だけ）、真円軌道では縦の線に近い", () => {
    const flat = analemmaModel({ ...earth, epsilon: 0 });
    expect(Math.max(...flat.curve.map((q) => Math.abs(q.y)))).toBeLessThan(
      1e-9,
    );
    expect(Math.max(...flat.curve.map((q) => Math.abs(q.x)))).toBeGreaterThan(
      1,
    );
    const round = analemmaModel({ ...earth, e: 0 });
    // 真円なら横の広がりは傾き由来の成分だけで、左右対称になる
    const xs = round.curve.map((q) => q.x);
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 6);
  });

  it("夏至の点（λ=90°）の赤緯が最大になる", () => {
    const m = analemmaModel(earth);
    const summer = m.marks.find((k) => k.lambda === 90);
    expect(summer?.y).toBeCloseTo(23.44, 6);
  });
});

describe("analemmaCursor / analemmaBounds", () => {
  it("夏至の瞬間のカーソルは赤緯 ε", () => {
    const m = analemmaModel(earth);
    const summer = m.marks.find((k) => k.lambda === 90);
    const c = analemmaCursor(earth, summer?.t ?? 0, 0);
    expect(c.y).toBeCloseTo(23.44, 6);
  });

  it("範囲は 0 を含み、幅・高さが 0 にならない", () => {
    const b = analemmaBounds([analemmaModel({ ...earth, epsilon: 0, e: 0 })]);
    expect(b.xMax - b.xMin).toBeGreaterThan(0);
    expect(b.yMax - b.yMin).toBeGreaterThan(0);
    const c = analemmaBounds([analemmaModel(earth, EARTH)]);
    expect(c.yMin).toBeLessThan(-23.44);
    expect(c.yMax).toBeGreaterThan(23.44);
  });
});
