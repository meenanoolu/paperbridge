import { CameraError, decode, rasterFromVideo, type CardLayout, type RasterImage, type ScanResult } from "../../core";
import { decodeBestFit } from "../../shell/route";

/**
 * The live camera for X-Ray Rite: one decode per frame, over and over, with the same optical
 * decoder every PaperBridge app uses. The first decodes try both paper sizes and keep the one
 * whose printed rings line up (`decodeBestFit`); once a sheet decodes, that paper is locked, so
 * later frames cost a single decode.
 */
export interface RiteFrame {
  result: ScanResult;
  layout: CardLayout;
  frame: RasterImage;
  ms: number;
}

export interface RiteCamera {
  /** Stops the timer, the camera tracks and the video. Safe to call twice. */
  stop(): void;
  /** Pause or resume decoding without closing the camera (e.g. while the Game Over receipt shows). */
  setActive(on: boolean): void;
}

/** Larger frames are shrunk before decoding: decode time grows with pixel count. */
export const RITE_MAX_SIDE = 960;
export const RITE_INTERVAL_MS = 100;
/** After this many failed frames in a row the paper lock is dropped and both sizes are tried again. */
const UNLOCK_AFTER = 20;

export const CAMERA_HELP: Record<string, string> = {
  PERMISSION_DENIED: "Camera permission was denied.",
  NO_CAMERA: "No camera was found on this device.",
  INSECURE_CONTEXT: "The camera only works on a secure (https) page.",
  UNSUPPORTED: "This browser does not support camera access.",
  UNKNOWN: "The camera could not be started.",
};

function cameraError(err: unknown): CameraError {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return new CameraError("PERMISSION_DENIED", CAMERA_HELP.PERMISSION_DENIED);
  if (name === "NotFoundError" || name === "OverconstrainedError") return new CameraError("NO_CAMERA", CAMERA_HELP.NO_CAMERA);
  return new CameraError("UNKNOWN", CAMERA_HELP.UNKNOWN);
}

export async function openRiteCamera(opts: {
  video: HTMLVideoElement;
  layouts: CardLayout[];
  onFrame: (f: RiteFrame) => void;
  intervalMs?: number;
}): Promise<RiteCamera> {
  if (typeof window !== "undefined" && !window.isSecureContext) throw new CameraError("INSECURE_CONTEXT", CAMERA_HELP.INSECURE_CONTEXT);
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("UNSUPPORTED", CAMERA_HELP.UNSUPPORTED);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (err) {
    throw cameraError(err);
  }

  const { video, layouts, onFrame } = opts;
  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  } catch (err) {
    release();
    throw cameraError(err);
  }

  const canvas = document.createElement("canvas");
  const interval = opts.intervalMs ?? RITE_INTERVAL_MS;
  let timer: number | undefined;
  let stopped = false;
  let active = true;
  let locked: CardLayout | null = null;
  let misses = 0;

  const step = () => {
    if (stopped) return;
    const started = performance.now();
    try {
      if (active && video.readyState >= 2 && video.videoWidth > 0) {
        const frame = rasterFromVideo(video, canvas, RITE_MAX_SIDE);
        const { result, layout } = locked ? { result: decode(frame, locked), layout: locked } : decodeBestFit(frame, layouts);
        if (result.ok) {
          locked = layout;
          misses = 0;
        } else if (locked && ++misses > UNLOCK_AFTER) {
          locked = null;
          misses = 0;
        }
        onFrame({ result, layout, frame, ms: performance.now() - started });
      }
    } catch {
      // A frame that cannot be read is skipped; the next one may be fine.
    }
    if (!stopped) timer = window.setTimeout(step, Math.max(0, interval - (performance.now() - started)));
  };
  timer = window.setTimeout(step, interval);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(timer);
      release();
    },
    setActive(on) {
      active = on;
    },
  };
}
