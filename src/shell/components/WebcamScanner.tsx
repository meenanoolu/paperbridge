import { useEffect, useRef, useState } from "react";
import { CameraError, startWebcamScan, type CardLayout, type RasterImage, type WebcamScan } from "../../core";
import { Callout, Button } from "./ui";

type Live =
  | { kind: "starting" }
  | { kind: "searching" }
  | { kind: "found"; streak: number }
  | { kind: "unclear" }
  | { kind: "error"; message: string };

const CAMERA_HELP: Record<string, string> = {
  PERMISSION_DENIED: "Camera permission was denied.",
  NO_CAMERA: "No camera was found on this device.",
  INSECURE_CONTEXT: "The camera only works on a secure (https) page.",
  UNSUPPORTED: "This browser does not support camera access.",
};

export function WebcamScanner({
  layout,
  onCapture,
  onClose,
}: {
  layout: CardLayout;
  onCapture: (frame: RasterImage) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const scan = useRef<WebcamScan | null>(null);
  const [live, setLive] = useState<Live>({ kind: "starting" });
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startWebcamScan({
      video: video.current!,
      layout,
      onFrame: (result, state) => {
        if (!result.ok) setLive({ kind: "searching" });
        else if (state.streak === 0) setLive({ kind: "unclear" });
        else setLive({ kind: "found", streak: state.streak });
        if (state.lastOk) setHasFrame(true);
      },
      onStable: (_result, frame) => {
        scan.current?.stop();
        onCapture(frame);
      },
    })
      .then((s) => {
        if (cancelled) s.stop();
        else {
          scan.current = s;
          setLive({ kind: "searching" });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof CameraError ? CAMERA_HELP[err.kind] ?? err.message : "The camera could not be started.";
        if (!cancelled) setLive({ kind: "error", message });
      });
    return () => {
      cancelled = true;
      scan.current?.stop();
      scan.current = null;
    };
    // Start once per open; layout is stable for the lifetime of the dialog.
  }, []);

  const useLatest = () => {
    const l = scan.current?.latest();
    if (!l) return;
    scan.current?.stop();
    onCapture(l.frame);
  };

  const status =
    live.kind === "starting"
      ? "Starting camera..."
      : live.kind === "searching"
        ? "Looking for the 4 black corner squares. Hold the whole card in view."
        : live.kind === "found"
          ? "Card found. Hold still..."
          : live.kind === "unclear"
            ? "Card found, but some marks are unclear. Hold still, or use this frame."
            : "";

  return (
    <div className="rounded-2xl border-2 border-slate-950 bg-white p-4">
      {live.kind === "error" ? (
        <Callout tone="warn" title={live.message}>
          No problem: use the <strong>Try Sample Scanned Cards</strong> panel above. It runs the same decoder on real photo pixels.
        </Callout>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl bg-slate-900">
            <video ref={video} className="block aspect-video w-full object-contain" aria-label="Live camera preview" />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-4 border-dashed border-yellow-300/80" aria-hidden />
          </div>
          <p className="mt-3 text-lg font-semibold" role="status" aria-live="polite">
            {status}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {live.kind !== "error" && (
          <Button variant="primary" icon="camera" onClick={useLatest} disabled={!hasFrame}>
            Use this frame
          </Button>
        )}
        <Button onClick={onClose}>Close camera</Button>
      </div>
    </div>
  );
}
