import { useCallback, useRef, useState } from "react";
import {
  decode,
  rasterFromFile,
  rasterFromUrl,
  rasterToDataUrl,
  type CardLayout,
  type DecodeErrorReason,
  type RasterImage,
  type ScanResult,
} from "../core";

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
 * Decode against each accepted layout variant (e.g. A4 and Letter prints) and keep the first success.
 * Returns the first failure if none decode.
 */
export function decodeAny(raster: RasterImage, layouts: CardLayout[]): { result: ScanResult; layout: CardLayout } {
  let first: { result: ScanResult; layout: CardLayout } | null = null;
  for (const layout of layouts) {
    const result = decode(raster, layout);
    if (result.ok) return { result, layout };
    // A missing fiducial fails the same way for every variant, so stop early.
    if (result.reason === "FIDUCIALS_NOT_FOUND") return { result, layout };
    first ??= { result, layout };
  }
  return first!;
}

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

  return { state, scanUrl, scanFile, scanFrame };
}
