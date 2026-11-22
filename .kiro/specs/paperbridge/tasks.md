# Tasks: PaperBridge

Requirement references use the numbering in `requirements.md`.

- [x] 1. Project scaffold
  - [x] 1.1 Create Vite + React + TypeScript project with Tailwind CSS, Vitest, fast-check, pdf-lib; add scripts `dev`, `build`, `test` (`vitest --run`), `typecheck`, `gen:samples` _(R9.4)_
  - [x] 1.2 Add path structure `src/core`, `src/apps`, `src/shell`; export public API from `src/core/index.ts` _(R9.3)_

- [x] 2. Core types and layout
  - [x] 2.1 Define `CardLayout`, `ScanResult`, `BubbleReading` in `types.ts`
  - [x] 2.2 Implement `bubbleCenters(layout)` and page-size constants (A4, Letter)
  - [x] 2.3 Unit tests for layout coordinates

- [x] 3. Card generator
  - [x] 3.1 SVG renderer: fiducials, header with card ID strip, labelled bubble grids _(R1.1-R1.4, R1.6)_
  - [x] 3.2 PDF renderer with pdf-lib, one page, vector _(R1.5)_
  - [x] 3.3 Tests: one fiducial per corner, R x C bubbles, deterministic output

- [x] 4. Synthetic raster generator (`core/testing/synth.ts`)
  - [x] 4.1 Rasterize layout + fill pattern to RGBA
  - [x] 4.2 Apply rotation, scale, perspective, illumination gradient, shadow blob, seeded noise

- [x] 5. Decoder
  - [x] 5.1 Grayscale, integral image, local-mean binarization
  - [x] 5.2 Fiducial detection (connected components + nested ratio check) _(R2.1, R2.2)_
  - [x] 5.3 Corner ordering by top-edge direction
  - [x] 5.4 Homography solver with degenerate check, unit tests with known points _(R2.3)_
  - [x] 5.5 Bubble sampling with local background normalization and 3-state classification _(R2.4, R2.5)_
  - [x] 5.6 Pipeline `decode()` returning `ScanResult` JSON, card ID check _(R2.6-R2.9)_

- [x] 6. Property-based tests
  - [x] 6.1 `src/core/__tests__/decoder.pbt.test.ts` with arbitraries for fills, rotation, scale, shadow, noise _(R4.1, R4.2)_
  - [x] 6.2 Missing-fiducial property _(R4.3)_
  - [x] 6.3 Determinism property
  - [x] 6.4 Tune constants in `decode/constants.ts` until properties pass reliably; keep suite under about 60 s

- [x] 7. Capture
  - [x] 7.1 Webcam loop with stable-scan detection and typed permission errors _(R3.1-R3.3)_
  - [x] 7.2 Image upload path _(R3.4)_

- [x] 8. Shell UI
  - [x] 8.1 App switcher (Elder Care / Study Bridge), shared `SamplePanel`, `Scanner`, `PrintButton` components _(R8.2)_

- [x] 9. Elder Care Bridge
  - [x] 9.1 Weekly layout and large-print styling _(R5.1, R5.2)_
  - [x] 9.2 `interpret.ts` with unit tests for adherence, missed doses, symptoms, needs-review _(R5.6-R5.9)_
  - [x] 9.3 Generate three sample images (Normal Week, Missed-Dose Alert, Tilted/Low-Light) via `gen:samples` _(R5.3)_
  - [x] 9.4 Sample panel wired to the real decoder _(R5.4)_
  - [x] 9.5 Caregiver Adherence Dashboard (adherence ring, missed list, symptom flags, energy trend) _(R5.5)_
  - [x] 9.6 Emit `paperbridge:scan-alert` events

- [x] 10. Study Bridge
  - [x] 10.1 10-question A-E layout _(R6.1)_
  - [x] 10.2 `grade.ts` with answer key, invalid multi-mark handling, weak topics, spaced repetition schedule; unit tests _(R6.3-R6.6)_
  - [x] 10.3 Sample sheet image and one-click scan _(R6.2)_
  - [x] 10.4 Results UI, offline verified _(R6.7)_

- [x] 11. Kiro Crew App
  - [x] 11.1 Check Kiro Crew docs and sources for `app.json` schema and `@kirocrew/app-sdk` API; adjust design if needed (`ui.entry` relative to `ui/`, default-export page, `openChat({ agent, message, autoSend })`)
  - [x] 11.2 `crew-app/app.json` (`paperbridge-care-monitor`, permissions `api`, `events`, `storage`) _(R7.1)_
  - [x] 11.3 `crew-app/agents/care-auditor.json` and `crew-app/skills/adherence-analysis/SKILL.md` _(R7.2)_
  - [x] 11.4 `crew-app/ui/` dashboard with `sdk.ts` wrapper: subscribe, persist, list alerts _(R7.3, R7.4)_

- [x] 12. Polish and submission
  - [x] 12.1 Accessibility pass (contrast, focus, aria-live) _(R9.2)_
  - [x] 12.2 Performance check: 1280x720 decode under 500 ms _(R9.1)_
  - [x] 12.3 README showcase: apps, Crew App, quick start, how Kiro built it, guarantees, 3rd-app spec (approved by user; original title and tagline kept)
  - [x] 12.4 Final check: `npm test`, `npm run build`, manual run of all four samples

- [x] 13. Phase 1: real-world workflows (branch `feat/real-world-workflows`)
  - [x] 13.1 `src/shell/overrides.ts` (`applyManualOverrides`, `countActiveOverrides`, `nextOverride`) with unit tests _(R10.3, R10.4)_
  - [x] 13.2 Interactive unclear bubbles on the scan overlay, review list, audit badge, live announcement _(R10.1, R10.2, R10.5)_
  - [x] 13.3 Override recalculation tests for Elder Care (adherence, missed doses, water) and Study Bridge (score, invalid, weak topics) _(R10.5)_
  - [x] 13.4 Webcam alignment guide with pure `guideFor` / `guideGeometry` and tests _(R11)_
  - [x] 13.5 "Copy for Kiro Crew" with clipboard fallback; Crew App accepts `manualOverrides`; contract test _(R12)_

- [x] 14. Phase 2: customization, history, class sheets (branch `feat/real-world-workflows`)
  - [x] 14.1 `card-settings.ts`: validation, label wrapping, header width limit, Monday snapping, `customizeCareLayout`; geometry and photographed-decode tests _(R13.1-R13.3)_
  - [x] 14.2 Customize Card panel with live printed-card preview; custom labels in PDF/SVG and dashboard _(R13.1)_
  - [x] 14.3 `readMarks` / `gradeMarks` split; editable answer key with tests; Edit Answer Key panel that re-grades on save _(R13.4)_
  - [x] 14.4 `history.ts` (entries, trend, `formatDoctorSummary`) with tests; Save Week, trend section, Clear History _(R14)_
  - [x] 14.5 `class-sheet.ts` (roster, breakdown, `csvCell`, `gradebookCsv`) with tests; Add to Class Sheet, breakdown, CSV export _(R15)_
  - [x] 14.6 axe-core audit of new controls (0 violations; AAA contrast on Elder Care), keyboard pass _(R9.2)_

- [x] 15. Phase 3: offline PWA and developer kit (branch `feat/offline-pwa-and-dev-kit`)
  - [x] 15.1 `vite-plugin-pwa` (generateSW, autoUpdate), manifest and icons (`scripts/gen-icons.ts`), offline badge; precache verified and full flow run with the network off _(R17)_
  - [x] 15.2 `src/core/validate.ts` (`parseCardLayout`, `checkLayout`, `validateLayoutJson`) with tests; shipped layouts pass _(R19.1)_
  - [x] 15.3 Self-registering apps (`src/shell/app-registry.ts`) and sample sets (`SAMPLE_SET` in `gen:samples`) _(R18.3)_
  - [x] 15.4 `scripts/create-app.mjs` with temp-dir test that runs the generated suite; `docs/BUILD-YOUR-OWN-APP.md` _(R18.1, R18.2, R18.4)_
  - [x] 15.5 `mcp/server.ts` + `mcp/tools.ts` with tests and a stdio smoke test; `.kiro/settings/mcp.json` _(R19)_
  - [x] 15.6 README: live demo, app folder links, PWA, scaffolder, MCP server; LICENSE (MIT) confirmed
