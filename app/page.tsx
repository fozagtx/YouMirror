import Link from "next/link";
import Nav from "@/components/Nav";
import { catalogSize, linesWithPhotos } from "@/lib/catalog";

export default function Home() {
  const size = catalogSize();
  const picks = [...linesWithPhotos("foundation", 5), ...linesWithPhotos("lipstick", 5)];
  return (
    <>
      <section className="hero">
        <img src="/hero.jpg" alt="" className="hero-img" />
        <Nav overlay />
        <div className="hero-copy">
          <h1>Should I buy this?</h1>
          <p className="caps">Before you buy, ask the mirror.</p>
          <Link href="/shop" className="btn light">Find a product</Link>
        </div>
      </section>

      <section className="how">
        <p className="caps">How it works</p>
        <ol>
          <li><b>01</b><h3>Bring a product</h3><p>Pick one of {(size.foundation + size.lipstick).toLocaleString()} real shades, or paste a garment link.</p></li>
          <li><b>02</b><h3>Take one selfie</h3><p>YouCam reads your skin tone and today&apos;s skin, then tries that exact product on you.</p></li>
          <li><b>03</b><h3>Buy, skip or swap</h3><p>You get a straight answer with reasons from your scan, and closer shades tried on beside it.</p></li>
        </ol>
      </section>

      <section className="shelf">
        <div className="shelf-head"><p className="caps">Widest shade ranges</p><Link href="/shop" className="caps">Shop all</Link></div>
        <div className="grid">
          {picks.map((l) => (
            <Link key={l.id} href={`/shop/${l.id}`} className="tile">
              <div className="tile-img"><img src={l.image!} alt="" /></div>
              <p className="caps">{l.brand}</p>
              <p className="tile-name">{l.name}</p>
              <p className="tile-meta">{l.shades} shades{l.price && l.price !== "$0.0" ? ` · ${l.price}` : ""}</p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="foot">Skin Analysis, Skin Tone Analysis and Virtual Try-On by YouCam. Shade data from The Pudding and Makeup API. Not medical advice.</footer>
    </>
  );
}
