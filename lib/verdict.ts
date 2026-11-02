import { compareShade, deltaE, hueAngle, round, shadeDistance, undertone } from "@/lib/color";
import type { SkinSummary } from "@/lib/skin";
import type { Product } from "@/lib/types";

export type Verdict = {
  verdict: "buy" | "skip" | "swap";
  headline: string;
  reasons: string[];
  alternatives: Product[];
  tryOn: { coverage: number };
  skincare: string[];
};

type Input = { product: Product; skinHex: string; skin: SkinSummary; catalogLine: Product[] };

const label = (p: Product) => [p.brand, p.name, p.shade].filter(Boolean).join(" · ");

function dayNotes(skin: SkinSummary) {
  const reasons: string[] = [];
  if (skin.breakout) {
    const worst = skin.concerns[0];
    reasons.push(`Breakout day: your ${worst.label.toLowerCase()} score is ${worst.score}/100 today, so the try-on uses fuller coverage.`);
  }
  for (const c of skin.changes) {
    if (c.delta <= -10) reasons.push(`${c.label} dropped ${-c.delta} points since your last scan.`);
  }
  return { reasons, skincare: skin.concerns.map((c) => c.tip), coverage: skin.breakout ? 80 : 45 };
}

/** A pick within this many points of the best shade in its range counts as the best. */
const SAME_AS_BEST = 2;
/** If even the best shade in the range is further than this, the range doesn't carry your shade. */
const RANGE_MISS = 20;

function foundation({ product, skinHex, catalogLine }: Input) {
  const c = compareShade(product.hex!, skinHex);
  const ranked = [product, ...catalogLine.filter((p) => p.id !== product.id && p.hex)]
    .map((p) => ({ p, d: shadeDistance(p.hex!, skinHex) }))
    .sort((a, b) => a.d - b.d);
  const picked = shadeDistance(product.hex!, skinHex);
  const best = ranked[0].d;
  const why =
    c.direction === "lighter" ? `This shade sits ${c.lightnessGap} points lighter than your measured tone ${skinHex}.`
    : c.direction === "darker" ? `This shade sits ${-c.lightnessGap} points darker than your measured tone ${skinHex}.`
    : c.direction === "match" ? `This shade matches the depth of your measured tone ${skinHex}.`
    : `This shade is the right depth but leans off your ${undertone(skinHex)} undertone.`;
  if (best > RANGE_MISS) {
    return { verdict: "skip" as const, headline: "Skip it. Nothing in this range matches you.", reasons: [why, `The closest shade in ${product.brand} ${product.name} is still ${round(best)} points off your tone.`], alternatives: [] };
  }
  if (picked - best < SAME_AS_BEST) {
    return { verdict: "buy" as const, headline: "Buy it. This is your shade in this range.", reasons: [why, `Out of ${ranked.length} shades in this range, this is the closest to your skin today (${round(picked)} points off).`], alternatives: [] };
  }
  const alternatives = ranked.filter((x) => x.p.id !== product.id && picked - x.d >= SAME_AS_BEST).slice(0, 2).map((x) => x.p);
  return {
    verdict: "swap" as const,
    headline: `Try ${alternatives[0].shade} instead.`,
    reasons: [why, `${alternatives.length === 1 ? "The closest shade" : `The ${alternatives.length} closest shades`} in the same range, tried on you: ${alternatives.map((a) => `${a.shade} (${round(shadeDistance(a.hex!, skinHex))} points off, yours is ${round(picked)})`).join("; ")}.`],
    alternatives,
  };
}

const lipTone = (hex: string) => {
  const h = hueAngle(hex);
  return h >= 30 && h < 180 ? "warm" : h <= 15 || h >= 300 ? "cool" : "neutral";
};

function lipstick({ product, skinHex, catalogLine }: Input) {
  const contrast = deltaE(product.hex!, skinHex);
  const skinTone = undertone(skinHex);
  const others = catalogLine.filter((p) => p.id !== product.id && p.hex);
  const pick = (ok: (p: Product) => boolean) =>
    others.filter(ok).sort((a, b) => Math.abs(deltaE(a.hex!, skinHex) - 30) - Math.abs(deltaE(b.hex!, skinHex) - 30)).slice(0, 2);
  if (contrast < 12) {
    const alternatives = pick((p) => deltaE(p.hex!, skinHex) >= 18);
    const why = `This shade blends into your skin (${round(contrast)} ΔE from your tone ${skinHex}), so it will read as no colour.`;
    return alternatives.length
      ? { verdict: "swap" as const, headline: `Try ${alternatives[0].shade} instead.`, reasons: [why, `${alternatives.map((a) => a.shade).join(" and ")} stand out on you and are in the same range.`], alternatives }
      : { verdict: "skip" as const, headline: "Skip it. It disappears on your skin.", reasons: [why], alternatives: [] };
  }
  const tone = lipTone(product.hex!);
  const clash = (skinTone === "warm" && tone === "cool") || (skinTone === "cool" && tone === "warm");
  if (clash) {
    const alternatives = pick((p) => lipTone(p.hex!) !== tone && deltaE(p.hex!, skinHex) >= 12);
    if (alternatives.length) {
      return { verdict: "swap" as const, headline: `Try ${alternatives[0].shade} instead.`, reasons: [`This is a ${tone}-toned shade and your measured skin reads ${skinTone}.`, `${alternatives.map((a) => a.shade).join(" and ")} sit closer to your undertone.`], alternatives };
    }
  }
  return { verdict: "buy" as const, headline: "Buy it. This shade works on you.", reasons: [`It shows clearly against your tone (${round(contrast)} ΔE) and suits ${skinTone} skin.`], alternatives: [] };
}

function garment({ product, skinHex }: Input) {
  if (!product.hex) {
    return { verdict: "buy" as const, headline: "Judge the try-on yourself.", reasons: ["We couldn't read a main colour from this garment photo."], alternatives: [] };
  }
  const d = deltaE(product.hex, skinHex);
  if (d < 12) {
    return { verdict: "skip" as const, headline: "Skip it. It washes you out.", reasons: [`Its main colour ${product.hex} sits ${round(d)} ΔE from your skin tone ${skinHex}, too close to give any contrast near your face.`], alternatives: [] };
  }
  return { verdict: "buy" as const, headline: "Buy it. The colour works with your skin.", reasons: [`Its main colour ${product.hex} contrasts with your skin tone ${skinHex} (${round(d)} ΔE), so it frames your face instead of blending in.`], alternatives: [] };
}

export function decide(input: Input): Verdict {
  const base = input.product.kind === "foundation" ? foundation(input) : input.product.kind === "lipstick" ? lipstick(input) : garment(input);
  const day = dayNotes(input.skin);
  return { ...base, reasons: [...base.reasons, ...day.reasons], skincare: day.skincare, tryOn: { coverage: day.coverage } };
}

export { label as productLabel };
