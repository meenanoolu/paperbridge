import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, isWinAnsiText, renderCardPdf, renderCardsPdf, validateLayoutJson } from "../../../core";
import { STUDY_LAYOUTS } from "../../study-bridge/layout";
import { columnIcons, customizedElderLayouts, DEFAULT_CARE_SETTINGS, parseCareSettings, validateSettings, type CareCardSettings } from "../card-settings";
import { doctorPdfFileName, englishOr, renderDoctorVisitPdf } from "../doctor-pdf";
import { CARD_LANGUAGES, languagePack, translateLabel } from "../i18n";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { monthlyPackLayouts } from "../monthly-pack";
import { applyPreset, REGIMEN_PRESETS } from "../presets";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").slice(0, 16);

/** A minimal valid PNG (grey + alpha), standing in for the browser's canvas text image. */
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
  ihdr.writeUInt32BE(4, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 4; // grey + alpha
  const raw = Buffer.from([0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255]);
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

const pngRenderer = (log: string[]) => async (r: { text: string }) => {
  log.push(r.text);
  return tinyPng();
};
const images = async (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;

const ROSA: CareCardSettings = { ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez", weekStart: "2026-11-23" };

describe("English cards stay byte-identical", () => {
  // SHA-256 of the default card PDFs on main before Phase 6 (any-script, icons and highlights).
  const MAIN = { "elder A4": "e981da5d693ba7dd", "elder Letter": "2aaff83778ddca87", "study A4": "0dfc1de022200ca3", "study Letter": "e06c04020f3bf687" };

  it("with or without the any-script text renderer", async () => {
    const log: string[] = [];
    for (const [name, l] of [
      ["elder A4", ELDER_LAYOUTS[0]],
      ["elder Letter", ELDER_LAYOUTS[1]],
      ["study A4", STUDY_LAYOUTS[0]],
      ["study Letter", STUDY_LAYOUTS[1]],
    ] as const) {
      expect({ name, sha: sha(await renderCardPdf(l)) }).toEqual({ name, sha: MAIN[name] });
      expect({ name, sha: sha(await renderCardPdf(l, { textImage: pngRenderer(log) })) }).toEqual({ name, sha: MAIN[name] });
    }
    // Spanish and a customized English card are Latin-1 too: still pure vector text.
    await renderCardsPdf(customizedElderLayouts({ ...ROSA, language: "es" }), { textImage: pngRenderer(log) });
    await renderCardsPdf(customizedElderLayouts(applyPreset(ROSA, REGIMEN_PRESETS[0])), { textImage: pngRenderer(log) });
    expect(log).toEqual([]);
  });
});

describe("Offline language packs for the printed card", () => {
  it("offers English, Telugu, Hindi, Spanish and any other script", () => {
    expect(CARD_LANGUAGES.map((l) => `${l.id}:${l.native}`)).toEqual(["en:English", "te:తెలుగు", "hi:हिन्दी", "es:Español", "other:Other script"]);
  });

  it("translates day names, default column headers, preset anchors and footer instructions; custom labels print as typed", () => {
    const te = customizedElderLayouts({ ...ROSA, language: "te" })[0];
    expect(te.title).toBe("సంరక్షణ కార్డు");
    expect(te.subtitle).toBe("రోగి: Rosa Martínez");
    expect(te.groups[0].rowLabels).toEqual(["సోమ 23", "మంగళ 24", "బుధ 25", "గురు 26", "శుక్ర 27", "శని 28", "ఆది 29"]);
    expect(te.groups[0].title).toBe("వారం: 23/11 - 29/11/2026");
    expect(te.groups[0].colLabels![1]).toBe("రాత్రి\nమందులు");
    expect(te.footer!.lines).toEqual(["ప్రతి వృత్తాన్ని ముదురు పెన్‌తో నింపండి.", "శక్తి: 1 = చాలా అలసట, 5 = పూర్తి శక్తి. ఒకటి నింపండి."]);
    const hi = customizedElderLayouts(applyPreset({ ...DEFAULT_CARE_SETTINGS, language: "hi" }, REGIMEN_PRESETS[0]))[0];
    expect(hi.groups[0].rowLabels).toEqual(["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"]);
    expect(hi.groups[0].colLabels![0]).toBe("Metformin\n+ BP Pill"); // a medicine name stays as typed
    expect(hi.groups[0].colNotes![0].split("\n")[0]).toBe("नाश्ते के साथ");
    expect(hi.groups[1].title).toBe("ऊर्जा 1-5");
    expect(translateLabel(languagePack("es"), "Dizzy or Pain")).toBe("Mareo o Dolor");
    expect(translateLabel(languagePack("es"), "Lisinopril")).toBe("Lisinopril");
  });

  it("never splits a Telugu or Hindi syllable across lines", () => {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const language of ["te", "hi"] as const)
      for (const p of [null, ...REGIMEN_PRESETS]) {
        const s = p ? applyPreset({ ...ROSA, language }, p) : { ...ROSA, language };
        for (const line of customizedElderLayouts({ ...s, highVisibility: true })[0].groups[0].colLabels!.flatMap((l) => l.split("\n"))) {
          const first = [...seg.segment(line)][0]?.segment ?? "";
          expect({ line, startsWithMark: /^\p{M}/u.test(first) }).toEqual({ line, startsWithMark: false });
        }
      }
  });

  it("every pack x preset x paper x mode x icons passes the layout and printed-text checks", () => {
    let n = 0;
    for (const language of ["te", "hi", "es", "other"] as const)
      for (const base of [DEFAULT_CARE_SETTINGS, ...REGIMEN_PRESETS.map((p) => applyPreset(DEFAULT_CARE_SETTINGS, p))])
        for (const patientName of ["", "Rosa Martínez"])
          for (const weekStart of ["", "2026-12-28"])
            for (const highVisibility of [false, true])
              for (const icons of [false, true]) {
                const s = { ...base, patientName, weekStart, highVisibility, icons, language };
                expect(validateSettings(s)).toEqual([]);
                for (const l of customizedElderLayouts(s)) {
                  n++;
                  expect(checkLayout(l).ok).toBe(true);
                  expect({ language, page: l.page, problems: checkPrintedText(l).map((e) => e.message) }).toEqual({ language, page: l.page, problems: [] });
                }
              }
    expect(n).toBe(512);
  });

  it("Telugu and Hindi PDFs render without crashing, with identical bubbles, via the image path and the Node fallback", async () => {
    for (const language of ["te", "hi"] as const) {
      const s = applyPreset({ ...ROSA, language, icons: true, highVisibility: true }, REGIMEN_PRESETS[1]);
      for (const l of customizedElderLayouts(s)) {
        expect(bubbleCenters(l)).toEqual(bubbleCenters(ELDER_LAYOUTS.find((b) => b.page === l.page)!));
        expect(fiducialCenters(l)).toEqual(fiducialCenters(ELDER_LAYOUTS.find((b) => b.page === l.page)!));
        expect(idBits(l)).toEqual(idBits(ELDER_LAYOUT));
        const log: string[] = [];
        const withImages = await renderCardPdf(l, { textImage: pngRenderer(log) });
        expect((await PDFDocument.load(withImages)).getPageCount()).toBe(1);
        expect(log.length).toBeGreaterThan(10);
        expect(log.every((t) => !isWinAnsiText(t))).toBe(true);
        expect(await images(withImages)).toBe(new Set(log).size);
        // No canvas (Node): falls back to the standard fonts, still a valid page.
        const fallback = await renderCardPdf(l);
        expect((await PDFDocument.load(fallback)).getPageCount()).toBe(1);
        expect(await images(fallback)).toBe(0);
      }
      const pack = await renderCardsPdf(monthlyPackLayouts({ ...s, weekStart: "2026-12-28" }, "A4"), { textImage: pngRenderer([]) });
      expect((await PDFDocument.load(pack)).getPageCount()).toBe(4);
    }
  });

  it("any-script labels need a non-English card language; emoji never print", () => {
    const te = { ...DEFAULT_CARE_SETTINGS, labels: { ...DEFAULT_CARE_SETTINGS.labels, am: "మెట్‌ఫార్మిన్" } };
    expect(validateSettings(te).map((p) => p.message)).toEqual(["These characters cannot be printed: మ ె ట ్ \u200c ఫ ా ర ి న"]);
    expect(validateSettings({ ...te, language: "other" })).toEqual([]);
    expect(validateSettings({ ...te, language: "other", cues: { am: "💊 white" } }).map((p) => p.message)).toEqual(["These characters cannot be printed: 💊"]);
    expect(parseCareSettings({ ...te, language: "te", icons: true })).toMatchObject({ language: "te", icons: true });
    expect(parseCareSettings({ ...te, language: "xx", icons: "yes" })).not.toHaveProperty("language");
    expect(parseCareSettings({ ...te, language: "en" })).not.toHaveProperty("language");
  });

  it("the Doctor Visit PDF stays English: other-script names and labels become a plain note", async () => {
    expect(englishOr("రమాదేవి", "(other)")).toBe("(other)");
    expect(englishOr("Zoë O’Brien — 李", "(other)")).toBe("Zoë O'Brien - 李");
    const card = { ...DEFAULT_CARE_SETTINGS, language: "other" as const, labels: { ...DEFAULT_CARE_SETTINGS.labels, am: "మెట్‌ఫార్మిన్" } };
    const bytes = await renderDoctorVisitPdf({ patientName: "రమాదేవి", weeks: [], patterns: [], card, generatedAt: new Date("2026-11-23T10:00:00Z") });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(doctorPdfFileName("రమాదేవి", new Date("2026-11-23T10:00:00Z"))).toMatch(/\.pdf$/);
  });
});

describe("Icon-Anchored print mode", () => {
  it("puts a sun, moon, drop (or check for other habits) and warning above the columns", () => {
    expect(columnIcons(DEFAULT_CARE_SETTINGS)).toEqual(["sun", "moon", "drop", "alert"]);
    expect(columnIcons(applyPreset(DEFAULT_CARE_SETTINGS, REGIMEN_PRESETS[1]))).toEqual(["sun", "moon", "check", "alert"]);
    const l = customizedElderLayouts({ ...ROSA, icons: true })[0];
    expect(l.printStyle).toMatchObject({ showIcons: true });
    expect(l.groups[0].colIcons).toEqual(["sun", "moon", "drop", "alert"]);
  });

  it("an icon card passes validate_card_layout (geometry and printed text) on both papers", () => {
    for (const l of customizedElderLayouts({ ...ROSA, icons: true, highVisibility: true }))
      expect(validateLayoutJson(JSON.parse(JSON.stringify(l)), { checkText: true })).toMatchObject({ ok: true, errors: [] });
  });

  it("a photographed icon card decodes bubble for bubble like the standard card", () => {
    const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === "missed-dose")!;
    const states = (l: typeof ELDER_LAYOUT, camera = spec.camera) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(l, { ...spec, camera }))), ELDER_LAYOUT.page === l.page ? ELDER_LAYOUT : ELDER_LAYOUTS[1]);
      if (!r.ok) throw new Error(r.reason);
      return r.bubbles.map((b) => `${b.group}/${b.row}/${b.col}=${b.state}`);
    };
    const icons = customizedElderLayouts({ ...DEFAULT_CARE_SETTINGS, icons: true });
    expect(states(icons[0])).toEqual(states(ELDER_LAYOUTS[0]));
    const tilted = ELDER_SAMPLE_SPECS[2].camera;
    expect(states(icons[1], tilted)).toEqual(states(ELDER_LAYOUTS[1], tilted));
  });
});
