import sharp from "sharp";
import { sharpness } from "@/lib/check";
import { rgbToHex } from "@/lib/color";

const THUMB = 96;

export async function inspect(buf: Buffer) {
  const meta = await sharp(buf).rotate().metadata();
  const g = await sharp(buf).rotate().resize(512, 512, { fit: "inside" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const [w, h] = meta.orientation && meta.orientation >= 5 ? [meta.height!, meta.width!] : [meta.width!, meta.height!];
  return { width: w, height: h, bytes: buf.byteLength, sharpness: sharpness(new Uint8Array(g.data), g.info.width, g.info.height) };
}

export async function thumb(buf: Buffer): Promise<Uint8Array> {
  const out = await sharp(buf).rotate().resize(THUMB, THUMB, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return new Uint8Array(out);
}

/** Most common colour (quantised) among the non-backdrop pixels of a product photo. */
export async function dominantColor(buf: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).resize(64, 64, { fit: "fill", kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 235 && g > 235 && b > 235) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const k = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    k.n++; k.r += r; k.g += g; k.b += b;
    buckets.set(key, k);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const v of buckets.values()) if (!best || v.n > best.n) best = v;
  return best ? rgbToHex([best.r / best.n, best.g / best.n, best.b / best.n]) : null;
}

export async function normalizeSelfie(buf: Buffer): Promise<Buffer> {
  return sharp(buf).rotate().resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
}

export async function loadImage(url: string, f: typeof fetch = fetch): Promise<Buffer> {
  const res = await f(url, { headers: { "User-Agent": "Mozilla/5.0 YouMirror" } });
  if (!res.ok) throw new Error(`Couldn't download image (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
