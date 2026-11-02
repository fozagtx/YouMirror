import { createHash } from "node:crypto";
import { parseProductPage } from "@/lib/link";
import { dominantColor, loadImage } from "@/lib/pixels";
import { publicUrl } from "@/lib/safe-url";
import type { Product } from "@/lib/types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const page = url ? publicUrl(url) : null;
  if (!page) return Response.json({ error: "Paste a full product link starting with https://" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(page, { headers: { "User-Agent": UA, Accept: "text/html,image/*" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
  } catch {
    return Response.json({ error: "That shop didn't respond. Paste the product image link instead." }, { status: 502 });
  }
  if (!res.ok) return Response.json({ error: `That shop blocked the request (${res.status}). Paste the product image link instead.` }, { status: 502 });

  const type = res.headers.get("content-type") ?? "";
  const info = type.startsWith("image/")
    ? { title: page.pathname.split("/").pop() || page.hostname, image: page.toString(), price: null }
    : parseProductPage(await res.text(), res.url || page.toString());
  const image = info.image ? publicUrl(info.image) : null;
  if (!image) return Response.json({ error: "No product photo found on that page. Paste the product image link instead." }, { status: 422 });

  let hex: string | null = null;
  try {
    hex = await dominantColor(type.startsWith("image/") ? Buffer.from(await res.arrayBuffer()) : await loadImage(image.toString()));
  } catch {
    return Response.json({ error: "Couldn't download the product photo. Paste the product image link instead." }, { status: 502 });
  }

  const product: Product = {
    id: `link-${createHash("sha1").update(page.toString()).digest("hex").slice(0, 12)}`,
    kind: "garment",
    brand: page.hostname.replace(/^www\./, ""),
    name: info.title.slice(0, 120),
    line: "link",
    shade: null,
    hex,
    image: image.toString(),
    url: page.toString(),
    price: info.price,
  };
  return Response.json({ product });
}
