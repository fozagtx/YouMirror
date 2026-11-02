"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Line } from "@/lib/catalog";

export default function Shop() {
  const [kind, setKind] = useState<"foundation" | "lipstick">("foundation");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Line[] | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/lines?kind=${kind}&q=${encodeURIComponent(q)}`).then((r) => r.json());
      setItems(r.items);
    }, 150);
    return () => clearTimeout(t);
  }, [kind, q]);

  return (
    <>
      <div className="shop-head">
        <h1 className="title">Shop</h1>
        <div className="filters">
          {(["foundation", "lipstick"] as const).map((k) => (
            <button key={k} className={k === kind ? "chip on" : "chip"} onClick={() => setKind(k)}>{k}</button>
          ))}
          <Link href="/mirror?garment=1" className="chip">Garment link</Link>
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand or product" />
        </div>
      </div>
      {items && !items.length && <p className="empty">No products match that search.</p>}
      <div className="grid">
        {(items ?? []).map((l) => (
          <Link key={l.id} href={`/shop/${l.id}`} className="tile">
            <div className="tile-img">{l.image ? <img src={l.image} alt="" loading="lazy" /> : <span className="fan">{l.swatches.slice(0, 5).map((h, i) => <i key={i} style={{ background: h }} />)}</span>}</div>
            <p className="caps">{l.brand}</p>
            <p className="tile-name">{l.name}</p>
            <div className="dots">{l.swatches.map((h, i) => <i key={i} style={{ background: h }} />)}</div>
            <p className="tile-meta">{l.shades} shades{l.price && l.price !== "$0.0" ? ` · ${l.price}` : ""}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
