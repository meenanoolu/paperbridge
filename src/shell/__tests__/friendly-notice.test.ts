import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DecodeErrorReason, SuccessfulScan } from "../../core";
import { ElderCareApp } from "../../apps/elder-care/App";
import { StudyBridgeApp } from "../../apps/study-bridge/App";
import { FriendlyNotice, hasNoMarks, PROBLEM_COPY, ScanProblem } from "../components/FriendlyNotice";
import { HumanVerifyControl } from "../components/HumanVerifyControl";
import { RouteContext } from "../route-context";
import { DECODE_ERROR_TEXT, type CompletedScan } from "../scan";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const text = (h: string) => strip(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const EM_DASH = /[\u2013\u2014]/;
const REASONS: DecodeErrorReason[] = ["FIDUCIALS_NOT_FOUND", "HOMOGRAPHY_DEGENERATE", "CARD_ID_MISMATCH"];

const failed = (reason: DecodeErrorReason) => ({ result: { ok: false, reason } }) as unknown as CompletedScan;
const read = (states: ("filled" | "blank" | "ambiguous")[]): SuccessfulScan => ({
  ok: true,
  cardId: "c",
  layoutVersion: 1,
  fiducials: [],
  bubbles: states.map((state, i) => ({ group: "g", row: "r", col: String(i), state, confidence: 0.9, fill: 0.1, at: [i, i] })),
});

describe("ScanProblem: a photo that could not be read", () => {
  it("shows a joke, the factual reason and the exact next step, for every decode failure", () => {
    for (const reason of REASONS) {
      const html = renderToString(createElement(ScanProblem, { scan: failed(reason) }));
      const t = text(html);
      expect(html).toContain(`data-notice="decode-${reason}"`);
      expect(t).toContain(PROBLEM_COPY[reason].joke);
      expect(t).toContain(DECODE_ERROR_TEXT[reason].title);
      expect(t).toContain(PROBLEM_COPY[reason].next);
      expect(t).not.toMatch(EM_DASH);
    }
  });

  it("tells a stranger to try a sample card when no corners were found", () => {
    expect(text(renderToString(createElement(ScanProblem, { scan: failed("FIDUCIALS_NOT_FOUND") })))).toMatch(/4 black corner squares.*sample card/);
  });

  it("renders nothing for no scan or a good scan", () => {
    expect(renderToString(createElement(ScanProblem, { scan: null }))).toBe("");
    expect(renderToString(createElement(ScanProblem, { scan: { result: read(["filled"]) } as unknown as CompletedScan }))).toBe("");
  });

  it("keeps the original decode error wording unchanged for announcements", () => {
    expect(DECODE_ERROR_TEXT.FIDUCIALS_NOT_FOUND.title).toBe("Could not find all 4 black corner squares");
  });
});

describe("hasNoMarks: an empty page", () => {
  it("is true only when the card was read and every bubble is blank", () => {
    expect(hasNoMarks(read(["blank", "blank", "blank"]))).toBe(true);
    expect(hasNoMarks(read(["blank", "filled"]))).toBe(false);
    expect(hasNoMarks(read(["blank", "ambiguous"]))).toBe(false);
    expect(hasNoMarks(read([]))).toBe(false);
  });
});

describe("FriendlyNotice", () => {
  it("is a labelled block with the joke first and the words carrying the meaning", () => {
    const html = renderToString(createElement(FriendlyNotice, { kind: "x", joke: "Boo!", children: createElement("p", null, "Do this next.") }));
    expect(html).toContain('data-notice="x"');
    expect(html.indexOf("Boo!")).toBeLessThan(html.indexOf("Do this next."));
    expect(html).toContain("aria-hidden"); // the ghost is decoration
  });
});

describe("HumanVerifyControl hint", () => {
  const unclear = read(["ambiguous"]).bubbles;
  const render = (hint?: string) =>
    strip(renderToString(createElement(HumanVerifyControl, { unclear, overrides: {}, onSet: () => undefined, hint })));

  it("shows the hint under the title when given, and nothing extra when not", () => {
    expect(render("Look at the amber circle.")).toMatch(/data-testid="verify-hint">Look at the amber circle\./);
    expect(render()).not.toContain("verify-hint");
  });
});

describe("first-time lines in the apps", () => {
  const wrap = (c: () => ReturnType<typeof createElement>) => text(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, c())));

  it("Elder Care says what to tap first", () => {
    expect(wrap(() => createElement(ElderCareApp))).toContain("Tap a sample card to see how a week is read, or upload a photo of your own printed card.");
  });

  it("Study Bridge says what to tap first", () => {
    expect(wrap(() => createElement(StudyBridgeApp))).toContain("Tap a sample quiz sheet to see it graded in a blink, or upload a photo of your own.");
  });

  it("the Elder and Study hints name the real buttons, not invented ones", async () => {
    const { readFileSync } = await import("node:fs");
    const elder = readFileSync(new URL("../../apps/elder-care/App.tsx", import.meta.url), "utf8");
    const study = readFileSync(new URL("../../apps/study-bridge/App.tsx", import.meta.url), "utf8");
    for (const src of [elder, study]) {
      expect(src).toMatch(/hint="[^"]*Mark filled or Mark blank/);
      expect(src).not.toContain("Confirm Mark");
    }
    expect(elder).toContain("HUMAN VERIFIED stamp");
    // Elder Care stays sober about missed medication: no dog-ate-it joke there.
    expect(elder).not.toMatch(/dog eat/i);
    expect(study).toContain("Did the dog eat the homework?");
  });
});
