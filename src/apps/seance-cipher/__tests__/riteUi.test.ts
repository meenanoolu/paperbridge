import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APPS } from "../../../shell/app-registry";
import { RouteContext } from "../../../shell/route-context";
import { SeanceCipherApp, appMeta } from "../App";
import { RITE_RUNE_NAMES, SEANCE_RITE_LAYOUTS } from "../layout";
import { LiveOverlay } from "../RiteLive";
import { LaunchPad } from "../RitePads";
import { RitePrint } from "../RitePrint";
import { RiteGame } from "../RiteGame";
import { RiteReceipt } from "../RiteReceipt";
import { PAD_KEYS, type ScoreReceipt, type Target } from "../riteEngine";
import { sheetSnapshot } from "../riteSheet";
import { RITE_COLORS, RITE_CSS } from "../theme";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const text = (h: string) => strip(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/ :/g, ":");
const EM_DASH = /[\u2013\u2014]/;

/** Every button's visible words must be part of its accessible name (WCAG 2.5.3), and every button needs one. */
function expectNamedButtons(html: string) {
  for (const m of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const visible = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const label = /aria-label="([^"]+)"/.exec(m[1])?.[1];
    expect({ button: m[0].slice(0, 90), named: !!(visible || label) }).toMatchObject({ named: true });
    if (label && visible) expect(label.toLowerCase()).toContain(visible.toLowerCase().slice(0, 12));
  }
}

describe("the game page (server-rendered menu)", () => {
  const html = strip(renderToString(createElement(RiteGame)));

  it("offers the 2 play modes as a radio group, digital first and selected", () => {
    expect(html).toContain('data-game="x-ray-rite"');
    expect(html).toMatch(/<h2[^>]*>Play the rite<\/h2>/);
    expect(html).toContain("<legend");
    const radios = [...html.matchAll(/<input[^>]*name="rite-mode"[^>]*>/g)].map((m) => m[0]);
    expect(radios).toHaveLength(2);
    expect(radios[0]).toContain("checked");
    expect(radios[1]).not.toContain("checked");
    expect(text(html)).toContain("Instant digital launchpad");
    expect(text(html)).toContain("Live optical webcam");
  });

  it("shows wave, 3 lives, score, combo and best, and a polite status line", () => {
    const from = html.indexOf('aria-label="Rite status"');
    const hud = html.slice(from, html.indexOf("</ul>", from));
    expect(text(hud)).toMatch(/Wave - Lives .*3 of 3 Score 0 Combo 0 x1\.0 Best 0/);
    expect(html).toMatch(/role="status" aria-live="polite"[^>]*data-testid="rite-status">Choose a mode, then start the rite\./);
  });

  it("is a 3 x 4 launchpad of 12 named runes with their keys", () => {
    const pads = [...html.matchAll(/<button type="button" data-rune="(\d+)"[^>]*>([\s\S]*?)<\/button>/g)];
    expect(pads).toHaveLength(12);
    pads.forEach((m, i) => {
      expect(Number(m[1])).toBe(i);
      const visible = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      expect(visible).toBe(`${i + 1} ${RITE_RUNE_NAMES[i]} Key ${PAD_KEYS[i]}`);
      // The visible words are the accessible name: no separate aria-label to drift from them.
      expect(m[0]).not.toContain("aria-label");
    });
    expect(html).toContain('aria-label="Rune launchpad"');
    expect(html).toMatch(/grid-cols-2[^"]*sm:grid-cols-4/);
  });

  it("explains the rules with the real numbers, without em dashes", () => {
    const t = text(html);
    expect(t).toContain("a reading of 0.48 or more");
    expect(t).toContain("0.22 to 0.47");
    expect(t).toContain("40% slower");
    expect(t).toContain("You have 3");
    expect(t).toContain("up to 4 runes at once");
    expect(t).toContain("Hold a pad, or its key");
    expect(t).not.toMatch(EM_DASH);
  });

  it("is keyboard-ready: native controls, a Start button, a sound toggle, no positive tabindex, every button named", () => {
    expect(html).toMatch(/>Start the Rite<\/button>/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Rite sounds <span[^>]*>on<\/span><\/button>/);
    expect(html).not.toMatch(/tabindex="[1-9]/);
    expect(html).not.toMatch(/<div[^>]*onclick/i);
    expect(html.match(/<h1/g)).toBeNull();
    expectNamedButtons(html);
  });
});

describe("launchpad states and input handlers", () => {
  const target = (rune: number, trembling = false): Target => ({ rune, cursed: trembling, trembling });
  const cover = (entries: Record<number, number>) => Array.from({ length: 12 }, (_, i) => entries[i] ?? 0);
  const noop = () => undefined;
  const render = (targets: Target[], coverage: number[], bursts: { id: number; rune: number }[] = []) =>
    strip(renderToString(createElement(LaunchPad, { targets, coverage, bursts, onPress: noop, onRelease: noop })));
  const pad = (html: string, i: number) => new RegExp(`<button[^>]*data-rune="${i}"[^>]*>[\\s\\S]*?</button>`).exec(html)![0];

  it("marks targets in gold with a beam and a word, trembling in dashed crimson with a flickering beam, covered in emerald", () => {
    const html = render([target(2), target(5, true), target(9)], cover({ 5: 0.35, 9: 0.6 }));
    const gold = pad(html, 2);
    expect(gold).toContain('data-kind="target"');
    expect(gold).toContain(">Target<");
    expect(gold).toContain('data-beam="gold"');
    expect(gold).toContain("border-[#D4AF37]");
    // The glow pulses; the button itself (and so its text) never fades.
    expect(gold).toContain('data-glow="pulse"');
    expect(gold.slice(0, gold.indexOf(">"))).not.toContain("rite-pulse");

    const crimson = pad(html, 5);
    expect(crimson).toContain('data-kind="trembling"');
    expect(crimson).toContain(">Trembling<");
    expect(crimson).toContain('data-beam="crimson"');
    expect(crimson).toContain("rite-flicker");
    expect(crimson).toContain("border-dashed");

    const green = pad(html, 9);
    expect(green).toContain('data-kind="covered"');
    expect(green).toContain(">Covered<");
    expect(green).toContain("border-[#34d399]");

    const idle = pad(html, 0);
    expect(idle).toContain('data-kind="idle"');
    expect(idle).not.toContain("data-beam");
  });

  it("flashes an emerald burst on a banished rune and shows the cover meter on targets only", () => {
    const html = render([target(1)], cover({ 1: 0.24 }), [{ id: 4, rune: 3 }]);
    expect(pad(html, 3)).toContain('data-burst="true"');
    expect(pad(html, 1)).toContain("width:50%");
    expect(pad(html, 2)).not.toContain("width:");
  });

  /** Find the 12 pad buttons in the element tree and call their handlers. */
  function buttons(onPress: (i: number) => void, onRelease: (i: number) => void) {
    const tree = LaunchPad({ targets: [], coverage: cover({}), bursts: [], onPress, onRelease }) as ReactElement;
    const out: ReactElement<Record<string, (e: unknown) => void>>[] = [];
    const walk = (n: ReactNode): void => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (isValidElement(n)) {
        if (n.type === "button") out.push(n as ReactElement<Record<string, (e: unknown) => void>>);
        walk((n.props as { children?: ReactNode }).children);
      }
    };
    walk(tree);
    return out;
  }

  it("presses on pointer down and Space or Enter, releases on pointer up and key up, and ignores key repeat", () => {
    const press = vi.fn();
    const release = vi.fn();
    const pads = buttons(press, release);
    expect(pads).toHaveLength(12);
    const p = pads[3].props;
    const capture = vi.fn();
    p.onPointerDown({ currentTarget: { setPointerCapture: capture }, pointerId: 9 });
    expect(press).toHaveBeenLastCalledWith(3);
    expect(capture).toHaveBeenCalledWith(9);
    p.onPointerUp({});
    expect(release).toHaveBeenLastCalledWith(3);
    p.onPointerCancel({});
    expect(release).toHaveBeenCalledTimes(2);

    for (const key of [" ", "Enter"]) {
      press.mockClear();
      release.mockClear();
      const preventDefault = vi.fn();
      p.onKeyDown({ key, repeat: false, preventDefault });
      p.onKeyDown({ key, repeat: true, preventDefault });
      p.onKeyUp({ key, preventDefault });
      expect(press).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(3);
    }
    press.mockClear();
    p.onKeyDown({ key: "Tab", repeat: false, preventDefault: vi.fn() });
    p.onKeyUp({ key: "a", preventDefault: vi.fn() });
    expect(press).not.toHaveBeenCalled();
    const menu = vi.fn();
    p.onContextMenu({ preventDefault: menu });
    expect(menu).toHaveBeenCalled();
  });
});

describe("the live camera overlay", () => {
  const view = { width: 1280, height: 720, bubbles: Array.from({ length: 12 }, (_, i) => ({ x: 200 + (i % 4) * 250, y: 250 + Math.floor(i / 4) * 140, r: 28 })) };
  const target = (rune: number): Target => ({ rune, cursed: false, trembling: false });
  const cover = (entries: Record<number, number>) => Array.from({ length: 12 }, (_, i) => entries[i] ?? 0);
  const render = (targets: Target[], coverage: number[], bursts: { id: number; rune: number }[] = []) => strip(renderToString(createElement(LiveOverlay, { view, targets, coverage, bursts })));

  it("pulses targets in antique gold, flickers a trembling beam crimson, rings a covered rune in emerald", () => {
    const html = render([target(1), target(4), target(8)], cover({ 4: 0.3, 8: 0.7 }), [{ id: 1, rune: 8 }]);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`stroke="${RITE_COLORS.gold}"`);
    expect(html).toMatch(/<g data-rune="1" data-kind="target"><rect data-beam="gold"/);
    expect(html).toMatch(/<g data-rune="4" data-kind="trembling"><rect data-beam="crimson" class="rite-flicker"/);
    expect(html).toContain('stroke-dasharray="');
    expect(html).toMatch(/<g data-rune="8" data-kind="covered">/);
    expect(html).toContain(`stroke="${RITE_COLORS.emerald}"`);
    expect(html).toContain('class="rite-pulse"');
    expect(html).toContain('class="rite-burst"');
    expect(html).toContain("2 Bat 0.00");
    expect(html).toContain("5 Eye 0.30");
    expect(html).toContain("9 Spider 0.70");
    expect(html).toContain(`stroke="${RITE_COLORS.crimson}"`);
  });

  it("draws nothing when the sheet is out of view", () => {
    expect(renderToString(createElement(LiveOverlay, { view: { width: 10, height: 10, bubbles: null }, targets: [], coverage: cover({}), bursts: [] }))).toBe("");
  });
});

describe("the Game Over receipt", () => {
  const receipt: ScoreReceipt = { wave: 7, score: 2340, maxCombo: 5, bestMultiplier: 1.75, banished: 14, mode: "live", coverage: Array.from({ length: 12 }, (_, i) => (i === 0 ? 0.9 : i === 4 ? 0.3 : 0)), missed: [4, 6] };
  const render = (best: number, frame = sheetSnapshot(SEANCE_RITE_LAYOUTS[0], receipt.coverage, receipt.missed)) =>
    strip(renderToString(createElement(RiteReceipt, { receipt, frame, best, onPlayAgain: () => undefined })));

  it("shows the frozen X-Ray frame, the numbers, Play Again and Copy Score Receipt", () => {
    const html = render(2340);
    expect(html).toMatch(/<h3[^>]*>The rite ends<\/h3>/);
    expect(html).toMatch(/<img src="data:image\/svg\+xml[^"]*" alt="The X-Ray Rite sheet at the moment the rite ended[^"]*"/);
    expect(html).toContain('data-testid="xray"');
    expect(html).toContain('data-glow="on"');
    expect(text(html)).toMatch(/Final wave 7 Score 2,340 Max combo 5 \(x1\.75\) Runes banished 14 Mode Live optical webcam/);
    expect(html).toMatch(/>Play Again<\/button>/);
    expect(html).toMatch(/>Copy Score Receipt<\/button>/);
    expect(text(html)).toContain("New best score on this device.");
    expect(text(render(5000))).toContain("Best on this device: 5,000");
    expect(text(html)).toContain("5 Eye: missed while trembling 0.30");
    expect(text(html)).toContain("2 Bat: empty 0.00");
    expect(text(html)).toContain("7 Candle: missed 0.00");
    expect(text(html)).toContain("1 Skull: covered 0.90");
    expect(text(html)).not.toMatch(EM_DASH);
    expectNamedButtons(html);
  });

  it("keeps a plain-text copy of the receipt in view for pasting by hand", () => {
    expect(render(0)).toContain("X-Ray Rite: The Endless Obsidian Seance\nFinal wave: 7");
  });
});

describe("the print panel and the whole page", () => {
  it("offers the 12-Rune Sheet as PDF and SVG on A4 or Letter", () => {
    const html = strip(renderToString(createElement(RitePrint)));
    expect(html).toMatch(/<h2[^>]*>Print the X-Ray Rite 12-Rune Sheet<\/h2>/);
    expect(html).toContain(">Print the 12-Rune Sheet</button>");
    expect(html).toContain(">SVG</button>");
    expect(html).toMatch(/A4/);
    expect(html).toMatch(/US Letter/);
    expect(html).toContain("blank white circle");
    expect(html).toContain("<summary");
    // The preview image is only built when opened.
    expect(html).not.toContain("<img");
    expect(text(html)).not.toMatch(EM_DASH);
  });

  it("is still the Seance Cipher app, with one h1, the game first and the classic reading kept", () => {
    const html = strip(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, createElement(SeanceCipherApp)))).replace(/^(<link[^>]*>)+/, "");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>X-Ray Rite<\/h1>/);
    expect(text(html)).toContain("The Endless Obsidian Seance");
    expect(html.indexOf('data-game="x-ray-rite"')).toBeGreaterThan(0);
    expect(html.indexOf('data-game="x-ray-rite"')).toBeLessThan(html.indexOf("Print the X-Ray Rite 12-Rune Sheet"));
    expect(html.indexOf("Print the X-Ray Rite 12-Rune Sheet")).toBeLessThan(html.indexOf('data-section="classic-oracle"'));
    expect(html).toContain("Haunted sample cards (no printer needed)");
    expect(html).toContain("Print Chapter 1 Card");
    expect(html).toContain("Scan Any Card (Auto-Route)");
    expect(appMeta.label).toBe("Seance Cipher");
    expect(APPS.find((a) => a.id === "seance-cipher")?.fullBleed).toBe(true);
    expect(text(html)).not.toMatch(EM_DASH);
    expectNamedButtons(html);
  });
});

describe("contrast, focus rings and motion", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const C = RITE_COLORS;

  it("meets WCAG 2.2 AA (4.5:1 for text) on every surface the game draws text on", () => {
    const pairs: [string, string, string][] = [
      ["parchment on obsidian", C.parchment, C.obsidian],
      ["parchment on a pad", C.parchment, C.panel],
      ["parchment on a target pad", C.parchment, "#1d1a10"],
      ["parchment on a trembling pad", C.parchment, "#24121a"],
      ["parchment on a covered pad", C.parchment, "#10241e"],
      ["muted parchment on obsidian", "#D9CFB4", C.obsidian],
      ["muted parchment on a pad", "#D9CFB4", C.panel],
      ["gold labels on a pad", C.gold, C.panel],
      ["gold on the game panel", C.gold, "#10131a"],
      ["crimson message on obsidian", C.crimson, C.obsidian],
      ["crimson on the game panel", C.crimson, "#10131a"],
      ["emerald on the receipt", C.emerald, "#10131a"],
      ["emerald on a covered pad", C.emerald, "#10241e"],
      ["amber warning on obsidian", "#FBBF24", C.obsidian],
      ["ink on the print panel", "#020617", "#F3EBD3"],
    ];
    for (const [what, fg, bg] of pairs) expect(contrast(fg, bg), what).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#020617", "#F3EBD3")).toBeGreaterThanOrEqual(7);
  });

  it("meets 3:1 for the borders, beams and timer bar that carry state", () => {
    for (const [what, fg, bg] of [
      ["gold border", C.gold, C.obsidian],
      ["crimson border", C.crimson, "#24121a"],
      ["emerald border", C.emerald, "#10241e"],
      ["timer bar gold", C.gold, "#2a2f3d"],
      ["timer bar crimson", C.crimson, "#2a2f3d"],
      ["focus ring on obsidian", "#fde047", C.obsidian],
      ["focus ring on a pad", "#fde047", C.panel],
      ["focus ring on parchment", "#020617", "#F3EBD3"],
    ] as const)
      expect(contrast(fg, bg), what).toBeGreaterThanOrEqual(3);
  });

  it("never removes the page's 4 px focus ring from a game control", () => {
    const css = readFileSync(join(__dirname, "../../../index.css"), "utf8");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*4px solid/);
    expect(css).toMatch(/\.on-dark :focus-visible\s*\{[^}]*outline-color:\s*#fde047/);
    const html = [
      renderToString(createElement(RiteGame)),
      renderToString(createElement(LaunchPad, { targets: [], coverage: [], bursts: [], onPress: () => undefined, onRelease: () => undefined })),
      renderToString(createElement(RitePrint)),
      renderToString(createElement(RiteReceipt, { receipt: { wave: 1, score: 0, maxCombo: 0, bestMultiplier: 1, banished: 0, mode: "digital", coverage: [], missed: [] }, frame: null, best: 0, onPlayAgain: () => undefined })),
    ].join("");
    expect(html).not.toMatch(/outline-none|outline-0|focus:outline-hidden/);
    expect(RITE_CSS).not.toMatch(/outline/);
    // Controls inside the parchment panel get a dark ring: yellow would vanish on parchment.
    expect(strip(renderToString(createElement(RitePrint)))).toContain("[&amp;_:focus-visible]:outline-slate-950");
  });

  it("keeps the flicker under 3 flashes a second and switches every animation off for reduced motion", () => {
    const flicker = /@keyframes rite-flicker \{([^@]*?)\}\s*@keyframes/.exec(RITE_CSS)?.[1] ?? /@keyframes rite-flicker \{([\s\S]*?)\}\n/.exec(RITE_CSS)![1];
    const dips = [...flicker.matchAll(/(\d+)% \{ opacity: (\.\d+|0)/g)].length;
    expect(dips).toBe(2);
    const period = Number(/rite-flicker (\d*\.?\d+)s/.exec(RITE_CSS)![1]);
    expect(dips / period).toBeLessThan(3);
    expect(RITE_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.rite-pulse[^}]*\.rite-flicker[^}]*\.rite-burst[^}]*animation: none/);
  });
});
