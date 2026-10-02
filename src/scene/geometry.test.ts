import { describe, expect, it } from "vitest";
import { EARTH, sceneState } from "../engine";
import {
  apsides,
  apsisDistances,
  observerDirection,
  orbitCenter,
  orbitPoints,
  planetPositionAtLambda,
  seasonLengths,
} from "./geometry";

const earth = { epsilon: 23.44, e: 0.0167, varpi: 283, phi: 35, h0: -0.833 };
const ang = (p: number[]) =>
  ((Math.atan2(p[1] ?? 0, p[0] ?? 0) * 180) / Math.PI + 360) % 360;

describe("orbitPoints", () => {
  it("r = (1−e²)/(1+e cos ν) を満たし、焦点が原点にある", () => {
    const e = 0.3;
    const varpi = 70;
    for (const p of orbitPoints(e, varpi, 64)) {
      const r = Math.hypot(p[0], p[1]);
      const nu = ((ang(p) - 180 - varpi) * Math.PI) / 180;
      expect(r).toBeCloseTo((1 - e * e) / (1 + e * Math.cos(nu)), 9);
      expect(p[2]).toBe(0);
    }
  });
  it("閉じた曲線で、長半径が 1", () => {
    const pts = orbitPoints(0.4, 120, 128);
    expect(pts[0]).toEqual(pts[pts.length - 1]);
    const { perihelion, aphelion } = apsides(0.4, 120);
    expect(Math.hypot(...perihelion) + Math.hypot(...aphelion)).toBeCloseTo(
      2,
      12,
    );
  });
});

describe("apsides / center", () => {
  it("近日点は黄経 ϖ+180°、距離 1−e。遠日点は反対側で 1+e", () => {
    const { perihelion, aphelion } = apsides(0.2, 283);
    expect(ang(perihelion)).toBeCloseTo((283 + 180) % 360, 9);
    expect(Math.hypot(...perihelion)).toBeCloseTo(0.8, 12);
    expect(Math.hypot(...aphelion)).toBeCloseTo(1.2, 12);
    expect(ang(aphelion)).toBeCloseTo(283, 9);
    expect(apsisDistances(0.2)).toEqual({ perihelion: 0.8, aphelion: 1.2 });
  });
  it("軌道中心は近日点と遠日点の中点で、太陽からの距離が e", () => {
    const e = 0.25;
    const { perihelion, aphelion } = apsides(e, 40);
    const c = orbitCenter(e, 40);
    expect(c[0]).toBeCloseTo((perihelion[0] + aphelion[0]) / 2, 12);
    expect(c[1]).toBeCloseTo((perihelion[1] + aphelion[1]) / 2, 12);
    expect(Math.hypot(...c)).toBeCloseTo(e, 12);
  });
});

describe("エンジンとの整合", () => {
  it("planetPositionAtLambda は sceneState の惑星位置と一致する", () => {
    const s = sceneState(earth, EARTH, 100);
    const p = planetPositionAtLambda(earth.e, earth.varpi, s.sun.lambda);
    for (let i = 0; i < 3; i++)
      expect(p[i]).toBeCloseTo(s.planetPosition[i] ?? Number.NaN, 9);
  });
});

describe("seasonLengths", () => {
  it("合計が 1 年で、地球では春・夏が秋・冬より長い", () => {
    const l = seasonLengths(earth, EARTH);
    expect(l.reduce((a, b) => a + b)).toBeCloseTo(EARTH.yearDays, 6);
    expect(l[1]).toBeGreaterThan(l[3]);
    expect(l[1]).toBeCloseTo(93.65, 0);
  });
  it("円軌道ではすべて等しい", () => {
    const l = seasonLengths({ ...earth, e: 0 }, EARTH);
    for (const x of l) expect(x).toBeCloseTo(EARTH.yearDays / 4, 6);
  });
});

describe("observerDirection", () => {
  const axis: [number, number, number] = [0, 0, 1];
  const pos: [number, number, number] = [-1, 0, 0]; // 太陽は +x 側
  it("正午・緯度 0 で太陽を向き、真夜中は反対", () => {
    expect(observerDirection(pos, axis, 0, 12)[0]).toBeCloseTo(1, 9);
    expect(observerDirection(pos, axis, 0, 0)[0]).toBeCloseTo(-1, 9);
  });
  it("緯度が高さ方向に反映され、単位ベクトルになる", () => {
    const d = observerDirection(pos, axis, 60, 15);
    expect(d[2]).toBeCloseTo(Math.sin(Math.PI / 3), 9);
    expect(Math.hypot(...d)).toBeCloseTo(1, 12);
  });
});
