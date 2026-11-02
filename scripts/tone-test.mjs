// Skin-tone consistency test: runs YouCam Skin Tone Analysis on each photo in three lightings
// (as shot, 45% darker, warm tungsten cast) and prints the measured tone and face-quality flags.
// Usage: YOUCAM_API_KEY=... [LIGHTS=as,dim] node scripts/tone-test.mjs photo1.jpg photo2.jpg ...
// Results are appended to research/tone-test.json.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const B = "https://yce-api-01.makeupar.com/s2s/v2.0";
const H = { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}` };
const j = async (r) => { const t = await r.json(); if (!r.ok) throw new Error(JSON.stringify(t)); return t; };

async function tone(buf) {
  const init = await j(await fetch(`${B}/file/skin-tone-analysis`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ files: [{ content_type: "image/jpeg", file_name: "t.jpg", file_size: buf.length }] }) }));
  const f = init.data.files[0];
  await fetch(f.requests[0].url, { method: "PUT", headers: f.requests[0].headers, body: buf });
  const { data } = await j(await fetch(`${B}/task/skin-tone-analysis`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ src_file_id: f.file_id }) }));
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = (await j(await fetch(`${B}/task/skin-tone-analysis/${data.task_id}`, { headers: H }))).data;
    if (s.task_status === "success") return s.results;
    if (s.task_status === "error") return { error: s.error };
  }
}

const LIGHTS = {
  "as shot": (img) => img,
  "dim (-45%)": (img) => img.modulate({ brightness: 0.55 }),
  "warm tungsten": (img) => img.recomb([[1.12, 0, 0], [0, 0.98, 0], [0, 0, 0.78]]),
};

const only = process.env.LIGHTS?.split(",");
const rows = fs.existsSync("research/tone-test.json") ? JSON.parse(fs.readFileSync("research/tone-test.json", "utf8")) : [];
for (const file of process.argv.slice(2)) {
  for (const [light, fx] of Object.entries(LIGHTS)) {
    if (only && !only.some((o) => light.startsWith(o))) continue;
    const buf = await fx(sharp(file).rotate().resize(1600, 1600, { fit: "inside" })).jpeg({ quality: 92 }).toBuffer();
    const r = await tone(buf);
    const row = { photo: path.basename(file), light, skin: r.color?.skin_color ?? null, quality: r.face_quality ?? null, error: r.error ?? null };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
fs.writeFileSync("research/tone-test.json", JSON.stringify(rows, null, 2));
