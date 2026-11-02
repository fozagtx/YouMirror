import { listLines } from "@/lib/catalog";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") === "lipstick" ? "lipstick" : "foundation";
  return Response.json({ items: listLines(sp.get("q") ?? "", kind, 48) });
}
