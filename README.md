# YouMirror

**Before you buy, ask the mirror. It reads your skin today, tries the product on you, and tells you to buy, skip or swap, with reasons.**

[Live app](https://you-mirror.vercel.app) · [Setup](#setup) · [How it works](#how-it-works) · [Skin tone test](research/skin-tone-test.md) · [YouCam API](https://yce.makeupar.com/)

## Setup

```bash
git clone https://github.com/fozagtx/YouMirror && cd YouMirror
npm install
echo "YOUCAM_API_KEY=your_key" > .env.local
npm run dev
```

Open http://localhost:3000. Get a key at [yce.makeupar.com](https://yce.makeupar.com/) under API Key.

| Command | What it does |
| --- | --- |
| `npm test` | Vitest suite (agent loop, verdicts, catalog, YouCam client, photo checks) |
| `npm run build` | Production build |
| `npm run catalog` | Rebuilds `data/catalog.json` from the real shade sources |

To deploy on Vercel, import the repo and add `YOUCAM_API_KEY` under Settings > Environment Variables.

## Inspiration

Every foundation looks right on the product page. Then it arrives two shades too light. A shopper can't try a shade on their own skin through a screen, so they guess, send back what doesn't match, and stop trusting the page. No store can put a shade expert next to every shopper.

Most try-on apps stop at a filter: here is the lipstick on your face, good luck. We wanted the mirror to answer the question a shopper actually has right before they pay: **should I buy this?**

## What it does

1. Pick a real foundation or lipstick from 8,468 shades across 464 product lines, or paste a garment link.
2. Take one selfie. A local photo check stops blurry or too-small photos before any YouCam units are spent.
3. YouCam Skin Tone Analysis measures your tone and undertone. YouCam Skin Analysis reads today's skin: acne, redness, oiliness, moisture, texture and radiance.
4. YouCam tries that exact shade on you.
5. The mirror answers **Buy it**, **Skip it** or **Try this instead**, with reasons from your own scan. The two closest shades in the same line are tried on you too, each next to its real product photo, brand, price and store link.
6. On a breakout day it raises coverage and adds a skincare step, so the advice changes with the day you're having.

## How it works

```
product + one selfie
   │
   ▼
photo check ─▶ skin tone ─▶ skin scan ─▶ try-on ─▶ compare ─▶ verdict
 (local)      (YouCam)     (YouCam)     (YouCam)   (alternatives    buy / skip / swap
                                                    tried on too)
```

1. The browser finds the face with MediaPipe and sends the photo, the face box and the product to `/api/mirror`.
2. The server runs one agent loop (`lib/agent.ts`) and streams every step back to the page as it happens.
3. If the face is small in the frame, the scans run on a portrait crop around it, because YouCam needs the face across about 60% of the image.
4. `lib/verdict.ts` compares the shade with the measured tone, ranks the rest of the line by colour distance, and reads the skin scores for coverage and care advice.
5. The verdict, the try-ons and the skin scores are shown together, and past scans are saved on the device only.

## What we built

- A working shop and mirror, live at [you-mirror.vercel.app](https://you-mirror.vercel.app), on four real YouCam APIs: Skin Tone Analysis, Skin Analysis, Makeup VTO and Clothes VTO.
- A real catalogue: 8,468 foundation and lipstick shades, with 6,418 verified per-shade product photos from Sephora and Ulta.
- A streamed agent loop the shopper can watch: photo check, tone check, skin scan, try-on, compare, verdict.
- Side-by-side try-ons of the chosen shade and the two closest shades, each shown with its product photo.
- An honest garment check: if the clothes try-on hands back the original garment, the mirror retries once, then says so instead of showing a bad result.
- Our own [skin tone test](research/skin-tone-test.md) on light to very deep skin under normal, dim and warm light.
- Built test-first: 57 Vitest tests cover the agent loop, verdicts, catalog, YouCam client and photo checks.

## Challenges

- **Framing, not skin.** Wide webcam photos came back from YouCam as "face too small" or a false "face turned left" even when the person faced the camera. We added browser face detection and a server-side face crop, plus a fallback to the full photo when the crop is too tight. Failed YouCam tasks cost no units, so the retries are free.
- **Try-on recolouring.** YouCam slightly recolours the whole photo on every try-on, so a simple "did anything change" check wrongly flagged subtle nude shades. The unchanged-result check now runs on garments only.
- **Broken retailer images.** The catalogue's image links were mostly flat shade swatches or dead links. A script probes every URL and keeps only real product photos (`scripts/build-packshots.mjs`).
- **Trust across skin tones.** We found no source showing how the tone API handles deep skin, so we measured it. Dim and warm light moved the reading by 1.4 to 4.2 ΔE, about the gap between two neighbouring shades. Very deep skin (L* 33) was read with no errors. Every rejection came from framing, never from skin depth.

## What's next

- An "Ask the mirror" button that any store can drop onto a product page.
- More categories: concealer, blush and brows.
- Garment fit with the same buy, skip or swap answer.

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
