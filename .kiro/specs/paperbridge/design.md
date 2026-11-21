# Design: PaperBridge

## 1. Overview
One domain-agnostic optical core. Two apps supply a `CardLayout` and an interpreter. A Kiro Crew App consumes scan alerts.

```
            +---------------------- src/core ----------------------+
 CardLayout |  layout -> render (SVG/PDF)      decode pipeline      |
   (data)   |                                  image -> fiducials   |
            |                                  -> homography        |
            |                                  -> adaptive threshold|
            |                                  -> ScanResult JSON   |
            +------------------------------------------------------+
                 ^                        ^
        src/apps/elder-care       src/apps/study-bridge
        (layout, interpret,       (layout, grade,
         dashboard, samples)       weak topics, samples)
                 |
                 +--> crew-app/ (scan alert events -> Kiro Crew dashboard)
```

## 2. Repository layout
```
src/core/
  index.ts              public API
  types.ts              CardLayout, ScanResult, errors
  layout.ts             layout helpers, bubble coordinate lookup
  render/svg.ts         layout -> SVG string
  render/pdf.ts         layout -> one-page PDF (pdf-lib)
  decode/image.ts       grayscale, integral image
  decode/fiducials.ts   corner marker detection
  decode/homography.ts  4-point DLT, 3x3 solve, apply
  decode/threshold.ts   local adaptive threshold
  decode/decode.ts      pipeline
  capture/webcam.ts     getUserMedia loop (browser only)
  testing/synth.ts      synthetic card rasterizer + transforms (used by tests and sample generation)
  __tests__/            unit + decoder.pbt.test.ts
src/apps/elder-care/    layout.ts interpret.ts samples/ components/ App.tsx
src/apps/study-bridge/  layout.ts grade.ts samples/ components/ App.tsx
src/shell/              app switcher, shared sample panel + scanner components
crew-app/               Kiro Crew App package
```

## 3. Core data model
```ts
type PageSize = "A4" | "Letter";
interface CardLayout {
  id: string;            // e.g. "elder-care-weekly"
  version: number;
  title: string;
  page: PageSize;
  fiducial: { sizeMm: number; insetMm: number };
  groups: BubbleGroup[]; // grid of rows x cols with labels
}
interface BubbleGroup {
  key: string; rows: string[]; cols: string[];
  originMm: [number, number]; pitchMm: [number, number]; radiusMm: number;
}
type BubbleState = "filled" | "blank" | "ambiguous";
interface BubbleReading { group: string; row: string; col: string; state: BubbleState; confidence: number; fill: number }
type ScanResult =
  | { ok: true; cardId: string; layoutVersion: number; bubbles: BubbleReading[] }
  | { ok: false; reason: "FIDUCIALS_NOT_FOUND" | "HOMOGRAPHY_DEGENERATE" | "CARD_ID_MISMATCH" };
```
Bubble positions are computed from `groups` by one function, `bubbleCenters(layout)`, used by both renderer and decoder.

## 4. Card generator
- Page sizes in mm: A4 210x297, Letter 215.9x279.4. SVG uses `viewBox` in mm.
- Fiducial: a black square, white inner square, black centre square (nested, 3 layers). The ratio of the layers (1:1:1 along any scan line through the centre) is rotation and scale invariant, similar to QR finder patterns, and cheap to detect.
- Header: title, card ID text, layout version.
- Bubbles: outlined circles with row and column labels. Fill region used for scoring is the inner 70% of the radius, so partial outline overlap does not count.
- PDF: pdf-lib draws the same primitives from the layout (not by rasterizing the SVG), so output is vector.

## 5. Decoder pipeline
1. **Grayscale** from RGBA (integer luma). Build an integral image.
2. **Binarize for fiducial search** using a local mean threshold (window ~ image width / 16, offset constant). This tolerates shadows.
3. **Fiducial detection**: connected components on the binary image. Keep components whose nested structure matches (outer black component containing a white hole containing a black component) and whose area ratios fall within tolerance of the nominal 9:5:1... ratios defined in `FIDUCIAL_RATIOS`. Result: candidate centres.
4. **Corner assignment**: choose the 4 best candidates, sort by angle around their centroid, then rotate the order so TL is the candidate whose card-space ordering matches. Orientation is resolved with the header marker: the card has one asymmetric element (a notch on the TL fiducial's outer ring) so the 4 corners are unambiguous under rotation up to +/-30 degrees. (180-degree rotation is out of scope; the sample panel and capture guide the user to hold the card upright.)
5. **Homography**: solve the 8x8 DLT system with Gaussian elimination and partial pivoting for card mm to pixel mapping. Reject near-singular systems (`HOMOGRAPHY_DEGENERATE`).
6. **Bubble sampling**: for each bubble centre, map the centre and a ring of sample points (inner disc) to pixels via the homography. Compute mean darkness `d` of the inner disc and mean `b` of a local background annulus outside the bubble.
7. **Adaptive classification**: `fill = (b - d) / max(b, eps)` (relative darkness vs. local paper). Thresholds: `fill >= FILLED_MIN` filled, `fill <= BLANK_MAX` blank, else ambiguous. Local background normalization removes the effect of shadows and exposure. `confidence` is the normalized distance from the nearest threshold.
8. **Output** `ScanResult`. Pure and deterministic; no RNG or time.

Named constants (`FILLED_MIN=0.45`, `BLANK_MAX=0.18`, ring radii, window sizes) live in `decode/constants.ts` and are tuned against the PBT suite.

## 6. Capture
`capture/webcam.ts` wraps `getUserMedia`, draws frames to an offscreen canvas at <=1280 px wide, and calls `decode`. A scan is "stable" after 2 consecutive identical, ambiguity-free results. Image upload goes through the same path. Denied permission yields a typed error the UI maps to the sample-panel hint.

## 7. Synthetic test and sample generation (`core/testing/synth.ts`)
`renderCardRaster(layout, fills, opts)` rasterizes a layout to RGBA with an affine/perspective transform (rotation, scale, slight perspective), an illumination field (linear gradient plus a soft shadow blob), and optional noise from a seeded PRNG. The same function generates the three elder-care samples and the study sample, so samples are real pixels decoded at runtime. Samples are generated by a script (`scripts/gen-samples.ts`) into PNGs checked into `src/apps/*/samples/`.

## 8. Property-based tests (`decoder.pbt.test.ts`)
Arbitraries: fill pattern (boolean per bubble), rotation in [-30, 30] deg, scale in [0.5, 2], shadow (gradient angle, strength up to 40%, optional blob), seeded noise.
Properties:
- P1 decode(render(fills, transform)) recovers `fills` exactly, with no ambiguous bubbles.
- P2 results are invariant under additional rotation and scale (compare against identity transform).
- P3 shadow strength does not change the result.
- P4 removing any one fiducial gives `FIDUCIALS_NOT_FOUND`.
- P5 decoding is idempotent (same input, same output).
Run count is set so the full suite stays within about 60 s; the failing seed is printed by fast-check for replay. Plus example-based unit tests for homography (known points), threshold, and layout.

## 9. Elder Care app
- **Layout**: 7 rows (Mon..Sun) x 6 cols (Morning, Night, Hydration, Dizzy/Pain, plus Energy as a 5-column group 1..5). Large bubbles (radius 6 mm), 16 pt+ labels, thick black strokes.
- **interpret.ts** (pure): input `ScanResult`, output
```ts
interface CareReport { adherencePct: number; taken: number; scheduled: number;
  missed: {day:string; slot:"Morning"|"Night"}[]; needsReview: string[];
  symptomDays: string[]; energy: (number|null)[]; hydrationDays: number }
```
  Adherence = taken / (scheduled doses excluding needs-review). Multiple energy bubbles in a day yields `null` and needs-review.
- **UI**: tabs for Print, Scan, Dashboard. `SamplePanel` has three large buttons (Normal Week, Missed-Dose Alert, Tilted/Low-Light Card). Dashboard: adherence ring with text, missed-dose list, symptom flags, energy sparkline, needs-review list. Colour is always paired with icon and text.
- **Alerts**: after each scan, the app emits a `paperbridge:scan-alert` event (see section 11).

## 10. Study Bridge app
- **Layout**: 10 rows (Q1..Q10) x 5 cols (A..E), 5 mm bubbles.
- **grade.ts** (pure): input `ScanResult` plus `AnswerKey` (`{q: {answer, topic}}`), output score, per-question status (`correct | incorrect | blank | invalid`), per-topic accuracy, weak topics (<70%), and a spaced-repetition schedule (+1, +3, +7 days from scan date; date is a parameter, not read inside the function).
- Sample sheet has a built-in answer key across 4 topics.

## 11. Crew App (`crew-app/`)
```
crew-app/
  app.json                      name: paperbridge-care-monitor; permissions: api, events, storage
  agents/care-auditor.json      agent that reviews scan alerts and drafts caregiver summaries
  skills/adherence-analysis/SKILL.md
  ui/index.html, main.ts        dashboard using @kirocrew/app-sdk
```
- The dashboard subscribes to `paperbridge:scan-alert` events through the SDK `events` API, persists the list with SDK `storage`, and calls the `api` surface to hand alerts to the `care-auditor` agent.
- The exact `app.json` schema and SDK method names will be confirmed against Kiro Crew documentation before implementation (task 11.1). Where docs are unavailable, the SDK is wrapped behind `crew-app/ui/sdk.ts` so only one file changes.
- Alert payload contains aggregate data only (adherence %, missed slots, flags), no images.

## 12. Tooling
- Vite + React + TS, Tailwind CSS, Vitest, fast-check, pdf-lib.
- npm scripts: `dev`, `build`, `test` (`vitest --run`), `gen:samples`, `typecheck`.
- Hook: PostFileSave on `src/core/**/*.ts` runs `npm test`.

## 13. Risks
| Risk | Mitigation |
|---|---|
| Fiducial detection fragile under heavy shadow | Local thresholding plus nested-ratio check; PBT covers shadows |
| Perspective/rotation ambiguity | Asymmetric TL notch; 180 degree rotation out of scope |
| Kiro Crew SDK/schema unknown | Verify docs in task 11.1; isolate behind `sdk.ts` |
| Test runtime too long | Small synthetic resolution (about 800 px), bounded `numRuns` |
| Sample cards look fake to judges | Sample images include noise, perspective, and shadow produced by the same synth |
