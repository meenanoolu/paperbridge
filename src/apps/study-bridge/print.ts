import type { PrintLanguage } from "../../core";
import { createPrintSlot, type PrintText } from "../../shell/print-slot";
import { STUDY_LAYOUTS } from "./layout";

/**
 * Study Bridge's printed words in each card language. Everything else (Translate card,
 * any-script PDF text, High-Visibility, the 4-quiz unit pack) comes from the shared Print Cards
 * tab. Translations are short and should be checked by a native speaker before class use.
 */
export const STUDY_PRINT_TEXT: PrintText = {
  te: {
    "Quiz Answer Sheet": "క్విజ్ జవాబు పత్రం",
    "Fill one circle per question.": "ప్రతి ప్రశ్నకు ఒక వృత్తం నింపండి.",
    Answers: "జవాబులు",
    "Name: ______________________    Date: ____________": "పేరు: ________________    తేదీ: __________",
    "To change an answer, erase it fully.": "జవాబు మార్చాలంటే పూర్తిగా చెరపండి.",
  },
  hi: {
    "Quiz Answer Sheet": "उत्तर पत्र",
    "Fill one circle per question.": "हर प्रश्न के लिए एक गोला भरें।",
    Answers: "उत्तर",
    "Name: ______________________    Date: ____________": "नाम: ________________    तारीख: __________",
    "To change an answer, erase it fully.": "उत्तर बदलने के लिए उसे पूरा मिटाएँ।",
  },
  es: {
    "Quiz Answer Sheet": "Hoja de Respuestas",
    "Fill one circle per question.": "Rellene un círculo por pregunta.",
    Answers: "Respuestas",
    "Name: ______________________    Date: ____________": "Nombre: ________________    Fecha: __________",
    "To change an answer, erase it fully.": "Para cambiar una respuesta, bórrela por completo.",
  },
};

const QUIZ: Record<PrintLanguage, [string, string]> = {
  en: ["Quiz", "of"],
  te: ["క్విజ్", "/"],
  hi: ["प्रश्नोत्तरी", "/"],
  es: ["Cuestionario", "de"],
  other: ["Quiz", "of"],
};

export const UNIT_QUIZZES = 4;

/** "Answers: Quiz 2 of 4", with a shorter fallback. */
export function quizSheetTitles(i: number, n: number, lang: PrintLanguage): string[] {
  const [quiz, of] = QUIZ[lang];
  const answers = (lang !== "en" && lang !== "other" ? STUDY_PRINT_TEXT[lang]?.Answers : undefined) ?? "Answers";
  const num = of === "/" ? `${i}/${n}` : `${i} ${of} ${n}`;
  return [`${answers}: ${quiz} ${num}`, `${quiz} ${i}/${n}`];
}

export const STUDY_PRINT = createPrintSlot({
  layouts: STUDY_LAYOUTS,
  text: STUDY_PRINT_TEXT,
  cardLabel: "Download Quiz Sheet (PDF)",
  pack: {
    heading: "Print a unit",
    label: `Download ${UNIT_QUIZZES}-Week Unit Quiz Pack`,
    sheets: UNIT_QUIZZES,
    sheetTitles: quizSheetTitles,
    fileStem: "unit-quiz-pack",
    pdfTitle: "Unit Quiz Pack (4 answer sheets)",
  },
});
