import { describe, expect, it } from "vitest";
import { changedFraction, sharpness, photoProblems } from "@/lib/check";

const img = (w: number, h: number, f: (x: number, y: number) => number) => {
  const a = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); a.set([v, v, v], (y * w + x) * 3); }
  return a;
};

describe("try-on check", () => {
  it("reports ~0 change when the try-on handed back the original", () => {
    const a = img(64, 64, (x, y) => (x * 3 + y) % 255);
    expect(changedFraction(a, a.slice())).toBe(0);
  });
  it("reports change when a region was repainted", () => {
    const a = img(64, 64, () => 120);
    const b = img(64, 64, (x, y) => (y > 40 && x > 20 && x < 44 ? 30 : 120));
    expect(changedFraction(a, b)).toBeGreaterThan(0.05);
  });
});

describe("photo check", () => {
  it("scores a flat image as blurry and an edgy one as sharp", () => {
    const flat = img(64, 64, () => 128).filter((_, i) => i % 3 === 0);
    const edgy = img(64, 64, (x, y) => ((x + y) % 2 ? 255 : 0)).filter((_, i) => i % 3 === 0);
    expect(sharpness(flat, 64, 64)).toBeLessThan(1);
    expect(sharpness(edgy, 64, 64)).toBeGreaterThan(100);
  });
  it("rejects photos that are too small or too large", () => {
    expect(photoProblems({ width: 400, height: 600, bytes: 1000, sharpness: 50 })[0]).toMatch(/too small/);
    expect(photoProblems({ width: 1080, height: 1440, bytes: 11 * 1024 * 1024, sharpness: 50 })[0]).toMatch(/10 MB/);
    expect(photoProblems({ width: 1080, height: 1440, bytes: 1000, sharpness: 2 })[0]).toMatch(/blurry/);
    expect(photoProblems({ width: 1080, height: 1440, bytes: 1000, sharpness: 50 })).toEqual([]);
  });
});
