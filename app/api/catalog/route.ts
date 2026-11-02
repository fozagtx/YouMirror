import { getProduct, lineOf, searchCatalog } from "@/lib/catalog";
import type { Kind } from "@/lib/types";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lineFor = sp.get("lineFor");
  if (lineFor) {
    const p = getProduct(lineFor);
    return Response.json({ items: p ? lineOf(p) : [] });
  }
  const kind = sp.get("kind") === "lipstick" ? "lipstick" : ("foundation" as Kind);
  return Response.json({ items: searchCatalog(sp.get("q") ?? "", kind, 40) });
}
