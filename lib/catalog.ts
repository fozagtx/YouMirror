import data from "@/data/catalog.json";
import lineImages from "@/data/line-images.json";
import shadeImages from "@/data/shade-images.json";
import { deltaE } from "@/lib/color";
import type { Kind, Product } from "@/lib/types";

const photos = lineImages as Record<string, string | null>;
const packshots = shadeImages as Record<string, string>;
// Raw catalog links are shade swatches and often broken. Each shade shows its own verified packshot
// (scripts/build-packshots.mjs), else its line's verified photo (scripts/check-images.mjs).
const catalog = (data as Product[]).map((p) => ({ ...p, image: packshots[p.id] ?? photos[`${p.kind}:${p.line}`] ?? null }));
const byId = new Map(catalog.map((p) => [p.id, p]));
const haystack = new Map(catalog.map((p) => [p.id, `${p.brand} ${p.name} ${p.shade ?? ""}`.toLowerCase()]));

export function searchCatalog(query: string, kind?: Kind, limit = 24): Product[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Product[] = [];
  for (const p of catalog) {
    if (kind && p.kind !== kind) continue;
    const text = haystack.get(p.id)!;
    if (words.every((w) => text.includes(w))) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export const getProduct = (id: string) => byId.get(id);

export const lineOf = (p: Product) => catalog.filter((x) => x.line === p.line && x.kind === p.kind);

export function closestShades(skinHex: string, current: Product, n = 2): Product[] {
  return lineOf(current)
    .filter((p) => p.id !== current.id && p.hex)
    .map((p) => ({ p, d: deltaE(p.hex!, skinHex) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.p);
}

export const catalogSize = () => ({
  foundation: catalog.filter((p) => p.kind === "foundation").length,
  lipstick: catalog.filter((p) => p.kind === "lipstick").length,
});

export type Line = { id: string; kind: Kind; brand: string; name: string; image: string | null; price: string | null; shades: number; swatches: string[] };

const lines: Line[] = (() => {
  const map = new Map<string, Line>();
  for (const p of catalog) {
    const key = `${p.kind}:${p.line}`;
    let l = map.get(key);
    if (!l) map.set(key, (l = { id: p.id, kind: p.kind, brand: p.brand, name: p.name, image: packshots[p.id] ?? photos[key] ?? null, price: p.price ?? null, shades: 0, swatches: [] }));
    l.shades++;
    if (p.hex && l.swatches.length < 8) l.swatches.push(p.hex);
  }
  return [...map.values()].sort((a, b) => b.shades - a.shades);
})();

export const linesWithPhotos = (kind: Kind, limit: number) => lines.filter((l) => l.kind === kind && l.image).slice(0, limit);

export function listLines(query: string, kind: Kind, limit = 24): Line[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return lines.filter((l) => l.kind === kind && words.every((w) => `${l.brand} ${l.name}`.toLowerCase().includes(w))).slice(0, limit);
}
