import type { FaceDetector } from "@mediapipe/tasks-vision";
import { clampBox, type Box } from "@/lib/face-box";

let detector: Promise<FaceDetector> | null = null;

const load = () =>
  (detector ??= import("@mediapipe/tasks-vision").then(async ({ FaceDetector, FilesetResolver }) =>
    FaceDetector.createFromOptions(await FilesetResolver.forVisionTasks("/mediapipe"), {
      baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite", delegate: "CPU" },
      runningMode: "IMAGE",
    }),
  ));

/** Finds the biggest face in the photo on the device, so the server can zoom in on it. Null if none or the detector fails. */
export async function detectFace(img: HTMLImageElement): Promise<Box | null> {
  try {
    const faces = (await load()).detect(img).detections.flatMap((d) => (d.boundingBox ? [d.boundingBox] : []));
    if (!faces.length) return null;
    const b = faces.reduce((a, c) => (c.width * c.height > a.width * a.height ? c : a));
    const W = img.naturalWidth, H = img.naturalHeight;
    return clampBox({ x: b.originX / W, y: b.originY / H, w: b.width / W, h: b.height / H });
  } catch {
    detector = null;
    return null;
  }
}
