# Requirements: PaperBridge

PaperBridge turns a printed bubble card into structured data using deterministic computer vision. One reusable optical core powers two apps (Elder Care Bridge, Study Bridge) and a Kiro Crew App.

## Glossary
- **Card**: a one-page A4 or Letter printout with 4 corner fiducials, a card ID header, and a bubble grid.
- **Fiducial**: a high-contrast square marker at each card corner.
- **CardLayout**: the single data structure describing page size, fiducial positions, header, and bubble positions. Used by both printer and decoder.
- **Decoder**: the function that turns an image into a `ScanResult` JSON.
- **Sample Card**: a pre-rendered raster image of a filled-in card, decoded from pixels at runtime.

## R1. Card generation (core)
1. WHEN given a `CardLayout` and a page size of A4 or Letter, THE Card Generator SHALL produce a printable one-page SVG.
2. THE Card Generator SHALL place one fiducial at each of the four page corners with a quiet zone around each.
3. THE Card Generator SHALL render a card ID header containing the card title and a human-readable card ID.
4. WHEN a layout defines a grid of R rows by C columns of bubbles, THE Card Generator SHALL render R x C labelled bubbles at the positions defined in the layout.
5. WHEN the user requests PDF output, THE Card Generator SHALL produce a one-page PDF that matches the SVG.
6. THE Card Generator SHALL be deterministic for the same layout and options.

## R2. Optical decoding (core)
1. WHEN given an RGBA image containing a card, THE Decoder SHALL locate the four corner fiducials.
2. IF fewer than four fiducials are found, THEN THE Decoder SHALL return `{ ok: false, reason: "FIDUCIALS_NOT_FOUND" }` and SHALL NOT return guessed bubble data.
3. WHEN four fiducials are found, THE Decoder SHALL compute a homography from image space to card space and unwarp the card.
4. THE Decoder SHALL classify each bubble as `filled`, `blank`, or `ambiguous` using a locally adaptive threshold.
5. THE Decoder SHALL report a `confidence` between 0 and 1 for each bubble.
6. THE Decoder SHALL output structured JSON containing the card ID, the layout version, and one entry per bubble.
7. THE Decoder SHALL NOT call any LLM, network service, or random source.
8. WHEN the same image is decoded twice, THE Decoder SHALL return identical results.
9. THE Decoder SHALL run in both Node (tests) and the browser.

## R3. Capture (core)
1. WHEN the user starts a webcam scan, THE Capture module SHALL request camera access and stream frames to the Decoder.
2. WHEN a frame decodes with no ambiguous bubbles in two consecutive frames with identical results, THE Capture module SHALL report a stable scan.
3. IF camera access is denied or unavailable, THEN THE app SHALL show a message pointing to the sample panel.
4. WHEN the user uploads an image file, THE Capture module SHALL decode it with the same Decoder.

## R4. Property-based testing
1. THE test suite SHALL include `src/core/__tests__/decoder.pbt.test.ts` using Vitest and `fast-check`.
2. FOR ALL random bubble fill patterns, rotations within +/-30 degrees, scales from 0.5x to 2x, and smooth shadow gradients, THE Decoder SHALL recover the original fill pattern.
3. FOR ALL images with one fiducial removed, THE Decoder SHALL return a `FIDUCIALS_NOT_FOUND` error.
4. WHEN a file in `src/core/**/*.ts` is saved, THE hook SHALL run `npm test`.

## R5. Elder Care Bridge app
1. THE app SHALL generate a Weekly Medication and Symptom Care Card with rows Mon to Sun and columns: Morning Meds, Night Meds, Hydration, Felt Dizzy/Pain, and Energy 1 to 5.
2. THE printed card SHALL use bold, high-contrast, large-print styling suitable for low vision.
3. THE app SHALL offer a 1-click "Try Sample Scanned Cards (No Printer Needed)" panel with three cards: Normal Week, Missed-Dose Alert, and Tilted/Low-Light Card.
4. WHEN a sample is selected, THE app SHALL decode it through the core Decoder from pixels.
5. WHEN a scan completes, THE Caregiver Dashboard SHALL show adherence percentage, missed-dose alerts, symptom flags, and the energy trend.
6. THE adherence percentage SHALL equal taken doses divided by scheduled doses (Morning and Night) over the week.
7. WHEN a scheduled dose is blank, THE dashboard SHALL list it as a missed-dose alert with the day and time.
8. WHEN Felt Dizzy/Pain is filled for a day, THE dashboard SHALL show a symptom flag for that day.
9. WHEN a bubble is ambiguous, THE dashboard SHALL mark it "needs review" and SHALL NOT count it as taken or missed.
10. THE end user filling out the card SHALL NOT need a smartphone, login, or cloud upload.

## R6. Study Bridge app
1. THE app SHALL generate a 10-question multiple-choice bubble sheet with options A to E using the same core Card Generator.
2. THE app SHALL offer a 1-click sample sheet that is decoded from pixels by the core Decoder.
3. WHEN a sheet is scanned, THE app SHALL grade each answer against an answer key, and show score percentage.
4. IF a question has more than one bubble filled, THEN THE app SHALL mark it invalid and score it as incorrect.
5. WHEN a question is incorrect or blank, THE app SHALL attribute it to its topic and list topics below 70% as weak topics for spaced repetition.
6. THE app SHALL show a spaced-repetition schedule (1, 3, 7 days) for each weak topic.
7. THE app SHALL run with no network access.

## R7. Kiro Crew App
1. THE repo SHALL include `crew-app/app.json` with `name: "paperbridge-care-monitor"` and permissions `api`, `events`, and `storage`.
2. THE repo SHALL include `crew-app/agents/care-auditor.json` and `crew-app/skills/adherence-analysis/SKILL.md`.
3. THE repo SHALL include a dashboard page in `crew-app/ui/` that uses `@kirocrew/app-sdk` to display PaperBridge scan alerts.
4. WHEN a scan alert event is received, THE dashboard SHALL persist it to app storage and list it.

## R8. Product rules (from `product.md`)
1. THE paper end user SHALL NOT need a smartphone, login, or cloud upload.
2. EVERY web UI SHALL provide the 1-click sample scanned card fallback.

## R9. Non-functional
1. Decoding a 1280x720 frame SHALL complete in under 500 ms on a typical laptop.
2. All UI text SHALL meet WCAG AA contrast, with AAA for the Elder Care app.
3. Apps SHALL import only from the public `src/core/index.ts`.
4. Stack: React, TypeScript, Vite, Tailwind CSS, Vitest, fast-check.

## R10. Human review of unclear marks (Phase 1)
1. WHEN a scan contains ambiguous bubbles, THE scan view SHALL make each one a keyboard- and mouse-operable control with an accessible name and visible focus ring.
2. WHEN a person activates an unclear bubble, THE app SHALL cycle its override through filled, blank, and unclear, and SHALL offer the same three choices in a large-target list.
3. THE app SHALL apply overrides with a pure function and SHALL NOT modify the decoder's `ScanResult`.
4. Overrides SHALL apply only to bubbles the decoder reported as ambiguous.
5. WHEN overrides change, BOTH apps SHALL recalculate their results, show "Manually verified (N)", and announce the update through the live region.

## R11. Webcam alignment guide (Phase 1)
1. WHILE the webcam is open, THE scanner SHALL draw 4 corner brackets matching the card's aspect ratio over the video.
2. WHILE fewer than 4 corner markers are found, THE brackets SHALL be dashed amber with the prompt "Align all 4 corner markers inside the frame."
3. WHEN all 4 markers are found, THE brackets SHALL turn solid green and the status SHALL say "4/4 corners locked".
4. THE overlay SHALL be `aria-hidden`, SHALL respect `prefers-reduced-motion`, and its state SHALL be available in a polite status line.

## R12. Copy for Kiro Crew (Phase 1)
1. WHEN an Elder Care scan is shown, THE dashboard SHALL offer "Copy for Kiro Crew", which copies the `paperbridge:scan-alert` JSON with overrides applied.
2. WHEN overrides are active, THE alert SHALL include `manualOverrides`, and THE Crew App SHALL keep and display it.
3. IF the clipboard is unavailable, THEN THE app SHALL show the JSON for manual copying.

## R13. Customizable cards (Phase 2)
1. THE Elder Care app SHALL offer a collapsible "Customize Card" panel for patient name, week start date, and the 4 checklist column labels, persisted in localStorage with "Reset to defaults".
2. THE customized card SHALL change only printed text; bubble centres, corner markers, the card-ID strip, and the layout id/version SHALL equal the default layout's, so the default decoder reads it unchanged.
3. Printed text SHALL stay clear of the card-ID strip and corner markers: the header name is width-limited, labels wrap to the column (max 3 lines), and the footer never grows.
4. THE Study app SHALL offer a collapsible "Edit Answer Key" panel for the answer (A-E) and topic of each question, persisted with "Reset to default key", and SHALL re-grade the loaded sheet when the key is saved.

## R14. Elder Care history (Phase 2)
1. WHEN "Save Week to History" is pressed, THE app SHALL store the week's summary (week, patient, adherence, missed doses, symptoms, manual verification count); re-saving the same patient and week SHALL replace it.
2. THE app SHALL show a Multi-Week Adherence Trend with week-over-week change and a "Clear History" action that asks for confirmation.
3. THE app SHALL copy a deterministic plain-text/Markdown Doctor Visit Summary of the saved weeks.

## R15. Study Bridge class sheet (Phase 2)
1. AFTER a scan, THE app SHALL accept a Student Name / ID and "Add to Class Sheet"; re-adding a student SHALL replace their sheet.
2. THE class sheet SHALL store marks, not grades, so editing the key re-grades every student.
3. THE app SHALL show a Class Weak-Topic Breakdown: per topic, the share of students below 70% and the class average.
4. THE app SHALL export a CSV gradebook (Student, Score, %, Double-Marked, Blank, Unclear, Weak Topics) that follows RFC 4180, starts with a UTF-8 BOM, and neutralizes spreadsheet formulas.

## R16. Local data (Phase 2)
1. All saved settings, history, and class sheets SHALL stay in this browser's localStorage and SHALL be validated by a pure parser on load.

## R17. Offline-first PWA (Phase 3)
1. THE app SHALL be installable as a standalone PWA with a `manifest.webmanifest` (name and short_name "PaperBridge", `display: standalone`, theme colour #020617, PNG, maskable and SVG icons).
2. THE service worker SHALL precache the app shell, every JS/CSS chunk (including the lazily loaded PDF generator), all sample photos, and the icons, so scanning, printing, samples, manual review, history, and CSV export work with no network.
3. WHILE `navigator.onLine` is false, THE header SHALL show "Offline mode: scanning & printing still work locally" in a polite status region at AAA contrast.

## R18. App scaffolder and developer guide (Phase 3)
1. `npm run create-app <slug> "<Display Name>"` SHALL write `src/apps/<slug>/` with `layout.ts`, `interpret.ts`, `App.tsx`, `samples/`, and `__tests__/layout.test.ts`, and SHALL refuse invalid slugs, unprintable names, and existing folders with a clear message.
2. THE generated layout SHALL pass `checkLayout` on A4 and Letter; THE generated tests SHALL include a fast-check property that random fills decode exactly, and an interpreter test that resolves an unclear mark with `applyManualOverrides`.
3. Apps SHALL register themselves: any `src/apps/*/App.tsx` exporting `appMeta` and a default component appears in the switcher, and any `samples/specs.ts` exporting `SAMPLE_SET` is rendered by `gen:samples`.
4. `docs/BUILD-YOUR-OWN-APP.md` SHALL document the 3-file contract, the scaffolder, and a ready-to-paste Kiro prompt.

## R19. Layout Validator MCP server (Phase 3)
1. A local stdio MCP server in `mcp/` SHALL expose `validate_card_layout`, which accepts a `CardLayout` object or JSON string and returns pass/fail with one diagnostic (code, message, bubble IDs, JSON path) per problem: shape errors, out of bounds, fiducial quiet-zone overlap, card-ID strip overlap, bubble-to-bubble overlap (centres closer than 1.1 x the sum of radii), and duplicate IDs.
2. THE server SHALL expose `list_registered_apps`, which lists every `src/apps/` folder with its label, card ID, pages, groups, bubble count, layout status, sample photo count, and problems (including card-ID code clashes).
3. Both tools SHALL be read-only. `.kiro/settings/mcp.json` SHALL configure the server for Kiro.

## R20. Routine anchors and pill cues (Phase 4)
1. THE Customize Card panel SHALL offer an optional routine anchor and pill cue per checklist column (up to 24 characters, 2 printed lines each), persisted with the card settings and cleared by "Reset to defaults".
2. THE card SHALL print them in small type between each column label and its bubbles, in both the PDF and the preview, and SHALL NOT move any bubble, corner marker or card-ID bit.
3. Printed text SHALL stay clear of neighbouring columns, the card-ID strip, corner markers, bubbles and other text, as measured by `checkPrintedText` with Helvetica metrics.
4. A photographed card with anchors and cues SHALL decode bubble for bubble identically to the standard card.

## R21. Deterministic symptom-to-miss correlation (Phase 4)
1. THE app SHALL flag a symptom-to-miss pattern WHEN a dose slot is missed on at least 2 days on which dizziness/pain or low energy was marked, AND those days are at least half of that slot's misses.
2. THE app SHALL flag a time-of-day barrier WHEN at least 3 doses are missed AND at least 75% of them are in one slot.
3. Patterns SHALL be computed by a pure function (`patterns.ts`) for one week (dashboard, scan alert) and across saved weeks (Doctor Visit Summary and PDF), and worded observationally, never as a diagnosis.
4. THE `paperbridge:scan-alert` payload SHALL include an optional `patterns` array; THE Crew App SHALL keep, show and pass it to `care-auditor`, which SHALL reference each pattern as a question in the check-in.

## R22. High-Visibility Print Mode (Phase 4)
1. THE Customize Card panel SHALL offer a persisted "High-Visibility Print Mode" toggle.
2. WHEN enabled, THE card SHALL print all text bold, day labels 20% larger, and alternate-day bands at grey 0.90, with bubble interiors white and borders unchanged.
3. THE High-Visibility card SHALL pass `validate_card_layout` (geometry and printed text) and SHALL decode bubble for bubble identically to the standard card, with faint marks on shaded rows still reported as unclear.
4. THE renderer SHALL refuse band grey darker than 0.88.

## R23. Doctor Visit PDF (Phase 4)
1. THE history section SHALL offer "Download Doctor Visit PDF", generated on the device with pdf-lib and available offline.
2. THE PDF SHALL fit one page and include: patient, generation date, weeks covered, medications with routine anchors and pill cues, overview, missed doses by time of day, patterns, a week table (adherence, missed, dizzy/pain days, marks checked by hand), and a footer on deterministic local decoding with human-verification counts.
3. WHEN the history does not fit, THE table SHALL list the latest weeks and state how many earlier weeks are counted but not listed. All text SHALL be reduced to the PDF fonts' character set so generation never fails.

## R24. Scan Any Card: auto-routing and batch scan (Phase 5)
1. THE shell SHALL offer a "Scan Any Card (Auto-Route)" file picker (multiple files) and drop zone that decodes each photo's card ID and routes it to the registered app that owns it, using each app's `appMeta.layouts`.
2. WHEN one photo is given and it decodes, THE shell SHALL switch to the owning app and load the result into its Scan Workbench.
3. WHEN several photos are given, THE shell SHALL decode them one after another on the device and show a summary such as "4 cards decoded locally in 118 ms: 3 ready, 1 needs human review", then list each file with its app and status.
4. Each failed file SHALL get its own clear, accessible error (corner markers not found, perspective could not be corrected, or card not recognised) and SHALL NOT stop the rest of the batch.
5. Files with unclear marks SHALL offer "Review", which opens the scan in its app for 1-click verification. Decoded files SHALL be bulk-saveable per app through its `appMeta.batch` adapter: Elder Care into Multi-Week History (one Monday per row, duplicates rejected), Study Bridge into the Class Sheet (student from the file name, duplicates rejected). Open apps SHALL update live.
6. Every scan path (upload, webcam, auto-route) SHALL pick the paper size whose layout fits best (fewest unclear marks, then highest mean confidence), so Letter prints are never read with the A4 layout.

## R25. Multi-page card PDFs (Phase 5)
1. `src/core` SHALL export `renderCardsPdf(layouts, { title })`, which renders an array of `CardLayout` into one PDF with one page per layout, lazily loaded with pdf-lib.
2. `renderCardPdf` SHALL produce byte-identical output to before.

## R26. 4-Week Monthly Pack (Phase 5)
1. THE Customize Card panel SHALL offer "Download 4-Week Pack (1 Month)" once a week is chosen: one 4-page PDF for Week 1 to Week 4 starting on the chosen Monday.
2. Every page SHALL keep the patient name, labels, anchors, cues and High-Visibility mode, carry a "Week N of 4" heading with its dates, and SHALL keep the bubbles, corner markers and card-ID bits of the standard card.
3. Every page SHALL pass `checkLayout` and `checkPrintedText`; WHEN the long heading would collide, THE pack SHALL use a shorter heading that fits.

## R27. Regimen presets (Phase 5)
1. THE Customize Card panel SHALL offer one-click presets "BP & Diabetes", "Post-Surgery Recovery" and "Simple Morning & Night" above the column inputs. A preset SHALL set labels, anchors and cues, keep patient, week and print mode, and leave every field editable.
2. Presets SHALL keep the column roles (1 morning dose, 2 evening dose, 3 daily habit, 4 symptom), so adherence, alerts and patterns stay correct.
3. Every preset SHALL pass validation and the printed-text check on A4 and Letter, standard and High-Visibility, with at least 1.5 mm between neighbouring words on a line.
4. Habit alerts and dashboard tiles SHALL use the printed column labels (for example "Gentle Walk: done on only 3 of 7 days"); with the default label the wording is unchanged.

## R28. 4-Week Sample History (Phase 5)
1. WHEN history is empty, THE history section SHALL offer "Load 4-Week Sample History" for a clearly named demo patient. It SHALL NOT be shown when real history exists, so it never overwrites saved data.
2. THE sample SHALL hold the 4 weeks before the current one with adherence 93%, 86%, 79%, 71%, a Metformin-miss-with-dizziness pattern, and one manually verified mark, and SHALL drive the trend, patterns, Markdown summary and Doctor Visit PDF.
3. "Clear History" SHALL remove it completely.

## R29. 3-tab workspace (Phase 6)
1. EVERY app built on ScanWorkbench SHALL show 3 WAI-ARIA tabs at the top of the page: **Scan & Verify** (default), **Print Cards**, and **History & Export** (Study Bridge: "Class Sheet & Export"). Arrow keys, Home and End SHALL move and activate tabs, with one tab stop and 4 px focus rings.
2. Scan & Verify SHALL hold Scan Any Card, the sample cards, webcam/upload, the decoded dashboard, unclear-mark verification and Copy for Kiro Crew. Print Cards SHALL hold the 1-Week PDF, card customization, presets, language, Icon-Anchored and High-Visibility modes, and the 4-Week Pack. History & Export SHALL hold the trend, sample history, patterns, summaries and the Doctor Visit PDF (or the class sheet and CSV).
3. Inactive panels SHALL stay mounted, so a scan, a form or a batch survives switching tabs; Scan Any Card's batch SHALL also survive switching apps.
4. WHEN a card is auto-routed, a batch starts, a batch row's Review is used, or a new scan completes, THE workspace SHALL show Scan & Verify.

## R30. Adaptive Paper Loop (Phase 6)
1. WHEN the fixed pattern rules find at least one pattern (on a scan or across saved weeks), Elder Care SHALL offer **Print Adapted Next-Week Card**: next Monday's card with a bold focus note in the footer (e.g. "Focus this week: Night Meds. Take it at the same time each day.", or a doctor check-in for symptom patterns) and the affected dose column's header framed, or double-underlined when a frame would touch a neighbouring label.
2. WHEN a graded sheet has weak topics, Study Bridge SHALL offer **Print Due Review Card**: a sheet whose header names the topics due and whose footer lists the +1/+3/+7-day review dates.
3. Adapted cards SHALL change printed text and print-only marks only, pass `checkLayout` and `checkPrintedText` on A4 and Letter, never add footer lines, and decode bubble for bubble like the standard card. Notes and headers SHALL fall back to shorter wording that fits.

## R31. Icon-Anchored mode and offline card languages (Phase 6)
1. `src/core` SHALL draw optional monochrome vector icons (`printStyle.showIcons` + `colIcons`: sun, moon, drop, alert, check) as filled pdf-lib paths above column labels, with no external assets. Icons SHALL be part of the printed-text collision check and SHALL NOT move any bubble.
2. Elder Care's Print Cards tab SHALL offer a **Translate card** button with built-in offline packs for English, Telugu, Hindi and Spanish (title, instructions, day names, default column labels, preset routine anchors, footer, focus notes) and an "Other script" option. A non-English choice SHALL allow labels in any script; emoji SHALL be refused. The dashboard, alerts and Doctor Visit PDF SHALL stay English.
3. Latin-1 text SHALL stay on the Helvetica vector path (byte-identical PDFs). Other text SHALL be drawn by the browser on a canvas with system fonts (about 600 dpi) and embedded as a lossless PNG fitted inside the box `checkPrintedText` measured. Without a canvas (Node), the core SHALL fall back to its standard-font path without failing.

## R32. Optical Stress-Test Lab (Phase 6)
1. Scan & Verify SHALL offer a collapsed **Test Decoder Resilience** drawer with sliders for tilt (-8 to +8 degrees), dim lighting and shadow, and pen faintness.
2. After each (debounced) change, THE lab SHALL render the sample card with known marks, distort it, run the real decoder in the browser, and show the decode time and how many bubbles were read correctly, sent for a human check, or read wrong.
3. Across the lab's range, no bubble SHALL be read wrong: faint marks SHALL turn unclear, never blank or filled by guess.

## R33. Varied Kiro hooks (Phase 6)
1. A `PreToolUse` hook SHALL ask the person before any write to `src/core/decode/`, `src/core/layout.ts` or `src/core/capture/`, and remind the agent to run the 50-photo A4/Letter regression matrix and the property tests first.
2. A `Stop` hook SHALL keep the agent working if `src/core` imports `src/apps` or `src/shell`, and, when UI files changed, ask it once to confirm the WCAG 2.2 AA / AAA audit.

## R34. Optical X-Ray (Phase 7)
1. ScanWorkbench and the Stress-Test Lab SHALL offer a "Show Optical X-Ray" toggle, off by default, for any app.
2. WHEN on, an SVG overlay aligned with the scanned image SHALL show green lock-on boxes on the 4 detected corner markers and a ring on every bubble coded by colour and dash (green filled, amber dashed unclear, slate dotted blank), with its ink-density score to two decimals: always shown for filled and unclear, on hover or focus for blank. A caption SHALL state the counts and score ranges, and a keyboard-reachable list SHALL give every reading.
3. THE X-Ray SHALL use only the existing decode result (corner centres, bubble centres, `fill`, `state`). No decoder file, threshold or classification SHALL change.

## R35. Audio cues, Read Aloud and Copy Quick Update (Phase 7)
1. ScanWorkbench SHALL offer an "Audio cues" toggle (on by default, stored in localStorage) that plays a short dual-tone chime synthesised with the Web Audio API once each time the webcam locks onto all 4 corner markers, and does nothing when AudioContext is unavailable.
2. Apps MAY pass `spokenSummary(scan) => { text, lang? }`; THE shell SHALL then show "Read Aloud" / "Stop Reading" using the browser's offline speechSynthesis, choosing a system voice that matches `lang` (offline voices first) and hiding the button where speech is unsupported.
3. Apps MAY pass `shareText(scan) => string`; THE shell SHALL then show "Copy Quick Update" with a polite live-region confirmation and a select-to-copy fallback.
4. No audio or speech files or libraries SHALL be bundled.

## R36. Zero-boilerplate saving (Phase 7)
1. `src/shell/local-batch.ts` SHALL provide a generic saved-cards list in localStorage (marks, not reports; one entry per name) with a ready Scan Any Card `BatchAdapter`, a single-save form and a History & Export section.
2. `npm run create-app` SHALL wire the generic batch adapter, the saved-cards tab and starter `spokenSummary` and `shareText`. A generated app SHALL pass typecheck, its tests, auto-routing and batch save with no edits.

## R37. App wiring (Phase 7)
1. Elder Care SHALL speak adherence, missed doses, symptom days, the first pattern's focus and the hand-check count in the card's language (`en-US`, `te-IN`, `hi-IN`, `es-ES`), and SHALL offer a 4-line English family update (name, adherence, flag, "Manually verified (N)" or "Every mark on the card was clear").
2. Elder Care alerts SHALL include optional `cardLanguage` (BCP 47) for translated cards only; English alerts SHALL be unchanged.
3. Study Bridge SHALL speak the score and topics due, and offer a 3-line update with the score, topics and review dates.

## R38. Bilingual check-ins in Kiro Crew (Phase 7)
1. THE Crew parser SHALL accept an optional well-formed BCP 47 `cardLanguage` and drop anything else; alerts without it SHALL parse unchanged. THE page SHALL show a "Card: <language>" badge, and the demo alert SHALL carry `te-IN`.
2. WHEN an alert has `patterns` and/or `cardLanguage`, THE check-in prompt, the `care-auditor` agent and the skill SHALL ask for two sections: "Clinical Note (English)" and "Gentle Check-In Opener" in the card language (Telugu, Hindi or Spanish; otherwise English).

## R39. Instant Demo (Phase 8)
1. THE top of Scan & Verify SHALL show "Try an Instant Demo" with up to 3 one-click scenarios built from `appMeta.demo` and `appMeta.samples`: **Missed-Dose + Faint Mark** (opens the sample in its app with the Optical X-Ray on), **Mixed Batch (2 Apps at Once)** (sends one sample from each of 2 apps through Scan Any Card), and **Clean Week (100% Adherence)**.
2. Scenarios whose samples are missing SHALL be hidden; the batch needs samples from 2 different apps. A polite status line SHALL report each result, and it SHALL survive the app switch.
3. Elder Care SHALL offer **Doctor Visit PDF (this week)** on the dashboard, for the scanned week without saving it.

## R40. Decode pipeline and Raw vs. Unwarped (Phase 8)
1. Once a scan starts, ScanWorkbench SHALL show 3 steps (1. Photo Input, 2. Optical Unwarp with the measured decode time, 3. Verified Output), each with a worded state (not started, in progress, done, failed, needs review) and `aria-current="step"` on the current one.
2. A **Raw vs. Unwarped** toggle (`aria-pressed`) SHALL show the input photo next to the card redrawn flat with the homography from the 4 detected corner markers. Display only: the decoder never uses this image, and no decoder file changes.

## R41. App accents and the architecture dialog (Phase 8)
1. `appMeta.accent` SHALL colour the selected tab, the tab underline, the app badge and the primary-button edge. Elder Care SHALL use clinical teal (#115e59) and Study Bridge academic indigo (#3730a3); white text on each SHALL be at least 7:1.
2. THE header SHALL have **How the Skeleton Works**, opening a modal dialog (`role="dialog"`, `aria-modal`, labelled) showing the core, shell, apps, App #3 via `create-app`, and the Kiro Crew handoff. Escape SHALL close it, Tab and Shift+Tab SHALL stay inside it, and focus SHALL return to the button.

## R42. Visual README (Phase 8)
1. THE README SHALL open with the tagline, live demo, Crew App repo, blog and X links, and a 3-image grid; a "Built with Kiro" table linking specs, steering, hooks, MCP, the scaffolder and the Crew App; and Featured applications giving both apps equal billing with a 1-line outcome and a screenshot each.

## R43. Shared Print Cards workspace (Phase 9)
1. ScanWorkbench's Print Cards tab SHALL render the shared controls for every app: Translate card (the languages the app offers), High-Visibility Print Mode, Icon-Anchored Print Mode (only when the layouts declare column icons), problems that block printing, the card download (PDF and SVG) and an optional multi-sheet pack.
2. Language lists, BCP 47 tags, High-Visibility style, printed-text helpers (clean text, unprintable characters, grapheme-safe wrapping), `localizeLayout` and the pack builder SHALL live in `src/core/`. The canvas renderer for non-Latin text SHALL stay in `src/shell/`, because the core steering forbids DOM APIs outside `src/core/capture/`.
3. Study Bridge SHALL print its sheet in English, Telugu, Hindi and Spanish and offer a 4-Week Unit Quiz Pack; Elder Care SHALL use the same controls for its card and its 4-Week Monthly Pack, saving the options with its card settings. English output SHALL be unchanged.

## R44. One adaptive-card slot (Phase 9)
1. Apps MAY return an `adaptiveCard(scan)` spec (heading, button label, layouts, file name, description). THE shell SHALL render it with `AdaptiveCardPanel`, which Elder Care's history also uses. Elder Care's Print Adapted Next-Week Card and Study Bridge's Print Due Review Card SHALL both go through it.

## R45. Skeleton Home and top-right view tabs (Phase 9)
1. THE header SHALL show Skeleton Home, Elder Care and Study Bridge (and any scaffolded app) as top-right links styled as tabs, with `aria-current="page"` on the open view. An empty or unknown hash SHALL open Skeleton Home.
2. Skeleton Home SHALL offer **Run Mixed Batch (Elder Care + Study Bridge)**, showing for each decoded card its X-Ray, its unwarped view, its status and the app it was routed to, with a button to open it; then 3 equal domain cards (Elder Care Bridge, Study Bridge, Scaffold App #3 with the command and what it inherits); then Scan Any Card.
3. THE webcam viewfinder SHALL show 4 target squares where the printed corner markers should sit, green once all 4 are locked.

## R46. Scaffolder parity and a short README (Phase 9)
1. `npm run create-app` SHALL write `print.ts` (translations for the template's words, column icons, a 4-sheet pack) and pass it to ScanWorkbench, so a new app inherits multilingual print, packs, X-Ray, audio, Read Aloud, Copy Quick Update, auto-route and batch save.
2. THE root README SHALL stay under 150 lines; longer material SHALL live in `docs/DETAILS.md`. Markdown and UI copy SHALL not use em dashes.

## R47. Optical primitives and the launcher bar (Phase 10)
1. `src/shell/optical.tsx` SHALL export `OpticalViewfinder`, `OpticalXRayOverlay`, `BatchDropzone`, `HumanVerifyControl` and `PrintSheetButton`, driven by a `useOpticalScan` hook that ScanWorkbench SHALL also use, so both paths decode and review the same way.
2. THE header SHALL be a slim sticky launcher bar: the PaperBridge mark (linking to Skeleton Home, `aria-current` when open), a `nav` labelled "Apps" with one pill per registered app using its full name, the offline badge, and a compact **How Skeleton Works** button that opens the architecture dialog with `npm run create-app`.
3. WHEN `appMeta.fullBleed` is set, THE shell SHALL give the app the full page width under the bar.
4. `HumanVerifyControl` SHALL offer Mark filled, Mark blank and Undo for each unclear mark, with accessible names that include the mark, and SHALL show a "Human verified" stamp whose animation respects reduced motion.
5. THE X-Ray SHALL accept an app palette with an optional glow; the default palette SHALL keep the existing look.

## R48. Elder Care: Warm Clinical Stationery (Phase 10)
1. Elder Care SHALL use an ivory (#FAF8F5) page with teal (#0F766E) hairlines, and every text and control colour SHALL meet WCAG AAA (7:1).
2. THE page SHALL have two columns: the card, Optical X-Ray and Raw vs. Unwarped on the left; adherence status, the Human Verified control, Read Aloud, Copy WhatsApp Update, the Doctor Visit PDF and icon card printing in 4 languages on the right. Presets SHALL sit in an accordion.

## R49. Study Bridge: Live Classroom Studio (Phase 10)
1. Study Bridge SHALL use slate and white with indigo (#3730A3) and emerald, and show score, correct answers, weak topics, class size and decode time as bold `tabular-nums` telemetry.
2. THE page SHALL show horizontal topic-mastery bars, the batch gradebook, the Due Review Card and the multi-week quiz pack (including Telugu and Hindi), in Live Scan, Print Studio and Gradebook panels.

## R50. Seance Cipher and 3-family routing (Phase 10)
1. `src/apps/seance-cipher/` SHALL provide the Oracle Cipher card: 3 questions of 4 runes (moon, eye, key, flame) with icons, 3 chapters, a unique card ID, and 2 samples, one with a faint mark.
2. WHEN a reading has an unclear mark, THE app SHALL withhold the verdict and ask a person to confirm it. WHEN every answer is known, THE app SHALL show a story verdict from the majority rune, play a harmonic chord if audio cues are on, and offer the next chapter's card to print.
3. THE theme SHALL be obsidian (#0B0D12) with brass (#D4AF37) hairlines, serif headings, a laser sweep that respects reduced motion and a glowing X-Ray, at WCAG AA.
4. Scan Any Card SHALL route Elder Care, Study Bridge and Seance Cipher cards, on A4 and Letter, in one batch.
5. WHEN choosing between paper sizes, THE shell SHALL prefer the size whose printed bubble rings line up with the photo, falling back to fewest unclear marks when the ring scores are close. No file in `src/core/decode/`, `src/core/layout.ts` or `src/core/capture/` SHALL change.

## R51. X-Ray Rite 12-Rune Sheet (Phase 11)
1. THE app SHALL offer a printable 1-page **X-Ray Rite 12-Rune Sheet** on A4 and US Letter with the same card ID and version, the same 12 bubble coordinates, corner markers and ID strip as the Oracle Cipher card, so every earlier printout and sample photo still decodes and routes to Seance Cipher.
2. THE sheet SHALL name the 12 runes in order (1 Skull, 2 Bat, 3 Ghost, 4 Pumpkin, 5 Eye, 6 Moon, 7 Candle, 8 Cross, 9 Spider, 10 Bone, 11 Coffin, 12 Star) above their bubbles and draw each as a vector picture below its bubble. Every bubble centre SHALL stay blank white, and no picture SHALL touch a bubble, a corner marker, the ID strip, printed text or another picture. The sheet SHALL pass the Layout Validator and download as PDF and SVG.

## R52. Endless wave engine (Phase 11)
1. THE game rules SHALL be pure state transitions (`menu`, `waveIntro`, `active`, `gameOver`) with `wave`, `lives` (3), `score`, `combo`, `maxCombo` and `multiplier` (`1 + combo * 0.15`). The wave timer SHALL be `max(1800, 4200 - wave * 180)` ms, and a wave SHALL light 1 to 4 runes (1 for waves 1 to 3, one more every 3 waves).
2. A cover reading of 0.48 or more SHALL banish a rune, pay `round(100 * multiplier)` and grow the combo. A reading from 0.22 up to just under 0.48 SHALL be the Trembling Hand: the timer SHALL drain 40% slower while it lasts, and that rune SHALL be cursed for the wave, so its banish pays points but does not grow the combo, and no banish grows the combo while another target is cursed.
3. WHEN the timer runs out THE game SHALL cost a life, break the combo and start the next wave; at 0 lives it SHALL end. WHEN the camera cannot see the sheet THE timer SHALL wait.

## R53. Two play modes (Phase 11)
1. **Live optical webcam**: THE app SHALL decode camera frames continuously with the optical decoder, choose the paper size by printed-ring fit, read each rune's cover as the decoder's ink density, and require two agreeing frames before a cover counts. It SHALL highlight targets in pulsing antique gold (#D4AF37), flicker a crimson beam on a trembling target, and play Web Audio chords on a banish and on a tremble. Its timer and camera SHALL be released on stop and on unmount.
2. **Instant digital launchpad**: THE app SHALL show a 3 x 4 grid of the 12 runes driven by mouse, touch and the keys 1-9, 0, minus and equals. Holding a pad for 250 ms or more SHALL read 1.0; a quick tap SHALL read 0.35.

## R54. Game Over receipt (Phase 11)
1. WHEN the game ends THE app SHALL show the frozen Optical X-Ray (the last camera frame, or the sheet on the launchpad, with runes still lit marked), the final wave, score and max combo, a **Play Again** button that takes focus, and a **Copy Score Receipt** button that copies plain text. The best score SHALL be kept on the device.

## R55. Accessibility and protected code (Phase 11)
1. Text SHALL meet WCAG 2.2 AA contrast, every control SHALL show the 4 px focus ring, every button's accessible name SHALL contain its visible words, flicker SHALL stay under 3 flashes a second and every animation SHALL stop for reduced motion. State SHALL never rely on colour alone, and the game SHALL be pausable and announce events in a polite status line.
2. THE change SHALL leave `src/core/`, `src/shell/`, `src/apps/elder-care/` and `src/apps/study-bridge/` unchanged, keep `pdf-lib` out of the initial bundle, and use no em dashes in UI copy or markdown.
