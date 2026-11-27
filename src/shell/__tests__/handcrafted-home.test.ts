import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ARTIFACTS, ArtifactRow } from "../components/HomeArtifacts";
import { DRIFTERS, DriftingGhosts, GhostGuide, GUIDE_HINTS, hintFor, HOME_CSS } from "../components/HomeGhosts";
import { HOME_STEPS, SkeletonHome } from "../components/SkeletonHome";
import { RouteContext } from "../route-context";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const text = (h: string) => strip(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const EM_DASH = /[\u2013\u2014]/;

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("Skeleton Home: the haunted drafting table", () => {
  const home = strip(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, createElement(SkeletonHome))));

  it("is a dark #090C14 desk with drifting ghosts, a friendly guide, the headline and the same demo buttons", () => {
    expect(home).toContain("background-color:#090C14");
    expect(home).toContain('data-ghosts="drifting"');
    expect(home).toContain('data-guide="default"');
    // The headline is split into word spans so each word can spring in; the words are unchanged.
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(home)![1];
    expect(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).toBe("One Optical Engine. Three Distinct Worlds.");
    expect([...h1.matchAll(/<span/g)]).toHaveLength(6);
    expect(home).toContain("Run Mixed-Domain Auto-Route Demo");
    expect(home).toMatch(/Scaffold Your Next App \(<code[^>]*>npm run create-app<\/code>\)/);
    expect(home).toContain("Scan Any Card (Auto-Route)");
    expect(text(home)).not.toMatch(EM_DASH);
  });

  it("has 3 tilted physical artifacts, not 3 equal cards, each one link with its own accessible name", () => {
    const html = strip(renderToString(createElement(ArtifactRow, { ids: ["elder-care", "study-bridge", "seance-cipher"], onHint: () => undefined })));
    const kinds = [...html.matchAll(/data-artifact="(\w+)"/g)].map((m) => m[1]);
    expect(kinds).toEqual(["clipboard", "composition", "oracle"]);
    expect([...html.matchAll(/--tilt:(-?[\d.]+deg)/g)].map((m) => m[1])).toEqual(["-1.5deg", "1.2deg", "-1deg"]);
    // Uneven on purpose: different vertical offsets and unequal columns.
    expect(html).toMatch(/lg:mt-10/);
    expect(html).toMatch(/lg:mt-2/);
    expect(html).toMatch(/lg:mt-16/);
    expect(html).toContain("lg:grid-cols-[1.12fr_1fr_0.94fr]");
    for (const id of ["elder-care", "study-bridge", "seance-cipher"]) expect(html).toMatch(new RegExp(`<h2[^>]*><a href="#${id}" aria-describedby="world-${id}-desc"`));
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(ARTIFACTS.map((a) => a.tag)).toEqual(["Clinical Care", "Classroom Studio", "Physical Paper Game"]);
  });

  it("draws the clipboard with a silver and brass clip, cream paper and a teal stamp", () => {
    const html = strip(renderToString(createElement(ArtifactRow, { ids: ["elder-care"], onHint: () => undefined })));
    expect(html).toContain('id="clip-silver"');
    expect(html).toContain('id="clip-brass"');
    expect(html).toContain("bg-[#FAF6EE]");
    expect(html).toContain("border-[#0F766E]");
    expect(text(html)).toContain("Verified");
    expect(html).toContain("Unclip the clipboard");
  });

  it("draws the school sheet with a red margin line, blue rules, binder holes and a red A+ stamp", () => {
    const html = strip(renderToString(createElement(ArtifactRow, { ids: ["study-bridge"], onHint: () => undefined })));
    expect(html).toContain("bg-[#d64545]");
    expect(html).toContain("#bcd3ec");
    expect(html).toContain("bg-[#FCFBF7]");
    expect((html.match(/rounded-full bg-\[#090C14\]/g) ?? []).length).toBe(3);
    expect(html).toMatch(/border-\[#b91c1c\][^>]*>A\+</);
  });

  it("draws the oracle card in obsidian and antique gold with 4 corner filigrees and an emerald glow", () => {
    const html = strip(renderToString(createElement(ArtifactRow, { ids: ["seance-cipher"], onHint: () => undefined })));
    expect(html).toContain("bg-[#11131A]");
    expect(html).toContain("border-[#D4AF37]");
    expect(html.match(/M3 45V14C3 7 7 3 14 3h31/g)).toHaveLength(4);
    expect(html).toContain("rgba(52,211,153,0.5)");
    expect(text(html)).toContain("X-Ray Rite");
    expect(text(html)).toContain("Seance Cipher");
  });

  it("keeps the 4 px focus ring on whichever artifact holds focus", () => {
    const html = strip(renderToString(createElement(ArtifactRow, { ids: ["elder-care", "study-bridge", "seance-cipher"], onHint: () => undefined })));
    expect(html.match(/has-\[a:focus-visible\]:outline-4/g)).toHaveLength(3);
    expect(html.match(/has-\[a:focus-visible\]:outline-\[#fde047\]/g)).toHaveLength(3);
    // The stretched link hides its own outline only because the artifact draws the ring.
    expect(html.match(/focus-visible:outline-none/g)).toHaveLength(3);
  });
});

describe("the ghosts", () => {
  it("drift translucently behind everything, as decoration only", () => {
    expect(DRIFTERS.length).toBeGreaterThanOrEqual(4);
    for (const g of DRIFTERS) {
      expect(g.opacity).toBeGreaterThan(0);
      expect(g.opacity).toBeLessThanOrEqual(0.2);
      expect(parseFloat(g.drift)).toBeGreaterThanOrEqual(40);
    }
    expect(new Set(DRIFTERS.map((g) => g.top)).size).toBe(DRIFTERS.length);
    const html = strip(renderToString(createElement(DriftingGhosts)));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
    expect(html.match(/class="home-ghost /g)).toHaveLength(DRIFTERS.length);
    expect(html).not.toMatch(/<a |<button/);
  });

  it("stop moving under prefers-reduced-motion: the drift, the bob, the float and the hover tilt all switch off", () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(HOME_CSS)![1];
    expect(reduced).toMatch(/\.home-ghost, \.home-ghost > svg, \.home-guide \{ animation: none; \}/);
    expect(reduced).toMatch(/\.home-ghost \{ transform: translateX\(var\(--rest/);
    expect(reduced).toMatch(/\.home-artifact \{ transition: none; \}/);
    expect(reduced).toMatch(/\.home-artifact:hover[^{]*\{ transform: rotate\(var\(--tilt/);
    // Every ghost has a place to rest.
    for (const g of DRIFTERS) expect(g.rest).toMatch(/^\d+vw$/);
    // The only animations are transforms (cheap), never layout.
    for (const m of HOME_CSS.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*(?=@keyframes|\.)/g)) expect(m[1]).not.toMatch(/\b(width|height|top|left|margin)\b/);
  });

  it("tilt the artifacts on desktop only", () => {
    const base = HOME_CSS.slice(0, HOME_CSS.indexOf("@media (min-width: 1024px)"));
    expect(base).toMatch(/\.home-artifact \{ transform: rotate\(0deg\)/);
    expect(HOME_CSS).toMatch(/@media \(min-width: 1024px\) \{\s*\.home-artifact \{ transform: rotate\(var\(--tilt/);
  });

  it("have a guide that says something playful and helpful about each app, and about the scaffold button", () => {
    expect(hintFor(null)).toBe(GUIDE_HINTS.default);
    expect(hintFor("unknown-app")).toBe(GUIDE_HINTS.default);
    for (const id of ["elder-care", "study-bridge", "seance-cipher", "scaffold"]) {
      expect(hintFor(id)).toBe(GUIDE_HINTS[id]);
      expect(hintFor(id)).not.toBe(GUIDE_HINTS.default);
    }
    expect(hintFor("elder-care")).toMatch(/Pills/);
    expect(hintFor("study-bridge")).toMatch(/quiz/);
    expect(hintFor("seance-cipher")).toMatch(/rune/);
    expect(hintFor("scaffold")).toMatch(/one command/i);
    for (const h of Object.values(GUIDE_HINTS)) {
      expect(h).not.toMatch(EM_DASH);
      expect(h.length).toBeLessThan(120);
    }
    const html = strip(renderToString(createElement(GhostGuide, { hint: "elder-care" })));
    expect(html).toContain('data-guide="elder-care"');
    expect(html).toContain(GUIDE_HINTS["elder-care"]);
    expect(html).toContain('data-testid="guide-bubble"');
  });
});

describe("Skeleton Home meets WCAG 2.2 AA", () => {
  it("text contrast on every object and on the desk", () => {
    const pairs: [string, string, string, number][] = [
      ["clipboard ink on cream", "#134E4A", "#FAF6EE", 7],
      ["clipboard stamp on cream", "#0F766E", "#FAF6EE", 4.5],
      ["composition text on paper", "#0f172a", "#FCFBF7", 7],
      ["composition red on paper", "#b91c1c", "#FCFBF7", 4.5],
      ["composition tag on yellow", "#0f172a", "#fde68a", 7],
      ["oracle title on obsidian", "#F3EBD3", "#11131A", 7],
      ["oracle description on obsidian", "#D9CFB4", "#11131A", 7],
      ["oracle gold on obsidian", "#D4AF37", "#11131A", 4.5],
      ["oracle emerald tag on obsidian", "#a7f3d0", "#11131A", 4.5],
      ["guide bubble", "#020617", "#F8F3E6", 7],
      ["subtitle on the desk", "#cbd5e1", "#090C14", 7],
      ["amber eyebrow on the desk", "#fde68a", "#090C14", 7],
      ["white headline on the desk", "#ffffff", "#090C14", 7],
      ["inherits chips", "#e2e8f0", "#090C14", 7],
    ];
    for (const [what, fg, bg, min] of pairs) expect(contrast(fg, bg), what).toBeGreaterThanOrEqual(min);
  });

  it("focus rings: yellow on the desk, never hidden", () => {
    expect(contrast("#fde047", "#090C14")).toBeGreaterThanOrEqual(3);
    expect(HOME_CSS).not.toMatch(/outline/);
  });
});

describe("Skeleton Home: understandable by a stranger in under a minute", () => {
  const home = strip(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, createElement(SkeletonHome))));

  it("says in plain words what it does, with no account, no upload and no AI guessing", () => {
    expect(home).toContain('data-testid="home-promise"');
    const t = text(home);
    expect(t).toContain("Fill in a paper card with a pen, take one photo");
    expect(t).toMatch(/No account, no upload, no AI guessing/);
    expect(t).toMatch(/goes to a person/);
    expect(t).not.toMatch(EM_DASH);
  });

  it("shows the idea as 3 numbered steps", () => {
    expect(HOME_STEPS).toEqual(["Print a card", "Mark it with a pen", "Snap one photo"]);
    const ol = home.slice(home.indexOf('data-steps="home"'), home.indexOf("</ol>", home.indexOf('data-steps="home"')));
    expect([...ol.matchAll(/<li/g)]).toHaveLength(3);
    expect(home).toContain('aria-label="How PaperBridge works"');
  });

  it("puts the demo button before the 3 worlds, so it is above the fold", () => {
    expect(home.indexOf("Run Mixed-Domain Auto-Route Demo")).toBeGreaterThan(0);
    expect(home.indexOf("Run Mixed-Domain Auto-Route Demo")).toBeLessThan(home.indexOf('data-artifact="clipboard"'));
    expect(text(home)).toContain("One tap reads 3 real card photos on this device and sends each one to the right app.");
  });

  it("has a guide that opens by telling the visitor what to do next", () => {
    expect(GUIDE_HINTS.default).toMatch(/Pick a paper world below/);
    expect(GUIDE_HINTS.default).toMatch(/amber button/);
    expect(GUIDE_HINTS.default).not.toMatch(EM_DASH);
    expect(text(home)).toContain(GUIDE_HINTS.default);
  });
});
