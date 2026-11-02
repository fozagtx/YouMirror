const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

function meta(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const t of tags) {
    const k = t.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (k?.toLowerCase() !== key) continue;
    const v = t.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (v) return decode(v);
  }
  return null;
}

export function parseProductPage(html: string, pageUrl: string) {
  const title = meta(html, "og:title") ?? meta(html, "twitter:title") ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "") ?? "";
  const img = meta(html, "og:image") ?? meta(html, "og:image:secure_url") ?? meta(html, "twitter:image");
  const amount = meta(html, "product:price:amount") ?? meta(html, "og:price:amount");
  const currency = meta(html, "product:price:currency") ?? meta(html, "og:price:currency");
  return {
    title: title || new URL(pageUrl).hostname,
    image: img ? new URL(img, pageUrl).toString() : null,
    price: amount ? [currency, amount].filter(Boolean).join(" ") : null,
  };
}
