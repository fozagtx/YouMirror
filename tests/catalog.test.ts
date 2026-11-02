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
