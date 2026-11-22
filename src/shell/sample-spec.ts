import type { CardLayout } from "../core";
import type { CameraOptions } from "../core/testing/synth";

/** How a sample's pen mark looks. "faint" is a light, partial mark that should decode as "needs review". */
export type MarkStyle = "pen" | "pencil" | "faint";

/**
 * Recipe for one pre-rendered sample photo. `npm run gen:samples` turns it into a JPEG:
 * the real card SVG with pen marks, rasterised, then photographed by the simulated camera.
 * The app decodes the JPEG pixels at runtime; nothing here is read by the decoder.
 */
export interface SampleSpec {
  id: string;
  title: string;
  description: string;
  /** File name inside the app's `samples/` folder. */
  file: string;
  /** Bubble keys (`group/row/col`) to mark, with optional mark style. */
  marks: { key: string; style?: MarkStyle }[];
  camera: CameraOptions;
  /** Seed for the hand-drawn mark shapes. */
  inkSeed: number;
}

/** Exported as `SAMPLE_SET` from `src/apps/<slug>/samples/specs.ts`; `npm run gen:samples` finds it. */
export interface SampleSet {
  layout: CardLayout;
  specs: SampleSpec[];
}
