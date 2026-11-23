---
name: adherence-analysis
description: How to read a PaperBridge Weekly Care Card scan alert and turn it into a caregiver check-in, with the thresholds PaperBridge uses.
triggers: [paperbridge, adherence, medication, care card]
always: false
---

# PaperBridge adherence analysis

PaperBridge decodes a paper Weekly Care Card with deterministic computer vision (corner
markers, perspective unwarp, local thresholds). No AI reads the card. Each scan produces
one alert with aggregate data only.

## Alert format (`paperbridge:scan-alert`)

```json
{
  "type": "paperbridge:scan-alert",
  "app": "elder-care",
  "cardId": "elder-care-weekly",
  "scannedAt": "2026-11-21T13:47:27.052Z",
  "severity": "high",
  "adherencePct": 71,
  "missed": [{ "day": "Thu", "slot": "Morning" }, { "day": "Thu", "slot": "Night" }],
  "symptomDays": ["Thu", "Fri"],
  "needsReview": ["Wednesday water"],
  "alerts": [{ "level": "high", "title": "No medication at all on Thursday", "detail": "Both morning and night doses were missed." }],
  "cardLanguage": "te-IN"
}
```

- `adherencePct` = doses taken / doses with a clear mark, over Morning and Night for 7 days.
  It is `null` when no dose could be read.
- `needsReview` lists marks the decoder found unclear. They are **excluded** from adherence.
  Never treat them as taken or missed; ask the caregiver to check the paper.
- `manualOverrides` (optional) counts unclear marks the caregiver resolved by looking at the
  paper card. Those marks are already included in the numbers; mention that the week was
  partly verified by hand.
- `patterns` (optional) lists what PaperBridge's fixed rules found. No AI is involved:
  - `symptom-miss`: a dose was missed on at least 2 days when a symptom (dizziness or pain,
    or low energy) was marked, and those days make up at least half of that dose's misses.
    Example: "Night Meds missed on 3 days when low energy was marked."
  - `slot-barrier`: of at least 3 misses, at least 75% are at one time of day.
    Example: "4 of 5 missed doses were Night Meds."
- `cardLanguage` (optional) is the BCP 47 language the patient's paper card is printed in:
  `en-US`, `te-IN` (Telugu), `hi-IN` (Hindi) or `es-ES` (Spanish). Absent means English.
  The alert itself (titles, details, patterns) is always English.
- `severity` is `high` if any alert is high, `medium` if any is medium, else `none`.

## Thresholds PaperBridge uses

| Signal | Rule | Level |
|---|---|---|
| Adherence | below 80% | high |
| Both doses missed on one day | any day | high |
| Some doses missed, adherence 80%+ | any | medium |
| Dizzy or pain | 2+ days | high |
| Dizzy or pain | 1 day | medium |
| Energy 2 or below | 2+ days | medium |
| Water 6+ cups | fewer than 5 days | medium |
| Unclear marks | any | info |

## Steps

1. Read `severity`, `adherencePct`, `missed`, `symptomDays`, and `needsReview`.
2. Open with what went well (doses taken, good water days) before concerns.
3. Group missed doses by day. A whole missed day is more important than a single slot.
4. Pair symptoms with missed doses on the same or previous day; mention the overlap
   as something to ask about, not as a cause.
5. If `patterns` is present, reference each pattern by name in the check-in, as a gentle
   question rather than a conclusion:
   - `symptom-miss`: "On the days you felt dizzy, the evening pill was often skipped. Does it
     make you feel unwell?" Suggest raising it with the clinician. Never call it a side effect.
   - `slot-barrier`: ask what gets in the way at that time of day, and suggest a routine anchor
     (e.g. "with dinner") or a pill-box placement.
6. Write the check-in: 3-6 short sentences, open questions, no blame.
7. If the alert has `patterns` and/or `cardLanguage`, answer in two clearly separated sections:
   - **Clinical Note (English):** 3-5 factual lines for a doctor or pharmacist: adherence,
     missed doses by day and time, symptom days, each pattern as observed (not a cause), and
     how many marks were checked by hand. No advice on doses.
   - **Gentle Check-In Opener (<language>):** 2-4 warm sentences in the `cardLanguage`
     (English if absent; Telugu, Hindi or Spanish otherwise) that the caregiver can say to the
     patient. Ask about side effects or routine barriers with curiosity, never scolding
     (e.g. Telugu: "అమ్మా, ఈ వారం రాత్రి మందు వేసుకోవడం కష్టంగా అనిపించిందా?"). Use simple
     everyday words, the familiar form of address, and no medical jargon. Add an English gloss
     in brackets after it so the caregiver knows what it says.
   For any other language tag, write the opener in English and say so.

## When to suggest contacting a clinician

- Both doses missed on 2 or more days, or adherence below 60%.
- Dizziness or pain on 3 or more days, or on 2 days in a row together with missed doses.
- A `symptom-miss` pattern on two or more saved weeks in a row.
- The caregiver reports a fall, confusion, chest pain, or trouble breathing:
  tell them to call emergency services now.

Do not diagnose, recommend dose changes, or name medicines the alert does not contain.
