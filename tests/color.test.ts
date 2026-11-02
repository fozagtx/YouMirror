import { describe, expect, it } from "vitest";
import { hexToLab, deltaE, compareShade, undertone } from "@/lib/color";

describe("color", () => {
  it("converts white and black to Lab", () => {
    expect(hexToLab("#ffffff").L).toBeCloseTo(100, 0);
    expect(hexToLab("#000000").L).toBeCloseTo(0, 0);
  });

  it("deltaE is 0 for identical colours and grows with distance", () => {
    expect(deltaE("#bc9d88", "#bc9d88")).toBe(0);
    expect(deltaE("#bc9d88", "#be9f8a")).toBeLessThan(2);
    expect(deltaE("#bc9d88", "#f1e7db")).toBeGreaterThan(15);
  });

  it("says a much paler shade sits lighter than the skin", () => {
    const c = compareShade("#f1e7db", "#bc9d88");
    expect(c.direction).toBe("lighter");
    expect(c.lightnessGap).toBeGreaterThan(10);
  });

  it("says a deeper shade sits darker and a near match is a match", () => {
    expect(compareShade("#6b4a35", "#bc9d88").direction).toBe("darker");
    expect(compareShade("#bd9e89", "#bc9d88").direction).toBe("match");
  });

  it("reads undertone from hue", () => {
    expect(undertone("#efd0ae")).toBe("warm");
    expect(undertone("#e8c4c4")).toBe("cool");
  });
});
