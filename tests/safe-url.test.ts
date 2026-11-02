import { describe, expect, it } from "vitest";
import { publicUrl } from "@/lib/safe-url";

describe("publicUrl", () => {
  it("accepts shop links", () => expect(publicUrl("https://www.zara.com/p/1")?.hostname).toBe("www.zara.com"));
  it("rejects local, private and non-http targets", () => {
    for (const u of ["http://localhost:3000", "http://127.0.0.1", "http://192.168.1.4/x", "http://10.0.0.1", "file:///etc/passwd", "nope"]) expect(publicUrl(u)).toBeNull();
  });
});
