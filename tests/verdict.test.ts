import { describe, expect, it } from "vitest";
import { decide } from "@/lib/verdict";
import { summarizeSkin } from "@/lib/skin";
import type { Product } from "@/lib/types";

const skinHex = "#bc9d88";
const calm = summarizeSkin([{ type: "acne", ui_score: 95 }, { type: "redness", ui_score: 93 }]);
const breakout = summarizeSkin([{ type: "acne", ui_score: 45 }, { type: "redness", ui_score: 60 }]);
const fnd = (hex: string, id = hex): Product => ({ id, kind: "foundation", brand: "B", name: "Base", line: "b-base", shade: id, hex });
const line = [fnd("#f1e7db", "pale"), fnd("#bd9e89", "close1"), fnd("#b89884", "close2"), fnd("#6b4a35", "deep")];

describe("decide", () => {
  it("swaps a too-light foundation for the two closest shades and says why", () => {
    const v = decide({ product: line[0], skinHex, skin: calm, catalogLine: line });
    expect(v.verdict).toBe("swap");
    expect(v.reasons[0]).toMatch(/lighter than your measured tone/);
    expect(v.alternatives.map((a) => a.id)).toEqual(["close1", "close2"]);
  });

  it("says buy for a matching foundation", () => {
    const v = decide({ product: line[1], skinHex, skin: calm, catalogLine: line });
    expect(v.verdict).toBe("buy");
    expect(v.alternatives).toEqual([]);
  });

  it("raises coverage and adds a skincare step on a breakout day", () => {
    const v = decide({ product: line[1], skinHex, skin: breakout, catalogLine: line });
    expect(v.tryOn.coverage).toBeGreaterThan(60);
    expect(v.skincare.length).toBeGreaterThan(0);
    expect(v.reasons.join(" ")).toMatch(/breakout/i);
  });

  it("skips a foundation when nothing in the line is close", () => {
    const v = decide({ product: fnd("#f1e7db", "pale"), skinHex, skin: calm, catalogLine: [fnd("#f1e7db", "pale"), fnd("#f0e6da", "pale2")] });
    expect(v.verdict).toBe("skip");
  });

  it("swaps a lipstick that barely shows against the skin", () => {
    const lip = (hex: string, id: string): Product => ({ id, kind: "lipstick", brand: "C", name: "Lip", line: "c-lip", shade: id, hex });
    const lips = [lip("#c4a090", "nude-match"), lip("#a12a33", "red"), lip("#8e4140", "berry"), lip("#c9a596", "nude2")];
    const v = decide({ product: lips[0], skinHex, skin: calm, catalogLine: lips });
    expect(v.verdict).toBe("swap");
    expect(v.reasons[0]).toMatch(/blends into your skin/);
    expect(v.alternatives).toHaveLength(2);
  });

  it("skips a garment that sits too close to the skin tone", () => {
    const g: Product = { id: "g", kind: "garment", brand: "", name: "Tee", line: "g", shade: null, hex: "#bfa08b", image: "https://x/t.jpg" };
    expect(decide({ product: g, skinHex, skin: calm, catalogLine: [] }).verdict).toBe("skip");
    expect(decide({ product: { ...g, hex: "#1f3a5f" }, skinHex, skin: calm, catalogLine: [] }).verdict).toBe("buy");
  });
});
