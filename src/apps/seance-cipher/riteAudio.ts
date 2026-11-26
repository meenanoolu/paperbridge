/**
 * X-Ray Rite sounds, synthesised offline with the Web Audio API (no audio files). Every function
 * does nothing when sound is off or the API is missing (old browsers, Node tests).
 */
type AudioCtor = new () => AudioContext;

export interface Voice {
  hz: number;
  /** Seconds after the sound starts. */
  at: number;
  dur: number;
  type: OscillatorType;
  gain: number;
}

export type Sound = "banish" | "interference" | "lifeLost" | "gameOver" | "wave";

const SEMITONE = 2 ** (1 / 12);

/** A major triad (root, third, fifth, octave) that climbs one semitone per combo step, up to an octave. */
export const banishVoices = (combo: number): Voice[] => {
  const root = 261.63 * SEMITONE ** Math.min(Math.max(0, combo), 12);
  return [1, 1.25, 1.5, 2].map((ratio, i) => ({ hz: root * ratio, at: i * 0.045, dur: 0.5, type: "triangle", gain: 0.07 }));
};

/** Two notes a semitone apart plus a low tritone: a nervous, beating buzz. */
export const INTERFERENCE_VOICES: Voice[] = [
  { hz: 233.08, at: 0, dur: 0.38, type: "sawtooth", gain: 0.04 },
  { hz: 246.94, at: 0, dur: 0.38, type: "sawtooth", gain: 0.04 },
  { hz: 329.63, at: 0.05, dur: 0.3, type: "square", gain: 0.025 },
];

/** A falling minor third. */
export const LIFE_LOST_VOICES: Voice[] = [
  { hz: 311.13, at: 0, dur: 0.3, type: "triangle", gain: 0.08 },
  { hz: 261.63, at: 0.18, dur: 0.5, type: "triangle", gain: 0.08 },
];

/** A slow, low minor chord, A2 C3 E3 A3. */
export const GAME_OVER_VOICES: Voice[] = [110, 130.81, 164.81, 220].map((hz, i) => ({ hz, at: i * 0.12, dur: 1.9, type: "triangle", gain: 0.07 }));

export const WAVE_VOICES: Voice[] = [{ hz: 659.25, at: 0, dur: 0.18, type: "sine", gain: 0.05 }];

export function voicesFor(sound: Sound, combo = 0): Voice[] {
  return sound === "banish" ? banishVoices(combo) : sound === "interference" ? INTERFERENCE_VOICES : sound === "lifeLost" ? LIFE_LOST_VOICES : sound === "gameOver" ? GAME_OVER_VOICES : WAVE_VOICES;
}

let shared: AudioContext | null = null;

const ctorOf = (): AudioCtor | null => {
  const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
};

/** Play one sound. Returns false (and does nothing) when sound is off or unavailable. */
export function playRite(sound: Sound, enabled: boolean, combo = 0, Ctor: AudioCtor | null = ctorOf()): boolean {
  if (!enabled || !Ctor) return false;
  try {
    shared ??= new Ctor();
    const ctx = shared;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    for (const v of voicesFor(sound, combo)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.hz, t0 + v.at);
      gain.gain.setValueAtTime(0.0001, t0 + v.at);
      gain.gain.exponentialRampToValueAtTime(v.gain, t0 + v.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + v.at + v.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + v.at);
      osc.stop(t0 + v.at + v.dur + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

/** Release the audio device (the page calls this when the game leaves the screen). */
export function closeRiteAudio(): void {
  const ctx = shared;
  shared = null;
  try {
    void ctx?.close();
  } catch {
    // already closed
  }
}
