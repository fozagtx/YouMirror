// Finds a real product packshot for each shade. Catalog image links are shade swatches;
// Sephora and Ulta serve the packshot of the same SKU at a sibling URL. Every URL is fetched
// and kept only if it returns a real image that isn't a shared "no image" placeholder.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url)));

export const packshotUrl = (swatch) => {
  if (!swatch) return null;
  const s = swatch.match(/^https:\/\/www\.sephora\.com\/productimages\/sku\/(s\d+)\+sw\.jpg$/);
  if (s) return `https://www.sephora.com/productimages/sku/${s[1]}-main-zoom.jpg`;
  const u = swatch.match(/^https:\/\/images\.ulta\.com\/is\/image\/Ulta\/(\d+)sw\b/);
  if (u) return `https://media.ulta.com/i/ulta/${u[1]}?w=600`;
  return null;
};

async function probe(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "manual" });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 4000) return null;
    return createHash("md5").update(buf).digest("hex");
  } catch {
    return null;
  }
}

const out = new URL("../data/shade-images.json", import.meta.url);
const found = JSON.parse(await readFile(out).catch(() => "{}"));
const jobs = catalog.map((p) => [p.id, packshotUrl(p.image)]).filter(([id, u]) => u && found[id] !== u);
const hashes = new Map();
let done = 0;
async function worker() {
  while (jobs.length) {
    const [id, url] = jobs.pop();
    const h = await probe(url);
    if (h) { found[id] = url; hashes.set(h, [...(hashes.get(h) ?? []), id]); }
    if (++done % 500 === 0) console.log(done, Object.keys(found).length);
  }
}
await Promise.all(Array.from({ length: 24 }, worker));
for (const ids of hashes.values()) if (ids.length > 3) for (const id of ids) delete found[id];
await writeFile(out, JSON.stringify(found) + "\n");
console.log(`${Object.keys(found).length} shades have a verified packshot`);
