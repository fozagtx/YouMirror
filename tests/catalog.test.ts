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
