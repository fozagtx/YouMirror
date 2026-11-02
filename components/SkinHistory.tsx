"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export const HISTORY = "youmirror:history";
export type Scan = { at: string; product: string; shade: string | null; verdict: "buy" | "skip" | "swap"; skinHex: string; undertone: string; breakout: boolean; scores: Record<string, number> };

const read = () => (typeof window === "undefined" ? "[]" : localStorage.getItem(HISTORY) ?? "[]");
const VERDICT = { buy: "Buy", skip: "Skip", swap: "Swap" } as const;

export default function SkinHistory() {
  const raw = useSyncExternalStore((cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); }, read, () => "[]");
  const scans = JSON.parse(raw) as Scan[];
  const keys = scans.length ? Object.keys(scans[0].scores) : [];
  return (
    <>
      <h1 className="title">My skin</h1>
      <p className="lede">Every scan you run is kept on this device only, so you can see how your skin moves day to day.</p>
      {!scans.length ? (
        <p className="empty">No scans yet. <Link href="/shop">Pick a product</Link> and ask the mirror to see your skin here.</p>
      ) : (
        <table className="history">
          <thead><tr><th>Date</th><th>Tone</th>{keys.map((k) => <th key={k}>{k.replace("_v2", "")}</th>)}<th>Asked about</th><th>Answer</th></tr></thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.at}>
                <td>{new Date(s.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td><i style={{ background: s.skinHex }} />{s.skinHex}</td>
                {keys.map((k) => <td key={k} className={s.scores[k] < 65 ? "low" : ""}>{s.scores[k]}</td>)}
                <td>{s.product}{s.shade ? `, ${s.shade}` : ""}</td>
                <td className={`v ${s.verdict}`}>{VERDICT[s.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
