import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignOffStamp } from "../../apps/elder-care/components/SignOffStamp";
import { CARE_CSS, Field, PaperClip } from "../../apps/elder-care/components/CareSheet";
import { GRADE_CSS, Telemetry, TopicMastery } from "../../apps/study-bridge/components/Studio";
import { LaunchPad } from "../../apps/seance-cipher/RitePads";
import { RiteGame, WaveBanner } from "../../apps/seance-cipher/RiteGame";
import { RITE_FLUID_CSS } from "../../apps/seance-cipher/theme";
import { ARTIFACTS, ArtifactRow } from "../components/HomeArtifacts";
import { GhostGuide, GhostShape } from "../components/HomeGhosts";
import { HEADLINE, HOME_MOTION_CSS } from "../components/HomeMotion";
import { DecodePipeline } from "../components/DecodePipeline";
import { XRayOverlay } from "../components/XRayOverlay";
import { LauncherBar } from "../App";
import { MOTION_CSS } from "../motion/motion-css";
import { MotionStyle } from "../motion/MotionStyle";
import { SPRINGS } from "../motion/spring";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const EM_DASH = /[\u2013\u2014]/;
const render = (el: Parameters<typeof renderToString>[0]) => strip(renderToString(el));

/** Every `@media (... prefers-reduced-motion: no-preference) { ... }` block of a stylesheet, with its brace-balanced body. */
function guardedBlocks(css: string): { start: number; end: number; header: string; body: string }[] {
  const out: { start: number; end: number; header: string; body: string }[] = [];
  for (const m of css.matchAll(/@media[^{]*prefers-reduced-motion: no-preference\)\s*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const bodyStart = i;
    for (; i < css.length && depth; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
    out.push({ start: m.index!, end: i, header: m[0], body: css.slice(bodyStart, i - 1) });
  }
  return out;
}
const calm = (css: string) => guardedBlocks(css).map((b) => b.body).join("\n");
const outside = (css: string) => guardedBlocks(css).reduceRight((acc, b) => acc.slice(0, b.start) + acc.slice(b.end), css);

describe("every motion rule is behind prefers-reduced-motion: no-preference", () => {
  const sheets = { MOTION_CSS, HOME_MOTION_CSS, RITE_FLUID_CSS, CARE_CSS, GRADE_CSS };
  for (const [name, css] of Object.entries(sheets))
    it(`${name}: no animation, keyframe or transition runs outside the guard, and the copy has no em dashes`, () => {
      const free = outside(css.replace(/\/\*[\s\S]*?\*\//g, ""));
      // Strip the vt-* rules that only say "animation: none" and the explicit reduced-motion blocks.
      const reducedBlocks = free.replace(/@media \(prefers-reduced-motion: reduce\)[^{]*\{[\s\S]*?\}\s*\}?/g, "");
      const moving = [...reducedBlocks.matchAll(/(^|[;{\s])(animation|transition)\s*:\s*([^;}]+)/g)].filter((m) => !/^none\b/.test(m[3].trim()) && !/^opacity 600ms/.test(m[3].trim()));
      expect(moving.map((m) => m[0].trim())).toEqual([]);
      expect(css).not.toMatch(EM_DASH);
      expect(css).not.toMatch(/outline\s*:/);
    });

  it("the shared sheet also switches every entrance off for reduced motion", () => {
    expect(MOTION_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.m-rise, \.m-pop, \.m-slam, \.m-word, \.m-deal, \.m-sweep, \.m-hop \{ animation: none; \}/);
  });

  it("entrance keyframes only name their from state, so a stamp or paper keeps its own tilt", () => {
    for (const k of ["m-rise", "m-pop", "m-slam", "m-word", "m-deal", "m-sweep", "xray-lock", "xray-ring", "rite-bump", "care-swing", "care-impress"]) {
      const css = [MOTION_CSS, RITE_FLUID_CSS, CARE_CSS].join("\n");
      const body = new RegExp(`@keyframes ${k} \\{([^@]*?\\})\\s*\\}`).exec(css)?.[1] ?? "";
      expect(body, k).toContain("from");
      expect(body, k).not.toMatch(/\bto \{/);
    }
  });

  it("animates only compositor properties (transform family, opacity, clip-path, filter), never layout", () => {
    for (const css of Object.values(sheets))
      for (const m of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)) expect(m[1]).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\s*:/);
  });
});

describe("the shared motion stylesheet", () => {
  it("publishes every spring and the iris page transition from the pressed point", () => {
    const html = render(createElement(MotionStyle));
    for (const n of Object.keys(SPRINGS)) expect(html).toContain(`--spring-${n}: linear(`);
    expect(MOTION_CSS).toMatch(/clip-path: circle\(0px at var\(--vt-x/);
    expect(MOTION_CSS).toMatch(/::view-transition-new\(root\) \{ animation: vt-iris/);
    expect(MOTION_CSS).toMatch(/::view-transition-old\(root\) \{ animation: vt-recede/);
  });

  it("keeps the keyboard ring 4 px: it springs its offset only, and never touches pads or animated controls", () => {
    expect(MOTION_CSS).toMatch(/@keyframes m-focus \{ from \{ outline-offset: 10px; \} to \{ outline-offset: 3px; \} \}/);
    expect(MOTION_CSS).not.toMatch(/outline-width|outline: /);
    expect(MOTION_CSS).toContain(':not([class*="animate"])');
    expect(MOTION_CSS).toContain(":not([data-rune])");
  });
});

describe("launcher bar: one pill that glides", () => {
  it("server-renders the open link with its own yellow (no flash before the pill is measured) and no pill yet", () => {
    const html = render(createElement(LauncherBar, { current: "study-bridge" }));
    expect(html).toMatch(/<nav aria-label="Apps" data-pill="off"/);
    expect(html).not.toContain("nav-pill");
    expect(html).toMatch(/href="#study-bridge" aria-current="page" class="relative z-10[^"]*bg-yellow-300/);
    expect(html).not.toMatch(/href="#elder-care"[^>]*bg-yellow-300/);
  });
  it("the pill springs transform and size, and only once it has been measured", () => {
    expect(MOTION_CSS).toMatch(/\[data-pill-ready\] \.nav-pill \{ transition: transform var\(--spring-snappy-ms\) var\(--spring-snappy\)/);
    expect(MOTION_CSS).toMatch(/\.nav-pill \{[^}]*background: #fde047/);
  });
});

describe("Skeleton Home: the first 3 seconds", () => {
  it("splits the headline into 6 word springs in order, accenting the last three", () => {
    expect(HEADLINE.map((w) => w.t).join(" ")).toBe("One Optical Engine. Three Distinct Worlds.");
    expect(HEADLINE.filter((w) => "accent" in w)).toHaveLength(3);
  });
  it("papers are dealt when they scroll into view, in order, and each one catches the light", () => {
    const html = render(createElement(ArtifactRow, { ids: ARTIFACTS.map((a) => a.id), onHint: () => undefined }));
    expect([...html.matchAll(/--i:(\d)/g)].map((m) => m[1])).toEqual(["0", "1", "2"]);
    expect([...html.matchAll(/home-artifact m-deal/g)]).toHaveLength(3);
    expect([...html.matchAll(/class="tilt-glare/g)]).toHaveLength(3);
    expect([...html.matchAll(/data-no-tactile/g)]).toHaveLength(3);
    expect(HOME_MOTION_CSS).toContain(".home-artifact.m-deal { animation-play-state: paused; }");
    expect(HOME_MOTION_CSS).toContain('[data-seen="true"] .home-artifact.m-deal { animation-play-state: running; }');
  });
  it("the scan line is hidden until motion is allowed, and the pencil grid glows only where the pointer is", () => {
    expect(HOME_MOTION_CSS.startsWith("\n.home-scan { display: none; }")).toBe(true);
    expect(HOME_MOTION_CSS).toMatch(/\.home-grid-glow \{[^}]*mask-image: radial-gradient\(circle 230px at var\(--mx/);
    expect(MOTION_CSS).toContain('[data-lit="true"] .lit-layer { opacity: 1; }');
  });
  it("papers lean with perspective on desktop only, never for reduced motion", () => {
    expect(outside(HOME_MOTION_CSS)).not.toContain("perspective");
    expect(HOME_MOTION_CSS).toMatch(/@media \(min-width: 1024px\) and \(prefers-reduced-motion: no-preference\) \{\s*\.home-artifact \{ transform: perspective\(1100px\)/);
  });
  it("the guide's eyes follow the pointer and it hops when the hint changes", () => {
    const html = render(createElement(GhostGuide, { hint: "elder-care" }));
    expect(html).toContain('class="ghost-eyes"');
    expect(html).toContain("m-hop");
    expect(html).toContain("guide-pop");
    expect(render(createElement(GhostShape, { className: "h-4 w-4" }))).not.toContain("ghost-eyes");
    expect(HOME_MOTION_CSS).toContain(".ghost-eyes { transform: translate(calc(var(--px, 0) * 2.8px)");
  });
});

describe("Elder Care: calm and physical", () => {
  it("the clip swings once, the sheet fields settle in order, and nothing loops", () => {
    expect(render(createElement(PaperClip))).toContain("care-clip");
    const f = render(createElement(Field, { n: 2, id: "x", title: "How the week went", children: "body" }));
    expect(f).toContain("m-rise");
    expect(f).toContain("--i:2");
    expect(CARE_CSS).toMatch(/\.care-clip \{ animation: care-swing[^}]*both; \}/);
    expect(CARE_CSS).not.toMatch(/infinite/);
    expect(CARE_CSS).toMatch(/\.stamp-ready \.stamp-head \{ animation: care-nudge 2\.4s ease-in-out 3; \}/);
  });
  it("the stamp invites a press only when every faint mark is checked", () => {
    expect(render(createElement(SignOffStamp, { pending: 0, when: new Date("2026-11-02T12:00:00Z") }))).toContain("stamp-ready");
    expect(render(createElement(SignOffStamp, { pending: 2, when: new Date("2026-11-02T12:00:00Z") }))).not.toContain("stamp-ready");
  });
  it("the press springs, and the impression lands on its own -6 degree tilt", () => {
    const html = render(createElement(SignOffStamp, { pending: 0, when: new Date() }));
    expect(html).toContain("transition-duration:var(--spring-snappy-ms, 300ms)");
    expect(CARE_CSS).toMatch(/@keyframes care-impress \{ from \{ opacity: 0; scale: 1\.9; filter: blur\(3px\); \} \}/);
    expect(CARE_CSS).toContain(".stamp-ink { display: none; }");
  });
});

describe("Study Bridge: ink and highlighter", () => {
  it("score stamps slam in one after another, and are replayed when a value changes", () => {
    const html = render(createElement(Telemetry, { items: [{ label: "Score", value: "60%", tone: "red" }, { label: "Correct", value: "6/10", tone: "blue" }] }));
    expect([...html.matchAll(/m-slam/g)]).toHaveLength(2);
    expect(html).toContain("--i:0");
    expect(html).toContain("--i:1");
    expect(html).toContain("rotate(-1.6deg)");
  });
  it("highlighter bars sweep in from the left, staggered by topic", () => {
    const report = { topics: [{ topic: "Fractions", correct: 1, total: 3, pct: 33, weak: true }, { topic: "Algebra", correct: 3, total: 3, pct: 100, weak: false }] };
    const html = render(createElement(TopicMastery, { report: report as never }));
    expect([...html.matchAll(/m-sweep/g)]).toHaveLength(2);
    expect(html).toMatch(/data-marker="weak"[^>]*--i:0/);
    expect(html).toMatch(/data-marker="mastered"[^>]*--i:1/);
    expect(MOTION_CSS).toContain("@keyframes m-sweep { from { scale: 0 1; } }");
  });
  it("the title underline draws itself, and is solid for reduced motion", () => {
    expect(GRADE_CSS).toMatch(/\.study-draw \{ stroke-dasharray: none; \}/);
    expect(calm(GRADE_CSS)).toMatch(/\.study-draw \{ stroke-dasharray: 1; animation: study-draw 900ms/);
  });
});

describe("X-Ray Rite: obsidian glass", () => {
  const noop = () => undefined;
  const pads = (bursts: { id: number; rune: number }[]) => render(createElement(LaunchPad, { targets: [], coverage: [], bursts, onPress: noop, onRelease: noop }));
  const pad = (html: string, i: number) => new RegExp(`<button[^>]*data-rune="${i}"[^>]*>[\\s\\S]*?</button>`).exec(html)![0];

  it("a banish releases a soul and 6 sparks from that pad only", () => {
    const html = pads([{ id: 7, rune: 3 }]);
    expect(pad(html, 3).match(/data-soul="true"/g)).toHaveLength(1);
    expect(pad(html, 3).match(/data-spark="true"/g)).toHaveLength(6);
    expect(pad(html, 2)).not.toContain("data-soul");
    expect(pads([])).not.toContain("data-spark");
  });
  it("every pad has a lens of light that follows the pointer, and the lens is decoration", () => {
    const html = pads([]);
    expect([...html.matchAll(/class="rite-lens /g)]).toHaveLength(12);
    expect(html).not.toMatch(/<span[^>]*rite-lens[^>]*>[^<]+</);
    expect(RITE_FLUID_CSS).toContain("[data-rune]:hover .rite-lens { opacity: 1; background: radial-gradient(circle 90px at var(--lx");
  });
  it("the stage is a stacking context with the aurora behind it, and the animated bits are inert", () => {
    const html = render(createElement(RiteGame));
    expect(html).toMatch(/class="relative isolate flex/);
    expect(html).toMatch(/aria-hidden="true" class="rite-aurora pointer-events-none absolute inset-0 -z-10/);
    expect(RITE_FLUID_CSS).toContain(".rite-aurora { display: none; }");
    expect(RITE_FLUID_CSS).toMatch(/\.rite-hurt \{ display: block; animation: rite-hurt 700ms ease-out both; \}/);
  });
  it("the wave banner slams the wave number in and pops each rune in turn", () => {
    const html = render(createElement(WaveBanner, { wave: 4, names: "Skull and Bat", runes: [0, 1] }));
    expect(html).toContain("m-slam");
    expect([...html.matchAll(/m-pop/g)]).toHaveLength(2);
    expect(html).toContain("--i:1");
  });
  it("nothing flashes: the life-lost vignette fades once in 700 ms and the shake lasts 420 ms", () => {
    expect(RITE_FLUID_CSS).toMatch(/\.rite-shake \{ animation: rite-shake 420ms ease-out both; \}/);
    expect(RITE_FLUID_CSS).not.toMatch(/infinite[^;]*;[^}]*rite-hurt/);
  });
});

describe("scanning", () => {
  it("the X-Ray locks onto each corner in turn and rings in every bubble", () => {
    const model = {
      corners: ["top-left", "top-right", "bottom-right", "bottom-left"].map((name, i) => ({ name, x: i * 10, y: i * 10, size: 8 })),
      bubbles: [{ key: "a/b/c", x: 5, y: 5, r: 3, state: "filled", score: "0.90" }, { key: "a/b/d", x: 15, y: 5, r: 3, state: "blank", score: "0.02" }],
      counts: { filled: 1, unclear: 0, blank: 1 },
      pxPerMm: 1,
    };
    const html = render(createElement(XRayOverlay, { model: model as never, width: 100, height: 100 }));
    expect([...html.matchAll(/class="xray-lock"/g)]).toHaveLength(4);
    expect([...html.matchAll(/xray-ring/g)]).toHaveLength(2);
    expect(html).toContain("--i:3");
    expect(html).toContain("group pointer-events-auto");
  });
  it("pipeline steps rise in order and their icons pop when a step changes state", () => {
    const steps = [
      { id: "input", label: "1. Photo Input", status: "done", detail: "ok" },
      { id: "unwarp", label: "2. Optical Unwarp", status: "active", detail: "" },
      { id: "output", label: "3. Verified Output", status: "waiting", detail: "" },
    ];
    const html = render(createElement(DecodePipeline, { steps: steps as never }));
    expect([...html.matchAll(/class="m-rise flex/g)]).toHaveLength(3);
    expect([...html.matchAll(/class="m-pop mt-0\.5/g)]).toHaveLength(3);
    expect(html).toContain("--i:2");
  });
});
