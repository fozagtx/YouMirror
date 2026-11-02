import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inspect, thumb, dominantColor, normalizeSelfie } from "@/lib/pixels";

const solid = (w: number, h: number, c: { r: number; g: number; b: number }) =>
  sharp({ create: { width: w, height: h, channels: 3, background: c } }).jpeg().toBuffer();

describe("pixels", () => {
  it("measures size and flags a flat photo as unsharp", async () => {
    const p = await inspect(await solid(600, 800, { r: 200, g: 150, b: 120 }));
    expect(p).toMatchObject({ width: 600, height: 800 });
    expect(p.sharpness).toBeLessThan(8);
  });

  it("makes equal-size thumbnails from different-size images", async () => {
    const a = await thumb(await solid(600, 800, { r: 10, g: 20, b: 30 }));
    const b = await thumb(await solid(300, 300, { r: 10, g: 20, b: 30 }));
    expect(a.length).toBe(b.length);
  });

  it("reads a garment's main colour and ignores a white backdrop", async () => {
    const tee = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite([{ input: await sharp({ create: { width: 240, height: 300, channels: 3, background: { r: 31, g: 58, b: 95 } } }).png().toBuffer(), top: 50, left: 80 }])
      .png().toBuffer();
    const hex = await dominantColor(tee);
    expect(hex).toMatch(/^#1[e-f]3[9a-b]5[e-f]$/);
  });

  it("shrinks big selfies to 1920px on the long side as JPEG", async () => {
    const out = await normalizeSelfie(await solid(3000, 4000, { r: 1, g: 2, b: 3 }));
    const m = await sharp(out).metadata();
    expect(Math.max(m.width!, m.height!)).toBe(1920);
    expect(m.format).toBe("jpeg");
  });
});
