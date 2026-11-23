/**
 * Offline language packs for the PRINTED Weekly Care Card. Only the paper changes: the caregiver
 * dashboard, alerts, history and Doctor Visit PDF stay in English, and stored labels are not
 * rewritten. Default wording (title, instructions, day names, the default column labels and the
 * preset routine anchors) is translated at print time; anything the caregiver typed prints as typed,
 * in any script.
 *
 * Translations are plain, short phrases chosen to fit the 26 mm columns. They should be reviewed
 * by a native speaker before clinical use.
 */
export type CardLanguage = "en" | "te" | "hi" | "es" | "other";

export interface LanguageOption {
  id: CardLanguage;
  /** Name in its own script, shown first on the button. */
  native: string;
  /** English name, for screen readers and the caregiver. */
  english: string;
  /** BCP 47 tag for `lang` attributes. */
  tag: string;
}

export const CARD_LANGUAGES: LanguageOption[] = [
  { id: "en", native: "English", english: "English", tag: "en" },
  { id: "te", native: "తెలుగు", english: "Telugu", tag: "te" },
  { id: "hi", native: "हिन्दी", english: "Hindi", tag: "hi" },
  { id: "es", native: "Español", english: "Spanish", tag: "es" },
  { id: "other", native: "Other script", english: "Any other language (type your own labels)", tag: "und" },
];

export interface LanguagePack {
  title: string;
  /** Header instruction when there is no patient name. Also replaces a footer line when there is one. */
  penInstruction: string;
  patient: string;
  dailyChecklist: string;
  /** Prefix of the dated week heading, e.g. "Week of". */
  weekOf: string;
  /** Prefix of a 4-week pack heading: `${week} ${n}/${of}`. */
  week: string;
  energyTitle: string;
  /** [energy scale explanation, "bring this card"]. */
  footer: [string, string];
  days: [string, string, string, string, string, string, string];
  /** Default and preset column labels, keyed by their lower-case English text. */
  labels: Record<string, string>;
  /** Preset routine anchors, keyed by their lower-case English text. */
  anchors: Record<string, string>;
  /** Adaptive next-week card: the focus note printed in the footer. */
  focus: FocusPhrases;
  /** Read Aloud sentences (the caregiver can play the week back to the patient). */
  spoken: SpokenPhrases;
}

export interface SpokenPhrases {
  adherence: (pct: number) => string;
  unknown: string;
  missed: (n: number) => string;
  noneMissed: string;
  symptoms: (n: number) => string;
  verified: (n: number) => string;
}

export interface FocusPhrases {
  /** "Focus this week:" */
  lead: string;
  /** Shorter lead, tried when the full note does not fit. */
  short: string;
  askDizzy: string;
  askTired: string;
  sameTime: string;
  /** Sentence end after the column name ("।" in Hindi). */
  stop?: string;
}

export const ENGLISH_SPOKEN: SpokenPhrases = {
  adherence: (p) => `${p} percent of doses were taken this week.`,
  unknown: "Doses could not be counted this week.",
  missed: (n) => `${n} ${n === 1 ? "dose was" : "doses were"} missed.`,
  noneMissed: "No doses were missed.",
  symptoms: (n) => `Dizziness or pain was marked on ${n} ${n === 1 ? "day" : "days"}.`,
  verified: (n) => `${n} ${n === 1 ? "mark was" : "marks were"} checked by hand.`,
};

export const ENGLISH_FOCUS: FocusPhrases = {
  lead: "Focus this week:",
  short: "Focus:",
  askDizzy: "Ask the doctor if dizziness or pain continues.",
  askTired: "Ask the doctor if tiredness continues.",
  sameTime: "Take it at the same time each day.",
};

const PACKS: Partial<Record<CardLanguage, LanguagePack>> = {
  te: {
    spoken: { adherence: (p) => `ఈ వారం ${p} శాతం మందులు వేసుకున్నారు.`, unknown: "ఈ వారం మందులను లెక్కించలేకపోయాము.", missed: (n) => `${n} మోతాదులు తప్పిపోయాయి.`, noneMissed: "ఏ మోతాదూ తప్పిపోలేదు.", symptoms: (n) => `${n} రోజులు తల తిరగడం లేదా నొప్పి గుర్తించారు.`, verified: (n) => `${n} గుర్తులను చేతితో తనిఖీ చేశారు.` },
    focus: { lead: "ఈ వారం శ్రద్ధ:", short: "శ్రద్ధ:", askDizzy: "తల తిరగడం కొనసాగితే డాక్టర్‌ను అడగండి.", askTired: "అలసట కొనసాగితే డాక్టర్‌ను అడగండి.", sameTime: "రోజూ ఒకే సమయానికి వేసుకోండి." },
    title: "సంరక్షణ కార్డు",
    penInstruction: "ప్రతి వృత్తాన్ని ముదురు పెన్‌తో నింపండి.",
    patient: "రోగి:",
    dailyChecklist: "రోజువారీ జాబితా",
    weekOf: "వారం:",
    week: "వారం",
    energyTitle: "శక్తి 1-5",
    footer: ["శక్తి: 1 = చాలా అలసట, 5 = పూర్తి శక్తి. ఒకటి నింపండి.", "ప్రతి సందర్శనకు ఈ కార్డు తీసుకురండి."],
    days: ["సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని", "ఆది"],
    labels: {
      "morning meds": "ఉదయం మందులు",
      "night meds": "రాత్రి మందులు",
      "water 6+ cups": "నీళ్లు 6+ గ్లాసులు",
      water: "నీళ్లు",
      "dizzy or pain": "తల తిరగడం / నొప్పి",
      "pain or dizzy": "నొప్పి / తల తిరగడం",
      "gentle walk": "మెల్లని నడక",
    },
    anchors: {
      "with breakfast": "అల్పాహారంతో",
      "after dinner": "రాత్రి భోజనం తర్వాత",
      "before bed": "నిద్రకు ముందు",
      "all day": "రోజంతా",
      "with food": "ఆహారంతో",
      "with dinner": "రాత్రి భోజనంతో",
      "after lunch": "మధ్యాహ్న భోజనం తర్వాత",
      afternoon: "మధ్యాహ్నం",
      "pain med taken?": "నొప్పి మందు వేశారా?",
    },
  },
  hi: {
    spoken: { adherence: (p) => `इस सप्ताह ${p} प्रतिशत दवाएँ ली गईं।`, unknown: "इस सप्ताह दवाओं की गिनती नहीं हो सकी।", missed: (n) => `${n} खुराकें छूटीं।`, noneMissed: "कोई खुराक नहीं छूटी।", symptoms: (n) => `${n} दिन चक्कर या दर्द दर्ज हुआ।`, verified: (n) => `${n} निशान हाथ से जाँचे गए।` },
    focus: { lead: "इस सप्ताह ध्यान:", short: "ध्यान:", askDizzy: "चक्कर जारी रहें तो डॉक्टर से पूछें।", askTired: "थकान जारी रहे तो डॉक्टर से पूछें।", sameTime: "रोज़ एक ही समय पर लें।", stop: "।" },
    title: "देखभाल कार्ड",
    penInstruction: "हर गोला गहरे पेन से पूरा भरें।",
    patient: "मरीज़:",
    dailyChecklist: "रोज़ की सूची",
    weekOf: "सप्ताह:",
    week: "सप्ताह",
    energyTitle: "ऊर्जा 1-5",
    footer: ["ऊर्जा: 1 = बहुत थकान, 5 = भरपूर ऊर्जा। एक भरें।", "हर मुलाक़ात पर यह कार्ड साथ लाएँ।"],
    days: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"],
    labels: {
      "morning meds": "सुबह की दवा",
      "night meds": "रात की दवा",
      "water 6+ cups": "पानी 6+ गिलास",
      water: "पानी",
      "dizzy or pain": "चक्कर या दर्द",
      "pain or dizzy": "दर्द या चक्कर",
      "gentle walk": "हल्की सैर",
    },
    anchors: {
      "with breakfast": "नाश्ते के साथ",
      "after dinner": "रात के खाने के बाद",
      "before bed": "सोने से पहले",
      "all day": "पूरे दिन",
      "with food": "खाने के साथ",
      "with dinner": "रात के खाने के साथ",
      "after lunch": "दोपहर के खाने के बाद",
      afternoon: "दोपहर में",
      "pain med taken?": "दर्द की दवा ली?",
    },
  },
  es: {
    spoken: { adherence: (p) => `Esta semana se tomó el ${p} por ciento de las dosis.`, unknown: "Esta semana no se pudieron contar las dosis.", missed: (n) => `Se olvidaron ${n} dosis.`, noneMissed: "No se olvidó ninguna dosis.", symptoms: (n) => `Se marcó mareo o dolor ${n} ${n === 1 ? "día" : "días"}.`, verified: (n) => `Se revisaron ${n} ${n === 1 ? "marca" : "marcas"} a mano.` },
    focus: { lead: "Esta semana:", short: "Atención:", askDizzy: "Consulte al médico si sigue el mareo.", askTired: "Consulte al médico si sigue el cansancio.", sameTime: "Tómela a la misma hora cada día." },
    title: "Tarjeta Semanal",
    penInstruction: "Rellene cada círculo con bolígrafo oscuro.",
    patient: "Paciente:",
    dailyChecklist: "Lista diaria",
    weekOf: "Semana:",
    week: "Semana",
    energyTitle: "Energía 1-5",
    footer: ["Energía: 1 = muy cansado, 5 = mucha energía. Marque uno.", "Traiga esta tarjeta a cada consulta."],
    days: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    labels: {
      "morning meds": "Pastillas Mañana",
      "night meds": "Pastillas Noche",
      "water 6+ cups": "Agua 6+ vasos",
      water: "Agua",
      "dizzy or pain": "Mareo o Dolor",
      "pain or dizzy": "Dolor o Mareo",
      "gentle walk": "Paseo suave",
    },
    anchors: {
      "with breakfast": "Con el desayuno",
      "after dinner": "Después de cenar",
      "before bed": "Antes de dormir",
      "all day": "Todo el día",
      "with food": "Con comida",
      "with dinner": "Con la cena",
      "after lunch": "Tras el almuerzo",
      afternoon: "Por la tarde",
      "pain med taken?": "¿Tomó analgésico?",
    },
  },
};

/** The pack for a language, or null for English and "other" (English wording, any-script labels). */
export function languagePack(lang: CardLanguage | undefined): LanguagePack | null {
  return (lang && PACKS[lang]) || null;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The translated default/preset label, or the text unchanged (custom labels print as typed). */
export function translateLabel(pack: LanguagePack | null, text: string): string {
  return (pack && pack.labels[key(text)]) || text;
}

export function translateAnchor(pack: LanguagePack | null, text: string): string {
  return (pack && pack.anchors[key(text)]) || text;
}

/** "23/11 - 29/11/2026": numeric dates read the same in every language. */
export function numericRange(fromIso: string, toIso: string): string {
  const d = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
  return fromIso.slice(0, 4) === toIso.slice(0, 4)
    ? `${d(fromIso)} - ${d(toIso)}/${toIso.slice(0, 4)}`
    : `${d(fromIso)}/${fromIso.slice(0, 4)} - ${d(toIso)}/${toIso.slice(0, 4)}`;
}

/** BCP 47 tag for speech and for the Kiro Crew alert's `cardLanguage`. Undefined for "other". */
export const CARD_LANGUAGE_TAGS: Record<CardLanguage, string | undefined> = { en: "en-US", te: "te-IN", hi: "hi-IN", es: "es-ES", other: undefined };

export function isCardLanguage(v: unknown): v is CardLanguage {
  return CARD_LANGUAGES.some((l) => l.id === v);
}
