# Build your own PaperBridge app

PaperBridge has one optical core (`src/core/`) and any number of paper apps on top of it. The
core prints the card, finds the 4 corner markers, unwarps the photo, and reads every bubble as
`filled`, `blank`, or `ambiguous`. It knows nothing about medication or quizzes. An app only
says **what is printed** and **what the marks mean**.

## Quick start

```bash
npm run create-app clinic-intake "Clinic Intake"
npm test          # includes the new app's layout + fast-check decode tests
npm run dev       # open http://localhost:5173/#clinic-intake
```

`create-app` writes `src/apps/clinic-intake/` and renders its sample photo (it runs
`npm run gen:samples`; pass `-- --no-samples` to skip). The app appears in the top switcher on
its own: no other file needs editing.

Rules for the arguments:

| Argument | Rule |
|---|---|
| `<slug>` | lowercase letters, digits and single dashes, starting with a letter (`clinic-intake`). Becomes the folder, the URL hash, and the printed card ID. |
| `"<Display Name>"` | up to 40 characters, Latin-1 only (the PDF uses standard fonts). Printed as the card title. |

## The 3-file contract

| File | Exports | Job |
|---|---|---|
| `layout.ts` | `LAYOUTS: CardLayout[]` (A4 and Letter), `LAYOUT`, `describeBubble` | What is printed: title, bubble groups (rows x columns), labels. The same object drives the PDF, the sample photos, and the decoder. |
| `interpret.ts` | a pure function `(scan: SuccessfulScan) => Report` | What the marks mean: answers, scores, alerts. No DOM, no clock, no randomness, so it is unit tested directly. |
| `App.tsx` | `appMeta`, a default component | The page: `<ScanWorkbench>` with your layouts, samples, and a `renderResult` that shows the report. |

`ScanWorkbench` gives every app the same 3 tabs. **Scan & Verify** is built in (Scan Any Card,
samples, webcam/upload, your `renderResult`, review). Pass `printTab` for extra print options
(below the built-in 1-Week Card download), `historyTab` for saved results and exports, `tabLabels`
to rename a tab, and `stressTest={{ filled: [...] }}` (a sample's marked bubble keys) to add the
Test Decoder Resilience drawer. Print any layout variant with `PrintLayoutButton` from
`src/shell/components/PrintCard.tsx`; text in any script prints.

**Print Cards** is shared too: pass `print={createPrintSlot({ layouts, text, pack })}` (see the
generated `print.ts`) and the tab gets Translate card, any-script PDF text, High-Visibility,
Icon-Anchored mode (when your layout sets `colIcons`) and a multi-sheet pack. `text` maps your
printed English words to each language. Return an `adaptiveCard(scan)` spec to offer a "next
card" built from a scan, rendered by the shell's `AdaptiveCardPanel`.

Two optional result slots add shell buttons: `spokenSummary={(scan) => ({ text, lang })}` adds
**Read Aloud** (offline `speechSynthesis`, voice matched to `lang`), and
`shareText={(scan) => "..."}` adds **Copy Quick Update**. The **Optical X-Ray** toggle and the
**Audio cues** webcam chime need no code. To save cards without writing storage code, use
`src/shell/local-batch.ts`: `appMeta.batch = localBatchAdapter(SAVED)`, `<SaveScanForm>` under a
result and `<SavedScansSection>` as the `historyTab`. The scaffolder writes all of this for you.

`appMeta.layouts` (set by the scaffolder) lets **Scan Any Card** route photos of your card to
your app. Add an optional `appMeta.batch` (`BatchAdapter` in `src/shell/batch.ts`) to let a
batch scan bulk-save your results: it names the per-row field, validates it, and saves the rows.
See `src/apps/study-bridge/batch.ts` for a short example.

The scaffold also writes:

- `samples/specs.ts`: recipes for the 1-click sample photos (`SAMPLE_SET`). `npm run gen:samples` draws pen marks on your real card, photographs it with the simulated camera, and saves a JPEG.
- `samples/index.ts`: loads those JPEGs for the sample panel.
- `__tests__/layout.test.ts`: geometry invariants, a unique card-ID check, a `fast-check` property that random fills decode exactly under tilt, scale and uneven light, and interpreter tests.

### Rules the core enforces

`checkLayout` (`src/core/validate.ts`) and the Layout Validator MCP tool check these. The
generated test fails if any is broken:

1. Every bubble stays inside the page margin (`fiducial.insetMm`).
2. No bubble is within a corner marker's quiet zone, or near the card-ID strip at the top right.
3. Bubble centres are at least 1.1 x (sum of radii) apart, across all groups.
4. Group keys are unique, and rows and columns are unique within a group (`_id` is reserved).

### Rules your interpreter must follow

- **Never guess.** A bubble whose state is `ambiguous` means a person should look at the paper. Report it ("review"), and do not count it as an answer.
- **Read the reviewed scan.** `ScanWorkbench` gives `renderResult`, `announce`, and `onScan` a `scan.result` with `applyManualOverrides` already applied (see `src/shell/overrides.ts`). Interpret that, not the raw decoder output, and recalculation after a person resolves a mark is automatic.
- **Stay pure.** Pass dates in as parameters (see `gradeSheet(scan, key, today)` in Study Bridge).

### Changing the printed card

- Change labels, rows, columns, radii and positions freely in `layout.ts`, then re-run `npm run gen:samples` (the `regen-samples-on-layout` hook does this when you save a `layout.ts` in Kiro).
- Changing `id` or `version` changes the card-ID strip, so cards printed earlier stop decoding (they report `CARD_ID_MISMATCH`). Bump `version` on purpose when the meaning of a bubble changes.
- If the test "has a card-ID code no other app uses" fails, bump `version` before you print. The strip holds 10 bits, so different IDs can collide.

## Examples in this repo

- [`src/apps/elder-care/`](../src/apps/elder-care/): weekly medication card, caregiver dashboard, history, Kiro Crew alerts, and customizable printed labels (`card-settings.ts`).
- [`src/apps/study-bridge/`](../src/apps/study-bridge/): 10-question quiz sheet, editable answer key, class gradebook, and CSV export.

## Check a layout from Kiro

The repo ships a local MCP server (`mcp/server.ts`, configured in `.kiro/settings/mcp.json`)
with two tools:

- `validate_card_layout`: paste a `CardLayout` JSON object and get pass/fail diagnostics with bubble IDs and distances.
- `list_registered_apps`: every app in `src/apps/` with its card ID, page sizes, and bubble count.

## Ready-to-paste Kiro prompt

Copy this into a Kiro chat in this repo and fill in the brackets:

```text
Build a new PaperBridge paper app called "[Display Name]" for [who fills it in] so that
[who reads the results] can [what decision the data supports].

1. Run: npm run create-app [slug] "[Display Name]"
2. Edit src/apps/[slug]/layout.ts so the card has:
   - [rows, e.g. "8 symptoms: Fever, Cough, ..."]
   - [columns, e.g. "None / Mild / Severe"], one mark per row
   Keep LAYOUTS for A4 and Letter. Use validate_card_layout from the PaperBridge MCP server
   to check the layout and fix every diagnostic.
3. Edit src/apps/[slug]/interpret.ts: return [the report, e.g. "a triage level and the list of
   severe symptoms"]. Treat ambiguous bubbles as "needs review", never as answers.
4. Update App.tsx renderResult to show the report with tables and StatusBadge (never colour alone,
   text 18px or larger), and an announce() sentence for screen readers.
5. Update samples/specs.ts with 2-3 realistic samples (one with a faint mark), then run
   npm run gen:samples.
6. Extend __tests__/layout.test.ts with interpreter tests for the new report, including an unclear
   mark resolved with applyManualOverrides.
7. Run npm test, npm run typecheck and npm run build. Follow .kiro/steering/apps-ui.md and
   .kiro/steering/product.md (no logins or uploads; the 1-click sample panel must work).
```
