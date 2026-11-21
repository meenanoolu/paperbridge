/**
 * Generates the pre-rendered "scanned" sample photos used by the 1-click sample panels.
 * Each sample is the real printable card SVG plus hand-drawn pen marks, rasterised and then
 * photographed by the simulated camera (tilt, perspective, uneven light, noise, JPEG).
 * The apps decode these JPEG pixels at runtime with the same decoder as the webcam.
 *
 * Usage: npm run gen:samples
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, type CardLayout } from "../src/core";
import { ELDER_LAYOUT } from "../src/apps/elder-care/layout";
import { ELDER_SAMPLE_SPECS } from "../src/apps/elder-care/samples/specs";
import { STUDY_LAYOUT } from "../src/apps/study-bridge/layout";
import { STUDY_SAMPLE_SPECS } from "../src/apps/study-bridge/samples/specs";
import type { SampleSpec } from "../src/shell/sample-spec";
import { decodeJpeg, encodeJpeg, photographSample } from "./lib/photo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SETS: { dir: string; layout: CardLayout; specs: SampleSpec[] }[] = [
  { dir: "src/apps/elder-care/samples", layout: ELDER_LAYOUT, specs: ELDER_SAMPLE_SPECS },
  { dir: "src/apps/study-bridge/samples", layout: STUDY_LAYOUT, specs: STUDY_SAMPLE_SPECS },
];

let failed = false;
for (const set of SETS) {
  mkdirSync(join(root, set.dir), { recursive: true });
  for (const spec of set.specs) {
    const photo = photographSample(set.layout, spec);
    const bytes = encodeJpeg(photo);
    const path = join(root, set.dir, spec.file);
    writeFileSync(path, bytes);
    // Sanity check: the written file must decode.
    const result = decode(decodeJpeg(bytes), set.layout);
    const summary = result.ok
      ? `${result.bubbles.filter((b) => b.state === "filled").length} filled, ${result.bubbles.filter((b) => b.state === "ambiguous").length} unclear`
      : `DECODE FAILED: ${result.reason}`;
    if (!result.ok) failed = true;
    console.log(`${relative(root, path)}  ${photo.width}x${photo.height}  ${(bytes.length / 1024).toFixed(0)} KB  ${summary}`);
  }
}
if (failed) process.exit(1);
