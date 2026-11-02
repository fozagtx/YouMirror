"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HISTORY, type Scan } from "@/components/SkinHistory";
import type { AgentEvent, StepId, Tone, TryOn } from "@/lib/agent";
import { detectFace } from "@/lib/detect-face";
import type { Box } from "@/lib/face-box";
import type { SkinSummary } from "@/lib/skin";
import type { Product } from "@/lib/types";
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
type Result = { verdict: Verdict; tone: Tone; skin: SkinSummary; tryOns: TryOn[]; photo?: string | null };

const title = (p: Product) => [p.brand, p.name].filter(Boolean).join(" ");

export default function Mirror() {
  const productId = useSearchParams().get("product");
  return <MirrorFor key={productId ?? "none"} productId={productId} />;
}

function MirrorFor({ productId }: { productId: string | null }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [shades, setShades] = useState<Product[]>([]);
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const video = useRef<HTMLVideoElement>(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; w: number; h: number; face?: Box | null } | null>(null);

  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/catalog?lineFor=${encodeURIComponent(productId)}`).then((r) => r.json()).then((r: { items: Product[] }) => {
      setShades(r.items);
      setProduct(r.items.find((x) => x.id === productId) ?? null);
    });
  }, [productId]);

  function pick(p: Product) {
    setProduct(p);
    setResult(null);
    setSteps({});
    setError(null);
  }

  async function importLink() {
    setLinkState({ busy: true });
    const r = await fetch("/api/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) });
    const j = await r.json();
    if (!r.ok) return setLinkState({ busy: false, error: j.error });
    setLinkState({ busy: false });
    setShades([]);
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
    img.onload = () => {
      setPhoto({ blob, url, w: img.naturalWidth, h: img.naturalHeight });
      detectFace(img).then((face) => setPhoto((p) => (p?.url === url ? { ...p, face } : p)));
    };
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
    fd.append("face", JSON.stringify(photo.face ?? null));
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
      if (product) {
        const scan: Scan = { at: new Date().toISOString(), product: title(product), shade: product.shade, verdict: e.verdict.verdict, skinHex: e.tone.skinHex, undertone: e.tone.undertone, breakout: e.skin.breakout, scores: e.skin.scores };
        const prev = JSON.parse(localStorage.getItem(HISTORY) ?? "[]") as Scan[];
        localStorage.setItem(HISTORY, JSON.stringify([scan, ...prev].slice(0, 30)));
      }
    }
  }

  return (
    <>
      <h1 className="title">Ask the mirror</h1>
      <section className="setup">
        <div className="panel">
          <p className="caps step">01 · The product</p>
          {product ? (
            <div className="chosen">
              <div className="chosen-img">{product.image ? <img src={product.image} alt="" /> : <span className="swatch" style={{ background: product.hex ?? "#ccc" }} />}</div>
              <div>
                <p className="caps">{product.brand}</p>
                <p className="chosen-name">{product.name}</p>
                <p className="fine">{product.shade ?? product.hex ?? ""}{product.price && product.price !== "$0.0" ? ` · ${product.price}` : ""}</p>
                {shades.length > 1 && (
                  <div className="shade-grid small">
                    {shades.slice(0, 60).map((s) => (
                      <button key={s.id} title={s.shade ?? ""} className={s.id === product.id ? "on" : ""} style={{ background: s.hex ?? "#ccc" }} onClick={() => pick(s)} />
                    ))}
                  </div>
                )}
                <Link href="/shop" className="fine link">Choose another product</Link>
              </div>
            </div>
          ) : productId ? (
            <p className="empty">Loading product</p>
          ) : (
            <div className="pick">
              <Link href="/shop" className="btn dark">Pick a foundation or lipstick</Link>
              <p className="fine">or paste a garment link</p>
            </div>
          )}
          {!productId && (
            <div className="linkrow">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Garment page or image link" />
              <button className="btn" onClick={importLink} disabled={!link || linkState.busy}>{linkState.busy ? "Reading" : "Use link"}</button>
              {linkState.error && <p className="warn">{linkState.error}</p>}
            </div>
          )}
        </div>

        <div className="panel">
          <p className="caps step">02 · You today</p>
          <div className="frame">
            <span className="frame-text" aria-hidden>Face the light · Look straight in · No glasses</span>
            <i className="spark s1" aria-hidden>✦</i><i className="spark s2" aria-hidden>✦</i><i className="spark s3" aria-hidden>✦</i><i className="spark s4" aria-hidden>✦</i>
            <div className="glass">
              <video ref={video} playsInline muted className={camOn ? "" : "hidden"} />
              {!camOn && photo && <img src={photo.url} alt="Your selfie" />}
              {!camOn && !photo && <div className="glass-empty"><button className="btn light" onClick={startCamera}>Open camera</button><p>Face the light, look straight in, no glasses.</p></div>}
            </div>
          </div>
          <div className="row">
            {camOn ? <button className="btn dark" onClick={capture}>Take selfie</button> : photo ? <button className="btn" onClick={startCamera}>Retake</button> : null}
            <label className="btn">Upload photo<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && takePhoto(e.target.files[0])} /></label>
          </div>
          {camError && <p className="warn">{camError}</p>}
          {photo && !tooSmall && photo.face && photo.face.w < 0.4 && <p className="ok">Your face is small in this photo, so the mirror will zoom in on it for the skin scan.</p>}
          {photo && <p className={tooSmall ? "warn" : "ok"}>{tooSmall ? `Photo is ${photo.w}×${photo.h}. It needs at least 480px on the short side, so it won't use any units.` : `${photo.w}×${photo.h} photo ready. Sharpness and lighting are checked before any units are used.`}</p>}
        </div>
      </section>

      <div className="ask">
        <button className="btn dark big" disabled={!ready} onClick={ask}>{running ? "The mirror is thinking" : "Ask the mirror"}</button>
        {!product && <span>Pick a product first.</span>}
        {product && !photo && <span>{product.kind === "garment" ? "Now take a waist-up photo, face to the camera." : "Now take a selfie."}</span>}
      </div>

      {(running || Object.keys(steps).length > 0) && (
        <section className="agent">
          <p className="caps step">03 · What the mirror is doing</p>
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

      {result && photo && <VerdictView result={result} selfie={result.photo ?? photo.url} />}

    </>
  );
}

function VerdictView({ result, selfie }: { result: Result; selfie: string }) {
  const { verdict, tone, skin, tryOns } = result;
  return (
    <section className="verdict">
      <p className="caps step">04 · The answer</p>
      <div className={`call ${verdict.verdict}`}>
        <span className="stamp">{VERDICT[verdict.verdict]}</span>
        <p className="headline">{verdict.headline}</p>
        <ul className="reasons">{verdict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      <div className="looks">
        <figure className="look you">
          <div className="look-photo"><img src={selfie} alt="You today" /></div>
          <figcaption>
            <b>You today</b>
            <span className="look-name">Measured tone</span>
            <span className="look-shade"><i style={{ background: tone.skinHex }} />{tone.skinHex} · {tone.undertone} undertone</span>
          </figcaption>
        </figure>
        {tryOns.map((t, i) => (
          <figure key={t.product.id} className={`look ${i === 0 ? "picked" : "alt"}`}>
            <div className="look-photo">
              {t.url && !t.unchanged ? <img src={t.url} alt={`${t.product.shade ?? t.product.name} on you`} /> : <div className="noimg">{t.error ?? "YouCam handed back your original photo twice, so there is no honest try-on to show."}</div>}
              <div className="look-product">
                {t.product.image ? <img src={t.product.image} alt={t.product.name} /> : <span className="swatch" style={{ background: t.product.hex ?? "#ccc" }} />}
              </div>
            </div>
            <figcaption>
              <b>{i === 0 ? "What you picked" : `Closer match ${i}`}</b>
              {t.product.brand && <span className="caps">{t.product.brand}</span>}
              <span className="look-name">{t.product.name}</span>
              <span className="look-shade">{t.product.hex && <i style={{ background: t.product.hex }} />}{t.product.shade ?? ""}</span>
              <span className="look-meta">
                {t.product.price && t.product.price !== "$0.0" && <em>{t.product.price}</em>}
                {t.product.url && <a href={t.product.url} target="_blank" rel="noreferrer">View product</a>}
              </span>
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
