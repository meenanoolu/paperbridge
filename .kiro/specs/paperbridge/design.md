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

## 18. Phase 7: skeleton X-Ray, audio and bilingual Crew
- **No decoder change was needed.** `ScanResult` already carries the corner centres in image pixels (`fiducials`) and each bubble's centre (`at`), ink density (`fill`) and `state`. `xray.ts` only reshapes them; pixels per mm comes from the 4 marker-to-marker distances (averaged, since perspective makes the sides differ), which sizes the lock-on boxes and rings. `git diff main -- src/core` is empty, and the 50-photo matrix still passes.
- **Overlay.** One SVG in image coordinates over the photo (or the lab's canvas). Every ring has a black under-stroke so it reads on paper, desk and shadow; states differ by dash pattern as well as colour. Score labels are 2.4 bubble radii wide so neighbouring labels never overlap (energy bubbles are 10.5 mm apart). Unclear marks keep their review button, so their score sits above the ring. The overlay is `aria-hidden`; the caption and the readings list carry the same data.
- **Sound and speech.** `audio-cues.ts`: a 0.27 s E6-A6 sine chime at gain 0.08, one shared AudioContext, triggered on the rising edge of the webcam guide's `locked` state. `speak()` cancels the queue, sets `lang`, picks a voice (exact tag, then same language; offline first) and reports completion once, whether it ended, errored or was stopped. Elder Care reads in the card's language because Read Aloud can be played to the patient; the quick update is English because it goes to family and the dashboard is English.
- **Generic save.** Saved entries store filled and unclear bubble keys plus the card ID; `savedAsScan(entry, layout)` rebuilds a full decode-shaped result (missing keys blank), so the history re-runs the app's current interpreter. One entry per normalized name, newest first, capped at 500.
- **Crew.** `cardLanguage` is validated as a BCP 47 shape, never free text, so it cannot inject instructions into the agent prompt. Patterns alone also trigger the two sections (opener in English).

## 19. Phase 8: judge UX
- **Instant Demo.** Apps opt in with `appMeta.demo` (sample ids) and `appMeta.samples`; `judgeScenarios` is pure. A single-card scenario decodes the sample with `routeRaster` (so the card ID picks the app), then uses the existing routed-scan hand-off with a new view option (`{ xray: true }`) read once by the receiving workbench. The batch scenario fetches the sample JPEGs as `File`s and posts them to the mounted Scan Any Card panel through a small request store, so it runs the exact batch path a user's drop would.
- **Pipeline.** `pipelineSteps(state, unclearLeft)` is pure; "Verified Output" stays "needs review" until every unclear mark has a person's answer.
- **Unwarp.** `core/index.ts` now re-exports the decoder's own `solveHomography` and `applyHomography` (no change to `src/core/decode/`). `unwarpRaster` maps each output pixel (3 px/mm) through the card-to-image homography and samples bilinearly; the test checks that the 4 marker centres and a filled bubble land dark and a neighbouring blank lands light.
- **Accents.** CSS variables (`--accent`, `--accent-soft`) set on `<main>` from `appMeta.accent`; defaults keep the previous slate look. The primary-button accent is an inset shadow, so no button changes size.
- **Dialog.** A custom modal rather than `<dialog>`: focus moves to Close, `dialogKey` (pure) wraps Tab and Shift+Tab and maps Escape to close, and focus returns to the header button. The arrows are SVG, since an arrow glyph is missing from some system fonts.

## 20. Phase 9: skeleton parity
- **What moved.** `src/core/text.ts` (printableText, unprintableLatin, unprintableAnyScript, graphemes, wrapToWidth), `src/core/print-options.ts` (PRINT_LANGUAGES, tags, HIGH_VISIBILITY_STYLE, applyPrintOptions, localizeLayout, hasColumnIcons) and `src/core/pack.ts` (buildPack, firstFitting, withGroupTitle). Elder Care re-exports the old names, so its tests and imports are unchanged; its own files now hold only domain wording (packs for day names, columns, anchors, focus notes, spoken phrases) and the 9-character label rule.
- **Why the canvas renderer stays in the shell.** The `src/core/**` steering bans DOM APIs outside `capture/`, and `capture/` is protected. The core owns the PDF side (the `textImage` hook and the measured box); the browser side (`shell/text-image.ts`) is injected by the shared Print Cards controls.
- **Print slot.** `PrintSlot { value?, onChange?, languages, cardLabel, layouts(o), problems?(o), pack? }`. Shell-owned options are stored per card ID (`<id>.print-options`); Elder Care passes `value`/`onChange` because the card language also drives Read Aloud and the Crew alert. Customize Card keeps unsaved edits when those options change (they are patched into its draft). `createPrintSlot` turns a translation table and pack headings into a full slot; Study Bridge and scaffolded apps use it.
- **Layout checks drove the wording.** Hindi "प्रश्नोत्तरी उत्तर पत्र" reached the card-ID strip (non-Latin characters are measured at 1 em), so the Hindi title is "उत्तर पत्र"; the scaffold's Spanish subtitle was shortened the same way. Every language x High-Visibility x paper x pack sheet passes `checkPrintedText`.
- **Skeleton Home** reuses the batch, X-Ray, unwarp and routed-scan pieces; its result is kept in session state so it survives opening an app and coming back. View tabs are links (each view has a URL) rather than ARIA tabs, which are for in-page panels.

## 21. Phase 10: three frontends and Seance Cipher
- **One hook, two paths.** `useOpticalScan(layouts, { onScan, announce, onNewScan })` holds what ScanWorkbench held (active sample, camera, overrides, X-Ray, unwarp, audio cues, routed hand-off, live message). ScanWorkbench's markup is unchanged and scaffolded apps still use it; the 3 shipped apps compose `src/shell/optical.tsx` instead. `ScanSources` takes the app's class names, so each frontend keeps its own buttons.
- **Launcher.** Links rather than ARIA tabs, as in Phase 9. `appMeta.fullBleed` drops the shell's container (negative margins were rejected: they break at every breakpoint). The scaffold wording became "Your next app" now that App 3 ships.
- **Colour.** Elder Care uses #0F766E only for hairlines and #134E4A for text and buttons, since #0F766E on ivory is below 7:1. Seance text is parchment on obsidian; brass text uses #5b4310 on light backgrounds.
- **Seance Cipher.** idCode 465 (Elder Care 89, Study Bridge 593). Rows hidden, 4 columns 36 mm apart with radius 7 mm and rune icons, so it prints large. `fateOf` takes the majority rune, else "veil". The chord is A3, C4, E4, G4 triangle waves over 1.8 s on the shared AudioContext. New icons (eye, key, flame) were added to `src/core/render/icons.ts`, outside the protected paths.
- **Paper-fit bug.** The A4 smudged Seance card decoded with the Letter layout read 1 filled and 0 unclear: misplaced sample points fell on blank paper and read clean, so "fewest unclear" picked Letter. `ringAlignment` in `src/shell/route.ts` reads, through the decoder's homography, how much darker each bubble's printed ring is than the paper just outside it (16 angles, the darkest of 3 radii). The paper with the higher score wins when the gap exceeds `RING_TIE` (0.1); otherwise the old rule applies. Across 98 photos (every sample x cameras x both papers) the printed paper always wins, with a smallest gap of 0.835. The decoder is untouched.

## 22. Phase 11: X-Ray Rite
- **One layout, two faces.** `baseGroup(i)` holds the 12 bubbles; the Oracle card and the Rite sheet both spread it, so the coordinates cannot drift. The Rite sheet only changes titles, labels and the footer. `SEANCE_RITE_LAYOUTS` sorts after `SEANCE_LAYOUTS`, so the MCP validator still reports the Oracle card first. The decoder is unchanged.
- **Pictures outside the bubbles.** The core has 8 icons and cannot be edited, so `riteSheet.ts` draws 12 more as filled paths (`runeGlyphs.ts`) under each bubble, in the SVG and, after loading the core's PDF, with `drawSvgPath` exactly as the core draws its own icons. The core's PDF is loaded with `updateMetadata: false` so equal sheets give equal bytes. Pictures sit below the bubbles because the space above holds the title and labels. A test checks every picture against the bubbles, markers, ID strip, text and each other, on both papers. A decode of the photographed sheet reads all 12 centres at 0.00.
- **The engine is a function.** `tick(state, dtMs, coverage)` takes 12 readings (or null for "sheet not in view") and returns the next state plus `events` for sound and announcements. The seeded generator makes games replayable. Lock semantics: a tremble marks the rune cursed for the wave (sticky), the timer slowdown follows the current reading, and a clean banish waits while any other target is cursed. A tremble alone never costs the combo. A missed wave advances the wave, so difficulty keeps rising.
- **Thresholds against the real decoder.** Through the simulated camera: empty circle 0.00, dark token 0.94, dark fingertip 0.78, 60% cover 0.53, mid skin 0.45, pale skin 0.30, half-off-circle 0.38. PERFECT = 0.48 is therefore met by a dark token or a pressed dark fingertip; a pale fingertip in bright light trembles. The values are named constants. Real webcams are not verified.
- **Why not `startWebcamScan`.** It decodes with one fixed layout, but the paper size is not known in advance, and a wrong size misplaces the bubbles (the Phase 10 bug). `riteCamera.ts` is a self-scheduling timer (no overlapping decodes) that runs `decodeBestFit` until a frame decodes, then locks that paper, and unlocks after 20 failed frames. A two-frame minimum (`confirmCoverage`) means one noisy frame cannot banish.
- **Game clock.** One `requestAnimationFrame` chain ticks the engine about 30 times a second, with a 100 ms cap per step, and is cancelled on pause, on phase change and on unmount. The launchpad hold rule (250 ms, then 1.0; a shorter press leaves a 0.35 pulse) is in the pure `padPress`/`padRelease`/`padCoverage`.
- **Look.** Animations live in a scoped `<style>` (global CSS is off limits): the pulse is on a separate glow ring so a button's text never fades, the flicker has 2 dips per 1.2 s, and reduced motion disables all of it. Rune pictures are drawn through an SVG mask so cut-outs are real holes.
- **Kept, not replaced.** The Oracle reading stays in a collapsed section because Skeleton Home's "Open in Seance Cipher" hands a scan to `useOpticalScan` there, and the shell tests assert that panel.

## 23. Phase 12: handcrafted objects
- **Physical objects, not cards.** Each app on Skeleton Home is one object with its own proportions: the grid is `1.12fr 1fr 0.94fr` with different top offsets, and each has its own tilt in a CSS variable that only applies from 1024 px up. The stretched title link and the `has-[a:focus-visible]` ring on the object are kept from Phase 11, so the whole object is one focus target with a 4 px ring. The hover and focus straighten-and-lift rule and every ghost animation are `transform` only, and reduced motion removes them.
- **Ghosts.** A ghost is an SVG body; each drifter is a wrapper that translates across the desk (so the browser animates it on the compositor) with the bob on the inner SVG. A negative `animation-delay` starts each one mid-flight. Under reduced motion each wrapper gets `transform: translateX(var(--rest))`. The guide is decorative; the artifact's own description stays attached with `aria-describedby`, so nothing depends on the bubble.
- **Elder Care.** The shell's panels are not edited. `.care-sheet` CSS flattens any `section`, `details` or large rounded `div` inside the sheet into a dotted outline, so the shared components look like form fields. The stamp gates on `pending = unclear marks - checked`, the same number the decode pipeline uses. A locked or stamped stamp uses a solid colour, never opacity, so its text stays AAA.
- **Study Bridge.** Ink colours are all at least 7:1 on #FCFBF7. Highlighter bars are `mix-blend-multiply` skewed blocks; the numbers and the words Review and Mastered carry the meaning. The workspace tabs keep their roving tabindex and arrow keys; only their CSS changes.
- **X-Ray Rite.** The game section height is `100svh - launcher - header - drawer bar` with a minimum, and the stage inside it is `flex-1`, so the pads and the 16:9 video take what is left. The launcher bar wraps to 2 lines on narrow windows, so the page measures its own top offset and sets `--launcher`. `riteEngine.ts` is untouched: the ghostly lines are `riteVoice.ts`, which wraps `announceEvents` only for a tremble, picks a line from `(rune + wave)` so a replay reads the same, and leaves every other sentence exactly as the engine wrote it.

## 24. Phase 13: first-time user audit
- **Method.** Each surface was opened as a stranger in Chromium with 3 inputs: do nothing, tap, and upload a photo with no card. Findings drove the fixes; none were prescribed.
- **Coach, not status text.** `riteCoach.ts` is a pure `coachFor(state)` with a fixed priority: what you must do (menu, game over, paused, no sheet, trembling), then what just happened (a banish or lost life for 3 s), then the next action. `RiteGame` only feeds it and shows the result in `CoachGhost`. The visible bubble is decoration plus words; the `sr-only` status log still announces events, so nothing is read twice.
- **Hold feedback is local state.** `RiteGame` tracks `held` (pointer or key down) and passes it to `LaunchPad`; the engine still decides banish at 250 ms, so no rule moved.
- **No-sheet fallback.** A 400 ms interval compares `now - lastSeen` with `NO_SHEET_MS` (2 s). It only sets a flag; the engine's own "camera lost the sheet, timer waits" rule is unchanged.
- **Shared notices.** `FriendlyNotice.tsx` holds `ScanProblem`, `PROBLEM_COPY` and `hasNoMarks`. The factual text still comes from `DECODE_ERROR_TEXT`, which `useOpticalScan` reads, so it was not edited. `hasNoMarks` is a UI check on the decoded result and does not touch grading.
- **Home.** The demo button moved above the artifacts, the h1 lost its `lg:text-7xl` size, and the stage gaps tightened. On a 390 px phone the promise is above the fold and the button needs one scroll (accepted).

## 25. Phase 14: fluid signature UI
- **Springs without a library.** A unit step response of a damped oscillator is solved in closed form for under, critical and over damping, then sampled to 40 points as a CSS `linear()` easing. That keeps the motion on the compositor and the bundle small (the PWA precache grew by about 22 KiB). Four presets cover the feel: snappy (small overshoot), soft (critical, for pages), wobbly and slam (big overshoot). Browsers without `linear()` fall back to a plain curve.
- **Individual transform properties.** Entrances use `translate`, `scale` and `rotate`, not `transform`, and name only `from`. So the same element can carry its own tilt (the stamp, the papers), a tactile press (`scale` through the Web Animations API) and a hover transform without any of them overwriting another.
- **One navigation, one transition.** `App` keeps the id of the page it is on or moving to; the hash listener and `onRoute` both go through `go()`, which skips a repeat. The origin is the last press if it is under 2 s old, else the centre of the focused control, else the middle of the screen. `flushSync` makes React commit inside the transition callback.
- **Pointer light is cheap.** One listener per surface, springs chase the pointer, the animation loop stops when everything is at rest, and CSS reads `--px`, `--py`, `--mx`, `--my`. Papers use event delegation so 3 cards share one listener.
- **Reduced motion is the base state.** Final states are the default CSS; motion is added inside `no-preference` blocks. So a missing or failed animation can never hide content. The one exception is the deal-in, which waits for `data-seen`, and `revealOnce` sets it immediately when `IntersectionObserver` is missing.
- **Where the light sits.** The Rite stage is an `isolate` stacking context with the aurora at `-z-10`, so it sits above the stage background and below every pad.

## 26. Phase 15: Haunted Treasure Hunt and a spooky skin
- **A game that needs one photo, not a live camera.** The arcade needed the sheet in view for a whole game, which is awkward for a phone. The hunt asks for one photo per move, which is what the optical engine does best, and a faint mark naturally becomes the human-in-the-loop moment.
- **No new card.** The map is the 12-Rune Sheet. `hunt.ts` is pure: `readMap(result)` turns the decoder's bubbles into one of `room`, `none`, `many` or `unclear`; `makeGuess` applies a guess; `heatFor` maps row and column steps (0 to 5 on a 3 by 4 house) to a word. The creature comes from `nextRandom(seed)` in `riteEngine.ts`, which is read, not changed.
- **One photo, one guess.** `HuntGame` keys each decoded photo by `scannedAt` and the number of manual overrides, so a person's decision on a faint mark re-judges the same photo once and a stale photo never counts when a new hunt begins.
- **Samples.** Four photos of the printed map (three clean, one faint) come from `HUNT_SAMPLE_SET`; `gen-samples.ts` now loads every export ending in `SAMPLE_SET`, so an app can have more than one layout. The existing photos regenerate byte for byte.
- **Decoration behind content.** `HalloweenDoodles.tsx` draws on a `-z-10` layer inside an `isolate` page, so it paints above the page background and below all content. The Home scene is drawn with SVG and CSS and animated with `transform` and `opacity` only, inside `no-preference`.
