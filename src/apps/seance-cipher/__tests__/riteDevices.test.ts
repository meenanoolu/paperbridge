import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraError, type RasterImage } from "../../../core";
import { SEANCE_RITE_LAYOUTS } from "../layout";
import { banishVoices, closeRiteAudio, GAME_OVER_VOICES, INTERFERENCE_VOICES, LIFE_LOST_VOICES, playRite, voicesFor, WAVE_VOICES } from "../riteAudio";
import { openRiteCamera, RITE_INTERVAL_MS, type RiteFrame } from "../riteCamera";
import { PERFECT } from "../riteEngine";
import { riteSheetSvg } from "../riteSheet";
import { coverageFromScan } from "../riteVision";
import { photographSvg, sheetWithCover } from "./rite-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  closeRiteAudio();
});

describe("Web Audio chords", () => {
  /** A fake AudioContext that records every oscillator it is asked to play. */
  function fakeAudio() {
    const oscillators: { type: string; hz: number }[] = [];
    let created = 0;
    let closed = 0;
    class Ctx {
      currentTime = 0;
      state = "running";
      destination = {};
      constructor() {
        created++;
      }
      createOscillator() {
        const o = { type: "", hz: 0, frequency: { setValueAtTime: (hz: number) => (o.hz = hz) }, connect: (g: unknown) => g, start: () => undefined, stop: () => undefined };
        oscillators.push(o);
        return o;
      }
      createGain() {
        return { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => undefined };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        closed++;
        return Promise.resolve();
      }
    }
    return { Ctx: Ctx as unknown as new () => AudioContext, oscillators, count: () => created, closed: () => closed };
  }

  it("a banish is a major triad plus octave that climbs a semitone per combo step, up to an octave", () => {
    const at = (combo: number) => banishVoices(combo).map((v) => v.hz);
    const [r0, third, fifth, octave] = at(0);
    expect(r0).toBeCloseTo(261.63, 2);
    expect([third / r0, fifth / r0, octave / r0]).toEqual([1.25, 1.5, 2]);
    expect(at(1)[0] / r0).toBeCloseTo(2 ** (1 / 12), 6);
    expect(at(12)[0] / r0).toBeCloseTo(2, 6);
    expect(at(40)[0]).toBe(at(12)[0]);
    expect(at(-3)[0]).toBe(at(0)[0]);
    expect(banishVoices(3).every((v) => v.type === "triangle" && v.gain <= 0.1)).toBe(true);
  });

  it("interference is a beating pair a semitone apart plus a tritone buzz, quiet and short", () => {
    const [a, b, c] = INTERFERENCE_VOICES;
    expect(b.hz / a.hz).toBeCloseTo(2 ** (1 / 12), 2);
    expect(c.hz / a.hz).toBeCloseTo(2 ** (6 / 12), 1);
    for (const v of INTERFERENCE_VOICES) {
      expect(v.gain).toBeLessThanOrEqual(0.05);
      expect(v.dur).toBeLessThan(0.5);
    }
  });

  it("maps every sound to its voices", () => {
    expect(voicesFor("banish", 2)).toEqual(banishVoices(2));
    expect(voicesFor("interference")).toBe(INTERFERENCE_VOICES);
    expect(voicesFor("lifeLost")).toBe(LIFE_LOST_VOICES);
    expect(voicesFor("gameOver")).toBe(GAME_OVER_VOICES);
    expect(voicesFor("wave")).toBe(WAVE_VOICES);
    expect(GAME_OVER_VOICES.map((v) => v.hz)).toEqual([110, 130.81, 164.81, 220]);
    for (const v of [...INTERFERENCE_VOICES, ...LIFE_LOST_VOICES, ...GAME_OVER_VOICES, ...WAVE_VOICES, ...banishVoices(5)]) expect(v.gain).toBeLessThan(0.1);
  });

  it("plays one oscillator per voice, at the voice's pitch and wave, and shares one AudioContext", () => {
    const { Ctx, oscillators, count } = fakeAudio();
    expect(playRite("banish", true, 2, Ctx)).toBe(true);
    expect(oscillators.map((o) => [o.type, o.hz])).toEqual(banishVoices(2).map((v) => [v.type, v.hz]));
    expect(playRite("interference", true, 0, Ctx)).toBe(true);
    expect(oscillators).toHaveLength(4 + INTERFERENCE_VOICES.length);
    expect(oscillators.slice(4).map((o) => o.type)).toEqual(["sawtooth", "sawtooth", "square"]);
    expect(count()).toBe(1);
  });

  it("does nothing when sound is off or the browser has no Web Audio", () => {
    const { Ctx, count } = fakeAudio();
    expect(playRite("banish", false, 0, Ctx)).toBe(false);
    expect(playRite("banish", true, 0, null)).toBe(false);
    expect(count()).toBe(0);
  });

  it("releases the audio device when the game leaves the screen", () => {
    const { Ctx, closed } = fakeAudio();
    playRite("wave", true, 0, Ctx);
    closeRiteAudio();
    closeRiteAudio();
    expect(closed()).toBe(1);
  });
});

describe("camera errors", () => {
  const openWith = (w: object | undefined, nav: object) => {
    vi.stubGlobal("window", w);
    vi.stubGlobal("navigator", nav);
    return openRiteCamera({ video: {} as HTMLVideoElement, layouts: SEANCE_RITE_LAYOUTS, onFrame: () => undefined });
  };
  const fails = (kind: string) => expect.objectContaining({ name: "CameraError", kind });

  it("says why the camera cannot open", async () => {
    await expect(openWith({ isSecureContext: false }, {})).rejects.toEqual(fails("INSECURE_CONTEXT"));
    await expect(openWith({ isSecureContext: true }, {})).rejects.toEqual(fails("UNSUPPORTED"));
    const deny = (name: string) => ({ mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error("x"), { name })) } });
    await expect(openWith({ isSecureContext: true }, deny("NotAllowedError"))).rejects.toEqual(fails("PERMISSION_DENIED"));
    await expect(openWith({ isSecureContext: true }, deny("SecurityError"))).rejects.toEqual(fails("PERMISSION_DENIED"));
    await expect(openWith({ isSecureContext: true }, deny("NotFoundError"))).rejects.toEqual(fails("NO_CAMERA"));
    await expect(openWith({ isSecureContext: true }, deny("AbortError"))).rejects.toEqual(fails("UNKNOWN"));
    await expect(openWith({ isSecureContext: true }, deny("NotAllowedError"))).rejects.toBeInstanceOf(CameraError);
  });

  it("lets go of the camera if the video cannot start", async () => {
    const track = { stop: vi.fn() };
    const video = { srcObject: null as unknown, muted: false, playsInline: false, play: () => Promise.reject(new Error("blocked")) };
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) } });
    await expect(openRiteCamera({ video: video as unknown as HTMLVideoElement, layouts: SEANCE_RITE_LAYOUTS, onFrame: () => undefined })).rejects.toBeInstanceOf(CameraError);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });
});

describe("the live camera loop", () => {
  /** A video element whose picture is whatever raster `show` holds, drawn through a fake canvas. */
  function rig(initial: RasterImage) {
    let shown = initial;
    const track = { stop: vi.fn() };
    const video = { srcObject: null as unknown, muted: false, playsInline: false, readyState: 4, videoWidth: initial.width, videoHeight: initial.height, play: () => Promise.resolve() };
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => undefined, getImageData: () => ({ data: shown.data }) }) };
    vi.useFakeTimers();
    vi.stubGlobal("window", { isSecureContext: true, setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms), clearTimeout: (id: number) => globalThis.clearTimeout(id) });
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) } });
    const frames: RiteFrame[] = [];
    return {
      video,
      track,
      frames,
      show: (r: RasterImage) => {
        shown = r;
        video.videoWidth = r.width;
        video.videoHeight = r.height;
      },
      open: () => openRiteCamera({ video: video as unknown as HTMLVideoElement, layouts: SEANCE_RITE_LAYOUTS, onFrame: (f) => frames.push(f) }),
    };
  }
  const letter = SEANCE_RITE_LAYOUTS[1];
  const a4 = SEANCE_RITE_LAYOUTS[0];

  it("decodes a frame every 100 ms, finds the paper size, and reads covers live", async () => {
    const empty = photographSvg(letter, riteSheetSvg(letter));
    const covered = photographSvg(letter, sheetWithCover(letter, 7, "#111111", 1, 1));
    const r = rig(empty);
    const cam = await r.open();
    expect(r.video.srcObject).not.toBeNull();
    expect(r.frames).toHaveLength(0);

    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames).toHaveLength(1);
    expect(r.frames[0].result.ok).toBe(true);
    // A Letter print is not read as A4: the first frames try both and keep the better fit.
    expect(r.frames[0].layout.page).toBe("Letter");
    expect(coverageFromScan(r.frames[0].result)!.every((c) => c < 0.05)).toBe(true);

    r.show(covered);
    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames).toHaveLength(2);
    const cover = coverageFromScan(r.frames[1].result)!;
    expect(cover[7]).toBeGreaterThanOrEqual(PERFECT);
    expect(r.frames[1].layout.page).toBe("Letter");
    expect(r.frames[1].ms).toBeGreaterThanOrEqual(0);

    cam.stop();
  });

  it("picks A4 for an A4 print", async () => {
    const r = rig(photographSvg(a4, riteSheetSvg(a4)));
    const cam = await r.open();
    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames[0].layout.page).toBe("A4");
    cam.stop();
  });

  it("reports a frame with no sheet in view as a failed decode, then recovers", async () => {
    const blank: RasterImage = { width: 400, height: 500, data: new Uint8ClampedArray(400 * 500 * 4).fill(120) };
    const r = rig(blank);
    const cam = await r.open();
    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames[0].result.ok).toBe(false);
    expect(coverageFromScan(r.frames[0].result)).toBeNull();
    r.show(photographSvg(a4, riteSheetSvg(a4)));
    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames[1].result.ok).toBe(true);
    cam.stop();
  });

  it("can pause decoding without closing the camera", async () => {
    const r = rig(photographSvg(a4, riteSheetSvg(a4)));
    const cam = await r.open();
    cam.setActive(false);
    vi.advanceTimersByTime(RITE_INTERVAL_MS * 5);
    expect(r.frames).toHaveLength(0);
    expect(r.track.stop).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    cam.setActive(true);
    vi.advanceTimersByTime(RITE_INTERVAL_MS);
    expect(r.frames).toHaveLength(1);
    cam.stop();
  });

  it("stops the timer, the camera tracks and the video on stop, and stop is safe to call twice", async () => {
    const r = rig(photographSvg(a4, riteSheetSvg(a4)));
    const cam = await r.open();
    vi.advanceTimersByTime(RITE_INTERVAL_MS * 3);
    expect(r.frames.length).toBeGreaterThanOrEqual(3);
    expect(vi.getTimerCount()).toBe(1);
    const seen = r.frames.length;
    cam.stop();
    cam.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(r.track.stop).toHaveBeenCalledTimes(1);
    expect(r.video.srcObject).toBeNull();
    vi.advanceTimersByTime(RITE_INTERVAL_MS * 10);
    expect(r.frames).toHaveLength(seen);
  });
});
