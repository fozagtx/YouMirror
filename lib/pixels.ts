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

/** Most common colour (quantised) of a product photo, ignoring the backdrop (white or the border colour). */
export async function dominantColor(buf: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).resize(64, 64, { fit: "fill", kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const border: number[][] = [];
  for (let k = 0; k < info.width; k++) border.push(px(k, 0), px(k, info.height - 1), px(0, k), px(info.width - 1, k));
  const bg = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 235 && g > 235 && b > 235) continue;
    if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 36) continue;
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

/** Head-and-shoulders crop of a waist-up photo (top 45%, centre 64%), so the face is big enough for skin scans. */
export async function faceCrop(buf: Buffer): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const w = Math.round(width * 0.64), h = Math.round(height * 0.45);
  return sharp(buf).extract({ left: Math.round((width - w) / 2), top: 0, width: w, height: h }).jpeg({ quality: 92 }).toBuffer();
}
