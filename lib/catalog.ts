import data from "@/data/catalog.json";
import { deltaE } from "@/lib/color";
import type { Kind, Product } from "@/lib/types";

const catalog = data as Product[];
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
