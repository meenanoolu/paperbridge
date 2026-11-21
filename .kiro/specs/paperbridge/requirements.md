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
