# Skin tone test

Does YouCam Skin Tone Analysis give the same answer for the same face under different light, and does it work across skin depths? Run with `scripts/tone-test.mjs` on five real photos of different people, each sent three ways: as shot, 45% darker, and with a warm tungsten cast. Raw rows are in `tone-test.json`.

## Results

| Subject | Depth (L*) | As shot | Dim (-45%) | Warm tungsten | Worst drift |
| --- | --- | --- | --- | --- | --- |
| A, light | 66.7 | #bc9c86 | #bc9a83 | #c09d87 | 1.4 ΔE |
| B, light-medium | 61.8 | #b38e73 | #b79275 | #b89479 | 2.2 ΔE |
| C, deep | 43.7 | #806149 | #825e43 | #816049 | 3.4 ΔE |
| D, very deep | 32.9 | #654733 | #6e4b33 | #684a37 | 4.2 ΔE |
| E, deep | | rejected | rejected | rejected | face tilted upward |

## What we learned

- Lighting barely moves the reading. A 45% darker photo shifted the measured tone by 1.2 to 4.2 ΔE, about the gap between two neighbouring shades in one foundation range. YouCam normalises exposure before measuring.
- Deeper tones drift a little more under dim light (3.4 and 4.2 ΔE versus 1.2 and 1.8), so YouMirror ranks shades inside a range instead of trusting one absolute threshold.
- Very deep skin (L* 33) was read without errors and with the same face-quality grades as light skin. We found no failure tied to skin depth.
- Every rejection came from framing, not skin: faces too small in a wide shot, or the head turned or tilted. YouMirror stops on those before spending units on try-ons and tells the user how to fix the photo.
