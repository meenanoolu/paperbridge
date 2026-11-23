/**
 * The 50-photo paper-size regression matrix: 5 sample cards x 5 cameras x A4/Letter. Every photo
 * must route to the paper it was printed on and read exactly like decoding with that layout,
 * with every pen mark read as marked and every faint mark sent for review. Run it before any
 * change to decoder thresholds or card geometry (the protect-core hook asks for it).
 */
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../scripts/lib/photo";
import { ELDER_LAYOUTS } from "../../apps/elder-care/layout";
import { ELDER_SAMPLE_SPECS } from "../../apps/elder-care/samples/specs";
import { STUDY_LAYOUTS } from "../../apps/study-bridge/layout";
import { STUDY_SAMPLE_SPECS } from "../../apps/study-bridge/samples/specs";
import { decode } from "../../core";
import { routeRaster } from "../route";

const APPS = [
  { id: "elder-care", label: "Elder", layouts: ELDER_LAYOUTS },
  { id: "study-bridge", label: "Study", layouts: STUDY_LAYOUTS },
];
const SAMPLES = [...ELDER_SAMPLE_SPECS.map((s) => ({ s, layouts: ELDER_LAYOUTS })), ...STUDY_SAMPLE_SPECS.map((s) => ({ s, layouts: STUDY_LAYOUTS }))];
const CAMERAS = SAMPLES.map(({ s }) => s.camera);

describe("paper-size regression matrix (5 samples x 5 cameras x 2 papers)", () => {
  it("has 50 photos", () => expect(SAMPLES.length * CAMERAS.length * 2).toBe(50));

  for (const { s, layouts } of SAMPLES)
    it(`${s.id}: every camera, both papers, routes to the printed paper and reads every mark as drawn`, () => {
      for (const [ci, camera] of CAMERAS.entries())
        for (const printed of layouts) {
          const photo = decodeJpeg(encodeJpeg(photographSample(printed, { ...s, camera })));
          const r = routeRaster(photo, APPS);
          const where = { sample: s.id, camera: ci, page: printed.page };
          expect({ ...where, page: r.ok ? r.layout.page : r.reason }).toEqual(where);
          if (!r.ok) continue;
          expect(r.result).toEqual(decode(photo, printed));
          const states = new Map(r.result.ok ? r.result.bubbles.map((b) => [`${b.group}/${b.row}/${b.col}`, b.state]) : []);
          for (const m of s.marks) expect({ ...where, key: m.key, state: states.get(m.key) }).toEqual({ ...where, key: m.key, state: m.style === "faint" ? "ambiguous" : "filled" });
          const marked = new Set(s.marks.map((m) => m.key));
          const strays = [...states].filter(([k, st]) => !marked.has(k) && st !== "blank");
          expect({ ...where, strays }).toEqual({ ...where, strays: [] });
        }
    });
});
