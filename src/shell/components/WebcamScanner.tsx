import { useEffect, useMemo, useRef, useState } from "react";
import { CameraError, startWebcamScan, type CardLayout, type RasterImage, type ScanResult, type WebcamScan } from "../../core";
import { guideFor, guideGeometry } from "../webcam-guide";
import { Callout, Button } from "./ui";

const CAMERA_HELP: Record<string, string> = {
  PERMISSION_DENIED: "Camera permission was denied.",
  NO_CAMERA: "No camera was found on this device.",
  INSECURE_CONTEXT: "The camera only works on a secure (https) page.",
  UNSUPPORTED: "This browser does not support camera access.",
};

const AMBER = "#fbbf24";
const GREEN = "#22c55e";

interface Live {
  result: ScanResult | null;
  streak: number;
  frame: { width: number; height: number };
}

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
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live>({ result: null, streak: 0, frame: { width: 1280, height: 720 } });
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startWebcamScan({
      video: video.current!,
      layout,
      onFrame: (result, state, frame) => {
        setLive({ result, streak: state.streak, frame });
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
          setStarted(true);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof CameraError ? CAMERA_HELP[err.kind] ?? err.message : "The camera could not be started.";
        if (!cancelled) setError(message);
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

  const guide = guideFor(live.result, live.streak);
  const { width: fw, height: fh } = live.frame;
  const geo = useMemo(() => guideGeometry(fw, fh, layout), [fw, fh, layout]);
  const color = guide.locked ? GREEN : AMBER;
  const status = started ? guide.message : "Starting camera...";
  const corners = guide.locked && live.result?.ok ? live.result.fiducials : [];

  return (
    <div className="rounded-2xl border-2 border-slate-950 bg-white p-4">
      {error ? (
        <Callout tone="warn" title={error}>
          No problem: use the <strong>Try Sample Scanned Cards</strong> panel above. It runs the same decoder on real photo pixels.
        </Callout>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl bg-slate-900">
            <video ref={video} className="block aspect-video w-full object-contain" aria-label="Live camera preview" />
            {/* Purely visual: the status line below carries the same information for screen readers. */}
            <svg
              viewBox={`0 0 ${fw} ${fh}`}
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
              data-guide={guide.tone}
            >
              <rect x={geo.x} y={geo.y} width={geo.w} height={geo.h} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={geo.stroke / 3} />
              <path
                d={geo.path}
                fill="none"
                stroke={color}
                strokeWidth={geo.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={guide.locked ? undefined : `${geo.stroke * 2.2} ${geo.stroke * 1.4}`}
                className={`motion-safe:transition-[stroke] motion-safe:duration-200 ${guide.locked ? "" : "motion-safe:animate-pulse"}`}
              />
              {corners.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={geo.stroke * 2} fill="none" stroke={GREEN} strokeWidth={geo.stroke * 0.7} />
              ))}
            </svg>
          </div>
          <p className="mt-3 flex items-center gap-2 text-lg font-semibold" role="status" aria-live="polite">
            <span
              aria-hidden
              className={`inline-block h-4 w-4 shrink-0 rounded-full border-4 ${guide.locked ? "border-green-700 bg-green-700" : "border-dashed border-amber-600"}`}
            />
            {status}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {!error && (
          <Button variant="primary" icon="camera" onClick={useLatest} disabled={!hasFrame}>
            Use this frame
          </Button>
        )}
        <Button onClick={onClose}>Close camera</Button>
      </div>
    </div>
  );
}
