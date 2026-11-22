import { useCallback, useMemo, useState } from "react";
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

export const ANSWER_KEY_STORAGE = "study-bridge.key.v1";
export const CLASS_STORAGE = "study-bridge.class.v1";
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
        renderResult={(scan) => (
          <>
            <StudyResults report={gradeSheet(scan.result, answerKey, scan.scannedAt)} quiz={answerKey} />
            <AddToClass
              key={scan.scannedAt.toISOString()}
              roster={roster}
              onAdd={(student) => setRoster(addStudent(roster, toClassEntry(student, readMarks(scan.result), scan.scannedAt, new Date())).list)}
            />
          </>
        )}
      />
      <ClassSection roster={roster} answerKey={answerKey} onRemove={(id) => setRoster(removeStudent(roster, id))} onClear={clearRoster} />
    </>
  );
}
