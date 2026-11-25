import { useEffect, useMemo, useRef, useState } from "react";
import type { CardLayout } from "../core";
import { AUDIO_CUES_KEY, parseAudioCues } from "./audio-cues";
import { applyManualOverrides, countActiveOverrides, NO_OVERRIDES, setOverride, unclearBubbles, type ManualOverrides, type OverrideState } from "./overrides";
import { takeRoutedScan, takeRoutedView, useRoutedScan } from "./routed-scan";
import { DECODE_ERROR_TEXT, useScanner, type CompletedScan, type ReviewedScan } from "./scan";
import { usePersistentState } from "./usePersistentState";

/**
 * Everything a scan screen needs, with no layout: decode a sample, an upload or a webcam frame;
 * take a scan routed from Scan Any Card; keep a person's answers for unclear marks; and the
 * X-Ray, Raw vs. Unwarped and Audio cues toggles. ScanWorkbench and every custom app frontend
 * (Elder Care stationery, Study Bridge studio, Seance Cipher) are built on it.
 */
export interface OpticalScanOptions {
  /** Called after each successful scan and whenever a person changes an answer. */
  onScan?: (scan: ReviewedScan) => void;
  /** One sentence read out by screen readers after a scan. */
  announce?: (scan: ReviewedScan) => string;
  /** Called once per new scan (e.g. to scroll the result into view). */
  onNewScan?: (scan: CompletedScan) => void;
}

export function useOpticalScan(layouts: CardLayout[], opts: OpticalScanOptions = {}) {
  const { state, scanUrl, scanFile, scanFrame, loadScan } = useScanner(layouts);
  const [audioCues, setAudioCues] = usePersistentState(AUDIO_CUES_KEY, parseAudioCues, true);
  const [xray, setXray] = useState(false);
  const [unwarp, setUnwarp] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const routed = useRoutedScan();
  useEffect(() => {
    const scan = routed && takeRoutedScan(layouts.map((l) => l.id));
    if (!scan) return;
    setCamera(false);
    setActiveSample(null);
    const view = takeRoutedView();
    setXray(!!view.xray);
    setUnwarp(!!view.unwarp);
    loadScan(scan);
  }, [routed, layouts, loadScan]);

  // Answers belong to one scan: a new scan starts with none, so there is no reset race.
  const [review, setReview] = useState<{ scan: CompletedScan | null; overrides: ManualOverrides }>({ scan: null, overrides: NO_OVERRIDES });
  const scan = state.status === "done" ? state.scan : null;
  const overrides = review.scan === scan ? review.overrides : NO_OVERRIDES;
  const reviewed = useMemo<ReviewedScan | null>(() => {
    if (!scan || !scan.result.ok) return null;
    return { ...scan, rawResult: scan.result, result: applyManualOverrides(scan.result, overrides), overrides, manualOverrides: countActiveOverrides(scan.result, overrides) };
  }, [scan, overrides]);
  const unclear = useMemo(() => (scan ? unclearBubbles(scan.result) : []), [scan]);
  const setAnswer = (key: string, value: OverrideState | undefined) =>
    setReview((r) => ({ scan, overrides: setOverride(r.scan === scan ? r.overrides : NO_OVERRIDES, key, value) }));
  const resetAnswers = () => setReview({ scan, overrides: NO_OVERRIDES });

  const lastNew = useRef<CompletedScan | null>(null);
  const onNewScan = opts.onNewScan;
  useEffect(() => {
    if (!scan || lastNew.current === scan) return;
    lastNew.current = scan;
    onNewScan?.(scan);
  }, [scan, onNewScan]);
  const onScan = opts.onScan;
  useEffect(() => {
    if (reviewed) onScan?.(reviewed);
  }, [reviewed, onScan]);

  const busy = state.status === "busy";
  const liveMessage =
    state.status === "busy"
      ? `Decoding ${state.label}.`
      : state.status === "error"
        ? state.message
        : state.status === "done"
          ? reviewed
            ? `${reviewed.manualOverrides > 0 ? `Updated. Manually verified (${reviewed.manualOverrides}).` : `Scanned ${reviewed.label}.`} ${opts.announce?.(reviewed) ?? ""}`
            : !state.scan.result.ok
              ? `Scan failed. ${DECODE_ERROR_TEXT[state.scan.result.reason].title}.`
              : ""
          : "";

  return {
    state,
    scan,
    reviewed,
    unclear,
    overrides,
    setAnswer,
    resetAnswers,
    busy,
    liveMessage,
    /** Decode a sample photo (marks it active). */
    pickSample: (id: string, src: string, title: string) => {
      setCamera(false);
      setActiveSample(id);
      void scanUrl(src, title);
    },
    upload: (file: File) => {
      setCamera(false);
      setActiveSample(null);
      void scanFile(file);
    },
    scanFrame: (frame: Parameters<typeof scanFrame>[0]) => {
      setCamera(false);
      scanFrame(frame);
    },
    loadScan,
    activeSample,
    setActiveSample,
    camera,
    setCamera,
    xray,
    setXray,
    unwarp,
    setUnwarp,
    audioCues,
    setAudioCues,
  };
}

export type OpticalScan = ReturnType<typeof useOpticalScan>;
