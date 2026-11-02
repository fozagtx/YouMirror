/** Fraction of pixels (RGB arrays of equal size) whose colour moved noticeably. */
export function changedFraction(a: Uint8Array, b: Uint8Array, threshold = 24): number {
  const n = Math.min(a.length, b.length) / 3;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2])) > threshold) changed++;
  }
  return changed / n;
}

/** Variance of the Laplacian on a grayscale image: low means blurry. */
export function sharpness(gray: Uint8Array, w: number, h: number): number {
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v; sq += v * v; n++;
    }
  }
  const mean = sum / n;
  return sq / n - mean * mean;
}

export const MIN_SHORT_SIDE = 480;
export const MAX_BYTES = 10 * 1024 * 1024;
export const MIN_SHARPNESS = 8;

export function photoProblems(p: { width: number; height: number; bytes: number; sharpness: number }): string[] {
  const out: string[] = [];
  if (Math.min(p.width, p.height) < MIN_SHORT_SIDE) out.push(`Photo is too small (${p.width}×${p.height}). The short side needs at least ${MIN_SHORT_SIDE}px.`);
  if (p.bytes > MAX_BYTES) out.push("Photo is over 10 MB.");
  if (p.sharpness < MIN_SHARPNESS) out.push("Photo looks blurry. Hold still and retake it in good light.");
  return out;
}
