import { fileStem, type BatchAdapter } from "../../shell/batch";
import { loadJson, saveJson } from "../../shell/storage";
import { addStudent, parseClassSheet, studentId, toClassEntry, validateStudent, type ClassEntry } from "./class-sheet";
import { readMarks } from "./grade";
import { CLASS_STORAGE } from "./storage-keys";

/** Bulk save for "Scan Any Card": each decoded answer sheet joins the Class Sheet under a name. */
export const STUDY_BATCH: BatchAdapter = {
  input: { label: "Student name / ID", type: "text", hint: "Prefilled from the file name." },
  defaults: (items) => items.map((i) => fileStem(i.fileName)),
  validate(values) {
    const ids = values.map(studentId);
    return values.map((v, i) => validateStudent(v) ?? (ids.indexOf(ids[i]) !== i ? "Same student as another sheet in this batch." : null));
  },
  actionLabel: (n) => `Add ${n} ${n === 1 ? "sheet" : "sheets"} to the Class Sheet`,
  save(items, now) {
    let list: ClassEntry[] = loadJson(CLASS_STORAGE, parseClassSheet, []);
    let replaced = 0;
    for (const it of items) {
      const r = addStudent(list, toClassEntry(it.value, readMarks(it.scan), it.scannedAt, now));
      list = r.list;
      if (r.replaced) replaced++;
    }
    if (!saveJson(CLASS_STORAGE, list)) return "Could not save: this browser blocked storage.";
    const n = items.length;
    return `Added ${n} ${n === 1 ? "sheet" : "sheets"} to the Class Sheet${replaced ? ` (${replaced} replaced an earlier sheet)` : ""}.`;
  },
};
