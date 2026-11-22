---
inclusion: always
---
# PaperBridge Product Vision
PaperBridge revives 1960s bubble sheets as an offline-first optical skeleton: print a card, fill it in with a pen, and one photo becomes structured data. The card is read deterministically (corner markers, perspective unwarp, local thresholds), never by AI guessing at marks.

One shared skeleton powers every app:
- `src/core/`: domain-agnostic card layout, SVG/PDF rendering, optical decoder, webcam capture, and the Layout Validator.
- `src/shell/`: shared UI (ScanWorkbench, Scan Any Card auto-routing and batch, manual review, local storage, offline PWA).
- `src/apps/`: thin apps on that skeleton. Today: **Elder Care Bridge** (weekly medication and symptom card for caregivers) and **Study Bridge** (offline quiz sheet with grading and a class gradebook). New apps come from `npm run create-app` and register themselves.
- `crew-app/`: the PaperBridge Care Monitor Kiro Crew App, which drafts caregiver check-ins from Elder Care alerts.

## Core Rules
- Never require smartphones, logins, or cloud uploads for the person filling out the paper card. Scan data stays on the device.
- Same pixels, same answer: unclear marks are reported for a human check, never guessed or counted.
- Always provide a 1-click "Sample Scanned Card" fallback in every app so judges without a printer can test the full optical pipeline.
- Health features support tracking only. They never diagnose or give medical advice.
