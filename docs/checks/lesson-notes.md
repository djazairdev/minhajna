# Lesson notes and distributions

Checks of 22 October 2026 for [#237](https://github.com/djazairdev/minhajna/issues/237), from [#390](https://github.com/djazairdev/minhajna/pull/390) to [#396](https://github.com/djazairdev/minhajna/pull/396), answers 416 to 424. Made-up schools, classes and notes only.

## What changed

- **Lesson notes in the core** ([#390](https://github.com/djazairdev/minhajna/pull/390), answers 416 to 418):
  - A note belongs to a plan item of a class's course. Its head comes from the plan: the sequence, the domain, the resource and the duration, the item's budget in sessions times the session's length.
  - Its paragraphs are «مؤشر الكفاءة», «الأهداف» and «السندات», then one for each stage of the item's stage template. The packs hold no text for them yet, so they come empty, for the teacher to write; «السندات» proposes the textbook's pages when the item names them.
  - Notes are numbered across the class for the school year, all its subjects together, the courses a reorientation continues included (answer 418).
  - A note is the teacher's own: it goes in the private layer, so it syncs to the teacher's devices, backs up and goes into the full export, but never into a progress statement, a handover or the school's copy (answer 417).
  - «استعمالها» copies the newest written note for the same item from an earlier year's class of the same subject, grade and pack.
- **The note screens** ([#391](https://github.com/djazairdev/minhajna/pull/391), answer 419, [Note](../design/screens/Note.png), [Note-edit](../design/screens/Note-edit.png), [Note-add](../design/screens/Note-add.png)):
  - A note opens from its session: «تفاصيل الحصة» has a row for it, and «المذكرات» in «الوثائق» opens the note of the next session that has a lesson. A lesson over two sessions has one note.
  - Grey paragraphs come from the plan, ink ones were accepted or written. A tap accepts a grey paragraph that has text or reverts an accepted one; the pencil opens any paragraph for writing, with «إعادة نص المخطط»; «إضافة فقرة» adds the teacher's own at the end, and it can be removed after a confirmation.
  - Each change is kept at once, so the drawn «حفظ المذكرة» is gone.
- **The printed notes** ([#392](https://github.com/djazairdev/minhajna/pull/392), answer 420):
  - Any day of the year prints one A4 portrait page for each of its sessions that has a lesson, with the head, the kept paragraphs in ink and the others as their titles over three lines for the pen, and the box «تأشيرة المدير أو المفتش», always blank. A note has no teacher's box, so the drawn signature never prints on it.
  - The blank version keeps the heads and the titles. The note's printer opens the output on the session's day.
- **The distributions in the core** ([#393](https://github.com/djazairdev/minhajna/pull/393), answers 421 and 422):
  - They follow the class's main queue for the whole year: confirmed sessions with the items they taught, the rest as the plan projects them. A half-group TD, a support session, a session not held, one that taught nothing from the plan and one the calendar takes are left out, and they end with the plan.
  - Half-groups that take each lesson in turn, and a rotation's groups, count once a round, on the day the last group has it, as the plan's pacing counts them.
  - The annual one goes by sequence, an item outside any standing as its own and a plan by weeks going by plan week; a session that covers two sequences counts in each. The monthly one goes by teaching week, the termly one by term.
- **The printed distributions** ([#395](https://github.com/djazairdev/minhajna/pull/395), answer 423):
  - One A4 portrait page for each class and subject with a plan, in the layout chosen: «السنوي», «الشهري» for the chosen day's month, or «الفصلي» for the chosen day's term, a holiday giving the next term. Months take the Algerian names.
  - A total row gives the true count of sessions. The strip «توقيع الأستاذ», «تأشيرة المدير», «تأشيرة المفتش» ends each page, the teacher's box taking the drawn signature. The blank version keeps the heads over empty rows.
- **The distributions screen** ([#396](https://github.com/djazairdev/minhajna/pull/396), answer 424, [Dist](../design/screens/Dist.png)):
  - «التوزيعات» in «الوثائق» opens one class and subject at a time, with chips for the others, and the three tabs. The monthly tab steps through the school year's months from today's.
  - «تصدير أو طباعة» opens the output on the tab's layout, on the month shown for the monthly one. The output's layout choice reads «التوزيع».
  - **Not as drawn on Dist** (answers 423 and 424): the strip «توقيع الأستاذ», «تأشيرة المدير», «تأشيرة المفتش» is on the print only, without the boxes' «التاريخ:» lines; the subject replaces the line «من حزمة المخطط»; the monthly table adds a column of sessions and words each week by its days, such as «من 4 إلى 8 أكتوبر 2026»; and chips choose the class and subject. R-3.8-03's «حفظ DOCX» waits for an export issue (answer 416 (7)).
- **Moved to their own issue** ([#389](https://github.com/djazairdev/minhajna/issues/389), answer 416 (1)): template profiles, the subject order, and the notes joining «طباعة الأسبوع» with a range forward (answer 420 (3)). «نموذج الوثائق» stays shown and disabled.

The history gains one event, `lesson-note.set`, in the private layer. PRIVACY.md is unchanged. No new permission.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `lesson-notes.test.ts`: the draft from the plan, the numbering across a class and its continued courses, the next number, the earlier year's note by subject, grade and pack, a joint class's level, the paragraphs kept in the plan's order, and the private layer's route. `distributions.test.ts`, `distribution-cases.test.ts` and `distribution-kept.test.ts`: the main queue over the year, confirmed and projected sessions, a session not held, a merge within and across sequences, half-groups and a rotation counted once a round, a closure, skipped items, the plan's end, a plan by weeks, a removed item of a class's own list, and a joint class |
| Android tests | `note-rules`, `note`, `note-edit`, `note-links` and `app-data-record-from`: the screens, the taps, the pencil, the teacher's own paragraphs, the links from «تفاصيل الحصة» and «المذكرات», and each change kept in the save queue. `notes-pages`: the pages, a lesson over two sessions, the blank version, a day with none, and English. `dist-pages`: the three layouts, the totals, a merge across sequences, a holiday's term, the strip with the drawn signature in the teacher's box only, the blank version, escaping, a plan by weeks and the term line in English and French. `dist-screen`: the tabs, the month steps, the course chips, the empty screen, the row's route and the output's starting layout |
| Layout | Printed to PDF in headless Chrome: the notes in Arabic and blank, a note with four stages fitting its A4 page, and the three distributions in Arabic, the termly one in English and the annual one blank, each on its A4 page |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Colour | Checked by reading the code: grey and ink are said in each plan paragraph's label («· من المخطط», «· مقبول», «· مكتوب»), not by colour alone |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | On my own AVD: «المذكرات» named the next session's note and opened it, with the head from a class's own list and its paragraphs in grey. «التوزيعات» showed the empty screen, then a class's annual row once its list was written; the month step and its rows worked; «تصدير أو طباعة» opened the output on 1 October with «الشهري» checked and the choice headed «التوزيع». The app's secure flag blocks screenshots, so the screens were read from the accessibility tree |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - «المذكرة»: each paragraph's state, the tap that accepts or reverts it, the pencil, «إضافة فقرة» and «استعمالها»;
  - the paragraph editor and the teacher's own paragraph, with its removal;
  - «التوزيعات»: the tabs, the course chips, the month step and each row of the table.
- **On paper:** a day's notes and the three distributions, printed on A4 from the phone.
