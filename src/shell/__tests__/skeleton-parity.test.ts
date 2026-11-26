import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../scripts/lib/photo";
import { adaptedCardSpec } from "../../apps/elder-care/adaptive";
import { customizedElderLayouts, DEFAULT_CARE_SETTINGS, type CareCardSettings } from "../../apps/elder-care/card-settings";
import { interpretCareCard } from "../../apps/elder-care/interpret";
import { ELDER_LAYOUT } from "../../apps/elder-care/layout";
import { monthlyPackLayouts } from "../../apps/elder-care/monthly-pack";
import { elderPrintSlot } from "../../apps/elder-care/print";
import { DEFAULT_EDITABLE_KEY, toAnswerKey } from "../../apps/study-bridge/answer-key";
import { dueReviewSpec } from "../../apps/study-bridge/due-review";
import { gradeSheet } from "../../apps/study-bridge/grade";
import { STUDY_LAYOUT, STUDY_LAYOUTS } from "../../apps/study-bridge/layout";
import { quizSheetTitles, STUDY_PRINT, STUDY_PRINT_TEXT } from "../../apps/study-bridge/print";
import { STUDY_SAMPLE_SPECS } from "../../apps/study-bridge/samples/specs";
import { LauncherBar } from "../App";
import { bubbleCenters, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, isWinAnsiText, localizeLayout, renderCardPdf, renderCardsPdf } from "../../core";
import { APPS, HOME_ID, navItems, viewFromHash, viewId } from "../app-registry";
import { AdaptiveCardPanel } from "../components/AdaptiveCard";
import { PrintWorkspace } from "../components/PrintWorkspace";
import { DEMO_LABEL, INHERITED, mixedDomainRefs, SkeletonHome } from "../components/SkeletonHome";
import { createPrintSlot, parsePrintOptions } from "../print-slot";
import { RouteContext } from "../route-context";
import { guideGeometry } from "../webcam-guide";

/** A minimal valid PNG standing in for the browser's canvas text image. */
function tinyPng(): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 4;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 0, 255, 0, 255, 0, 0, 255, 0, 255]))), chunk("IEND", Buffer.alloc(0))]));
}
const images = (b: Uint8Array) => (Buffer.from(b).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
const strip = (h: string) => h.replace(/<!-- -->/g, "");

describe("Study Bridge inherits multilingual printing from the shared skeleton", () => {
  it("offers English, Telugu, Hindi and Spanish through the shared Translate card picker", () => {
    expect(STUDY_PRINT.languages).toEqual(["en", "te", "hi", "es"]);
    const html = strip(renderToString(createElement(PrintWorkspace, { slot: STUDY_PRINT, storageKey: "test.print" })));
    expect(html).toContain("Translate card: ");
    expect(html).toContain("High-Visibility Print Mode");
    expect(html).not.toContain("Icon-Anchored Print Mode"); // a quiz sheet declares no column icons
    expect(html).toContain("Download Quiz Sheet (PDF)");
    expect(html).toContain("Download 4-Week Unit Quiz Pack");
  });

  it("English stays exactly the shipped sheet", () => {
    expect(STUDY_PRINT.layouts({})).toEqual(STUDY_LAYOUTS);
    expect(STUDY_PRINT.layouts({ language: "en" })).toEqual(STUDY_LAYOUTS);
  });

  for (const language of ["te", "hi"] as const)
    it(`a ${language === "te" ? "Telugu" : "Hindi"} quiz sheet prints out of the box: translated words, same bubbles, valid PDF via the any-script path`, async () => {
      for (const highVisibility of [false, true]) {
        const layouts = STUDY_PRINT.layouts({ language, highVisibility });
        expect(layouts.map((l) => l.page)).toEqual(["A4", "Letter"]);
        for (const [i, l] of layouts.entries()) {
          expect(l.title).toBe(STUDY_PRINT_TEXT[language]!["Quiz Answer Sheet"]);
          expect(isWinAnsiText(l.subtitle!)).toBe(false);
          expect(bubbleCenters(l)).toEqual(bubbleCenters(STUDY_LAYOUTS[i]));
          expect(fiducialCenters(l)).toEqual(fiducialCenters(STUDY_LAYOUTS[i]));
          expect(idBits(l)).toEqual(idBits(STUDY_LAYOUTS[i]));
          expect(checkLayout(l).ok).toBe(true);
          expect({ language, highVisibility, page: l.page, text: checkPrintedText(l).map((e) => e.message) }).toEqual({ language, highVisibility, page: l.page, text: [] });
          const asked: string[] = [];
          const pdf = await renderCardPdf(l, { textImage: async (r) => (asked.push(r.text), tinyPng()) });
          expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
          expect(asked).toEqual(expect.arrayContaining([l.title, l.subtitle, ...l.footer!.lines]));
          expect(images(pdf)).toBe(new Set(asked).size);
        }
      }
    });

  it("a High-Visibility Telugu sheet photographed decodes and grades exactly like the standard sheet", () => {
    const spec = STUDY_SAMPLE_SPECS.find((s) => s.id === "sam-review")!;
    const grade = (printed: typeof STUDY_LAYOUT) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(printed, spec))), STUDY_LAYOUT);
      if (!r.ok) throw new Error(r.reason);
      return [r.bubbles.map((b) => b.state), gradeSheet(r, toAnswerKey(DEFAULT_EDITABLE_KEY), new Date("2026-11-23T10:00:00")).scorePct];
    };
    expect(grade(STUDY_PRINT.layouts({ language: "te", highVisibility: true })[0])).toEqual(grade(STUDY_LAYOUT));
  });
});

describe("Shared multi-sheet packs", () => {
  it("Study Bridge gets a 4-Week Unit Quiz Pack from the shared pack builder", async () => {
    for (const language of ["en", "te", "hi", "es"] as const)
      for (const page of ["A4", "Letter"] as const) {
        const pack = STUDY_PRINT.pack!.layouts({ language }, page);
        expect(pack).toHaveLength(4);
        expect(pack.map((l) => l.groups[0].title)).toEqual([1, 2, 3, 4].map((i) => quizSheetTitles(i, 4, language)[0]));
        for (const l of pack) {
          expect(l.page).toBe(page);
          expect(checkPrintedText(l)).toEqual([]);
          expect(bubbleCenters(l)).toEqual(bubbleCenters(STUDY_LAYOUTS.find((b) => b.page === page)!));
        }
      }
    expect(quizSheetTitles(2, 4, "en")).toEqual(["Answers: Quiz 2 of 4", "Quiz 2/4"]);
    const pdf = await renderCardsPdf(STUDY_PRINT.pack!.layouts({ language: "hi" }, "A4"), { title: STUDY_PRINT.pack!.pdfTitle({}), textImage: async () => tinyPng() });
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(4);
    expect(STUDY_PRINT.pack!.fileName({ language: "hi" }, "A4")).toBe("unit-quiz-pack-hi-A4.pdf");
  });

  it("Elder Care's 4-Week Monthly Pack uses the same builder and the same Print Cards controls", () => {
    const card: CareCardSettings = { ...DEFAULT_CARE_SETTINGS, patientName: "Rosa", weekStart: "2026-12-28", icons: true };
    let saved: CareCardSettings | null = null;
    const slot = elderPrintSlot(card, (c) => (saved = c));
    expect(slot.value).toEqual({ language: "en", highVisibility: false, icons: true });
    expect(slot.layouts(slot.value!)).toEqual(customizedElderLayouts(card));
    expect(slot.pack!.layouts(slot.value!, "A4")).toEqual(monthlyPackLayouts(card, "A4"));
    slot.onChange!({ ...slot.value, language: "te", highVisibility: true });
    expect(saved).toMatchObject({ patientName: "Rosa", language: "te", highVisibility: true, icons: true });
    const html = strip(renderToString(createElement(PrintWorkspace, { slot, storageKey: "test.print" })));
    expect(html).toContain("Icon-Anchored Print Mode");
    expect(html).toContain("Download 1-Week Card (PDF)");
    expect(html).toContain("Download 4-Week Pack (1 Month)");
    // A Telugu label on an English card cannot print: the shared tab says so and disables download.
    const bad = elderPrintSlot({ ...card, labels: { ...card.labels, am: "ఉదయం" } }, () => {});
    expect(bad.problems!({ language: "en" })).toEqual(["These characters cannot be printed: ఉ ద య ం"]);
    expect(bad.problems!({ language: "te" })).toEqual([]);
  });

  it("any app gets a pack and translations from a plain table (createPrintSlot)", () => {
    const slot = createPrintSlot({ layouts: STUDY_LAYOUTS, text: { es: { Answers: "Respuestas" } }, pack: { heading: "h", label: "l", sheets: 3, sheetTitles: (i, n) => [`Sheet ${i} of ${n}`], fileStem: "s", pdfTitle: "p" } });
    expect(slot.languages).toEqual(["en", "es"]);
    expect(slot.layouts({ language: "es" })[0].groups[0].title).toBe("Respuestas");
    expect(slot.pack!.layouts({}, "Letter").map((l) => l.groups[0].title)).toEqual(["Sheet 1 of 3", "Sheet 2 of 3", "Sheet 3 of 3"]);
    expect(localizeLayout(STUDY_LAYOUT, { "Quiz Answer Sheet": "X" }).title).toBe("X");
    expect(parsePrintOptions({ language: "te", highVisibility: true, icons: "yes" })).toEqual({ language: "te", highVisibility: true });
    expect(parsePrintOptions({ language: "en" })).toEqual({});
  });
});

describe("One adaptive-card component for both apps", () => {
  it("Elder Care's adapted next-week card and Study Bridge's due review sheet render through AdaptiveCardPanel", () => {
    const elder = decode(decodeJpeg(readFileSync(join(__dirname, "../../apps/elder-care/samples/missed-dose.jpg"))), ELDER_LAYOUT);
    const study = decode(decodeJpeg(readFileSync(join(__dirname, "../../apps/study-bridge/samples/sam-review.jpg"))), STUDY_LAYOUT);
    if (!elder.ok || !study.ok) throw new Error("samples");
    const a = adaptedCardSpec(DEFAULT_CARE_SETTINGS, interpretCareCard(elder).patterns, "2026-11-30")!;
    const b = dueReviewSpec(gradeSheet(study, toAnswerKey(DEFAULT_EDITABLE_KEY), new Date("2026-11-23T10:00:00")))!;
    for (const [spec, label] of [
      [a, "Print Adapted Next-Week Card"],
      [b, "Print Due Review Card"],
    ] as const) {
      const html = strip(renderToString(createElement(AdaptiveCardPanel, { spec })));
      expect(html).toContain('data-testid="adaptive-card"');
      expect(html).toContain(`>${label}</button>`);
      expect(spec.layouts.map((l) => l.page)).toEqual(["A4", "Letter"]);
    }
    expect(a.fileName("A4")).toBe("care-card-adapted-2026-11-30-A4.pdf");
    expect(b.fileName("Letter")).toBe("review-sheet-2026-11-24-Letter.pdf");
    expect(adaptedCardSpec(DEFAULT_CARE_SETTINGS, [], "2026-11-30")).toBeNull();
    expect(dueReviewSpec({ weakTopics: [], schedule: [] })).toBeNull();
  });
});

describe("Skeleton Home and the top-right view tabs", () => {
  it("opens on Skeleton Home by default; app hashes open apps", () => {
    expect(viewFromHash("")).toEqual({ kind: "home" });
    expect(viewFromHash("#home")).toEqual({ kind: "home" });
    expect(viewFromHash("#unknown")).toEqual({ kind: "home" });
    expect(viewId(viewFromHash("#elder-care"))).toBe("elder-care");
    expect(viewId(viewFromHash("#study-bridge"))).toBe("study-bridge");
    expect(viewId({ kind: "home" })).toBe(HOME_ID);
  });

  it("lists Skeleton Home, then the 3 apps, in that order, marking the open one", () => {
    expect(navItems().map((n) => n.label)).toEqual(["Skeleton Home", "Elder Care Bridge", "Study Bridge", "Seance Cipher"]);
    const html = strip(renderToString(createElement(LauncherBar, { current: HOME_ID })));
    expect(html).toMatch(/<nav aria-label="Apps"/);
    expect(html.match(/<a href="#/g)).toHaveLength(4);
    expect(html).toMatch(/href="#home" aria-current="page"/);
    expect(strip(renderToString(createElement(LauncherBar, { current: "study-bridge" })))).toMatch(/href="#study-bridge" aria-current="page"/);
  });

  it("Skeleton Home is a 3-world stage: headline, 3 portal cards linking to each app, the mixed-domain demo and the scaffold guide", () => {
    const html = strip(renderToString(createElement(RouteContext.Provider, { value: () => {} }, createElement(SkeletonHome))));
    expect(html).toMatch(/<h1[^>]*>One Optical Engine. Three Distinct Worlds.<\/h1>/);
    expect(html).toContain("Offline-first deterministic paper scanning across healthcare, classrooms, and physical puzzle games.");
    const cards = html.slice(html.indexOf('aria-label="Apps on the skeleton"'));
    expect(cards.indexOf("Elder Care Bridge")).toBeLessThan(cards.indexOf("Study Bridge"));
    expect(cards.indexOf("Study Bridge")).toBeLessThan(cards.indexOf("Seance Cipher"));
    for (const [id, pill] of [["elder-care", "Clinical Care"], ["study-bridge", "Classroom Studio"], ["seance-cipher", "Physical Paper Game"]]) {
      expect(html).toMatch(new RegExp(`<h2[^>]*><a href="#${id}" aria-describedby="world-${id}-desc"[^>]*>`));
      expect(html).toContain(pill);
    }
    expect(html).toContain(DEMO_LABEL);
    expect(html).toMatch(/aria-haspopup="dialog"[^>]*>.*Scaffold Your Next App \(<code[^>]*>npm run create-app<\/code>\)<\/span><\/button>/);
    expect(html).toContain('class="on-dark relative');
    for (const i of INHERITED) expect(html).toContain(i);
    expect(html).toContain("Scan Any Card (Auto-Route)");
  });

  it("the mixed-domain demo takes one sample card from each of the 3 apps", () => {
    const refs = mixedDomainRefs(APPS);
    expect(refs.map((r) => r.appId).sort()).toEqual(["elder-care", "seance-cipher", "study-bridge"]);
    expect(refs.find((r) => r.appId === "elder-care")!.sample.id).toBe("missed-dose");
    expect(refs.find((r) => r.appId === "study-bridge")!.sample.id).toBe("sam-review");
  });
});

describe("Webcam 4-corner alignment guide", () => {
  it("puts a target square exactly where each printed corner marker should appear", () => {
    const g = guideGeometry(1280, 720, ELDER_LAYOUT);
    expect(g.targets).toHaveLength(4);
    const k = g.w / 210;
    fiducialCenters(ELDER_LAYOUT).forEach(([x, y], i) => {
      const t = g.targets[i];
      expect(t.size).toBeCloseTo(16 * k, 0);
      expect(t.x + t.size / 2).toBeCloseTo(g.x + x * k, 0);
      expect(t.y + t.size / 2).toBeCloseTo(g.y + y * k, 0);
    });
  });
});
