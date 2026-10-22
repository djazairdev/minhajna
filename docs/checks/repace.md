# Re-pacing the rest of the term

Checks of 22 October 2026 for [#229](https://github.com/djazairdev/minhajna/issues/229), from [#350](https://github.com/djazairdev/minhajna/pull/350), [#351](https://github.com/djazairdev/minhajna/pull/351) and [#352](https://github.com/djazairdev/minhajna/pull/352), on main `aefa5b6`. Made-up content only.

## What changed

- **When it is offered** (answers 363, 369 and 370): rung 5 of «خيارات الاستدراك» opens «مسودة التوزيع» in two cases.
  - The class is behind its plan beyond its buffers.
  - The class is behind its current distribution with items that would land after the next exams.
  - A class on its distribution is not offered one. Once a re-pace absorbs the gap, rung 5 comes back only when the class falls behind again.
- **The draft** (answers 363 to 365 and 369, [Repace](../design/screens/Repace.png)):
  - **Span:** it runs from the class's first session not yet recorded, a backlog day included, to the day before the exam window or the term's end.
  - **Counts:** the sessions the term gives the plan after holidays, closures and tests, against what is left of the plan, with the spare or the shortfall; TD has its own line.
  - **Weeks:** one row per teaching week, with its dates, the items it takes and their stages, tests in their place, and the days the calendar takes. A week pack lists its plan weeks. The exams, or the term's end, close the list.
  - **Choices:** while re-pacing is offered, the pack's merges and leave-outs are listed with a tick each. When items would land after the exams, the ones the exam-window answer suggests come ticked. A tick follows its choice, and each kept tick is confirmed as its own decision.
  - **«ما تغيّر»:** how far behind the class is, the choices kept, the fixed points, and any item still landing after the exams.
  - **Half-groups:** rotating half-groups count one session for each pair, by when the pair completes.
- **Adopting it** (answers 366 and 369):
  - «اعتماد التوزيع» records the re-pace with the gap it absorbs, measured with the ticks applied. From that day, the class's pace is measured against the new distribution. Sessions still propose the next item, and no lesson moves.
  - «تراجع» right after takes all of it back. The list of decisions takes back the class's newest re-pace alone.
- **Printing and primary approval** (answers 367, 371 and 372, [Repace-primary](../design/screens/Repace-primary.png)):
  - **The page:** «طباعة المسودة» prints one A4 portrait page with the school, the teacher, the subject and the class, the dates and counts, the weeks, «ما تغيّر» and the preparer's signature line. Middle and secondary prints are not recorded.
  - **Printing in primary:** «طباعة المسودة للاعتماد» adds the director's box (date, stamp and signature) and keeps the print with the choices ticked on it. The screen says the draft was sent to print, since the app learns only that Android's print screen opened.
  - **Waiting:** the draft shows the printed choices. «تسجيل الاعتماد» takes the approval date from the print day to today and records the re-pace with that date and the print approved. «لم تُعتمد: تعديل المسودة» goes back to the ticks from the printed choices, and a new print replaces the old.
  - **Core checks:** the core refuses an approval with no print, before the print day, or with other choices. Later drafts count only prints recorded after the one approved.

No permission or network call changes. The lesson record gains two kinds of event, `repace.set` and `repace.removed`, which the records the app sends and the sync check carry like the others. A print record may name the choices on a re-pace draft.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `repace.test.ts` (8), `repace-cases.test.ts` (4) and `repace-print.test.ts` (2) cover the draft's span, counts, weeks and choices; the gap with ticks applied; backlog days and rotating half-groups; when rung 5 is offered; confirming, taking back the newest only, and the shift from its day on; the printed draft; and the approval's bounds |
| Android tests | `plan-repace.test.tsx` (7), `plan-repace-print.test.tsx` (6), `plan-catchup.test.tsx` (rung 5 shown for a class behind), and `plan-repace-scale.test.tsx` (4: the draft, and a primary draft waiting for approval, in Arabic and English at 100% and 200%, with every control named, every text free to grow, and week rows stacked at 200%) |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - Each week's row reads as one item: its dates, what it takes, its sessions and «دمج مقترح» when proposed.
  - Each tick names its choice.
  - The status line reads before «طباعة المسودة للاعتماد» or the approval date.
  - The month grid's days read their full date.
- **On a phone:** right to left and left to right, with text at 200%. The weeks stack and wrap without clipping, with touch targets of at least 48 dp, on Android 8 at 360×800.
- **On paper:**
  - A primary draft printed on A4 is readable in black and white: the week rows, «ما تغيّر», the preparer's line and the director's box.
  - A middle-school draft prints without the box.
  - Android's print screen also saves the page as a PDF.
