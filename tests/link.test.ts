import { describe, expect, it } from "vitest";
import { parseProductPage } from "@/lib/link";

describe("parseProductPage", () => {
  it("reads title, image and price from Open Graph tags", () => {
    const html = `<html><head><meta property="og:title" content="Relaxed Linen Shirt &amp; Co"><meta property="og:image" content="/img/shirt.jpg"><meta property="product:price:amount" content="49.00"><meta property="product:price:currency" content="USD"></head></html>`;
    const p = parseProductPage(html, "https://shop.example.com/p/1");
    expect(p).toMatchObject({ title: "Relaxed Linen Shirt & Co", image: "https://shop.example.com/img/shirt.jpg", price: "USD 49.00" });
  });

  it("falls back to the <title> and twitter image", () => {
    const p = parseProductPage(`<title>Dress</title><meta name="twitter:image" content="https://cdn.x/d.png">`, "https://a.b/");
    expect(p).toMatchObject({ title: "Dress", image: "https://cdn.x/d.png" });
  });

  it("returns no image when the page has none", () => {
    expect(parseProductPage("<html></html>", "https://a.b/").image).toBeNull();
  });
});
