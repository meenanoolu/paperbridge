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
  "alerts": [{ "level": "high", "title": "No medication at all on Thursday", "detail": "Both morning and night doses were missed." }]
}
```

- `adherencePct` = doses taken / doses with a clear mark, over Morning and Night for 7 days.
  It is `null` when no dose could be read.
- `needsReview` lists marks the decoder found unclear. They are **excluded** from adherence.
  Never treat them as taken or missed; ask the caregiver to check the paper.
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
5. Write the check-in: 3-6 short sentences, open questions, no blame.

## When to suggest contacting a clinician

- Both doses missed on 2 or more days, or adherence below 60%.
- Dizziness or pain on 3 or more days, or on 2 days in a row together with missed doses.
- The caregiver reports a fall, confusion, chest pain, or trouble breathing:
  tell them to call emergency services now.

Do not diagnose, recommend dose changes, or name medicines the alert does not contain.
