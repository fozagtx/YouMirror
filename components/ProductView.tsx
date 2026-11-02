"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";

export default function ProductView({ first, shades }: { first: Product; shades: Product[] }) {
  const [p, setP] = useState(first);
  return (
    <section className="pdp">
      <div className="pdp-img">{p.image && <img src={p.image} alt={p.shade ?? p.name} />}</div>
      <div className="pdp-info">
        <p className="caps">{p.brand}</p>
        <h1 className="title">{p.name}</h1>
        {p.price && p.price !== "$0.0" && <p className="price">{p.price}</p>}
        <p className="caps shade-label">Shade · {p.shade}</p>
        <div className="shade-grid">
          {shades.map((s) => (
            <button key={s.id} title={s.shade ?? ""} className={s.id === p.id ? "on" : ""} style={{ background: s.hex ?? "#ccc" }} onClick={() => setP(s)} />
          ))}
        </div>
        <Link href={`/mirror?product=${encodeURIComponent(p.id)}`} className="btn dark">Should I buy this shade?</Link>
        <p className="fine">The mirror scans one selfie, tries {p.shade ?? "this"} on you and answers buy, skip or swap.</p>
        {p.url && <a className="fine link" href={p.url} target="_blank" rel="noreferrer">View at the retailer</a>}
      </div>
    </section>
  );
}
