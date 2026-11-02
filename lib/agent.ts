import { changedFraction, photoProblems } from "@/lib/check";
import { undertone } from "@/lib/color";
import { SKIN_ACTIONS, summarizeSkin, type SkinSummary } from "@/lib/skin";
import type { Product, SkinOutput } from "@/lib/types";
import { decide, type Verdict } from "@/lib/verdict";
import type { YouCamError } from "@/lib/youcam";

export type StepId = "photo" | "tone" | "skin" | "tryon" | "compare" | "verdict";
export type TryOn = { product: Product; url: string | null; unchanged: boolean; error?: string };
export type Tone = { skinHex: string; undertone: string; eyeColor?: string; lipColor?: string; hairColor?: string };

export type AgentEvent =
  | { type: "step"; id: StepId; status: "running" | "done" | "warn"; title: string; detail?: string }
  | { type: "result"; verdict: Verdict; tone: Tone; skin: SkinSummary; tryOns: TryOn[]; photo?: string | null }
  | { type: "error"; step: StepId; message: string };

type Img = Buffer;

export type AgentDeps = {
  youcam: { upload: (feature: string, bytes: Img, contentType: string) => Promise<string>; run: <T>(feature: string, body: Record<string, unknown>) => Promise<T> };
  inspect: (buf: Img) => Promise<{ width: number; height: number; bytes: number; sharpness: number }>;
  thumb: (buf: Img) => Promise<Uint8Array>;
  loadImage: (url: string) => Promise<Img>;
  faceCrop: (buf: Img) => Promise<Img>;
  catalogLine: (p: Product) => Product[];
};

type FaceQuality = Partial<Record<"area" | "frontal" | "lighting" | "faceangle", string>> & { has_face?: boolean };

const FACE_FIX: Record<string, string> = {
  area: "Move closer so your face fills more of the frame.",
  frontal: "Face the camera straight on.",
  lighting: "The lighting is too dim or uneven. Face a window or a lamp.",
  faceangle: "Keep your head level and look straight at the camera.",
};

/**
 * Under this share of clearly changed pixels a garment try-on is the original photo handed back.
 * YouCam re-renders the whole frame (a small global colour shift), and a real garment swap
 * repaints far more than 2% of it. Makeup is not checked: a subtle shade is a real result.
 */
const UNCHANGED_BELOW = 0.02;

export function effectFor(p: Product, coverage: number) {
  if (p.kind === "lipstick") {
    return [{ category: "lip_color", shape: { name: "original" }, style: { type: "full" }, palettes: [{ color: p.hex, texture: "satin", colorIntensity: 70 }] }];
  }
  return [{ category: "foundation", palettes: [{ color: p.hex, colorIntensity: 60, glowIntensity: 15, coverageIntensity: coverage }] }];
}

// Off-centre or far-away faces come back as "too small" or "turned away"; a crop around the face fixes both.
const framing = (e: unknown) => /too_small|too small|angle/i.test(`${(e as YouCamError).code ?? ""} ${(e as Error).message ?? ""}`);

export async function* runMirror(
  input: { selfie: Img; product: Product; previous?: Pick<SkinSummary, "scores"> | null; zoom?: boolean },
  d: AgentDeps,
): AsyncGenerator<AgentEvent> {
  const { selfie, product } = input;
  const step = (id: StepId, status: "running" | "done" | "warn", title: string, detail?: string): AgentEvent => ({ type: "step", id, status, title, detail });

  yield step("photo", "running", "Checking your photo");
  const problems = photoProblems(await d.inspect(selfie));
  if (problems.length) return yield { type: "error", step: "photo", message: problems.join(" ") };
  yield step("photo", "done", "Photo is sharp and big enough");

  yield step("tone", "running", "Measuring your skin tone");
  let face = input.zoom ? await d.faceCrop(selfie) : selfie;
  let tone: Tone;
  try {
    type ToneResult = { color: Record<string, string>; face_quality?: FaceQuality };
    const measure = async (img: Img) => d.youcam.run<ToneResult>("skin-tone-analysis", { src_file_id: await d.youcam.upload("skin-tone-analysis", img, "image/jpeg") });
    let r: ToneResult;
    try {
      r = await measure(face);
    } catch (e) {
      // Framing rejections flip to the other framing: a crop for wide photos, the full photo when the crop is too tight
      // (failed tasks cost no units).
      if (!framing(e)) throw e;
      face = face !== selfie ? selfie : await d.faceCrop(selfie);
      r = await measure(face);
    }
    const fq = r.face_quality ?? {};
    if (fq.has_face === false) return yield { type: "error", step: "tone", message: "No face found. Face the camera in good light." };
    const bad = (Object.keys(FACE_FIX) as (keyof typeof FACE_FIX)[]).filter((k) => fq[k as keyof FaceQuality] && fq[k as keyof FaceQuality] !== "good");
    if (bad.length) return yield { type: "error", step: "tone", message: bad.map((k) => FACE_FIX[k]).join(" ") };
    const skinHex = r.color.skin_color.toLowerCase();
    tone = { skinHex, undertone: undertone(skinHex), eyeColor: r.color.eye_color, lipColor: r.color.lip_color, hairColor: r.color.hair_color };
  } catch (e) {
    return yield { type: "error", step: "tone", message: (e as Error).message };
  }
  yield step("tone", "done", `Skin tone ${tone.skinHex}, ${tone.undertone} undertone`);

  yield step("skin", "running", "Scanning today's skin");
  let skin: SkinSummary;
  try {
    type SkinResult = { output?: SkinOutput[] } | SkinOutput[];
    const scan = async (img: Img) => d.youcam.run<SkinResult>("skin-analysis", { src_file_id: await d.youcam.upload("skin-analysis", img, "image/jpeg"), dst_actions: [...SKIN_ACTIONS], format: "json" });
    let r: SkinResult;
    try {
      r = await scan(face);
    } catch (e) {
      // Skin Analysis wants the face across 60% of the frame; retry on a face crop (failed tasks cost no units).
      if (face !== selfie || !framing(e)) throw e;
      face = await d.faceCrop(selfie);
      r = await scan(face);
    }
    skin = summarizeSkin(Array.isArray(r) ? r : r.output ?? [], input.previous);
  } catch (e) {
    return yield { type: "error", step: "skin", message: (e as Error).message };
  }
  yield step("skin", "done", skin.breakout ? `Breakout day: ${skin.concerns.map((c) => `${c.label.toLowerCase()} ${c.score}`).join(", ")}` : "Skin is calm today");

  const verdict = decide({ product, skinHex: tone.skinHex, skin, catalogLine: product.kind === "garment" ? [] : d.catalogLine(product) });
  const feature = product.kind === "garment" ? "cloth" : "makeup-vto";
  let fileId: string | null = null;
  let before: Uint8Array | null = null;

  const tryOn = async (p: Product): Promise<TryOn & { retried: boolean }> => {
    // Makeup goes on the zoomed face so the result is close enough to see; garments need the whole body.
    const src = p.kind === "garment" ? selfie : face;
    fileId ??= await d.youcam.upload(feature, src, "image/jpeg");
    before ??= await d.thumb(src);
    const body = p.kind === "garment"
      ? { src_file_id: fileId, ref_file_url: p.image, garment_category: "auto" }
      : { src_file_id: fileId, effects: effectFor(p, verdict.tryOn.coverage) };
    let url = "";
    if (p.kind !== "garment") {
      url = (await d.youcam.run<{ url: string }>(feature, body)).url;
      return { product: p, url, unchanged: false, retried: false };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      url = (await d.youcam.run<{ url: string }>(feature, body)).url;
      const after = await d.thumb(await d.loadImage(url));
      if (changedFraction(before, after) >= UNCHANGED_BELOW) return { product: p, url, unchanged: false, retried: attempt > 0 };
    }
    return { product: p, url, unchanged: true, retried: true };
  };

  yield step("tryon", "running", `Trying ${product.shade ?? product.name} on you`);
  const tryOns: TryOn[] = [];
  try {
    const t = await tryOn(product);
    tryOns.push({ product: t.product, url: t.url, unchanged: t.unchanged });
    yield t.unchanged
      ? step("tryon", "warn", "Try-on came back unchanged", "YouCam handed back your original photo twice, so this try-on is unchanged. Judge by the scan, not the picture.")
      : step("tryon", "done", t.retried ? "Try-on ready (first attempt came back unchanged, retried)" : "Try-on ready");
  } catch (e) {
    return yield { type: "error", step: "tryon", message: (e as Error).message };
  }

  yield step("compare", "running", verdict.alternatives.length ? `Trying ${verdict.alternatives.length} closer shades on you` : "Comparing against your scan");
  for (const alt of verdict.alternatives) {
    try {
      const t = await tryOn(alt);
      tryOns.push({ product: t.product, url: t.url, unchanged: t.unchanged });
    } catch (e) {
      tryOns.push({ product: alt, url: null, unchanged: false, error: (e as Error).message });
    }
  }
  yield step("compare", "done", verdict.alternatives.length ? `${verdict.alternatives.length} alternatives tried on` : "No swap needed");

  yield step("verdict", "done", verdict.headline);
  const photo = face !== selfie && product.kind !== "garment" ? `data:image/jpeg;base64,${Buffer.from(face).toString("base64")}` : null;
  yield { type: "result", verdict, tone, skin, tryOns, photo };
}
