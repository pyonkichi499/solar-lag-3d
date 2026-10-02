import { describe, expect, it } from "vitest";
import { dayEvents, EARTH, type Params, sceneState, sunAt } from "../engine";
import {
  formatHM,
  hourAngleDeg,
  isDaylit,
  observerVector,
  planetFrame,
  sunDirection,
  sunElevationSin,
  toPlanetFrame,
  type Vec3,
} from "./earthMath";

const DEG = Math.PI / 180;
const params: Params = {
  epsilon: 23.44,
  e: 0.0167,
  varpi: 283,
  phi: 35,
  h0: -0.833,
};
const d = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function setup(p: Params, t: number) {
  const s = sceneState(p, EARTH, t);
  const sun = sunDirection(s.planetPosition);
  const H = hourAngleDeg(s.localMeanTime, s.sun.equationOfTime);
  const frame = planetFrame(sun, s.axisDirection, H);
  return { s, sun, H, frame };
}

describe("観測者の位置", () => {
  it("太陽が子午線上（時角 0）なら、子午線の面と太陽の赤道面成分の角度は 0", () => {
    for (const t0 of [10.3, 100.7, 200.2, 300.9]) {
      const s0 = sceneState(params, EARTH, t0);
      // 真の南中の地方平均時 = 12 − E になる時刻へずらす（E は 1 日では大きく変わらない）
      const t = Math.floor(t0) + (12 - s0.sun.equationOfTime) / 24;
      const { s, sun, H, frame } = setup(params, t);
      expect(Math.abs(H)).toBeLessThan(0.05);
      const a = s.axisDirection;
      const k = d(sun, a);
      const eq: Vec3 = [
        sun[0] - k * a[0],
        sun[1] - k * a[1],
        sun[2] - k * a[2],
      ];
      const cos = d(eq, frame.x) / Math.hypot(...eq);
      expect(Math.acos(Math.min(1, cos))).toBeLessThan(1e-3);
    }
  });

  it("太陽の高度が engine の式 sin h = sinφ sinδ + cosφ cosδ cosH と一致する", () => {
    for (const phi of [-60, 0, 35, 80]) {
      for (const t of [5.1, 77.77, 150.5, 222.25, 301.6, 360.99]) {
        const p = { ...params, phi };
        const { sun, H, frame } = setup(p, t);
        const dec = sunAt(p, EARTH, t).declination * DEG;
        const o = observerVector(frame, phi);
        const expected =
          Math.sin(phi * DEG) * Math.sin(dec) +
          Math.cos(phi * DEG) * Math.cos(dec) * Math.cos(H * DEG);
        expect(sunElevationSin(o, sun)).toBeCloseTo(expected, 9);
      }
    }
  });

  it("惑星固定座標系の太陽方向の z 成分は sin δ", () => {
    const t = 123.4;
    const { sun, frame } = setup(params, t);
    const local = toPlanetFrame(sun, frame);
    expect(local[2]).toBeCloseTo(
      Math.sin(sunAt(params, EARTH, t).declination * DEG),
      9,
    );
    expect(Math.hypot(...local)).toBeCloseTo(1, 12);
  });

  it("基底は正規直交の右手系", () => {
    const { frame } = setup(params, 42.42);
    expect(d(frame.x, frame.y)).toBeCloseTo(0, 12);
    expect(d(frame.x, frame.z)).toBeCloseTo(0, 12);
    expect(Math.hypot(...frame.x)).toBeCloseTo(1, 12);
    const c: Vec3 = [
      frame.x[1] * frame.y[2] - frame.x[2] * frame.y[1],
      frame.x[2] * frame.y[0] - frame.x[0] * frame.y[2],
      frame.x[0] * frame.y[1] - frame.x[1] * frame.y[0],
    ];
    expect(d(c, frame.z)).toBeCloseTo(1, 12);
  });

  it("時角 15°（午後 1 時）では、太陽は観測者から見て 15° 西にある", () => {
    const sun: Vec3 = [1, 0, 0];
    const axis: Vec3 = [0, 0, 1];
    const f0 = planetFrame(sun, axis, 0);
    const f1 = planetFrame(sun, axis, 15);
    const local = toPlanetFrame(sun, f1);
    expect(Math.atan2(local[1], local[0])).toBeCloseTo(-15 * DEG, 12);
    expect(toPlanetFrame(sun, f0)[1]).toBeCloseTo(0, 12);
  });
});

describe("緯度円の昼夜", () => {
  it("昼の側の経度の割合が dayEvents の昼の長さ / 24 におおよそ一致する", () => {
    for (const phi of [-50, 20, 45, 60]) {
      for (const day of [0, 90, 180, 270]) {
        const p = { ...params, phi };
        const { frame, sun } = setup(p, day + 0.5);
        const local = toPlanetFrame(sun, frame);
        const N = 3600;
        let lit = 0;
        for (let i = 0; i < N; i++)
          if (isDaylit(local, phi, ((i + 0.5) / N) * 2 * Math.PI, p.h0)) lit++;
        // 太陽の赤緯は 1 日の中でも動くので許容を持たせる
        const len = dayEvents(p, EARTH, day).dayLength;
        expect(Math.abs((lit / N) * 24 - len)).toBeLessThan(0.25);
      }
    }
  });
});

describe("formatHM", () => {
  it("h:mm にする", () => {
    expect(formatHM(0)).toBe("0:00");
    expect(formatHM(24)).toBe("24:00");
    expect(formatHM(9.5)).toBe("9:30");
    expect(formatHM(11.9999)).toBe("12:00");
    expect(formatHM(14.0833)).toBe("14:05");
  });
});
