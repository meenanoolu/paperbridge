export type PageSize = "A4" | "Letter";

/** A rectangular grid of bubbles. Positions are card-space millimetres (origin top-left, y down). */
export interface BubbleGroup {
  /** Unique key within the layout, e.g. "meds". */
  key: string;
  /** Row keys, top to bottom. */
  rows: string[];
  /** Column keys, left to right. */
  cols: string[];
  /** Optional printed text for rows/cols. Defaults to the keys. */
  rowLabels?: string[];
  colLabels?: string[];
  /** Optional printed group title, drawn above the column labels. */
  title?: string;
  /** Centre of the first bubble (top-left of the grid). */
  originMm: [number, number];
  /** Distance between neighbouring bubble centres: [between columns, between rows]. */
  pitchMm: [number, number];
  radiusMm: number;
}

export interface CardLayout {
  /** Stable identifier, e.g. "elder-care-weekly". */
  id: string;
  version: number;
  title: string;
  subtitle?: string;
  page: PageSize;
  fiducial: { sizeMm: number; insetMm: number };
  groups: BubbleGroup[];
}

export type BubbleState = "filled" | "blank" | "ambiguous";

export interface BubbleReading {
  group: string;
  row: string;
  col: string;
  state: BubbleState;
  /** 0..1. How far the measurement is from the decision thresholds. */
  confidence: number;
  /** 0..1. Darkness of the bubble interior relative to the paper around it. */
  fill: number;  /** Bubble centre in image pixels. For UI overlays. */
  at: [number, number];
}

export type DecodeErrorReason =
  | "FIDUCIALS_NOT_FOUND"
  | "HOMOGRAPHY_DEGENERATE"
  | "CARD_ID_MISMATCH";

export type ScanResult =
  | {
      ok: true;
      cardId: string;
      layoutVersion: number;
      bubbles: BubbleReading[];
      /** Fiducial centres in image pixels, ordered TL, TR, BR, BL. For UI overlays. */
      fiducials: [number, number][];
    }
  | { ok: false; reason: DecodeErrorReason };

/** Same shape as the browser `ImageData`, so the decoder runs in Node and in the browser. */
export interface RasterImage {
  width: number;
  height: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray;
}
