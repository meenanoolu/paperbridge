/**
 * Public API of the PaperBridge optical core. Apps import only from here.
 */
import { bubbleKey } from "./layout";
import type { BubbleReading, CardLayout, ScanResult } from "./types";

export type {
  BubbleGroup,
  CardIcon,
  BubbleReading,
  BubbleState,
  CardLayout,
  DecodeErrorReason,
  PageSize,
  PrintStyle,
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
export {
  BAND_GREY,
  cardPrimitives,
  COL_LABEL_SIZE_MM,
  COL_NOTE_SIZE_MM,
  GROUP_TITLE_SIZE_MM,
  LINE_HEIGHT,
  MIN_BAND_GREY,
  NOTE_GAP_MM,
  ROW_LABEL_SIZE_MM,
  ICON_SIZE_MM,
  type Primitive,
} from "./render/primitives";
export { CARD_ICONS, ICON_SHAPES } from "./render/icons";
export { isWinAnsiText } from "./render/measure";
export type { TextImageRenderer, TextImageRequest } from "./render/pdf";
export { decode } from "./decode/decode";
/** Read-only geometry helpers (for views such as the shell's Raw vs. Unwarped). */
export { applyHomography, solveHomography, type Homography } from "./decode/homography";
export { renderCardRaster, type SynthOptions } from "./testing/synth";
export { createStabilityTracker, resultSignature, STABLE_FRAMES, type StabilityState } from "./capture/stability";
export { rasterFromFile, rasterFromUrl, rasterFromVideo, rasterToDataUrl } from "./capture/image-source";
export { CameraError, startWebcamScan, type CameraErrorKind, type WebcamScan } from "./capture/webcam";

export type SuccessfulScan = Extract<ScanResult, { ok: true }>;

/**
 * Multi-page vector PDF, one page per layout (e.g. a 4-week pack). Loaded on demand so pdf-lib
 * stays out of the initial bundle.
 */
export async function renderCardsPdf(layouts: CardLayout[], opts?: import("./render/pdf").CardsPdfOptions): Promise<Uint8Array> {
  const m = await import("./render/pdf");
  return m.renderCardsPdf(layouts, opts);
}

/** One-page vector PDF. Loaded on demand so pdf-lib stays out of the initial bundle. */
export async function renderCardPdf(layout: CardLayout, opts?: { textImage?: import("./render/pdf").TextImageRenderer }): Promise<Uint8Array> {
  const m = await import("./render/pdf");
  return m.renderCardPdf(layout, opts);
}

/** Map of `group/row/col` to reading, for easy lookup. Returns an empty map for failed scans. */
export function readingsByKey(result: ScanResult): Map<string, BubbleReading> {
  const map = new Map<string, BubbleReading>();
  if (result.ok) for (const b of result.bubbles) map.set(bubbleKey(b.group, b.row, b.col), b);
  return map;
}

export { graphemes, isLatinText, printableText, unprintableAnyScript, unprintableLatin, wrapToWidth } from "./text";
export {
  applyPrintOptions,
  hasColumnIcons,
  HIGH_VISIBILITY_STYLE,
  isPrintLanguage,
  localizeLayout,
  PRINT_LANGUAGE_TAGS,
  PRINT_LANGUAGES,
  type PrintLanguage,
  type PrintLanguageOption,
  type PrintOptions,
} from "./print-options";
export { buildPack, firstFitting, withGroupTitle } from "./pack";
export {
  checkLayout,
  checkPrintedText,
  estimateTextWidthMm,
  textBoxes,
  printedBoxes,
  parseCardLayout,
  validateLayoutJson,
  type DiagnosticCode,
  type LayoutDiagnostic,
  type LayoutReport,
} from "./validate";
