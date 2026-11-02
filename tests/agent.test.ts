import { describe, expect, it } from "vitest";
import { runMirror, type AgentEvent, type AgentDeps } from "@/lib/agent";
import { YouCamError } from "@/lib/youcam";
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
    faceCrop: async () => "face" as unknown as Buffer,
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

  it("retries a garment try-on that handed back the original, then says so honestly", async () => {
    const { d, runs } = deps({ thumb: async () => new Uint8Array(30).fill(0), catalogLine: () => [] });
    const g: Product = { id: "g", kind: "garment", brand: "", name: "Shirt", line: "g", shade: null, hex: "#1f3a5f", image: "https://shop/shirt.jpg" };
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: g }, d));
    const result = ev.find((e) => e.type === "result") as Extract<AgentEvent, { type: "result" }>;
    expect(runs.filter((r) => r.feature === "cloth")).toHaveLength(2);
    expect(result.tryOns[0].unchanged).toBe(true);
    expect(ev.some((e) => e.type === "step" && /unchanged/i.test(e.detail ?? ""))).toBe(true);
  });

  it("does not spend a retry on a subtle makeup shade", async () => {
    const { d, runs } = deps({ thumb: async () => new Uint8Array(30).fill(0) });
    await collect(runMirror({ selfie: "selfie" as never, product: line[1] }, d));
    expect(runs.filter((r) => r.feature === "makeup-vto")).toHaveLength(1);
  });

  it("falls back to a face crop when a waist-up photo's face is too small", async () => {
    const uploads: Array<[string, unknown]> = [];
    const { d } = deps({ catalogLine: () => [] });
    const run = d.youcam.run;
    d.youcam.upload = async (f, b) => { uploads.push([f, b]); return `${f}:${String(b)}`; };
    d.youcam.run = (async (f: string, body: Record<string, unknown>) => {
      if (body.src_file_id === "skin-tone-analysis:selfie") throw new YouCamError("The face in the input image is too small.", "error_face_position_too_small");
      return run(f, body);
    }) as typeof run;
    const g: Product = { id: "g", kind: "garment", brand: "", name: "Shirt", line: "g", shade: null, hex: "#1f3a5f", image: "https://shop/shirt.jpg" };
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: g }, d));
    expect(ev.some((e) => e.type === "result")).toBe(true);
    expect(uploads).toEqual([["skin-tone-analysis", "selfie"], ["skin-tone-analysis", "face"], ["skin-analysis", "face"], ["cloth", "selfie"]]);
  });

  it("retries the skin scan on a face crop when the face fills too little of the photo", async () => {
    const uploads: Array<[string, unknown]> = [];
    const { d } = deps();
    const run = d.youcam.run;
    d.youcam.upload = async (f, b) => { uploads.push([f, b]); return `${f}:${String(b)}`; };
    d.youcam.run = (async (f: string, body: Record<string, unknown>) => {
      if (body.src_file_id === "skin-analysis:selfie") throw new YouCamError("The face in the input image is too small.", "error_src_face_too_small");
      return run(f, body);
    }) as typeof run;
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    expect(ev.some((e) => e.type === "result")).toBe(true);
    expect(uploads.slice(0, 4)).toEqual([["skin-tone-analysis", "selfie"], ["skin-analysis", "selfie"], ["skin-analysis", "face"], ["makeup-vto", "face"]]);
  });

  it("retries the tone check on a face crop for makeup too", async () => {
    const uploads: Array<[string, unknown]> = [];
    const { d } = deps();
    const run = d.youcam.run;
    d.youcam.upload = async (f, b) => { uploads.push([f, b]); return `${f}:${String(b)}`; };
    d.youcam.run = (async (f: string, body: Record<string, unknown>) => {
      if (body.src_file_id === "skin-tone-analysis:selfie") throw new YouCamError("The face in the input image is too small.", "error_face_position_too_small");
      return run(f, body);
    }) as typeof run;
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    expect(ev.some((e) => e.type === "result")).toBe(true);
    expect(uploads.slice(0, 4)).toEqual([["skin-tone-analysis", "selfie"], ["skin-tone-analysis", "face"], ["skin-analysis", "face"], ["makeup-vto", "face"]]);
  });

  it("zooms in on a small face before the tone check instead of waiting for a rejection", async () => {
    const uploads: Array<[string, unknown]> = [];
    const { d } = deps();
    d.youcam.upload = async (f, b) => { uploads.push([f, b]); return `${f}:${String(b)}`; };
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0], zoom: true }, d));
    expect(ev.some((e) => e.type === "result")).toBe(true);
    expect(uploads.slice(0, 3)).toEqual([["skin-tone-analysis", "face"], ["skin-analysis", "face"], ["makeup-vto", "face"]]);
    const res = ev.find((e) => e.type === "result");
    expect(res && res.type === "result" && res.photo).toBe(`data:image/jpeg;base64,${Buffer.from("face").toString("base64")}`);
  });

  it("retries on a face crop when an off-centre face is read as turned away", async () => {
    const uploads: Array<[string, unknown]> = [];
    const { d } = deps();
    const run = d.youcam.run;
    d.youcam.upload = async (f, b) => { uploads.push([f, b]); return `${f}:${String(b)}`; };
    d.youcam.run = (async (f: string, body: Record<string, unknown>) => {
      if (body.src_file_id === "skin-tone-analysis:selfie") throw new YouCamError("The face is turned too far to the left.", "error_face_angle_leftward");
      return run(f, body);
    }) as typeof run;
    const ev = await collect(runMirror({ selfie: "selfie" as never, product: line[0] }, d));
    expect(ev.some((e) => e.type === "result")).toBe(true);
    expect(uploads[1]).toEqual(["skin-tone-analysis", "face"]);
  });

  it("uses the cloth API with the garment image for garments", async () => {
    const { d, runs } = deps({ catalogLine: () => [] });
    const g: Product = { id: "g", kind: "garment", brand: "", name: "Shirt", line: "g", shade: null, hex: "#1f3a5f", image: "https://shop/shirt.jpg" };
    await collect(runMirror({ selfie: "selfie" as never, product: g }, d));
    const cloth = runs.find((r) => r.feature === "cloth");
    expect(cloth?.body).toMatchObject({ ref_file_url: "https://shop/shirt.jpg", garment_category: "auto" });
  });
});
