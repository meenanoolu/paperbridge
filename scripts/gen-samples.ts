/**
 * Generates the pre-rendered "scanned" sample photos used by the 1-click sample panels.
 * Each sample is the real printable card SVG plus hand-drawn pen marks, rasterised and then
 * photographed by the simulated camera (tilt, perspective, uneven light, noise, JPEG).
 * The apps decode these JPEG pixels at runtime with the same decoder as the webcam.
 *
 * Usage: npm run gen:samples
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decode } from "../src/core";
import type { SampleSet } from "../src/shell/sample-spec";
import { decodeJpeg, encodeJpeg, photographSample } from "./lib/photo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appsDir = join(root, "src/apps");

// Every app with samples/specs.ts exporting SAMPLE_SET (see src/shell/sample-spec.ts).
const SETS: (SampleSet & { dir: string })[] = [];
for (const slug of readdirSync(appsDir).sort()) {
  const specs = join(appsDir, slug, "samples/specs.ts");
  if (!existsSync(specs)) continue;
  const mod = (await import(pathToFileURL(specs).href)) as { SAMPLE_SET?: SampleSet };
  if (mod.SAMPLE_SET) SETS.push({ ...mod.SAMPLE_SET, dir: relative(root, dirname(specs)) });
}

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
