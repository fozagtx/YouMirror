"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent, StepId, Tone, TryOn } from "@/lib/agent";
import type { SkinSummary } from "@/lib/skin";
import type { Kind, Product } from "@/lib/types";
import type { Verdict } from "@/lib/verdict";

const STEPS: { id: StepId; label: string }[] = [
  { id: "photo", label: "Photo check" },
  { id: "tone", label: "Tone check" },
  { id: "skin", label: "Skin scan" },
  { id: "tryon", label: "Try-on" },
  { id: "compare", label: "Compare" },
  { id: "verdict", label: "Verdict" },
];
const VERDICT = { buy: "Buy it", skip: "Skip it", swap: "Try this instead" } as const;
const LAST_SCAN = "youmirror:last-scan";

type StepState = { status: "pending" | "running" | "done" | "warn" | "error"; title?: string; detail?: string };
type Result = { verdict: Verdict; tone: Tone; skin: SkinSummary; tryOns: TryOn[] };

const title = (p: Product) => [p.brand, p.name].filter(Boolean).join(" ");

export default function Mirror({ shadeCount }: { shadeCount: number }) {
  const [kind, setKind] = useState<Kind>("foundation");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [shades, setShades] = useState<Product[]>([]);
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const video = useRef<HTMLVideoElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(null);

  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "garment") return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/catalog?kind=${kind}&q=${encodeURIComponent(query)}`).then((r) => r.json());
      setResults(r.items);
    }, 180);
    return () => clearTimeout(t);
  }, [kind, query]);

  async function pick(p: Product) {
    setProduct(p);
    setResult(null);
    if (p.kind === "garment") return setShades([]);
    const r = await fetch(`/api/catalog?lineFor=${encodeURIComponent(p.id)}`).then((r) => r.json());
    setShades(r.items);
  }

  async function importLink() {
    setLinkState({ busy: true });
    const r = await fetch("/api/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) });
    const j = await r.json();
    if (!r.ok) return setLinkState({ busy: false, error: j.error });
    setLinkState({ busy: false });
    pick(j.product);
  }

  async function startCamera() {
    setCamError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setCamOn(true);
    } catch {
      setCamError("Camera is blocked. Allow camera access or upload a photo.");
    }
  }

  function stopCamera() {
    (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    setCamOn(false);
  }

  function capture() {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && takePhoto(b), "image/jpeg", 0.92);
    stopCamera();
  }

  function takePhoto(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => setPhoto({ blob, url, w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    setResult(null);
  }

  const tooSmall = photo ? Math.min(photo.w, photo.h) < 480 : false;
  const ready = !!product && !!photo && !tooSmall && !running;

  async function ask() {
    if (!product || !photo) return;
    setRunning(true); setResult(null); setError(null); setSteps({});
    const fd = new FormData();
    fd.append("selfie", photo.blob, "selfie.jpg");
    fd.append("product", JSON.stringify(product));
    fd.append("previous", localStorage.getItem(LAST_SCAN) ?? "null");
    try {
      const res = await fetch("/api/mirror", { method: "POST", body: fd });
      if (!res.body || !res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const l of lines) if (l.trim()) handle(JSON.parse(l) as AgentEvent);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function handle(e: AgentEvent) {
    if (e.type === "step") setSteps((s) => ({ ...s, [e.id]: { status: e.status, title: e.title, detail: e.detail } }));
    if (e.type === "error") { setSteps((s) => ({ ...s, [e.step]: { status: "error", title: e.message } })); setError(e.message); }
    if (e.type === "result") {
      setResult(e);
      localStorage.setItem(LAST_SCAN, JSON.stringify({ scores: e.skin.scores }));
    }
  }

  return (
    <main className="page">
      <header className="top">
        <span className="mark">YouMirror</span>
        <span className="meta">Real YouCam scan · {shadeCount.toLocaleString()} real shades</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Before you buy, ask the mirror</p>
        <h1>Should I <em>buy</em> this?</h1>
        <p className="lede">Pick a product, take one selfie. The mirror reads your skin today, tries the product on you, and tells you to buy, skip or swap, with reasons.</p>
      </section>

      <section className="setup">
        <div className="panel">
          <div className="panel-head"><span className="num">01</span><h2>The product</h2></div>
          <div className="tabs">
            {(["foundation", "lipstick", "garment"] as Kind[]).map((k) => (
              <button key={k} className={k === kind ? "on" : ""} onClick={() => { setKind(k); setQuery(""); }}>{k === "garment" ? "Garment link" : k}</button>
            ))}
          </div>
          {kind === "garment" ? (
            <div className="link">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a product page or product image link" />
              <button onClick={importLink} disabled={!link || linkState.busy}>{linkState.busy ? "Reading" : "Use link"}</button>
              {linkState.error && <p className="warn">{linkState.error}</p>}
            </div>
          ) : (
            <>
              <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "foundation" ? "Search brand or shade, e.g. fenty 330" : "Search brand or shade, e.g. nyx red"} />
              <ul className="results">
                {results.map((p) => (
                  <li key={p.id}>
                    <button className={product?.id === p.id ? "on" : ""} onClick={() => pick(p)}>
                      <i style={{ background: p.hex ?? "#ccc" }} />
                      <span><b>{title(p)}</b>{p.shade}</span>
                    </button>
                  </li>
                ))}
                {!results.length && <li className="empty">No shades match that search.</li>}
              </ul>
            </>
          )}
          {product && (
            <div className="chosen">
              {product.image && <img src={product.image} alt="" />}
              <div>
                <p className="eyebrow">You&apos;re asking about</p>
                <p className="chosen-name">{title(product)}</p>
                <p>{product.shade ?? product.hex ?? ""}{product.price ? ` · ${product.price}` : ""}</p>
                {shades.length > 1 && (
                  <div className="swatches">
                    {shades.slice(0, 48).map((s) => (
                      <button key={s.id} title={s.shade ?? ""} className={s.id === product.id ? "on" : ""} style={{ background: s.hex ?? "#ccc" }} onClick={() => pick(s)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><span className="num">02</span><h2>The mirror</h2></div>
          <div className="glass">
            <video ref={video} playsInline muted className={camOn ? "" : "hidden"} />
            {!camOn && photo && <img src={photo.url} alt="Your selfie" />}
            {!camOn && !photo && <p className="glass-empty">Face the light, look straight in, no glasses.</p>}
          </div>
          <div className="row">
            {camOn ? <button className="solid" onClick={capture}>Take selfie</button> : <button onClick={startCamera}>{photo ? "Retake" : "Open camera"}</button>}
            <label className="filebtn">Upload photo<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && takePhoto(e.target.files[0])} /></label>
          </div>
          {camError && <p className="warn">{camError}</p>}
          {photo && <p className={tooSmall ? "warn" : "ok"}>{tooSmall ? `Photo is ${photo.w}×${photo.h}. It needs at least 480px on the short side, so it won't use any units.` : `${photo.w}×${photo.h} photo ready. Sharpness and lighting are checked before any units are used.`}</p>}
        </div>
      </section>

      <div className="ask">
        <button className="solid big" disabled={!ready} onClick={ask}>{running ? "The mirror is thinking" : "Ask the mirror"}</button>
        {!product && <span>Pick a product first.</span>}
        {product && !photo && <span>{product.kind === "garment" ? "Now take a waist-up photo, face to the camera." : "Now take a selfie."}</span>}
      </div>

      {(running || Object.keys(steps).length > 0) && (
        <section className="agent">
          <div className="panel-head"><span className="num">03</span><h2>What the mirror is doing</h2></div>
          <ol className="track">
            {STEPS.map((s) => {
              const st = steps[s.id] ?? { status: "pending" };
              return (
                <li key={s.id} className={st.status}>
                  <span className="dot" />
                  <b>{s.label}</b>
                  <span>{st.title ?? (st.status === "pending" ? "Waiting" : "")}</span>
                  {st.detail && <em>{st.detail}</em>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {error && !result && <p className="warn big-warn">{error}</p>}

      {result && photo && <VerdictView result={result} selfie={photo.url} />}

      <footer className="foot">Skin Analysis, Skin Tone Analysis and Virtual Try-On by YouCam. Shade data from The Pudding and Makeup API. Not medical advice.</footer>
    </main>
  );
}

function VerdictView({ result, selfie }: { result: Result; selfie: string }) {
  const { verdict, tone, skin, tryOns } = result;
  return (
    <section className="verdict">
      <div className="panel-head"><span className="num">04</span><h2>The verdict</h2></div>
      <div className={`call ${verdict.verdict}`}>
        <span className="stamp">{VERDICT[verdict.verdict]}</span>
        <p className="headline">{verdict.headline}</p>
        <ul className="reasons">{verdict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      <div className="tryons">
        <figure>
          <img src={selfie} alt="You today" />
          <figcaption><b>You today</b><span><i style={{ background: tone.skinHex }} />Measured tone {tone.skinHex} · {tone.undertone}</span></figcaption>
        </figure>
        {tryOns.map((t, i) => (
          <figure key={t.product.id} className={i === 0 ? "picked" : "alt"}>
            {t.url && !t.unchanged ? <img src={t.url} alt={`${t.product.shade ?? t.product.name} on you`} /> : <div className="noimg">{t.error ?? "YouCam handed back your original photo twice, so there is no honest try-on to show."}</div>}
            <figcaption>
              <b>{i === 0 ? "What you picked" : `Closer match ${i}`}</b>
              <span>{t.product.hex && <i style={{ background: t.product.hex }} />}{t.product.shade ?? t.product.name}</span>
              {t.product.url && <a href={t.product.url} target="_blank" rel="noreferrer">View product</a>}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="skin">
        <div>
          <p className="eyebrow">Today&apos;s skin</p>
          <ul className="scores">
            {Object.entries(skin.scores).map(([k, v]) => {
              const ch = skin.changes.find((c) => c.type === k);
              return (
                <li key={k} className={v < 65 ? "low" : ""}>
                  <span>{k.replace("_v2", "").replace("_", " ")}</span>
                  <b>{v}</b>
                  {ch && ch.delta !== 0 && <em>{ch.delta > 0 ? `+${ch.delta}` : ch.delta}</em>}
                </li>
              );
            })}
          </ul>
          <p className="fine">Scores run 1 to 100, higher is healthier. Changes compare with your last scan on this device.</p>
        </div>
        {verdict.skincare.length > 0 && (
          <div className="care">
            <p className="eyebrow">Your skin step today</p>
            <ul>{verdict.skincare.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
