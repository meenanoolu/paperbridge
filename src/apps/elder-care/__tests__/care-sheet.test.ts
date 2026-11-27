import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteContext } from "../../../shell/route-context";
import { ElderCareApp } from "../App";
import { CARE_COLORS, CARE_CSS, Field, LINEN_STYLE } from "../components/CareSheet";
import { SignOffStamp, STAMP_INK, stampDate, stampHelp } from "../components/SignOffStamp";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const text = (h: string) => strip(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const EM_DASH = /[\u2013\u2014]/;
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("the caregiver sheet", () => {
  const html = strip(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, createElement(ElderCareApp))));

  it("is one centred sheet of cream paper on a linen desk, with no multi-column dashboard grid", () => {
    expect(html).toMatch(/^(<link[^>]*>)*<div class="[^"]*bg-\[#F4EFE6\][^"]*" style="[^"]*" data-frontend="elder-care"/);
    expect(html).toContain(LINEN_STYLE.backgroundImage.slice(0, 40));
    expect(html).toMatch(/class="care-sheet relative mx-auto max-w-4xl [^"]*bg-\[#FAF8F5\]/);
    expect(CARE_COLORS).toMatchObject({ linen: "#F4EFE6", paper: "#FAF8F5", ink: "#134E4A" });
    expect(html).not.toContain("lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]");
    expect(text(html)).toContain("Weekly medicine sheet");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("M12 96V24a10 10 0 0 1 20 0"); // the brass paper clip
  });

  it("numbers its fields down the sheet and keeps the scan controls", () => {
    expect([...html.matchAll(/<section aria-labelledby="(elder-[a-z]+)" data-field="(\d)"/g)].map((m) => [m[1], m[2]])).toEqual([
      ["elder-card", "1"],
      ["elder-status", "2"],
      ["elder-more", "3"],
    ]);
    expect(text(html)).toContain("This week's card");
    expect(text(html)).toContain("How the week went");
    expect(html).toContain("Scan with webcam");
    expect(html).toContain("Upload a photo");
    expect(html).toContain("Scan Any Card (Auto-Route)");
  });

  it("tucks the print options, languages and presets into a closed drawer", () => {
    const m = /<details class="group[^"]*" data-drawer="print">/.exec(html);
    expect(m).not.toBeNull();
    expect(m![0]).not.toContain(" open");
    expect(text(html)).toContain("Print the card, languages and presets");
    expect(html.indexOf('data-drawer="print"')).toBeLessThan(html.indexOf("Customize Card"));
  });

  it("is keyboard-ready: every button is named, no positive tabindex, no em dashes", () => {
    for (const b of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) expect(b[2].replace(/<[^>]+>/g, "").trim() || /aria-label=/.test(b[1])).toBeTruthy();
    expect(html).not.toMatch(/tabindex="[1-9]/);
    expect(text(html)).not.toMatch(EM_DASH);
  });

  it("flattens the shell's boxes into dotted form fields, in serif, with no shadows", () => {
    expect(CARE_CSS).toMatch(/\.care-sheet section\[class\*="rounded"\][^{]*\{[^}]*border: 1\.5px dotted/);
    expect(CARE_CSS).toMatch(/box-shadow: none/);
    expect(CARE_CSS).toMatch(/Georgia/);
    expect(CARE_CSS).not.toMatch(/outline/);
    const f = strip(renderToString(createElement(Field, { n: 2, id: "x", title: "Hello", children: createElement("p", null, "body") })));
    expect(f).toMatch(/<section aria-labelledby="x" data-field="2" class="[^"]*border-dotted/);
    expect(text(f)).toContain("2 Hello");
  });

  it("reaches WCAG 2.2 AAA (7:1) for text on the sheet and the linen", () => {
    for (const [what, fg, bg] of [
      ["ink on the sheet", "#134E4A", "#FAF8F5"],
      ["ink on the linen", "#134E4A", "#F4EFE6"],
      ["stamp impression on the sheet", STAMP_INK, "#FAF8F5"],
      ["stamp lettering on its base", "#ffffff", "#134E4A"],
      ["stamp lettering when it cannot be pressed", "#ffffff", "#365553"],
      ["black text on the sheet", "#020617", "#FAF8F5"],
    ] as const)
      expect(contrast(fg, bg), what).toBeGreaterThanOrEqual(7);
  });
});

describe("the HUMAN VERIFIED rubber stamp", () => {
  const render = (pending: number) => strip(renderToString(createElement(SignOffStamp, { pending, when: new Date(2026, 10, 27) })));

  it("cannot be pressed while faint marks are unchecked, and says why", () => {
    const html = render(2);
    expect(html).toContain('data-stamp-state="blocked"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="stamp-help"');
    expect(text(html)).toContain("Stamp HUMAN VERIFIED");
    expect(text(html)).toContain("2 faint marks still need your eyes on the paper. Check them above, then stamp.");
    expect(stampHelp(1)).toBe("1 faint mark still needs your eyes on the paper. Check it above, then stamp.");
    expect(html).not.toContain("data-impression");
  });

  it("can be pressed once everything is checked", () => {
    const html = render(0);
    expect(html).toContain('data-stamp-state="ready"');
    expect(html).toContain('aria-disabled="false"');
    expect(stampHelp(0)).toBe("Everything is checked. Press the stamp to sign off this sheet.");
    expect(html).toContain("active:translate-y-2"); // it presses down
  });

  it("dates the impression in plain words", () => {
    expect(stampDate(new Date(2026, 10, 27))).toMatch(/^Nov 27, 2026$/);
    expect(stampHelp(0)).not.toMatch(EM_DASH);
  });
});
