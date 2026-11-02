export type Lab = { L: number; a: number; b: number };

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function hexToLab(hex: string): Lab {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference. ~2 is barely visible, >10 is clearly a different colour. */
export function deltaE(a: string, b: string): number {
  const p = hexToLab(a), q = hexToLab(b);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

export function hueAngle(hex: string): number {
  const { a, b } = hexToLab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

export type Undertone = "warm" | "neutral" | "cool";

export function undertone(skinHex: string): Undertone {
  const h = hueAngle(skinHex);
  if (h >= 55 && h < 180) return "warm";
  if (h <= 40 || h >= 300) return "cool";
  return "neutral";
}

export type ShadeComparison = { deltaE: number; lightnessGap: number; direction: "match" | "lighter" | "darker" | "off-tone" };

export function compareShade(shadeHex: string, skinHex: string): ShadeComparison {
  const d = deltaE(shadeHex, skinHex);
  const gap = hexToLab(shadeHex).L - hexToLab(skinHex).L;
  const direction = d < 4 && Math.abs(gap) < 3 ? "match" : gap >= 3 ? "lighter" : gap <= -3 ? "darker" : "off-tone";
  return { deltaE: round(d), lightnessGap: round(gap), direction };
}

export const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
