import type { SkinOutput } from "@/lib/types";

export const SKIN_ACTIONS = ["acne", "redness", "oiliness", "moisture", "texture", "radiance"] as const;

export const LABELS: Record<string, string> = {
  acne: "Acne",
  redness: "Redness",
  oiliness: "Oil control",
  moisture: "Moisture",
  texture: "Texture",
  radiance: "Radiance",
  pore: "Pores",
  dark_circle_v2: "Dark circles",
};

const SKINCARE: Record<string, string> = {
  acne: "Spot-treat with a salicylic acid (BHA) gel tonight and pick a non-comedogenic base.",
  redness: "Calm redness with a fragrance-free niacinamide or centella moisturiser before makeup.",
  oiliness: "Use an oil-free primer and blot midday so the base doesn't slide.",
  moisture: "Apply a hyaluronic acid serum first so the base doesn't cling to dry patches.",
  texture: "Exfoliate gently (lactic acid) tonight; a blurring primer smooths texture today.",
  radiance: "A vitamin C serum in the morning lifts dullness over time.",
};

/** YouCam ui_score runs 1-100 where higher means healthier skin. */
const CONCERN_BELOW = 65;

export type Concern = { type: string; label: string; score: number; tip: string };
export type SkinSummary = {
  scores: Record<string, number>;
  masks: Record<string, string>;
  breakout: boolean;
  concerns: Concern[];
  changes: { type: string; label: string; delta: number }[];
};

export function summarizeSkin(output: SkinOutput[], previous?: Pick<SkinSummary, "scores"> | null): SkinSummary {
  const scores: Record<string, number> = {};
  const masks: Record<string, string> = {};
  for (const o of output) {
    const s = o.ui_score ?? o.score;
    if (typeof s !== "number" || !LABELS[o.type]) continue;
    scores[o.type] = Math.round(s);
    if (o.mask_urls?.[0]) masks[o.type] = o.mask_urls[0];
  }
  const concerns = Object.entries(scores)
    .filter(([t, s]) => s < CONCERN_BELOW && SKINCARE[t])
    .sort((a, b) => a[1] - b[1])
    .map(([type, score]) => ({ type, score, label: LABELS[type], tip: SKINCARE[type] }));
  const breakout = (scores.acne ?? 100) < CONCERN_BELOW || (scores.redness ?? 100) < CONCERN_BELOW;
  const changes = previous
    ? Object.keys(scores)
        .filter((t) => typeof previous.scores[t] === "number")
        .map((t) => ({ type: t, label: LABELS[t], delta: scores[t] - previous.scores[t] }))
    : [];
  return { scores, masks, breakout, concerns, changes };
}
