---
inclusion: fileMatch
fileMatchPattern: "src/core/**"
---
# Optical Core Rules (`src/core/**`)

The core is domain-agnostic. It must never import from `src/apps/**`, React, or the DOM-only APIs outside `src/core/capture/`.

## Determinism
- The decoder is pure: same pixels + same `CardLayout` produce the same JSON. No LLM calls, no network, no `Math.random()` or `Date.now()` in decode paths.
- Image input is a plain `{ width, height, data: Uint8ClampedArray }` (RGBA, same shape as `ImageData`) so the decoder runs in Node under Vitest and in the browser.

## Coordinate conventions
- Card space is millimetres, origin top-left, x right, y down. Pixel space is the same orientation.
- Fiducials sit at fixed card-space positions in order TL, TR, BR, BL. The homography maps pixel space to card space from those 4 correspondences.
- Bubble centres are defined once in `CardLayout`. The printer and the decoder must read the same layout object. Never duplicate coordinates.

## Decoding invariants (covered by `src/core/__tests__/decoder.pbt.test.ts`)
1. Rotation (any angle within +/-30 degrees) does not change decoded bubbles.
2. Uniform scale (0.5x to 2x) does not change decoded bubbles.
3. Smooth illumination gradients and shadows do not change decoded bubbles. Use local (adaptive) thresholds, never one global threshold.
4. A missing or ambiguous fiducial returns a typed error (`{ ok: false, reason }`), never a guess.
5. Every bubble reports `state: "filled" | "blank" | "ambiguous"` plus a `confidence` in [0, 1]. Ambiguous bubbles are surfaced, not coerced.

## Style
- Pure functions, no classes for math. Small files: `layout`, `render`, `fiducials`, `homography`, `threshold`, `decode`.
- Numerical tolerances are named constants, not inline literals.
- Any change in `src/core/**` must keep `npm test` green.
