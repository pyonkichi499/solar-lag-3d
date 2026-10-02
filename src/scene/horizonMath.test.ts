import { describe, expect, it } from "vitest";
import { dayEvents, EARTH, sunAt } from "../engine";
import {
  altAzOf,
  analemmaPoints,
  dayPath,
  domePoint,
  formatDuration,
  formatHm,
  sunAltAz,
  viewYaw,
} from "./horizonMath";

const north = { epsilon: 23.44, e: 0.0167, varpi: 283, phi: 35, h0: -0.833 };
const south = { ...north, phi: -33 };
const cases = [north, south, { ...north, h0: 0 }, { ...north, e: 0.3 }];

describe("sunAltAz", () => {
  it("日の出・日没の瞬間の高度が h0 に一致する", () => {
    for (const p of cases) {
      for (const n of [10, 80, 150, 200, 290]) {
        const row = dayEvents(p, EARTH, n);
        for (const ev of [row.sunrise, row.sunset]) {
          if (ev.kind !== "event") continue;
          expect(Math.abs(sunAltAz(p, ev.t).altitudeDeg - p.h0)).toBeLessThan(
            1e-6,
          );
        }
      }
    }
  });
  it("南中の高度は 90 − |φ − δ|", () => {
    for (const p of cases) {
      for (const n of [5, 100, 180, 250, 330]) {
        const row = dayEvents(p, EARTH, n);
        const t = n + row.transit / 24;
        const d = sunAt(p, EARTH, t).declination;
        expect(sunAltAz(p, t).altitudeDeg).toBeCloseTo(
          90 - Math.abs(p.phi - d),
          6,
        );
      }
    }
  });
  it("北半球の中緯度：日の出は東寄り（< 180°）、日没は西寄り（> 180°）、南中は南", () => {
    for (const n of [10, 100, 200, 300]) {
      const row = dayEvents(north, EARTH, n);
      if (row.sunrise.kind !== "event" || row.sunset.kind !== "event")
        throw new Error("event expected");
      expect(sunAltAz(north, row.sunrise.t).azimuthDeg).toBeLessThan(180);
      expect(sunAltAz(north, row.sunset.t).azimuthDeg).toBeGreaterThan(180);
      expect(sunAltAz(north, n + row.transit / 24).azimuthDeg).toBeCloseTo(
        180,
        4,
      );
    }
  });
  it("南半球：南中は北（方位 0°）", () => {
    const row = dayEvents(south, EARTH, 200);
    const az = sunAltAz(south, 200 + row.transit / 24).azimuthDeg;
    expect(Math.min(az, 360 - az)).toBeLessThan(1e-4);
  });
  it("赤道・春分・正午：天頂", () => {
    expect(altAzOf(0, 0, 0, 12).altitudeDeg).toBeCloseTo(90, 9);
  });
  it("均時差 0 の正午の前後で高度が等しく、方位は鏡像", () => {
    const a = altAzOf(40, 15, 0, 9);
    const b = altAzOf(40, 15, 0, 15);
    expect(a.altitudeDeg).toBeCloseTo(b.altitudeDeg, 9);
    expect(a.azimuthDeg + b.azimuthDeg).toBeCloseTo(360, 9);
  });
});

describe("dayPath", () => {
  it("97 点で、0 時と 24 時の位置がほぼつながる", () => {
    const path = dayPath(north, 100);
    expect(path).toHaveLength(97);
    const a = path[0]?.altitudeDeg ?? 0;
    const b = path[96]?.altitudeDeg ?? 0;
    expect(Math.abs(a - b)).toBeLessThan(1);
  });
});

describe("analemmaPoints", () => {
  it("先頭は現在の日の太陽で、点数は 73", () => {
    const t = 123.4;
    const pts = analemmaPoints(north, t);
    expect(pts).toHaveLength(73);
    expect(pts[0]).toEqual(sunAltAz(north, t));
  });
  it("同じ時刻の位置が高度・方位とも幅を持つ", () => {
    const pts = analemmaPoints(north, 0.5);
    const alts = pts.map((p) => p.altitudeDeg);
    const azs = pts.map((p) => p.azimuthDeg);
    expect(Math.max(...alts) - Math.min(...alts)).toBeGreaterThan(40);
    expect(Math.max(...azs) - Math.min(...azs)).toBeGreaterThan(5);
  });
});

describe("domePoint", () => {
  it("北は +y、東は +x、天頂は +z で、半径は保たれる", () => {
    const n = domePoint({ altitudeDeg: 0, azimuthDeg: 0 }, 1, 0);
    expect(n[1]).toBeCloseTo(1, 9);
    const e = domePoint({ altitudeDeg: 0, azimuthDeg: 90 }, 1, 0);
    expect(e[0]).toBeCloseTo(1, 9);
    const z = domePoint({ altitudeDeg: 90, azimuthDeg: 10 }, 2, 0);
    expect(z[2]).toBeCloseTo(2, 9);
    const p = domePoint({ altitudeDeg: 33, azimuthDeg: 77 }, 5, 0);
    expect(Math.hypot(...p)).toBeCloseTo(5, 9);
  });
  it("南中は常に正面（−y）に来る", () => {
    for (const p of [north, south]) {
      const r = dayEvents(p, EARTH, 100);
      const d = domePoint(
        sunAltAz(p, 100 + r.transit / 24),
        1,
        viewYaw(p.phi),
      );
      expect(d[1]).toBeLessThan(0);
      expect(d[0]).toBeCloseTo(0, 6);
    }
  });
});

describe("書式", () => {
  it("h:mm", () => {
    expect(formatHm(6.5)).toBe("6:30");
    expect(formatHm(5.999)).toBe("6:00");
    expect(formatHm(24)).toBe("0:00");
    expect(formatDuration(14.25)).toBe("14:15");
  });
});
