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
