import { describe, expect, it } from "vitest";
import { summarizeSkin } from "@/lib/skin";

const out = (scores: Record<string, number>) =>
  Object.entries(scores).map(([type, ui_score]) => ({ type, ui_score, raw_score: ui_score, mask_urls: [`https://x/${type}.png`] }));

describe("summarizeSkin", () => {
  it("maps scores and flags a calm day", () => {
    const s = summarizeSkin(out({ acne: 96, redness: 94, oiliness: 98, moisture: 82 }));
    expect(s.scores.acne).toBe(96);
    expect(s.breakout).toBe(false);
    expect(s.concerns).toEqual([]);
  });

  it("flags a breakout day when acne or redness is low, worst first", () => {
    const s = summarizeSkin(out({ acne: 48, redness: 58, oiliness: 90, moisture: 80 }));
    expect(s.breakout).toBe(true);
    expect(s.concerns.map((c) => c.type)).toEqual(["acne", "redness"]);
  });

  it("compares against the previous scan", () => {
    const prev = summarizeSkin(out({ acne: 92, redness: 90 }));
    const s = summarizeSkin(out({ acne: 70, redness: 91 }), prev);
    expect(s.changes.find((c) => c.type === "acne")?.delta).toBe(-22);
  });
});
