export const YOUCAM_BASE = "https://yce-api-01.makeupar.com/s2s/v2.0";

const ERRORS: Record<string, string> = {
  error_no_face: "No face found. Face the camera straight on in good light.",
  error_pose: "Your head is turned too far. Look straight at the camera.",
  error_face_parsing: "We couldn't read your face clearly. Try brighter, even light.",
  exceed_max_filesize: "The photo is over 10 MB.",
  error_decode_image: "The photo couldn't be read. Try a JPG or PNG.",
  error_download_image: "YouCam couldn't download the product image.",
  error_nsfw_content_detected: "The photo was rejected by YouCam's content filter.",
  invalid_parameter: "YouCam rejected a parameter.",
};

export class YouCamError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

type Opts = { apiKey: string | undefined; fetch?: typeof fetch; baseUrl?: string; pollMs?: number; timeoutMs?: number };

export function createYouCam({ apiKey, fetch: f = fetch, baseUrl = YOUCAM_BASE, pollMs = 2000, timeoutMs = 150_000 }: Opts) {
  if (!apiKey) throw new YouCamError("YOUCAM_API_KEY is not set on the server.");
  const auth = { Authorization: `Bearer ${apiKey}` };

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await f(`${baseUrl}${path}`, {
      method,
      headers: body ? { ...auth, "Content-Type": "application/json" } : auth,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = json?.error_code ?? json?.error;
      throw new YouCamError(ERRORS[code] ?? json?.error_message ?? json?.message ?? `YouCam ${path} failed (${res.status})`, code);
    }
    return json as T;
  }

  async function upload(feature: string, bytes: Buffer | Uint8Array, contentType: string, fileName = "photo.jpg") {
    type R = { data: { files: { file_id: string; requests: { url: string; method: string; headers: Record<string, string> }[] }[] } };
    const r = await call<R>("POST", `/file/${feature}`, { files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] });
    const file = r.data.files[0];
    const req = file.requests[0];
    const put = await f(req.url, { method: req.method || "PUT", headers: req.headers, body: bytes as BodyInit });
    if (!put.ok) throw new YouCamError(`Upload to YouCam storage failed (${put.status}).`);
    return file.file_id;
  }

  async function run<T = unknown>(feature: string, body: Record<string, unknown>): Promise<T> {
    const start = await call<{ data: { task_id: string } }>("POST", `/task/${feature}`, body);
    const id = start.data.task_id;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      await new Promise((r) => setTimeout(r, pollMs));
      const s = await call<{ data: { task_status: string; error?: string | null; error_message?: string; results?: T } }>("GET", `/task/${feature}/${encodeURIComponent(id)}`);
      if (s.data.task_status === "success") return s.data.results as T;
      if (s.data.task_status === "error") {
        const code = s.data.error ?? undefined;
        throw new YouCamError((code && ERRORS[code]) || s.data.error_message || `YouCam ${feature} failed (${code})`, code);
      }
      if (Date.now() > deadline) throw new YouCamError(`YouCam ${feature} took too long.`);
    }
  }

  return { upload, run };
}

export type YouCam = ReturnType<typeof createYouCam>;
