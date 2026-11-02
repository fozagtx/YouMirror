import { describe, expect, it, vi } from "vitest";
import { createYouCam, YouCamError } from "@/lib/youcam";

function fakeFetch(routes: Array<[RegExp, (init: RequestInit) => unknown]>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const r = routes.find(([re]) => re.test(`${init.method ?? "GET"} ${url}`));
    if (!r) throw new Error(`unexpected ${init.method} ${url}`);
    const body = r[1](init);
    return new Response(JSON.stringify(body ?? {}), { status: 200 });
  });
  return { fn, calls };
}

describe("youcam client", () => {
  it("uploads through the File API then PUTs bytes to the presigned URL", async () => {
    const { fn, calls } = fakeFetch([
      [/POST .*\/s2s\/v2.0\/file\/skin-tone-analysis$/, () => ({ status: 200, data: { files: [{ file_id: "F1", requests: [{ url: "https://up/x", method: "PUT", headers: { "Content-Type": "image/jpeg" } }] }] } })],
      [/PUT https:\/\/up\/x/, () => ({})],
    ]);
    const yc = createYouCam({ apiKey: "k", fetch: fn as unknown as typeof fetch });
    const id = await yc.upload("skin-tone-analysis", Buffer.from("abc"), "image/jpeg");
    expect(id).toBe("F1");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(calls[0].init.body as string).files[0].file_size).toBe(3);
    expect(calls[1].init.method).toBe("PUT");
  });

  it("starts a task and polls until success", async () => {
    let polls = 0;
    const { fn } = fakeFetch([
      [/POST .*\/task\/makeup-vto$/, () => ({ status: 200, data: { task_id: "T1" } })],
      [/GET .*\/task\/makeup-vto\/T1$/, () => (++polls < 3 ? { data: { task_status: "running" } } : { data: { task_status: "success", results: { url: "https://r/1.jpg" } } })],
    ]);
    const yc = createYouCam({ apiKey: "k", fetch: fn as unknown as typeof fetch, pollMs: 1 });
    const res = await yc.run<{ url: string }>("makeup-vto", { src_file_id: "F" });
    expect(res.url).toBe("https://r/1.jpg");
    expect(polls).toBe(3);
  });

  it("turns task errors into readable messages", async () => {
    const { fn } = fakeFetch([
      [/POST .*\/task\/skin-analysis$/, () => ({ data: { task_id: "T" } })],
      [/GET .*\/task\/skin-analysis\/T$/, () => ({ data: { task_status: "error", error: "error_no_face" } })],
    ]);
    const yc = createYouCam({ apiKey: "k", fetch: fn as unknown as typeof fetch, pollMs: 1 });
    await expect(yc.run("skin-analysis", {})).rejects.toThrow(/No face found/);
    await expect(yc.run("skin-analysis", {})).rejects.toBeInstanceOf(YouCamError);
  });

  it("refuses to run without an API key", () => {
    expect(() => createYouCam({ apiKey: "" })).toThrow(/YOUCAM_API_KEY/);
  });
});
