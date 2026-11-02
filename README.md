# YouMirror

**Before you buy, ask the mirror. It reads your skin today, tries the product on you, and tells you to buy, skip or swap, with reasons.**

[How it works](#how-it-works) · [Quickstart](#quickstart) · [Skin tone test](research/skin-tone-test.md) · [YouCam API](https://yce.makeupar.com/)

## How it works

```
product + one selfie
   │
   ▼
photo check ─▶ skin tone ─▶ skin scan ─▶ try-on ─▶ compare ─▶ verdict
 (local)      (YouCam)     (YouCam)     (YouCam)   (alternatives    buy / skip / swap
                                                    tried on too)
```

1. Pick a real foundation or lipstick shade from 8,468 catalogue shades, or paste a garment link.
2. Take one selfie. Blurry or too-small photos are stopped before any YouCam units are spent.
3. Skin Tone Analysis measures your tone and undertone. Skin Analysis checks today's skin.
4. YouCam tries the exact product on you.
5. The mirror says buy, skip or try this instead, with reasons tied to the scan, and shows two closer shades tried on beside it.
6. On a breakout day it raises coverage and adds a skincare step. A garment try-on that comes back unchanged is retried once, then called out instead of shown as a result.

## Quickstart

```bash
git clone https://github.com/fozagtx/YouMirror && cd YouMirror
npm install
echo "YOUCAM_API_KEY=your_key" > .env.local
npm run dev
```

Open http://localhost:3000. Tests: `npm test`.

## Purpose

| Part | What it does |
| --- | --- |
| `lib/agent.ts` | The agent loop, streamed step by step to the page |
| `lib/verdict.ts` | Buy, skip or swap from scan results and shade distance |
| `lib/youcam.ts` | YouCam upload, task and polling client |
| `lib/check.ts` | Photo checks and unchanged try-on detection |
| `data/catalog.json` | Real shades from The Pudding and Makeup API (`npm run catalog`) |

| YouCam API | Used for |
| --- | --- |
| Skin Tone Analysis | Measured tone, undertone, face quality |
| Skin Analysis | Acne, redness, oiliness, moisture, texture, radiance |
| Makeup VTO | Foundation and lipstick try-on |
| Clothes VTO | Garment try-on |

| Setting | Where |
| --- | --- |
| `YOUCAM_API_KEY` | `.env.local`, or the Render dashboard |
