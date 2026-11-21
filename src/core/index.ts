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
export { renderCardPdf } from "./render/pdf";
export { decode } from "./decode/decode";
export { renderCardRaster, type SynthOptions } from "./testing/synth";

import type { ScanResult } from "./types";
import { bubbleKey } from "./layout";

/** Map of `group/row/col` to reading, for easy lookup. Returns an empty map for failed scans. */
export function readingsByKey(result: ScanResult) {
  const map = new Map<string, import("./types").BubbleReading>();
  if (result.ok) for (const b of result.bubbles) map.set(bubbleKey(b.group, b.row, b.col), b);
  return map;
}
