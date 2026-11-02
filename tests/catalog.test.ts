import { describe, expect, it } from "vitest";
import { searchCatalog, closestShades, getProduct } from "@/lib/catalog";

describe("catalog", () => {
  it("finds real foundation and lipstick products by text", () => {
    const f = searchCatalog("fenty pro filt", "foundation");
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((p) => p.kind === "foundation")).toBe(true);
    const l = searchCatalog("colourpop", "lipstick");
    expect(l[0].brand.toLowerCase()).toContain("colourpop");
  });

  it("returns closest shades from the same line, excluding the current one", () => {
    const current = searchCatalog("fenty pro filt", "foundation")[0];
    const alts = closestShades("#bc9d88", current, 2);
    expect(alts).toHaveLength(2);
    expect(alts.every((a) => a.line === current.line && a.id !== current.id)).toBe(true);
  });

  it("shows each shade's own product packshot, so try-on cards show the exact product", async () => {
    const { listLines } = await import("@/lib/catalog");
    const shots = (await import("@/data/shade-images.json")).default as Record<string, string>;
    const line = listLines("fenty pro filt soft matte powder", "foundation", 1)[0];
    const shade = getProduct(line.id)!;
    expect(shade.image).toBe(shots[shade.id]);
    expect(shade.image).toMatch(/main-zoom\.jpg$/);
    const alts = closestShades("#bc9d88", shade, 2);
    expect(alts.map((a) => a.image)).toEqual(alts.map((a) => shots[a.id]));
    expect(new Set([shade.image, ...alts.map((a) => a.image)]).size).toBe(3);
    expect(line.image).toBe(shade.image);
  });

  it("looks a product up by id", () => {
    const p = searchCatalog("colourpop", "lipstick")[0];
    expect(getProduct(p.id)?.id).toBe(p.id);
    expect(getProduct("nope")).toBeUndefined();
  });
});

describe("product lines", () => {
  it("groups shades into real product lines with an image and shade count", async () => {
    const { listLines } = await import("@/lib/catalog");
    const lines = listLines("fenty pro filt", "foundation", 10);
    expect(lines.length).toBeGreaterThan(0);
    const l = lines[0];
    expect(l.brand.toLowerCase()).toContain("fenty");
    expect(l.shades).toBeGreaterThan(10);
    expect(l.image).toMatch(/^https:\/\//);
    expect(l.swatches.length).toBeLessThanOrEqual(8);
    expect(new Set(lines.map((x) => x.id)).size).toBe(lines.length);
  });

  it("lists lines with the widest shade ranges first when there is no search", async () => {
    const { listLines } = await import("@/lib/catalog");
    const lines = listLines("", "lipstick", 12);
    expect(lines).toHaveLength(12);
    expect(lines.every((l) => l.kind === "lipstick")).toBe(true);
    for (let i = 1; i < lines.length; i++) expect(lines[i - 1].shades).toBeGreaterThanOrEqual(lines[i].shades);
  });
});
