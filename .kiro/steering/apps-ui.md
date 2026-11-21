---
inclusion: fileMatch
fileMatchPattern: "src/apps/**"
---
# App UI Rules (`src/apps/**`)

## Boundaries
- Apps import only from `src/core` public exports (`src/core/index.ts`). No deep imports, no copying core math.
- Each app owns: its `CardLayout` definition, its result interpretation (adherence, grading), its sample cards, and its UI.
- Apps never send scan data off-device. No logins, no cloud uploads.

## Required UI for every app
- A prominent 1-click "Try Sample Scanned Cards (No Printer Needed)" panel. Samples must run through the real decoder from raw pixels, not through pre-baked results.
- A "Print Card" action that uses the core SVG/PDF generator.
- A live webcam scan option with a clear permission-denied fallback message pointing to the sample panel.

## Accessibility and style
- Tailwind CSS only. Minimum body text 18px, headings 28px+, WCAG AA contrast (AAA for the elder-care app).
- Elder Care: large touch targets (min 56px), high-contrast bold printed card, plain-language alerts.
- Never convey status by colour alone. Pair colour with an icon and text.
- All interactive elements are keyboard reachable with a visible focus ring. Add `aria-live` to scan results.

## Structure
- `src/apps/<app>/{layout.ts, interpret.ts, samples/, components/, App.tsx}`.
- `interpret.ts` is pure and takes decoded JSON, so it can be unit tested without a browser.
