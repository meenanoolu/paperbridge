import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHIME_NOTES, createLockEdge, parseAudioCues, pickVoice, playLockOnChime, resetAudioForTests, speak, speechSupported } from "../audio-cues";
import { ReadAloudButton, ResultVoice } from "../components/ResultVoice";

/** A recording AudioContext double. */
function fakeAudio() {
  const log: string[] = [];
  class Ctx {
    currentTime = 10;
    state = "running";
    destination = {};
    createOscillator() {
      const o = {
        type: "",
        frequency: { setValueAtTime: (hz: number, t: number) => log.push(`freq ${hz} @${(t - 10).toFixed(2)}`) },
        connect: (g: unknown) => g,
        start: (t: number) => log.push(`start @${(t - 10).toFixed(2)}`),
        stop: () => undefined,
      };
      return o;
    }
    createGain() {
      const g = { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => undefined };
      return g;
    }
    resume() {
      return Promise.resolve();
    }
  }
  return { Ctor: Ctx as unknown as new () => AudioContext, log };
}

afterEach(() => resetAudioForTests());

describe("Audio lock-on chime", () => {
  it("synthesises a short dual tone with Web Audio, only when enabled", () => {
    const { Ctor, log } = fakeAudio();
    expect(playLockOnChime(false, Ctor)).toBe(false);
    expect(log).toEqual([]);
    expect(playLockOnChime(true, Ctor)).toBe(true);
    expect(log).toEqual([`freq ${CHIME_NOTES[0].hz} @0.00`, "start @0.00", `freq ${CHIME_NOTES[1].hz} @0.09`, "start @0.09"]);
    expect(CHIME_NOTES.at(-1)!.at + CHIME_NOTES.at(-1)!.dur).toBeLessThan(0.35);
  });

  it("no-ops without AudioContext, and never throws", () => {
    expect(playLockOnChime(true, null)).toBe(false);
    const Broken = class {
      constructor() {
        throw new Error("blocked");
      }
    } as unknown as new () => AudioContext;
    expect(playLockOnChime(true, Broken)).toBe(false);
  });

  it("chimes once per lock, not on every locked frame", () => {
    const edge = createLockEdge();
    expect([false, true, true, true, false, true].map(edge)).toEqual([false, true, false, false, false, true]);
  });

  it("stores the on/off choice as a plain boolean", () => {
    expect(parseAudioCues(false)).toBe(false);
    expect(parseAudioCues("yes")).toBeNull();
  });
});

describe("Read Aloud", () => {
  const voices = [
    { lang: "en-US", name: "Samantha", localService: true },
    { lang: "hi-IN", name: "Lekha (online)", localService: false },
    { lang: "hi_IN", name: "Lekha", localService: true },
    { lang: "te-IN", name: "Geeta", localService: true },
    { lang: "es-MX", name: "Paulina", localService: true },
  ];

  it("picks a matching system voice, preferring offline ones, and falls back to the browser default", () => {
    expect(pickVoice(voices, "te-IN")?.name).toBe("Geeta");
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Lekha");
    expect(pickVoice(voices, "es-ES")?.name).toBe("Paulina"); // same language, other region
    expect(pickVoice(voices, "ta-IN")).toBeNull();
    expect(pickVoice(voices, undefined)).toBeNull();
    expect(pickVoice([], "en-US")).toBeNull();
  });

  class Utt {
    lang = "";
    voice: unknown = null;
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  it("speaks with the language and voice, calls back once when done, and Stop cancels", () => {
    const spoken: Utt[] = [];
    const synth = { speak: (u: Utt) => spoken.push(u), cancel: vi.fn(), getVoices: () => voices };
    const done = vi.fn();
    const stop = speak({ text: "ఈ వారం 71 శాతం", lang: "te-IN" }, done, synth as never, Utt as never);
    expect(spoken[0]).toMatchObject({ text: "ఈ వారం 71 శాతం", lang: "te-IN", voice: voices[3] });
    expect(synth.cancel).toHaveBeenCalledTimes(1); // clears anything queued first
    spoken[0].onend!();
    expect(done).toHaveBeenCalledTimes(1);
    stop();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(done).toHaveBeenCalledTimes(1);
    const done2 = vi.fn();
    const stop2 = speak({ text: "x" }, done2, synth as never, Utt as never);
    stop2();
    expect(done2).toHaveBeenCalledTimes(1);
  });

  it("is a no-op where speech is unsupported", () => {
    const done = vi.fn();
    speak({ text: "x" }, done, undefined, undefined);
    expect(done).toHaveBeenCalled();
    expect(speechSupported({})).toBe(false);
    expect(speechSupported({ speechSynthesis: {}, SpeechSynthesisUtterance: Utt })).toBe(true);
  });

  it("renders the Read Aloud button only when supported", () => {
    expect(renderToString(createElement(ReadAloudButton, { summary: { text: "Hi" }, supported: true }))).toContain(">Read Aloud</button>");
    expect(renderToString(createElement(ReadAloudButton, { summary: { text: "Hi" }, supported: false }))).toBe("");
  });
});

describe("Copy Quick Update", () => {
  it("renders the button with a polite live region, and nothing when the app gives no text", () => {
    const html = renderToString(createElement(ResultVoice, { share: "Weekly care update:\nTook 71%." }));
    expect(html).toContain("Copy Quick Update");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Share this result"');
    expect(renderToString(createElement(ResultVoice, {}))).toBe("");
    expect(renderToString(createElement(ResultVoice, { spoken: { text: "" }, share: null }))).toBe("");
  });
});

describe("ScanWorkbench controls", () => {
  it("every app gets the Audio cues toggle (on by default, a real toggle button)", async () => {
    const { default: Study } = await import("../../apps/study-bridge/App");
    const { default: Elder } = await import("../../apps/elder-care/App");
    for (const App of [Study, Elder]) {
      const html = renderToString(createElement(App)).replace(/<!-- -->/g, "");
      expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*?Audio cues<\/button>/);
      expect(html).toContain("Test Decoder Resilience");
    }
  });
});
