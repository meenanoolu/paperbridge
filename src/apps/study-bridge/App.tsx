import { useCallback, useMemo, useState } from "react";
import type { AppMeta } from "../../shell/app-registry";
import { ScanWorkbench } from "../../shell/components/ScanWorkbench";
import { usePersistentState } from "../../shell/usePersistentState";
import { DEFAULT_EDITABLE_KEY, parseEditableKey, toAnswerKey } from "./answer-key";
import { addStudent, parseClassSheet, removeStudent, toClassEntry, type ClassEntry } from "./class-sheet";
import { AddToClass, ClassSection } from "./components/ClassSheet";
import { EditKeyPanel } from "./components/EditKeyPanel";
import { StudyResults } from "./components/StudyResults";
import { gradeSheet, readMarks } from "./grade";
import { describeAnswerBubble, STUDY_LAYOUTS } from "./layout";
import { STUDY_SAMPLES } from "./samples";
import { STUDY_SAMPLE_SPECS } from "./samples/specs";
import { DueReviewButton } from "./components/DueReviewButton";
import { studyShareText, studySpokenSummary } from "./voice";

/** A sample sheet's marks, for the Test Decoder Resilience drawer. */
const STRESS_MARKS = { filled: STUDY_SAMPLE_SPECS[0].marks.filter((m) => m.style !== "faint").map((m) => m.key) };

import { ANSWER_KEY_STORAGE, CLASS_STORAGE } from "./storage-keys";
import { STUDY_BATCH } from "./batch";
export { ANSWER_KEY_STORAGE, CLASS_STORAGE };
const NO_STUDENTS: ClassEntry[] = [];

export function StudyBridgeApp() {
  const [editableKey, saveKey, resetKey, keySaved] = usePersistentState(ANSWER_KEY_STORAGE, parseEditableKey, DEFAULT_EDITABLE_KEY);
  const [roster, setRoster, clearRoster] = usePersistentState(CLASS_STORAGE, parseClassSheet, NO_STUDENTS);
  const answerKey = useMemo(() => toAnswerKey(editableKey), [editableKey]);
  const [hasScan, setHasScan] = useState(false);
  const onScan = useCallback(() => setHasScan(true), []);

  return (
    <>
      <ScanWorkbench
        icon="book"
        title="Study Bridge"
        tagline="Distraction-free paper quizzes. Students answer on a bubble sheet with no screen. One photo grades it, scores it, and plans spaced review for weak topics."
        layouts={STUDY_LAYOUTS}
        samples={STUDY_SAMPLES}
        steps={[
          ["Print", "A 10-question A-E answer sheet."],
          ["Answer", "Offline, on paper, with a pen."],
          ["Scan", "Webcam or photo upload."],
          ["Learn", "Score, weak topics, review dates."],
        ]}
        setup={<EditKeyPanel answerKey={editableKey} onSave={saveKey} onReset={resetKey} saved={keySaved} hasScan={hasScan} />}
        describeBubble={describeAnswerBubble}
        onScan={onScan}
        announce={(scan) => {
          const g = gradeSheet(scan.result, answerKey, scan.scannedAt);
          return `Score ${g.scorePct}%, ${g.correct} of ${g.total} correct. ${g.weakTopics.length ? `Weak topics: ${g.weakTopics.join(", ")}.` : "No weak topics."}`;
        }}
        tabLabels={{ history: "Class Sheet & Export" }}
        stressTest={STRESS_MARKS}
        spokenSummary={(scan) => studySpokenSummary(gradeSheet(scan.result, answerKey, scan.scannedAt))}
        shareText={(scan) => studyShareText(gradeSheet(scan.result, answerKey, scan.scannedAt))}
        historyTab={<ClassSection roster={roster} answerKey={answerKey} onRemove={(id) => setRoster(removeStudent(roster, id))} onClear={clearRoster} />}
        renderResult={(scan) => (
          <>
            <StudyResults report={gradeSheet(scan.result, answerKey, scan.scannedAt)} quiz={answerKey} />
            <DueReviewButton report={gradeSheet(scan.result, answerKey, scan.scannedAt)} />
            <AddToClass
              key={scan.scannedAt.toISOString()}
              roster={roster}
              onAdd={(student) => setRoster(addStudent(roster, toClassEntry(student, readMarks(scan.result), scan.scannedAt, new Date())).list)}
            />
          </>
        )}
      />
    </>
  );
}

export const appMeta: AppMeta = {
  id: "study-bridge",
  label: "Study Bridge",
  icon: "book",
  order: 2,
  layouts: STUDY_LAYOUTS,
  batch: STUDY_BATCH,
  // Crisp academic indigo: white text on it is 8.6:1.
  accent: { name: "academic-indigo", strong: "#3730a3", soft: "#eef2ff" },
  samples: STUDY_SAMPLES,
  demo: { batch: "sam-review" },
};
export default StudyBridgeApp;
