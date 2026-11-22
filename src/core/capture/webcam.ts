import { decode } from "../decode/decode";
import type { CardLayout, RasterImage, ScanResult } from "../types";
import { rasterFromVideo } from "./image-source";
import { createStabilityTracker, type StabilityState } from "./stability";

export type CameraErrorKind = "PERMISSION_DENIED" | "NO_CAMERA" | "INSECURE_CONTEXT" | "UNSUPPORTED" | "UNKNOWN";

export class CameraError extends Error {
  constructor(public readonly kind: CameraErrorKind, message: string) {
    super(message);
    this.name = "CameraError";
  }
}

/** Interval between decoded frames. Decoding takes ~25 ms at 1280x720, so this leaves the UI responsive. */
export const FRAME_INTERVAL_MS = 200;

export interface WebcamScanOptions {
  video: HTMLVideoElement;
  layout: CardLayout;
  /** Called after every decoded frame. `frame` is the decoded size, for drawing overlays in frame coordinates. */
  onFrame?: (result: ScanResult, state: StabilityState, frame: { width: number; height: number }) => void;
  /** Called once when the scan is stable. The camera keeps running until `stop()`. */
  onStable: (result: Extract<ScanResult, { ok: true }>, frame: RasterImage) => void;
  intervalMs?: number;
}

export interface WebcamScan {
  stop(): void;
  /** Most recent frame and decode, for a manual "use this frame" action. */
  latest(): { frame: RasterImage; result: ScanResult } | null;
}

function toCameraError(err: unknown): CameraError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return new CameraError("PERMISSION_DENIED", "Camera permission was denied.");
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return new CameraError("NO_CAMERA", "No camera was found on this device.");
  return new CameraError("UNKNOWN", err instanceof Error ? err.message : "The camera could not be started.");
}

/** Open the camera, decode frames on an interval, and report when the scan is stable (R3.1, R3.2). */
export async function startWebcamScan(opts: WebcamScanOptions): Promise<WebcamScan> {
  if (typeof window !== "undefined" && !window.isSecureContext)
    throw new CameraError("INSECURE_CONTEXT", "The camera needs a secure (https or localhost) page.");
  if (!navigator.mediaDevices?.getUserMedia)
    throw new CameraError("UNSUPPORTED", "This browser does not support camera access.");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    throw toCameraError(err);
  }

  const { video, layout, onFrame, onStable } = opts;
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const canvas = document.createElement("canvas");
  const tracker = createStabilityTracker();
  let latest: { frame: RasterImage; result: ScanResult } | null = null;
  let reported = false;
  let stopped = false;

  const timer = window.setInterval(() => {
    if (stopped || video.readyState < 2 || video.videoWidth === 0) return;
    const frame = rasterFromVideo(video, canvas);
    const result = decode(frame, layout);
    latest = { frame, result };
    const state = tracker.push(result);
    onFrame?.(result, state, { width: frame.width, height: frame.height });
    if (state.stable && result.ok && !reported) {
      reported = true;
      onStable(result, frame);
    }
  }, opts.intervalMs ?? FRAME_INTERVAL_MS);

  return {
    stop() {
      stopped = true;
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
    latest: () => latest,
  };
}
