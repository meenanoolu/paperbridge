/**
 * Optical primitives for building a custom app frontend on the shared engine. ScanWorkbench is
 * one composition of these; Elder Care, Study Bridge and Seance Cipher compose their own.
 *
 *   const scan = useOpticalScan(LAYOUTS, { onScan, announce });
 *   <ScanSources scan={scan} layouts={LAYOUTS} samples={SAMPLES} />
 *   <OpticalXRayOverlay scan={scan} describe={...} />
 *   <HumanVerifyControl unclear={scan.unclear} overrides={scan.overrides} onSet={scan.setAnswer} />
 */
import { useContext, useRef, type ReactNode } from "react";
import type { CardLayout } from "../core";
import { playLockOnChime } from "./audio-cues";
import { AutoRoutePanel } from "./components/AutoRoutePanel";
import { Icon } from "./components/Icon";
import { PrintLayoutButton } from "./components/PrintCard";
import { RawUnwarpView } from "./components/RawUnwarpView";
import type { SampleCard } from "./components/SamplePanel";
import { ScanPreview } from "./components/ScanPreview";
import { WebcamScanner } from "./components/WebcamScanner";
import type { DescribeBubble } from "./components/ReviewPanel";
import { RouteContext } from "./route-context";
import type { OpticalScan } from "./useOpticalScan";
import type { XRayPalette } from "./xray";

export { useOpticalScan, type OpticalScan } from "./useOpticalScan";
export { HumanVerifyControl, verifiedCount, type HumanVerifyTheme } from "./components/HumanVerifyControl";
export { DecodePipeline } from "./components/DecodePipeline";
export { pipelineSteps } from "./pipeline";
export { ResultVoice, ReadAloudButton } from "./components/ResultVoice";
export { RawUnwarpView } from "./components/RawUnwarpView";
export { JudgeDemoStrip } from "./components/JudgeDemoStrip";
export { StressLab } from "./components/StressLab";
export { DEFAULT_XRAY_PALETTE, type XRayPalette } from "./xray";

/** The live webcam viewfinder with the 4-corner alignment frame and the lock-on chime. */
export function OpticalViewfinder({ scan, layout, onClose }: { scan: OpticalScan; layout: CardLayout; onClose?: () => void }) {
  return (
    <WebcamScanner
      layout={layout}
      onClose={() => (onClose ? onClose() : scan.setCamera(false))}
      onLock={() => playLockOnChime(scan.audioCues)}
      onCapture={(frame) => scan.scanFrame(frame)}
    />
  );
}

/**
 * The scanned photo with the decoder's view: plain overlay, Optical X-Ray, or Raw vs. Unwarped,
 * following the scan's toggles. Unclear marks are buttons that cycle a person's answer.
 */
export function OpticalXRayOverlay({ scan, describe, palette }: { scan: OpticalScan; describe?: DescribeBubble; palette?: XRayPalette }) {
  if (!scan.scan) return null;
  if (scan.unwarp && scan.scan.result.ok) return <RawUnwarpView scan={scan.scan} />;
  return <ScanPreview scan={scan.scan} overrides={scan.overrides} onCycle={scan.setAnswer} describe={describe} xray={scan.xray} palette={palette} />;
}

/** Show Optical X-Ray and Raw vs. Unwarped toggles, styled by the app. */
export function OpticalViewToggles({ scan, className }: { scan: OpticalScan; className: string }) {
  if (!scan.scan?.result.ok) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className={className} onClick={() => scan.setXray(!scan.xray)}>
        <Icon name="xray" />
        {scan.xray ? "Hide Optical X-Ray" : "Show Optical X-Ray"}
      </button>
      <button type="button" className={className} aria-pressed={scan.unwarp} onClick={() => scan.setUnwarp(!scan.unwarp)}>
        <Icon name="camera" />
        Raw vs. Unwarped
      </button>
    </div>
  );
}

/** Scan Any Card (Auto-Route) dropzone. Needs the shell's RouteContext; renders nothing outside it. */
export function BatchDropzone() {
  const onRoute = useContext(RouteContext);
  return onRoute ? <AutoRoutePanel onRoute={onRoute} /> : null;
}

/** Print one card (A4 or Letter) as a PDF. Text in any script prints. */
export const PrintSheetButton = PrintLayoutButton;

/**
 * Where a scan comes from: sample photos, an upload, or the webcam (with the Audio cues
 * toggle). Every class name is the app's, so each frontend keeps its own look.
 */
export function ScanSources({
  scan,
  layouts,
  samples,
  classes,
  samplesLabel = "Sample cards",
  children,
}: {
  scan: OpticalScan;
  layouts: CardLayout[];
  samples: SampleCard[];
  classes: { button: string; primary: string; sample: string; activeSample: string };
  samplesLabel?: string;
  children?: ReactNode;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      {samples.length > 0 && (
        <div role="group" aria-label={samplesLabel}>
          <p className="text-lg font-bold">{samplesLabel}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {samples.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={scan.busy}
                  aria-pressed={scan.activeSample === s.id}
                  onClick={() => scan.pickSample(s.id, s.src, s.title)}
                  className={`flex w-full items-center gap-3 text-left ${s.id === scan.activeSample ? classes.activeSample : classes.sample}`}
                >
                  <img src={s.src} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />
                  <span>
                    <span className="block text-lg font-extrabold">{s.title}</span>
                    <span className="block text-lg">{s.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={classes.primary} aria-expanded={scan.camera} onClick={() => scan.setCamera(!scan.camera)}>
          <Icon name="camera" />
          {scan.camera ? "Hide webcam" : "Scan with webcam"}
        </button>
        <button type="button" className={classes.button} onClick={() => file.current?.click()} disabled={scan.busy}>
          <Icon name="upload" />
          Upload a photo
        </button>
        <button type="button" className={classes.button} aria-pressed={scan.audioCues} onClick={() => scan.setAudioCues(!scan.audioCues)} title="A short chime when the webcam locks onto all 4 corners">
          <Icon name={scan.audioCues ? "speaker" : "mute"} />
          Audio cues
        </button>
        {children}
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) scan.upload(f);
          }}
        />
      </div>
      {scan.camera && <OpticalViewfinder scan={scan} layout={layouts[0]} />}
    </div>
  );
}
