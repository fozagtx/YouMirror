import { describe, expect, it } from "vitest";
import { runMirror, type AgentEvent, type AgentDeps } from "@/lib/agent";
import type { Product } from "@/lib/types";

const fnd = (hex: string, id: string): Product => ({ id, kind: "foundation", brand: "B", name: "Base", line: "b", shade: id, hex });
const line = [fnd("#f1e7db", "pale"), fnd("#bd9e89", "close1"), fnd("#b89884", "close2")];

function deps(over: Partial<AgentDeps> = {}, faceQuality = { has_face: true, area: "good", frontal: "good", lighting: "good", faceangle: "good" }) {
  const runs: Array<{ feature: string; body: Record<string, unknown> }> = [];
  let tryOnCount = 0;
  const d: AgentDeps = {
    youcam: {
      upload: async (feature) => `file-${feature}`,
      run: async (feature, body) => {
        runs.push({ feature, body });
        if (feature === "skin-tone-analysis") return { face_quality: faceQuality, color: { skin_color: "#bc9d88" } } as never;
        if (feature === "skin-analysis") return { output: [{ type: "acne", ui_score: 95 }, { type: "redness", ui_score: 92 }] } as never;
        return { url: `https://r/${++tryOnCount}.jpg` } as never;
      },
    },
    inspect: async () => ({ width: 1080, height: 1440, bytes: 1000, sharpness: 40 }),
    thumb: async (src) => new Uint8Array(30).fill((src as unknown) === "selfie" ? 0 : 200),
    loadImage: async (url) => url as unknown as Buffer,
    catalogLine: () => line,
    ...over,
  };
  return { d, runs };
}

async function collect(gen: AsyncGenerator<AgentEvent>) {
  const ev: AgentEvent[] = [];
  for await (const e of gen) ev.push(e);
  return ev;
}

describe("runMirror", () => {
  it("runs scan → tone → try-on → compare → verdict and tries the alternatives on", async () => {
    const { d, runs } = deps();
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    const done = ev.filter((e) => e.type === "step" && e.status === "done").map((e) => (e as { id: string }).id);
    expect(done).toEqual(["photo", "tone", "skin", "tryon", "compare", "verdict"]);
    const result = ev.find((e) => e.type === "result") as Extract<AgentEvent, { type: "result" }>;
    expect(result.verdict.verdict).toBe("swap");
    expect(result.tryOns.map((t) => t.product.id)).toEqual(["pale", "close1", "close2"]);
    expect(runs.filter((r) => r.feature === "makeup-vto")).toHaveLength(3);
  });

  it("stops before spending units when the photo is blurry", async () => {
    const { d, runs } = deps({ inspect: async () => ({ width: 1080, height: 1440, bytes: 1000, sharpness: 1 }) });
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    expect(ev.at(-1)).toMatchObject({ type: "error", message: expect.stringMatching(/blurry/) });
    expect(runs).toHaveLength(0);
  });

  it("stops before skin analysis when YouCam says the lighting is poor", async () => {
    const { d, runs } = deps({}, { has_face: true, area: "good", frontal: "good", lighting: "bad", faceangle: "good" });
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    expect(ev.at(-1)).toMatchObject({ type: "error", message: expect.stringMatching(/lighting/i) });
    expect(runs.map((r) => r.feature)).toEqual(["skin-tone-analysis"]);
  });

  it("retries a try-on that handed back the original, then says so honestly", async () => {
    const { d, runs } = deps({ thumb: async () => new Uint8Array(30).fill(0) });
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[1] }, d));
    const result = ev.find((e) => e.type === "result") as Extract<AgentEvent, { type: "result" }>;
    expect(runs.filter((r) => r.feature === "makeup-vto")).toHaveLength(2);
    expect(result.tryOns[0].unchanged).toBe(true);
    expect(ev.some((e) => e.type === "step" && /unchanged/i.test(e.detail ?? ""))).toBe(true);
  });

  it("uses the cloth API with the garment image for garments", async () => {
    const { d, runs } = deps({ catalogLine: () => [] });
    const g: Product = { id: "g", kind: "garment", brand: "", name: "Shirt", line: "g", shade: null, hex: "#1f3a5f", image: "https://shop/shirt.jpg" };
    await collect(runMirror({ selfie: "selfie" as never, product: g }, d));
    const cloth = runs.find((r) => r.feature === "cloth");
    expect(cloth?.body).toMatchObject({ ref_file_url: "https://shop/shirt.jpg", garment_category: "auto" });
  });
});
