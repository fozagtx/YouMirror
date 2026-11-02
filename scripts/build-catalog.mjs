// Builds data/catalog.json from two public, real product datasets:
// - The Pudding "foundation-names" (Ulta + Sephora foundation shades with swatch hex)
// - makeup-api.herokuapp.com lipsticks (brand shades with hex)
import fs from "node:fs";

const PUDDING = "https://raw.githubusercontent.com/the-pudding/data/master/foundation-names/allShades.csv";
const LIPSTICK = "http://makeup-api.herokuapp.com/api/v1/products.json?product_type=lipstick";
const HEX = /^#[0-9a-f]{6}$/i;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const clean = (s) => (s || "").replace(/\s+/g, " ").replace(/\s*selected$/i, "").trim();

const products = [];
const seen = new Set();
const push = (p) => { if (!seen.has(p.id)) { seen.add(p.id); products.push(p); } };

const csv = parseCsv(await (await fetch(PUDDING)).text());
for (const r of csv) {
  if (!HEX.test(r.hex)) continue;
  const shade = clean(r.name !== "NA" ? r.name : r.description) || r.specific;
  const line = `${slug(r.brand)}-${slug(r.product)}`;
  push({
    id: `fnd-${line}-${slug(r.specific !== "NA" ? r.specific : shade).slice(0, 40)}-${r.hex.slice(1).toLowerCase()}`,
    kind: "foundation",
    brand: clean(r.brand),
    name: clean(r.product),
    line,
    shade,
    hex: r.hex.toLowerCase(),
    image: r.imgSrc && r.imgSrc !== "NA" ? r.imgSrc.replace(/\$\w+\$$/, "$tn$") : null,
    url: r.url,
  });
}

const lips = await (await fetch(LIPSTICK)).json();
for (const p of lips) {
  const line = `${slug(p.brand || "unknown")}-${slug(p.name)}`;
  for (const c of p.product_colors || []) {
    const hex = (c.hex_value || "").trim();
    if (!HEX.test(hex)) continue;
    push({
      id: `lip-${line}-${slug(c.colour_name || hex).slice(0, 40)}-${hex.slice(1).toLowerCase()}`,
      kind: "lipstick",
      brand: clean(p.brand || ""),
      name: clean(p.name),
      line,
      shade: clean(c.colour_name) || hex,
      hex: hex.toLowerCase(),
      image: p.image_link || null,
      url: p.product_link || null,
      price: p.price ? `${p.price_sign || ""}${p.price}` : null,
    });
  }
}

fs.writeFileSync(new URL("../data/catalog.json", import.meta.url), JSON.stringify(products));
console.log(`catalog: ${products.filter((p) => p.kind === "foundation").length} foundation shades, ${products.filter((p) => p.kind === "lipstick").length} lipstick shades`);
