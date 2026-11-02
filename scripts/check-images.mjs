// Picks one working product photo per catalogue line. Broken links and the retailer
// "image not available" placeholder (the same bytes reused across many lines) are dropped.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url)));
const lines = new Map();
for (const p of catalog) {
  const key = `${p.kind}:${p.line}`;
  if (!lines.has(key)) lines.set(key, []);
  if (p.image && !lines.get(key).includes(p.image)) lines.get(key).push(p.image);
}

async function probe(url) {
  try {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length < 1500 ? null : createHash("sha1").update(buf).digest("hex");
  } catch { return null; }
}

const found = new Map();
const owners = new Map();
const keys = [...lines.keys()];
let i = 0;
await Promise.all(Array.from({ length: 16 }, async () => {
  while (i < keys.length) {
    const key = keys[i++];
    const tried = [];
    for (const url of lines.get(key).slice(0, 4)) {
      const hash = await probe(url);
      if (hash) { tried.push({ url, hash }); if (!owners.has(hash)) owners.set(hash, new Set()); owners.get(hash).add(key); }
    }
    found.set(key, tried);
  }
}));

const out = {};
for (const [key, tried] of found) out[key] = tried.find((t) => owners.get(t.hash).size < 3)?.url ?? null;
await writeFile(new URL("../data/line-images.json", import.meta.url), JSON.stringify(out, null, 0) + "\n");
console.log(`${Object.values(out).filter(Boolean).length} of ${keys.length} lines have a working photo`);
