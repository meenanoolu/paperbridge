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

## 14. Phase 3: offline PWA and developer kit
- **PWA:** `vite-plugin-pwa` in generateSW mode with `registerType: "autoUpdate"`. `globPatterns` covers js/css/html/svg/png/jpg; the plugin adds the manifest itself, and manifest icons are not listed twice. `navigateFallback: index.html` suits the hash-routed single page. `useOnline()` (`useSyncExternalStore` over online/offline events) drives the header badge.
- **Layout checks:** `src/core/validate.ts` is additive and leaves `validateLayout` and the decoder unchanged. It is a strict superset: margins, fiducial quiet zone, card-ID strip, all-pairs bubble spacing (1.1 x the sum of radii, matching the 2.2r pitch rule), unique IDs, and a JSON shape parser for untrusted input.
- **Registries:** the shell finds apps with `import.meta.glob("../apps/*/App.tsx", { eager: true })` and `appMeta`. `gen:samples` imports every `samples/specs.ts` and reads `SAMPLE_SET`. A scaffolded app's `samples/index.ts` globs `./*.jpg`, so it builds before its photos exist (the sample panel then says so).
- **Scaffolder:** `scripts/create-app.mjs` is plain Node ESM with a pure `createApp({ slug, displayName, appsDir })`. Names are inserted with `JSON.stringify` so quotes and backslashes are safe. Its test builds the repo shape in a temp dir (symlinked core, shell, node_modules) and imports the generated test file so its suite runs in the same Vitest run.
- **MCP server:** `mcp/server.ts` (stdio, `McpServer.registerTool`, zod input schemas, read-only annotations) is a thin wrapper over `mcp/tools.ts`. `list_registered_apps` imports `layout.ts` files and reads `appMeta` as text, because App.tsx needs React and Vite-only APIs. It runs with `npx tsx`, so it imports the TypeScript core directly.

## 15. Phase 4: elder care clinical workflows
- **Print-only core options.** `colNotes` lines sit directly above the bubbles (`COL_NOTE_SIZE_MM` x label scale), and the column labels and group title move up by the tallest column's notes. `printStyle` adds bold text, row and column label multipliers, and band grey (clamped to 0.88 or lighter). Unset, the primitives are byte-identical, so every sample JPEG regenerates unchanged.
- **Measuring text.** `checkPrintedText` builds a box for every text primitive from Helvetica / Helvetica-Bold advance widths. That is a 2 KB Latin-1 table generated from `@pdf-lib/standard-fonts`, kept small so the font library stays out of the app bundle. Arial, the SVG font, shares the same widths. Boxes must stay inside the margin and clear (0.4 mm) of bubbles, markers, the ID strip and other text.
- **Wrapping.** Anchors, cues and High-Visibility labels wrap by measured width within 25.6 mm (the 26 mm pitch less clearance). Standard labels keep the 9-character rule and re-wrap only lines that are too wide, so validation never accepts a label it rejected before.
- **High-Visibility choices, from measurement.** Band grey 0.90, not 0.88: the faint test mark's lowest fill over 2 papers x 3 cameras is 0.254 (0.234 at 0.88, with the blank threshold at 0.20). Column labels stay at the standard size: 10% larger split "Metformin" mid-word.
- **Patterns.** `detectPatterns(weeks, labels)` is shared by `interpretCareCard` (one week) and `historyPatterns` (saved weeks, worded with the latest labels). `formatDoctorSummary` takes patterns as an optional input; without them its output is unchanged.
- **Doctor Visit PDF.** `doctor-pdf.ts` is lazy-loaded (6 KB chunk, plus the shared pdf-lib chunk) and precached. Sections stack top-down; the week table fills the space above a fixed footer and lists the latest weeks that fit. `renderDoctorVisitPdfWithLayout` reports the lowest body line, so tests can prove nothing reaches the footer.

## 16. Phase 5: batch routing and monthly packs
- **Paper-size fit.** `decodeAny` used to accept the first layout that decoded, and A4 came first, so Letter photos were read with A4 bubble positions (1 to 7 extra unclear marks, sometimes different readings). `decodeBestFit` (`src/shell/route.ts`) decodes every paper variant and keeps the one with the fewest ambiguous bubbles, then the highest mean confidence: 50 of 50 correct over 5 samples x 5 cameras x 2 papers. Core `decode` is unchanged. Inferring paper from the fiducial aspect ratio was rejected because perspective distorts it.
- **Routing.** `routeRaster` tries each registered app's layouts with the existing `decode`; the card-ID strip rejects other apps' cards (0 false cross-app matches in tests). It stops early on `FIDUCIALS_NOT_FOUND`, since no layout can succeed then. Failures are `FIDUCIALS_NOT_FOUND`, `HOMOGRAPHY_DEGENERATE` or `UNKNOWN_CARD`, each with plain-language text in `ROUTE_ERROR_TEXT`.
- **Registry.** `AppMeta` gains optional `layouts` (routing) and `batch: BatchAdapter` (bulk save). The scaffolder template sets `layouts`, so new apps are routable without edits.
- **Batch.** `processBatch` (pure, injectable clock) decodes sequentially and reports progress; `batchSummary` builds the banner text. `saveBatchGroup` validates each row through the app's adapter and saves only when every row is valid. A single routed photo is handed to the target app through a small module store (`offerRoutedScan` / `useRoutedScan`) read by `ScanWorkbench`.
- **Live saves.** `saveJson` / `removeJson` dispatch `paperbridge:storage`; `usePersistentState` reloads on it and on the cross-tab `storage` event, so an open history or class sheet shows bulk-saved rows at once.
- **Multi-page PDF.** `renderCardsPdf` loops the existing page renderer; `renderCardPdf` delegates to it and stays byte-identical (checked by sha256).
- **Monthly pack.** `monthlyPackLayouts` reuses `customizeCareLayout` per Monday and only changes the group title and day labels. Heading candidates go from "Week N of 4: <range>" to shorter forms, and the first that passes `checkPrintedText` is used.
- **Preset column roles.** Columns are not free-form: column 1 feeds the morning dose, column 2 the evening dose, column 3 the habit and column 4 the symptom used by alerts and patterns. Mapping the requested 4 items literally would count Morning Metformin as an evening dose and treat Water or a walk as a symptom. Presets therefore keep the roles: BP & Diabetes combines both morning medicines in column 1 ("Metformin + BP Pill", ordered so it does not end with "Metformin" right next to column 2's "Metformin"); Post-Surgery has no slot for a midday pain medicine, so column 4 asks "Pain med taken?"; Simple Morning & Night has one habit column, so the daily walk is left for the user to choose instead of water. Configurable column roles would remove these limits.
- **Sample history.** `sampleHistory(today)` builds deterministic entries from fixed week grids for `SAMPLE_PATIENT` with the BP & Diabetes card; the Doctor PDF uses that card's labels when the sample patient is selected.

## 17. Phase 6: adaptive paper and multilingual UX
- **Tabs.** The active tab is a module store (`workspace-tabs.ts`), so `offerRoutedScan`, a batch start and a new scan can switch to Scan & Verify without prop drilling. `WorkspaceTabs` renders all panels and hides inactive ones, so the workbench state survives. Scan Any Card moved from the page header into Scan & Verify; it reaches the shell's `setApp` through `RouteContext`, and its batch lives in `useSessionState` (memory only), because each app mounts its own copy.
- **Print-only marks in the core.** New primitives: `icon` (filled paths in a 10-unit box, `render/icons.ts`), `frame` (stroked box around a highlighted label) and `rule` (one bar of a double underline). With none of `showIcons`, `colHighlights` or `footer.boldLines` set, the primitive list is unchanged; PDF and SVG hashes of every shipped and customized card match `main`. `checkPrintedText` now uses `printedBoxes` (text + icons + frames); a frame is a ring, so the label inside it is not a collision but anything touching the ring is.
- **Measuring any script.** `estimateTextWidthMm` moved to `render/measure.ts` (shared by primitives, the validator and the PDF). Combining marks and joiners count 0, other non-Latin-1 characters 1 em (generous for Telugu and Devanagari). Wrapping splits non-Latin words by grapheme (`Intl.Segmenter`), never mid-syllable.
- **Any-script PDF text.** `renderCardsPdf(layouts, { textImage })`. Only non-WinAnsi strings call the renderer, with the exact box the validator measured; the browser renderer (`shell/text-image.ts`) draws with system fonts at 24 px/mm and scales the glyphs down to fit the box when needed. Images are cached per string, so a 4-week pack embeds each label once. No font files are bundled (precache +33 KiB, all code).
  - Rejected: bundling Noto fonts (several MB per script, against the lean offline precache) and pdf-lib custom-font embedding with fontkit (no complex-script shaping, so Telugu and Hindi conjuncts would print wrong).
- **Languages.** `i18n.ts` packs translate only default wording at print time; stored labels and everything on screen stay English, so history, alerts, patterns and the Doctor Visit PDF keep working. Any-script labels need a non-English card language, which keeps the Latin-1 validation (and its tests) for English cards. Typed other-script text in the Doctor PDF becomes "(in another script on the card)".
- **Adaptive loop.** `adaptedNextWeekCard` replaces the last footer line (Letter has no room for more) and tries, per paper: note candidates (longest first) x highlight (frame, underline, none), keeping the first that passes `checkPrintedText`. Highlighted groups lift their labels 1 mm so the ring clears the bubbles. Study's `dueReviewSheet` does the same for the header (topics, then "+N more") and the footer (dates).
- **Stress lab.** Uses the core's synthetic renderer (corner markers, ID strip, bubbles; no printed text) with known marks. Measured bands: mark darkness >= 0.45 reads filled, 0.30-0.40 unclear, below ~0.25 blank. The faintness slider spans 0.88 to 0.30, so its far end shows every mark sent for review and none read wrong. Decode in Chromium: 14-21 ms.
- **Hooks.** `PreToolUse` cannot match file paths (its matcher sees tool names), so it runs `scripts/hooks/protect-core.mjs`, which reads the payload and answers `permissionDecision: "ask"` only for protected paths; an agent-prompt action would fire on every edit. The `Stop` hook (`verify-boundaries.mjs`) exits 1 on forbidden core imports and returns one `block` reminder when `.tsx`/CSS files changed. The 50-photo paper-size matrix (5 samples x 5 cameras x 2 papers) is now a committed test.
