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
- Fiducial: 7x7-module black square, 5x5 white square, 3x3 black centre (like a QR finder pattern). After thresholding it becomes a dark ring around a dark solid square with the same centre, with an area ratio of 24:9. That signature does not change with rotation or scale.
- Header: title, subtitle, and the card ID printed both as text and as a strip of 10 pre-filled/blank ID bubbles encoding a 10-bit checksum of `id@version`. The decoder reads the strip to reject cards printed from a different layout (`CARD_ID_MISMATCH`).
- Bubbles: outlined circles with row and column labels. Fill region used for scoring is the inner 70% of the radius, so partial outline overlap does not count.
- PDF: pdf-lib draws the same primitives from the layout (not by rasterizing the SVG), so output is vector.

## 5. Decoder pipeline
1. **Grayscale** from RGBA (integer luma). Build an integral image.
2. **Binarize for fiducial search** using a local mean threshold (window ~ image width / 16, offset constant). This tolerates shadows.
3. **Fiducial detection**: connected components on the binary image. Keep components whose nested structure matches (outer black component containing a white hole containing a black component) and whose area ratios fall within tolerance of the nominal 9:5:1... ratios defined in `FIDUCIAL_RATIOS`. Result: candidate centres.
4. **Corner assignment**: take the 4 largest candidates (rejecting sets whose sizes differ by more than 2.2x), sort them clockwise around their centroid, and choose TL as the start whose TL->TR edge points closest to image "right". This is unambiguous for tilts under 45 degrees, which covers the +/-30 degree requirement, so no asymmetric marker is needed. 180-degree rotation is out of scope; an upside-down card fails the ID strip check instead of being misread.
5. **Homography**: solve the 8x8 DLT system with Gaussian elimination and partial pivoting for card mm to pixel mapping. Reject near-singular systems (`HOMOGRAPHY_DEGENERATE`).
6. **Bubble sampling**: for each bubble centre, map 19 points on the inner disc (60% of the radius, so the printed outline is excluded) to pixels via the homography and average them (`d`). Sample 32 points on an annulus at 1.45-1.75x the radius and take the 75th percentile as the local paper level `b`, which ignores neighbouring marks.
7. **Adaptive classification**: `fill = (b - d) / max(b, eps)` (relative darkness vs. local paper). Thresholds: `fill >= FILLED_MIN` filled, `fill <= BLANK_MAX` blank, else ambiguous. Local background normalization removes the effect of shadows and exposure. `confidence` is the normalized distance from the nearest threshold.
8. **Output** `ScanResult`. Pure and deterministic; no RNG or time.

Named constants (`FILLED_MIN=0.4`, `BLANK_MAX=0.2`, sampling radii, window sizes) live in `decode/constants.ts` and are tuned against the PBT suite.

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
  app.json                           name paperbridge-care-monitor; agents, skills, ui, permissions, contributes.commands
  agents/care-auditor.json           drafts plain-language caregiver check-ins from an alert
  skills/adherence-analysis/SKILL.md alert format, PaperBridge thresholds, escalation rules
  icon.png                           256x256 App Store icon
  ui/src/App.tsx                     default-export page (the host mounts it with React.lazy)
  ui/src/sdk.ts                      the only file that imports @kirocrew/app-sdk
  ui/src/alerts.ts                   pure parse / dedupe / storage / prompt logic
  ui/dist/index.mjs                  committed bundle (Crew installs without node_modules)
```
Verified against the Crew docs and the KiroCrew sources (`website/src/app-sdk/index.ts`, `website/src/components/AppHost.tsx`):
- `ui.entry` and `ui.pages[].iconUrl` resolve against `ui/`, so the entry is `dist/index.mjs`.
- The page is the bundle's default export. React, `react/jsx-runtime`, `lucide-react` and `@kirocrew/app-sdk(/ui)` come from the host import map and stay external. The UI package must not install `react`, or tests load two React copies.
- `useChatLauncher()` returns `{ openChat, createChat }`. "Draft Caregiver Check-In" calls `openChat({ agent: "care-auditor", message, autoSend: false })`, so the caregiver reviews the draft before it is sent.
- `contributes.commands[].agent` must name one of this app's agents.
- Alerts arrive from `notification` events, a `/api/notifications` backfill, same-window `paperbridge:scan-alert` events, paste, or the demo button. They are validated, deduplicated by `cardId@scannedAt`, and stored in `localStorage` under `kirocrew.app.<name>.alerts.v1`. `useNavBadge(openCount)` keeps the sidebar badge in sync.
- Alerts carry aggregate data only (no images, no bubbles). A root test checks that every sample alert passes the Crew parser unchanged.

## 12. Tooling
- Vite + React + TS, Tailwind CSS, Vitest, fast-check, pdf-lib.
- npm scripts: `dev`, `build`, `test` (`vitest --run`), `gen:samples`, `typecheck`.
- Hook: PostFileSave on `src/core/**/*.ts` runs `npm test`.

## 13. Risks
| Risk | Mitigation |
|---|---|
| Fiducial detection fragile under heavy shadow | Local thresholding plus nested-ratio check; PBT covers shadows |
| Perspective/rotation ambiguity | TL chosen by top-edge direction (valid under 45 degrees); ID strip rejects upside-down cards |
| Kiro Crew SDK/schema drift | Verified against docs and sources in task 11.1; SDK isolated behind `sdk.ts`; bundle smoke test |
| Test runtime too long | Small synthetic resolution (about 800 px), bounded `numRuns` |
| Sample cards look fake to judges | Sample images include noise, perspective, and shadow produced by the same synth |
