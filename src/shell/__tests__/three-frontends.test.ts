import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../scripts/lib/photo";
import { RUNE_PALETTE } from "../../apps/seance-cipher/theme";
import { chapterLayouts } from "../../apps/seance-cipher/layout";
import { SEANCE_SAMPLE_SPECS } from "../../apps/seance-cipher/samples/specs";
import { STUDY_SAMPLE_SPECS } from "../../apps/study-bridge/samples/specs";
import { ELDER_SAMPLE_SPECS } from "../../apps/elder-care/samples/specs";
import { ELDER_LAYOUTS } from "../../apps/elder-care/layout";
import { STUDY_LAYOUTS } from "../../apps/study-bridge/layout";
import { decode, type BubbleReading } from "../../core";
import { LauncherBar } from "../App";
import { APPS, HOME_ID, routableApps } from "../app-registry";
import { CHORD_DURATION, CHORD_NOTES, playHarmonicChord, resetAudioForTests } from "../audio-cues";
import { batchSummary, processBatch } from "../batch";
import { HumanVerifyControl, verifiedCount } from "../components/HumanVerifyControl";
import { XRayOverlay } from "../components/XRayOverlay";
import { RouteContext } from "../route-context";
import { routeRaster } from "../route";
import { xrayModel } from "../xray";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const jpg = (app: string, file: string) => decodeJpeg(readFileSync(join(__dirname, "../../apps", app, "samples", file)));

describe("Scan Any Card routes all 3 card families", () => {
  it("routes real sample photos of each app to that app, on both papers", () => {
    const apps = routableApps();
    expect(apps.map((a) => a.id)).toEqual(["elder-care", "study-bridge", "seance-cipher"]);
    const cases = [
      ["elder-care", ELDER_LAYOUTS, ELDER_SAMPLE_SPECS[1]],
      ["study-bridge", STUDY_LAYOUTS, STUDY_SAMPLE_SPECS[1]],
      ["seance-cipher", chapterLayouts(2), SEANCE_SAMPLE_SPECS[0]],
    ] as const;
    for (const [id, layouts, spec] of cases)
      for (const printed of layouts) {
        const r = routeRaster(decodeJpeg(encodeJpeg(photographSample(printed, spec))), apps);
        expect({ id, page: printed.page, routed: r.ok ? [r.app.id, r.layout.page] : r.reason }).toEqual({ id, page: printed.page, routed: [id, printed.page] });
      }
  });

  it("decodes a 3-app batch in one go, isolating each app's card", async () => {
    const run = await processBatch(
      [
        { name: "missed-dose.jpg", load: async () => jpg("elder-care", "missed-dose.jpg") },
        { name: "lantern-hall.jpg", load: async () => jpg("seance-cipher", "lantern-hall.jpg") },
        { name: "sam-review.jpg", load: async () => jpg("study-bridge", "sam-review.jpg") },
        { name: "smudged-seance.jpg", load: async () => jpg("seance-cipher", "smudged-seance.jpg") },
      ],
      routableApps(),
    );
    expect(run.items.map((i) => [i.fileName, i.appId, i.status])).toEqual([
      ["missed-dose.jpg", "elder-care", "review"],
      ["lantern-hall.jpg", "seance-cipher", "ready"],
      ["sam-review.jpg", "study-bridge", "ready"],
      ["smudged-seance.jpg", "seance-cipher", "review"],
    ]);
    expect(batchSummary(run)).toMatch(/^4 cards decoded locally in \d+ ms: 2 ready, 2 need human review\.$/);
    expect(APPS.find((a) => a.id === "seance-cipher")!.batch!.actionLabel(2)).toBe("Save 2 readings to the Grimoire");
  });
});

describe("Paper-size fit on a widely spaced card (regression)", () => {
  it("the smudged A4 Seance card is read with the A4 layout: ring alignment beats the unclear-mark count", async () => {
    const { decodeBestFit, fitScore, ringAlignment } = await import("../route");
    const photo = jpg("seance-cipher", "smudged-seance.jpg");
    const [a4, letter] = chapterLayouts(1);
    const ra = decode(photo, a4);
    const rl = decode(photo, letter);
    if (!ra.ok || !rl.ok) throw new Error("both papers lock onto the corners");
    // The wrong paper looks cleaner by the old rule (0 unclear, 1 mark), so it used to win...
    expect(fitScore(rl)[0]).toBeLessThan(fitScore(ra)[0]);
    expect(rl.bubbles.filter((b) => b.state === "filled")).toHaveLength(1);
    // ...but its rings land on blank paper.
    expect(ringAlignment(photo, ra, a4)).toBeGreaterThan(ringAlignment(photo, rl, letter) + 0.5);
    const best = decodeBestFit(photo, chapterLayouts(1));
    expect(best.layout.page).toBe("A4");
    expect(best.result).toEqual(ra);
  });

  it("every Seance sample on both papers, under every sample camera, reads as drawn", () => {
    const apps = routableApps();
    const cams = [...ELDER_SAMPLE_SPECS, ...STUDY_SAMPLE_SPECS, ...SEANCE_SAMPLE_SPECS].map((x) => x.camera);
    for (const spec of SEANCE_SAMPLE_SPECS)
      for (const [ci, camera] of cams.entries())
        for (const printed of chapterLayouts(1)) {
          const r = routeRaster(decodeJpeg(encodeJpeg(photographSample(printed, { ...spec, camera }))), apps);
          const where = { spec: spec.id, camera: ci, page: printed.page };
          expect({ ...where, page: r.ok ? r.layout.page : r.reason }).toEqual(where);
          if (!r.ok) continue;
          const states = new Map(r.result.bubbles.map((b) => [`${b.group}/${b.row}/${b.col}`, b.state]));
          for (const m of spec.marks) expect({ ...where, key: m.key, state: states.get(m.key) }).toEqual({ ...where, key: m.key, state: m.style === "faint" ? "ambiguous" : "filled" });
          expect({ ...where, extra: [...states].filter(([k, st]) => st !== "blank" && !spec.marks.some((m) => m.key === k)) }).toEqual({ ...where, extra: [] });
        }
  });
});

describe("Skeleton Crew Launcher Bar", () => {
  it("is one slim header: the PaperBridge mark (Skeleton Home), 3 app pills and How Skeleton Works", () => {
    const html = strip(renderToString(createElement(LauncherBar, { current: "seance-cipher" })));
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="#home" aria-label="PaperBridge: Skeleton Home"/);
    const pills = [...html.matchAll(/<a href="#([a-z-]+)"[^>]*>(?:<span[^>]*><\/span>)?([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(pills).toEqual([
      ["elder-care", "Elder Care Bridge"],
      ["study-bridge", "Study Bridge"],
      ["seance-cipher", "Seance Cipher"],
    ]);
    expect(html).toMatch(/href="#seance-cipher" aria-current="page"/);
    expect(html).toContain("How Skeleton Works</button>");
    expect(strip(renderToString(createElement(LauncherBar, { current: HOME_ID })))).toMatch(/href="#home" aria-current="page"/);
  });
});

describe("3 distinct frontends on the same primitives", () => {
  const render = async (id: string) => {
    const app = APPS.find((a) => a.id === id)!;
    // React hoists image preloads to the front of the HTML; the page itself starts after them.
    return strip(renderToString(createElement(RouteContext.Provider, { value: () => {} }, createElement(app.Component)))).replace(/^(<link[^>]*>)+/, "");
  };

  it("each app draws its own full-width page with its own identity", async () => {
    const elder = await render("elder-care");
    const study = await render("study-bridge");
    const seance = await render("seance-cipher");
    // Elder Care: a cream caregiver sheet on a linen desk. Study Bridge: a ruled gradebook page.
    expect(elder).toMatch(/^<div class="[^"]*bg-\[#F4EFE6\][^"]*"( style="[^"]*")? data-frontend="elder-care"/);
    expect(elder).toContain("care-sheet");
    expect(elder).toContain("bg-[#FAF8F5]");
    expect(study).toMatch(/^<div class="[^"]*bg-\[#FCFBF7\][^"]*"( style="[^"]*")? data-frontend="study-bridge"/);
    expect(study).toContain("grade-book");
    expect(seance).toMatch(/^<div class="on-dark[^"]*" style="background:radial-gradient\(ellipse at top, #1a1d27 0%, #0B0D12 60%\)" data-frontend="seance-cipher"/);
    expect(study).toContain('aria-label="Score telemetry"');
    expect(study).toContain("Live Scan");
    expect(seance).toContain("Haunted sample cards (no printer needed)");
    expect(seance).toContain("Print Chapter 1 Card");
    for (const a of APPS) expect(a.fullBleed).toBe(true);
  });

  for (const id of ["elder-care", "study-bridge", "seance-cipher"])
    it(`${id}: keyboard-ready markup: one h1, native controls only, no positive tabindex, every button named`, async () => {
      const html = await render(id);
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html).not.toMatch(/tabindex="[1-9]/);
      expect(html).not.toMatch(/<div[^>]*onclick/i);
      for (const m of html.matchAll(/<button[^>]*>(.*?)<\/button>/g)) {
        const text = m[1].replace(/<[^>]+>/g, "").trim();
        const label = /aria-label="([^"]+)"/.exec(m[0])?.[1];
        expect({ button: m[0].slice(0, 80), named: !!(text || label) }).toMatchObject({ named: true });
      }
      // Every frontend has the shared webcam, upload and audio controls and Scan Any Card.
      expect(html).toContain("Scan with webcam");
      expect(html).toContain("Upload a photo");
      expect(html).toMatch(/aria-pressed="true"[^>]*>.*?Audio cues<\/button>/);
      expect(html).toContain("Scan Any Card (Auto-Route)");
    });
});

describe("Optical primitives", () => {
  const scan = decode(jpg("seance-cipher", "smudged-seance.jpg"), chapterLayouts(1)[0]);
  if (!scan.ok) throw new Error("sample");
  const unclear = scan.bubbles.filter((b) => b.state === "ambiguous") as BubbleReading[];

  it("HumanVerifyControl offers Mark filled / Mark blank, then stamps HUMAN VERIFIED", () => {
    const before = strip(renderToString(createElement(HumanVerifyControl, { unclear, overrides: {}, onSet: () => {} })));
    expect(before).toContain("(0 of 1 checked)");
    expect(before).toContain('aria-label="Mark filled: q2/rune/moon"');
    const after = strip(renderToString(createElement(HumanVerifyControl, { unclear, overrides: { "q2/rune/moon": "filled" }, onSet: () => {} })));
    expect(after).toContain("(1 of 1 checked)");
    expect(after).toMatch(/data-stamp="true">.*Human verified: filled/);
    expect(after).toContain(">Undo</button>");
    expect(verifiedCount(unclear, { "q2/rune/moon": "blank" })).toBe(1);
    expect(renderToString(createElement(HumanVerifyControl, { unclear: [], overrides: {}, onSet: () => {} }))).toBe("");
  });

  it("the X-Ray takes an app palette: Seance Cipher's runes glow emerald and amber", () => {
    const m = xrayModel(scan, chapterLayouts(1)[0])!;
    const svg = renderToString(createElement(XRayOverlay, { model: m, width: 878, height: 1066, palette: RUNE_PALETTE }));
    expect(svg).toContain('data-glow="on"');
    expect(svg).toContain("<feGaussianBlur");
    expect(svg).toContain('stroke="#34d399"');
    expect(svg).toContain('stroke="#fbbf24"');
    expect(renderToString(createElement(XRayOverlay, { model: m, width: 878, height: 1066 }))).not.toContain("feGaussianBlur");
  });

  it("the harmonic chord is 4 triangle-wave notes, off when audio cues are off", () => {
    resetAudioForTests();
    const notes: number[] = [];
    class Ctx {
      currentTime = 0;
      state = "running";
      destination = {};
      createOscillator() {
        return { type: "", frequency: { setValueAtTime: (hz: number) => notes.push(hz) }, connect: (g: unknown) => g, start: () => undefined, stop: () => undefined };
      }
      createGain() {
        return { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => undefined };
      }
      resume() {
        return Promise.resolve();
      }
    }
    expect(playHarmonicChord(false, Ctx as never)).toBe(false);
    expect(playHarmonicChord(true, Ctx as never)).toBe(true);
    expect(notes).toEqual(CHORD_NOTES.map((n) => n.hz));
    expect(CHORD_DURATION).toBeLessThan(2.5);
    expect(playHarmonicChord(true, null)).toBe(false);
    resetAudioForTests();
  });
});
