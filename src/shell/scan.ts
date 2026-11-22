import { useCallback, useRef, useState } from "react";
import {
  rasterFromFile,
  rasterFromUrl,
  rasterToDataUrl,
  type CardLayout,
  type DecodeErrorReason,
  type RasterImage,
  type ScanResult,
  type SuccessfulScan,
} from "../core";
import type { ManualOverrides } from "./overrides";
import { decodeBestFit } from "./route";

export type ScanSource = "sample" | "webcam" | "upload";

export interface CompletedScan {
  source: ScanSource;
  label: string;
  imageUrl: string;
  width: number;
  height: number;
  result: ScanResult;
  /** The layout variant that decoded (A4 or Letter print of the same card). */
  layout: CardLayout;
  decodeMs: number;
  scannedAt: Date;
}

/**
 * A successful scan after human review. `result` has overrides applied and is what apps
 * interpret; `rawResult` is the decoder's output, unchanged.
 */
export interface ReviewedScan extends CompletedScan {
  result: SuccessfulScan;
  rawResult: SuccessfulScan;
  overrides: ManualOverrides;
  /** Number of unclear marks a person resolved. */
  manualOverrides: number;
}

export type ScanState =
  | { status: "idle" }
  | { status: "busy"; label: string }
  | { status: "done"; scan: CompletedScan }
  | { status: "error"; message: string };

export const DECODE_ERROR_TEXT: Record<DecodeErrorReason, { title: string; help: string }> = {
  FIDUCIALS_NOT_FOUND: {
    title: "Could not find all 4 black corner squares",
    help: "Make sure the whole card is in the picture, flat, and not covered by fingers.",
  },
  HOMOGRAPHY_DEGENERATE: {
    title: "The card is too small or too skewed in the picture",
    help: "Hold the card closer and more face-on to the camera.",
  },
  CARD_ID_MISMATCH: {
    title: "This is a different PaperBridge card",
    help: "The card ID strip does not match this app. Try the other app, or print this app's card.",
  },
};

/**
 * Decode against each accepted paper variant (A4 and Letter prints of the same card).
 * Kept for compatibility; see `decodeBestFit` for why the best fit, not the first success, wins.
 */
export const decodeAny = decodeBestFit;

/** Yield to the browser so "Decoding..." paints before the CPU-bound decode starts. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export function useScanner(layouts: CardLayout[]) {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const run = useRef(0);

  const finish = useCallback(
    (id: number, raster: RasterImage, source: ScanSource, label: string, imageUrl: string) => {
      const t0 = performance.now();
      const { result, layout } = decodeAny(raster, layouts);
      const decodeMs = performance.now() - t0;
      if (id !== run.current) return;
      setState({
        status: "done",
        scan: { source, label, imageUrl, width: raster.width, height: raster.height, result, layout, decodeMs, scannedAt: new Date() },
      });
    },
    [layouts],
  );

  const scanUrl = useCallback(
    async (url: string, label: string) => {
      const id = ++run.current;
      setState({ status: "busy", label });
      try {
        await nextFrame();
        const raster = await rasterFromUrl(url);
        finish(id, raster, "sample", label, url);
      } catch {
        if (id === run.current) setState({ status: "error", message: "The sample image could not be loaded." });
      }
    },
    [finish],
  );

  const scanFile = useCallback(
    async (file: File) => {
      const id = ++run.current;
      setState({ status: "busy", label: file.name });
      try {
        await nextFrame();
        const raster = await rasterFromFile(file);
        finish(id, raster, "upload", file.name, rasterToDataUrl(raster));
      } catch {
        if (id === run.current) setState({ status: "error", message: "That file could not be read as an image." });
      }
    },
    [finish],
  );

  const scanFrame = useCallback(
    (raster: RasterImage) => {
      const id = ++run.current;
      finish(id, raster, "webcam", "Webcam scan", rasterToDataUrl(raster));
    },
    [finish],
  );

  /** Show a scan decoded elsewhere (e.g. auto-routed from "Scan Any Card"). */
  const loadScan = useCallback((scan: CompletedScan) => {
    ++run.current;
    setState({ status: "done", scan });
  }, []);

  return { state, scanUrl, scanFile, scanFrame, loadScan };
}
