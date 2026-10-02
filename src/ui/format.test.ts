import { describe, expect, it } from "vitest";
import { formatHms, formatSigned } from "./format";

describe("formatSigned", () => {
  it("正は + 、負は U+2212", () => {
    expect(formatSigned(1.234)).toBe("+1.2");
    expect(formatSigned(-1.234)).toBe("−1.2");
  });
  it("0 に丸まる値は符号なし", () => {
    expect(formatSigned(0)).toBe("0.0");
    expect(formatSigned(-0.04)).toBe("0.0");
  });
});

describe("formatHms", () => {
  it("h:mm:ss", () => {
    expect(formatHms(14.5)).toBe("14:30:00");
    expect(formatHms(9 + 5 / 60 + 7 / 3600)).toBe("9:05:07");
    expect(formatHms(24)).toBe("24:00:00");
  });
});
