import { runMirror } from "@/lib/agent";
import { getProduct, lineOf } from "@/lib/catalog";
import { faceCrop, inspect, loadImage, normalizeSelfie, thumb } from "@/lib/pixels";
import { publicUrl } from "@/lib/safe-url";
import { createYouCam } from "@/lib/youcam";
import type { Product } from "@/lib/types";

export const maxDuration = 300;

function readProduct(raw: string): Product | null {
  let p: Product;
  try { p = JSON.parse(raw); } catch { return null; }
  if (p.kind !== "garment") return getProduct(p.id) ?? null;
  if (!p.image || !publicUrl(p.image)) return null;
  return { ...p, hex: p.hex && /^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : null };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("selfie");
  const product = readProduct(String(form.get("product") ?? ""));
  if (!(file instanceof File) || !product) return Response.json({ error: "Send a selfie and a product." }, { status: 400 });
  let previous = null;
  try { previous = JSON.parse(String(form.get("previous") ?? "null")); } catch {}

  let youcam;
  try { youcam = createYouCam({ apiKey: process.env.YOUCAM_API_KEY }); } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  const selfie = await normalizeSelfie(Buffer.from(await file.arrayBuffer()));
  const events = runMirror({ selfie, product, previous }, { youcam, inspect, thumb, loadImage: (u) => loadImage(u), faceCrop, catalogLine: lineOf });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(enc.encode(JSON.stringify(value) + "\n"));
      } catch (e) {
        controller.enqueue(enc.encode(JSON.stringify({ type: "error", step: "verdict", message: (e as Error).message }) + "\n"));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
