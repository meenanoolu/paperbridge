/**
 * Public API of the PaperBridge optical core. Apps import only from here.
 */
import { bubbleKey } from "./layout";
import type { BubbleReading, CardLayout, ScanResult } from "./types";

export type {
  BubbleGroup,
  BubbleReading,
  BubbleState,
  CardLayout,
  DecodeErrorReason,
  PageSize,
  RasterImage,
  ScanResult,
} from "./types";
export {
  PAGE_SIZE_MM,
  bubbleCenters,
  bubbleKey,
  fiducialCenters,
  idBits,
  idCode,
  pageSizeMm,
  validateLayout,
} from "./layout";
export { renderCardSvg } from "./render/svg";
export { decode } from "./decode/decode";
export { renderCardRaster, type SynthOptions } from "./testing/synth";
export { createStabilityTracker, resultSignature, STABLE_FRAMES, type StabilityState } from "./capture/stability";
export { rasterFromFile, rasterFromUrl, rasterFromVideo, rasterToDataUrl } from "./capture/image-source";
export { CameraError, startWebcamScan, type CameraErrorKind, type WebcamScan } from "./capture/webcam";

export type SuccessfulScan = Extract<ScanResult, { ok: true }>;

/** One-page vector PDF. Loaded on demand so pdf-lib stays out of the initial bundle. */
export async function renderCardPdf(layout: CardLayout): Promise<Uint8Array> {
  const m = await import("./render/pdf");
  return m.renderCardPdf(layout);
}

/** Map of `group/row/col` to reading, for easy lookup. Returns an empty map for failed scans. */
export function readingsByKey(result: ScanResult): Map<string, BubbleReading> {
  const map = new Map<string, BubbleReading>();
  if (result.ok) for (const b of result.bubbles) map.set(bubbleKey(b.group, b.row, b.col), b);
  return map;
}

export {
  checkLayout,
  parseCardLayout,
  validateLayoutJson,
  type DiagnosticCode,
  type LayoutDiagnostic,
  type LayoutReport,
} from "./validate";
