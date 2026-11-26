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

- [x] 16. Phase 4: elder care clinical workflows (branch `feat/elder-care-clinical-workflows`)
  - [x] 16.1 Core print-only options: `BubbleGroup.colNotes`, `CardLayout.printStyle` (bold, label scales, band grey, floor 0.88); defaults byte-identical _(R20.2, R22.2, R22.4)_
  - [x] 16.2 `checkPrintedText` with Helvetica / Helvetica-Bold metrics; opt-in `checkText` on `validate_card_layout`; fixed the Study sheet subtitle touching the card-ID strip _(R20.3)_
  - [x] 16.3 Card settings and panel: anchors, cues, High-Visibility toggle; width-based wrapping; worst-case text and decode-parity tests _(R20, R22)_
  - [x] 16.4 `patterns.ts` with threshold tests; dashboard card, scan alert `patterns`, Doctor Summary section; Crew App parser, UI, prompt, skill and agent _(R21)_
  - [x] 16.5 `doctor-pdf.ts` with layout guarantees and tests (empty, single, 2 years, special characters, deterministic); offline download in the history section _(R23)_
  - [x] 16.6 Browser checks: panel, saved settings, PDFs, offline Doctor PDF, axe-core (0 violations, AAA contrast), keyboard pass

- [x] 17. Phase 5: batch routing and monthly packs (branch `feat/batch-routing-and-monthly-packs`)
  - [x] 17.1 `renderCardsPdf` in `src/core/render/pdf.ts`; single-card PDFs byte-identical; 4-page test _(R25)_
  - [x] 17.2 `decodeBestFit` paper-size fix for every scan path, with a 2-paper x 5-camera test _(R24.6)_
  - [x] 17.3 `route.ts`, `batch.ts`, registry `layouts` / `batch`, Elder Care and Study Bridge adapters, storage event, scaffolder `layouts`; routing, mixed-batch, summary and bulk-save tests _(R24)_
  - [x] 17.4 Scan Any Card panel: single-photo routing, batch summary and list, per-file errors, Review, bulk save; browser-checked with a 6-file mixed batch _(R24)_
  - [x] 17.5 Regimen presets with role-preserving mapping, validation, text and 1.5 mm gap tests; habit labels in alerts and tiles _(R27)_
  - [x] 17.6 4-Week Monthly Pack: consecutive Mondays, headings with fallback, geometry, text and photographed-decode tests; download button _(R26)_
  - [x] 17.7 Load 4-Week Sample History with trend, pattern, override and Doctor PDF tests; Clear History removes it _(R28)_
  - [x] 17.8 axe-core audit (0 violations, AAA contrast on Elder Care), keyboard pass, focus rings on new buttons and presets _(R9.2)_

- [x] 18. Judge-readiness polish (branch `docs/judge-readiness-polish`)
  - [x] 18.1 README: top summary (live demo, video, Crew App repo), 60-second judge path, Phase 4 features, OMR comparison, not-medical-advice line, refreshed layout, paper-size bug row, new screenshots (dashboard with patterns, batch summary, Doctor Visit PDF)
  - [x] 18.2 `crew-app/` README works as the standalone `paperbridge-care-monitor` repo; `app.json` `repo` set to it
  - [x] 18.3 `product.md` steering covers the whole skeleton; shipped-layout checks moved to `src/__tests__/` so `src/core` has no imports from `src/apps`
  - [x] 18.4 Elder Care footer: "For tracking only; not medical advice" via `appMeta.footerNote` (AAA contrast, 18 px)

- [x] 19. Phase 6: adaptive paper and multilingual UX (branch `feat/adaptive-paper-and-multilingual-ux`)
  - [x] 19.1 Core: icon, frame and rule primitives; `printedBoxes`; shared measuring with zero-width marks; `textImage` PDF option; English PDF/SVG hashes unchanged _(R31.1, R31.3)_
  - [x] 19.2 Shell: `WorkspaceTabs`, tab store, `RouteContext`, session state for Scan Any Card; Print Cards and History & Export panels _(R29)_
  - [x] 19.3 Elder Care: language packs, Translate picker, Icon-Anchored toggle, grapheme-safe wrapping, Doctor PDF English fallback; 512-layout check _(R31.2)_
  - [x] 19.4 Adaptive Paper Loop: `adaptive.ts` + button on the dashboard and history; Study `due-review.ts` + button; decode-parity tests _(R30)_
  - [x] 19.5 Test Decoder Resilience drawer and `stress-lab.ts` with tilt/dim/faint sweeps _(R32)_
  - [x] 19.6 Hooks: `protect-core-pre-tool.json`, `verify-boundaries-on-stop.json`, `scripts/hooks/`, 50-photo `paper-matrix.test.ts` _(R33)_
  - [x] 19.7 Browser checks: tabs keyboard model, routed Review, Telugu PDF, adapted card, due review card, lab; axe-core 0 AA and 0 AAA violations on 5 states _(R9.2)_

- [x] 20. Phase 7: skeleton X-Ray, audio and bilingual Crew (branch `feat/skeleton-xray-audio-and-bilingual-crew`)
  - [x] 20.1 `xray.ts` + `XRayOverlay` in ScanPreview and the Stress-Test Lab; tests on the Missed-Dose sample (unclear amber), Study and the lab _(R34)_
  - [x] 20.2 `audio-cues.ts` (chime, lock edge, voice choice, speak/stop) + Audio cues toggle + `ResultVoice` (Read Aloud, Copy Quick Update) _(R35)_
  - [x] 20.3 `local-batch.ts` + `SavedScans` components; scaffolder wiring; temp-dir test runs tsc, the generated tests, auto-route and batch save _(R36)_
  - [x] 20.4 `elder-care/voice.ts`, `study-bridge/voice.ts`, `cardLanguage` in `toScanAlert` _(R37)_
  - [x] 20.5 Crew App parser, badge, demo, prompt, agent and skill; bundle rebuilt _(R38)_
  - [x] 20.6 Browser checks and axe-core: 0 AA / 0 AAA violations on 4 states; 4 px focus rings on the new buttons _(R9.2)_

- [x] 21. Phase 8: judge UX and visual README (branch `feat/judge-ux-and-visual-readme`)
  - [x] 21.1 `judge-demo.ts`, `JudgeDemoStrip`, routed view option, batch request store; Elder Care "Doctor Visit PDF (this week)" _(R39)_
  - [x] 21.2 `pipeline.ts` + `DecodePipeline`; `unwarp.ts` + `RawUnwarpView`; read-only homography exports _(R40)_
  - [x] 21.3 `appMeta.accent` tokens; `SkeletonGuide` dialog with `dialogKey` _(R41)_
  - [x] 21.4 README hero, image grid, Built with Kiro table, Featured applications; new screenshots _(R42)_
  - [x] 21.5 Tests (scenarios incl. the 2-app batch, pipeline, unwarp, accents contrast, dialog keys), browser checks, axe-core 0 AA / 0 AAA on 4 states _(R9.2)_

- [x] 22. Phase 9: skeleton parity (branch `refactor/skeleton-parity`)
  - [x] 22.1 Core text, print-options and pack modules; Elder Care re-exports and uses them _(R43.2)_
  - [x] 22.2 `print-slot.ts`, `PrintWorkspace`; Elder Care print slot; Study Bridge translations and unit quiz pack _(R43)_
  - [x] 22.3 `AdaptiveCardPanel` + `adaptiveCard` slot; Elder Care and Study Bridge specs _(R44)_
  - [x] 22.4 Skeleton Home, view tabs, `viewFromHash`, webcam corner targets _(R45)_
  - [x] 22.5 Scaffolder `print.ts`; README under 150 lines and `docs/DETAILS.md` _(R46)_
  - [x] 22.6 Tests, browser checks (Telugu quiz PDF, unit pack, mixed batch on Home), axe-core 0 AA / 0 AAA on 5 states

- [x] 23. Phase 10: three frontends and Seance Cipher (branch `feat/three-distinct-frontends-and-seance-app`)
  - [x] 23.1 Core rune icons (eye, key, flame) _(R50.1)_
  - [x] 23.2 `useOpticalScan`, `optical.tsx`, `HumanVerifyControl`, X-Ray palette, launcher bar, `fullBleed`, paper-fit ring alignment _(R47, R50.5)_
  - [x] 23.3 Elder Care Warm Clinical Stationery _(R48)_
  - [x] 23.4 Study Bridge Live Classroom Studio _(R49)_
  - [x] 23.5 Seance Cipher layout, oracle, samples, page and harmonic chord _(R50.1-R50.3)_
  - [x] 23.6 Tests (Seance layout and verdicts, 3-app auto-route and batch, paper fit, launcher, keyboard markup), browser checks, axe-core 0 AA on 5 states (Elder Care AAA 0) _(R50.4, R9.2)_
  - [x] 23.7 README showcase of 3 frontends, DETAILS, developer guide

- [x] 24. Phase 11: X-Ray Rite (branch `feat/xray-rite-endless-arcade`)
  - [x] 24.1 `riteEngine.ts` (pure wave game, launchpad input, noise guard, receipt) and `riteVision.ts` (cover readings from a decode) _(R52)_
  - [x] 24.2 `layout.ts` Rite sheet on the shared bubble geometry; `runeGlyphs.ts`, `riteSheet.ts` (SVG, PDF, frozen X-Ray), `RitePrint.tsx` _(R51)_
  - [x] 24.3 `riteCamera.ts`, `riteAudio.ts`, `RiteGame.tsx`, `RitePads.tsx`, `RiteLive.tsx`, `RiteReceipt.tsx`; `App.tsx` keeps the Oracle reading collapsed _(R53, R54)_
  - [x] 24.4 Tests: engine, sheet and camera readings, page markup and handlers, audio, the camera loop in Node _(R51-R55)_
  - [x] 24.5 Browser checks: both modes to Game Over, keyboard, axe-core 0 AA on 6 states, 4 px rings, reduced motion, 390 px width, camera released on leave _(R55)_
  - [x] 24.6 README showcase, DETAILS, developer guide _(R55.2)_
