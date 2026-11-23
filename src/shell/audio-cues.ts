/**
 * Offline audio and speech helpers. No audio files, no speech service: the lock-on chime is
 * synthesised with the Web Audio API and "Read Aloud" uses the browser's own speechSynthesis.
 * Every function no-ops when the API is missing (old browsers, Node tests).
 */
export const AUDIO_CUES_KEY = "audio-cues";

export const parseAudioCues = (raw: unknown): boolean | null => (typeof raw === "boolean" ? raw : null);

/** A short rising dual tone (E6 then A6), quiet and under a third of a second. */
export const CHIME_NOTES: { hz: number; at: number; dur: number }[] = [
  { hz: 1318.5, at: 0, dur: 0.12 },
  { hz: 1760, at: 0.09, dur: 0.18 },
];
export const CHIME_GAIN = 0.08;

type AudioCtor = new () => AudioContext;

let shared: AudioContext | null = null;

/** The AudioContext constructor, if this environment has one. */
export function audioContextCtor(g: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): AudioCtor | null {
  return ((g.AudioContext ?? g.webkitAudioContext) as AudioCtor | undefined) ?? null;
}

/**
 * Plays the lock-on chime. Returns false (and does nothing) when audio is off or unavailable.
 * The context is created once and reused; browsers allow it after the user's camera click.
 */
export function playLockOnChime(enabled: boolean, Ctor: AudioCtor | null = audioContextCtor()): boolean {
  if (!enabled || !Ctor) return false;
  try {
    shared ??= new Ctor();
    const ctx = shared;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const n of CHIME_NOTES) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.hz, t0 + n.at);
      gain.gain.setValueAtTime(0.0001, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(CHIME_GAIN, t0 + n.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

/** For tests. */
export function resetAudioForTests(): void {
  shared = null;
}

/**
 * Chime only on the transition to "all 4 corners locked", not on every locked frame.
 * Pure: feed it the lock state of each frame.
 */
export function createLockEdge() {
  let was = false;
  return (locked: boolean): boolean => {
    const rising = locked && !was;
    was = locked;
    return rising;
  };
}

// ---------------------------------------------------------------------------
// Read Aloud
// ---------------------------------------------------------------------------

export interface SpokenSummary {
  text: string;
  /** BCP 47, e.g. "en-US", "te-IN". */
  lang?: string;
}

interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * The best system voice for `lang`: exact tag, then same language, preferring offline voices.
 * Null means "let the browser choose" (it still reads, with its default voice).
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang?: string): V | null {
  if (!lang || voices.length === 0) return null;
  const norm = (t: string) => t.replace("_", "-").toLowerCase();
  const want = norm(lang);
  const base = want.split("-")[0];
  const rank = (v: V) => (norm(v.lang) === want ? 0 : norm(v.lang).split("-")[0] === base ? 1 : 9) * 2 + (v.localService === false ? 1 : 0);
  const best = [...voices].sort((a, b) => rank(a) - rank(b))[0];
  return rank(best) < 18 ? best : null;
}

interface SynthLike {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
  speaking?: boolean;
}

export function speechSupported(g: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): boolean {
  return !!g.speechSynthesis && typeof g.SpeechSynthesisUtterance === "function";
}

/**
 * Speak `summary`, cancelling anything already queued. `onDone` runs when it ends, errors, or is
 * cancelled. Returns a stop function. Throws nothing: unsupported environments get a no-op.
 */
export function speak(
  summary: SpokenSummary,
  onDone: () => void,
  synth: SynthLike | undefined = (globalThis as { speechSynthesis?: SynthLike }).speechSynthesis,
  Utterance: (new (text: string) => SpeechSynthesisUtterance) | undefined = (globalThis as { SpeechSynthesisUtterance?: new (t: string) => SpeechSynthesisUtterance }).SpeechSynthesisUtterance,
): () => void {
  if (!synth || !Utterance) {
    onDone();
    return () => {};
  }
  synth.cancel();
  const u = new Utterance(summary.text);
  if (summary.lang) u.lang = summary.lang;
  const voice = pickVoice(synth.getVoices(), summary.lang);
  if (voice) u.voice = voice;
  u.rate = 0.95;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
  return () => {
    synth.cancel();
    finish();
  };
}
