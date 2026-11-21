import { ScanWorkbench } from "../../shell/components/ScanWorkbench";
import { PRACTICE_QUIZ } from "./answer-key";
import { StudyResults } from "./components/StudyResults";
import { gradeSheet } from "./grade";
import { STUDY_LAYOUTS } from "./layout";
import { STUDY_SAMPLES } from "./samples";

export function StudyBridgeApp() {
  return (
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
      renderResult={(scan) => <StudyResults report={gradeSheet(scan.result, PRACTICE_QUIZ, scan.scannedAt)} quiz={PRACTICE_QUIZ} />}
    />
  );
}
