import { describe, expect, it } from "vitest";
import { cropAround, parseBox } from "@/lib/face-box";

describe("cropAround", () => {
  it("crops a 3:4 portrait so the face fills about 70% of the width", () => {
    const r = cropAround({ x: 0.6, y: 0.2, w: 0.17, h: 0.3 }, 1760, 1328);
    expect(r.width / r.height).toBeCloseTo(0.75, 1);
    expect((0.17 * 1760) / r.width).toBeCloseTo(0.7, 1);
    const faceCx = (0.6 + 0.085) * 1760;
    expect(Math.abs(r.left + r.width / 2 - faceCx)).toBeLessThan(2);
  });

  it("stays inside the image when the face is near an edge", () => {
    const r = cropAround({ x: 0.85, y: 0.02, w: 0.14, h: 0.2 }, 1760, 1328);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.left + r.width).toBeLessThanOrEqual(1760);
    expect(r.top + r.height).toBeLessThanOrEqual(1328);
  });

  it("never asks for more than the whole image", () => {
    const r = cropAround({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, 1080, 1440);
    expect(r).toEqual({ left: 0, top: 0, width: 1080, height: 1440 });
  });
});

describe("parseBox", () => {
  it("accepts a normalised box and rejects anything else", () => {
    expect(parseBox('{"x":0.2,"y":0.1,"w":0.3,"h":0.4}')).toEqual({ x: 0.2, y: 0.1, w: 0.3, h: 0.4 });
    expect(parseBox('{"x":-1,"y":0.1,"w":0.3,"h":0.4}')).toBeNull();
    expect(parseBox('{"x":0.9,"y":0.1,"w":0.3,"h":0.4}')).toBeNull();
    expect(parseBox("null")).toBeNull();
    expect(parseBox("nope")).toBeNull();
  });
});
