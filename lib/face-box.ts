/** Face bounding box, normalised to 0..1 of the image width and height. */
export type Box = { x: number; y: number; w: number; h: number };
export type Rect = { left: number; top: number; width: number; height: number };

const FACE_SHARE = 0.7;

export function clampBox(b: Box): Box {
  const x = Math.max(0, b.x), y = Math.max(0, b.y);
  return { x, y, w: Math.min(b.x + b.w, 1) - x, h: Math.min(b.y + b.h, 1) - y };
}

export function parseBox(raw: string): Box | null {
  let b: Box;
  try { b = JSON.parse(raw); } catch { return null; }
  if (!b || typeof b !== "object") return null;
  const n = [b.x, b.y, b.w, b.h];
  if (!n.every((v) => typeof v === "number" && v >= 0 && v <= 1)) return null;
  if (b.w === 0 || b.h === 0 || b.x + b.w > 1 || b.y + b.h > 1) return null;
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

/** 3:4 portrait crop centred on the face, sized so the face fills ~70% of its width (YouCam skin scans want over 60%). */
export function cropAround(box: Box, W: number, H: number): Rect {
  let cw = (box.w * W) / FACE_SHARE, ch = (cw * 4) / 3;
  const fit = Math.min(W / cw, H / ch, 1);
  cw = Math.round(cw * fit); ch = Math.round(ch * fit);
  const cx = (box.x + box.w / 2) * W, cy = (box.y + box.h * 0.6) * H;
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(v, 0), max));
  return { left: clamp(cx - cw / 2, W - cw), top: clamp(cy - ch / 2, H - ch), width: cw, height: ch };
}
