# Entering marks (#239)

Checks of 23 October 2026 for [#239](https://github.com/djazairdev/minhajna/issues/239), on `feat/239-marks-core`, `feat/239-marks-entry`, `feat/239-capture`, `feat/239-components` and `feat/239-justify`. Made-up classes and records only.

## Part 1: marks and captures in the history (#409)

- **A mark** (`mark.set`, pupil-records layer, answers 439 and 440):
  - for one of the term's tests, its exam, or a setup component, by the month in primary;
  - two decimals at most, from 0 to its maximum; a mark over it is refused;
  - «غائب» instead of a mark, or the mark cleared. The last one recorded counts.
- **A capture** (`capture.set`, answer 441): participation and behaviour taps, homework not done or done with help, a notebook incomplete; 0 clears it.
- Both travel with the pupil records, the last one per cell, without cleared values. On sync, each cell is a record of its own.
- **The figures** (answers 442 and 446):
  - the entry check: marks, absences, empty cells, and marks of pupils not on the list;
  - F, the mean of the tests the pupil sat while on the test's list;
  - a pupil's evidence over a period;
  - the homework counts a session proposes;
  - the attendance component, proposed from the roll-call book's own totals under the teacher's counting rules.
  - Captures of a session recorded as not held no longer count. Those of a withdrawn session count again since part 3, as for a session not yet recorded (answer 450).

| Check | Result |
|---|---|
| Core tests | 9 new:<br>• a typed mark's limits, the last one counting, an absence, a cleared cell;<br>• the entry check;<br>• marks travelling with the pupil records;<br>• each capture's range, the last one counting, the homework counts;<br>• evidence by course and period;<br>• a withdrawn session and one not held;<br>• F with a pupil who joined later and a half-group test;<br>• attendance from the roll-call book, a corrected roll call and the counting rules. |
| Sync-check tests | A mark and a capture typed differently on two devices conflict in their own cell only. |
| Type check, ESLint, Prettier, Android tests | Pass |

## Part 2: entering a test's or the exam's marks

- **Where it opens** (answer 444), on «التقويم والنقاط»:
  - one row for each of the term's tests, with its day and how many of its pupils are done, such as «الثلاثاء 10 نوفمبر · 2 من 45»;
  - «لا فرض في هذا الفصل بعد», opening «مواعيد الفروض», when the term has none;
  - «الاختبار», with its window's first day, for a subject with a term exam.
  - A class archived after a reorientation shows its rows, disabled.
- **The entry** (Marks-test, Marks-exam, answers 440, 447 and 448):
  - the test's name or «الاختبار» with the class, its day and maximum, how many are done, and a bar;
  - one pupil at a time in class-list order, the previous one above (a tap goes back) and the next one below;
  - the app's own keypad, two digits each side of the point, with .25, .5 and .75;
  - «النقطة أكبر من 20، ولا تُحفظ.» in the card while the mark is above the maximum, and «التالي» refuses it;
  - «غائب عن الفرض» or «غائب عن الاختبار»;
  - «التالي» records the mark at once and moves on. An empty cell is skipped, an erased mark is cleared, and «مسح» on an empty cell clears «غائب».
  - A mark just recorded shows at once, before the history's write ends.
  - TalkBack hears the pupil and the mark in words, and the card is a live region.
- **The summary:**
  - the marks and absences entered, no mark above the maximum, the empty cells, and every pupil on the list;
  - each mark of a pupil not on the list that day, «ليس في قائمة القسم يومها», with a button to clear it;
  - for a test, that its marks stay with the teacher, nothing signed or sent;
  - «تم» and «مراجعة من البداية».
- **The lists:** a test's list is its group's pupils enrolled on its day. The exam's is the class's, or the level's in a joint class, enrolled on the window's first day.

| Check | Result |
|---|---|
| Core tests | The term's exam window and the list sitting it, with a pupil who joined later; a joint class's levels each sitting their own exam. |
| Android tests | 2,117 pass, 20 of them new:<br>• the keypad, the quarters, what «التالي» does, the scales;<br>• a sheet refused for another course's or another term's test;<br>• a joint class's exam;<br>• marks, a quarter and an absence recorded;<br>• a mark over the maximum said and refused;<br>• an empty cell, going back, reviewing and clearing;<br>• a mark shown at once on going back, and «غائب» cleared;<br>• a mark of a pupil not on the list cleared;<br>• the exam's sheet;<br>• the hub's rows: tests, no test, the exam, a subject with no exam, an archived class;<br>• the routes;<br>• every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, with 45 made-up pupils, on 23 October:<br>• A test, «Fard1», was added for Tuesday 10 November. The hub showed its row, «الثلاثاء 10 نوفمبر · 0 من 45», and «الاختبار · الأحد 6 ديسمبر · 0 من 45».<br>• In the entry, 14 was recorded and kept after the app was closed and opened again.<br>• 25 showed the error in the card, and «التالي» stayed on the pupil.<br>• 9.5 with the quarter key, then «غائب عن الفرض».<br>• Going back showed «غ», and «مسح» cleared it.<br>• The summary read «النقاط: 2 · الغياب: 0», «خانات فارغة: 43» and «كل التلاميذ من قائمة القسم», with the note that test marks stay with the teacher.<br>• «مراجعة من البداية» showed 14 again, and the hub read «2 من 45».<br>• The exam took 16.75, and its row read «1 من 45».<br>• The first build put «التالي» under the navigation bar while the error showed. The error now sits in the card and the two buttons share a row, and everything fits.<br>• At 200% text, «غائب عن الاختبار» and «التالي» wrap onto two rows, and «التالي» spans the width after a short scroll. |

## Part 3: capture during the session

- **Where it opens** (answers 441, 449 and 450): the hub's «تقويم أثناء الحصة», with today's session and its time, such as «حصة اليوم · 08:00 – 09:00», for every subject with a mark scale, with or without continuous assessment. It is disabled on a day the course has no session, and for a class archived after a reorientation.
- **The sessions:** today's sessions of the course, leaving out a day the calendar closes, the teacher's own calendar days, and a session recorded as not held. The screen opens on the first not yet recorded, else the last, and shows a chip for each when there are several, with its time, such as «09:00 – 10:00». With none, it says «لا حصة لهذا القسم اليوم».
- **The screen** (Capture):
  - the class, the session line, and the session chips;
  - chips for «المشاركة», «الواجب», «الكراس» and «السلوك», with each one's hint;
  - a tile for each pupil of the session's group enrolled that day, in class-list order; in a joint class, of the course's level only.
- **Taps:**
  - participation and behaviour count up, shown «+2»;
  - homework goes from nothing to «لم يُنجز», «بمساعدة الغير» and back;
  - the notebook toggles «غير مكتمل».
  - Each tap is recorded at once, and quick taps count from what was just tapped. «تراجع» takes back the last tap made on the screen, back on that tap's session and item, and «تم» goes back.
- **Homework counts** (R-3.8-24): before a count is saved, the homework record's counter starts at what the taps of the session the homework came back in propose, «من تقويم الحصة · لم يُنجزه: 1 · …», counting only the pupils on the homework's list. They are written only when the teacher confirms.

| Check | Result |
|---|---|
| Core tests | The session capture opens on: the first not yet recorded, else the last, with two sessions on a day; none on a day off, on the teacher's own calendar day, or for a session not held; a withdrawn session's captures counting again; a half group's list; a joint class's level; and the homework counts proposed from the due day's taps, from the homework's own half group's session only and for the pupils on the list only. |
| Android tests | Taps counting and cycling, recorded at once, and «تراجع»; quick taps; the chips of two sessions, and «تراجع» going back to the last tap's session and item; the screen on a day without a session; the hub's row on a day with a session and on one without, for a subject with no continuous assessment, and disabled for an archived class; the homework counts proposed and written on confirming; every text in French and English; the route. |
| Android emulator, release build signed with the debug key | On Friday 23 October, a day off, the demo class's hub showed «تقويم أثناء الحصة» disabled with «لا حصة لهذا القسم اليوم». The screen itself was checked in the tests only, since the emulator had no session that day. |

## Part 3b: component marks

- **Where it opens** (answers 444 and 451): the hub's «نقاط التقويم المستمر», for a subject with continuous assessment, with how many of the term's component cells are filled, such as «الخانات المملوءة: 1 من 18». A class archived after a reorientation shows it disabled.
- **The components** (answers 442 and 451):
  - the class and the term; in primary, chips for the months the term covers, open on today's month within the term, else its first;
  - a note that the app never turns taps into marks;
  - one row for each component or column of the term's setup, with its points and how many of its pupils are done, such as «على 4 · 1 من 3».
- **The entry:** the same one-pupil-at-a-time entry and keypad as a test, out of the component's points, with no «غائب».
  - Under the current pupil, what was recorded for that component in the period: participation taps; homework due for the pupil's group with how many were not done or done with help; notebooks marked incomplete; for «الانضباط والمواظبة», the roll-call book's half-days, absences and lateness, and the behaviour taps; «لا يُسجَّل لهذا العنصر شيء في التطبيق» for the others and the teacher's columns.
  - When the setup takes attendance from the roll-call book, «المقترح من دفتر المناداة: 2.75» and «اعتماد المقترح», which puts it on the keypad; «التالي» records it like any mark.
  - The summary counts the marks entered and the empty cells, with no absences.
- **The list:** the course's pupils, of its level only in a joint class, enrolled on the period's last day, on today while it runs, or on its first day before it starts.
- **After the setup changes** (answer 452): marks already given keep their value. A mark above its component's new points shows with «النقطة أكبر من 3، ولا تُحفظ.» and must be retyped before «التالي» moves on; the summary says «نقاط فوق 3: 2», and the rows count it as not done. A component taken out of the setup keeps its marks in the history, out of every count.
- **Homework** (answers 452 and 453): each piece due for the pupil's group in the period counts the pupil's tap on the session it came back in, a whole-class session for homework set in a half group, so the counts never exceed what was due.
- TalkBack hears the evidence and the proposal with the current pupil.
- The keypad's keys and the row of the previous pupil now have a minimum width of 48dp, so the accessibility check holds in the middle of an entry too.

| Check | Result |
|---|---|
| Core tests | A term's months and a month cut to the term; the list read on the period's last day, on today, or on its first day, with a pupil who joined later, and a joint class's level; each kind of component's evidence, and a column's none; a pupil's homework due for their half group, tapped where it came back, a tap on another session left out; half-group homework read on the whole-class session; a mark above a lowered maximum in the entry check. |
| Android tests | The hub's row and its count; the components with their points; a component entered out of its points with no «غائب», the over-maximum message and the evidence; the attendance proposal from a roll call put on the keypad and recorded, with the behaviour taps; the homework and notebook lines; a mark above points since lowered not counted until retyped; the summary counting a mark put above points lowered while it shows; a component taken out of the setup out of every count; the evidence in the card TalkBack reads; a mark of a pupil not on the list cleared; primary opening on its first month outside the term; the hub's row hidden without continuous assessment and disabled for an archived class; no proposal without the roll-call book; a column with nothing recorded; primary's months open on today's, and a month's mark; sheets refused for a month the course does not keep or an unknown component; an archived class's rows disabled; the routes, and «تم» going back with the cell counted; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, with 45 made-up pupils and the teacher's own setup, on Friday 23 October:<br>• The hub read «الخانات المملوءة: 0 من 270», six components for 45 pupils.<br>• The components showed each with its points, such as «الانضباط والمواظبة» and «على 3 · 0 من 45», and «البحوث والمشاريع» on 5.<br>• Attendance opened on the first pupil with «أنصاف الأيام: 0 · غياب غير مبرر: 0 · …» under the mark, also in the card's TalkBack label, and no «غائب» button. The demo has no roll call taken, so no proposal showed.<br>• 2.5 was recorded with «التالي», and 4 showed «النقطة أكبر من 3، ولا تُحفظ.».<br>• Participation said «نقرات المشاركة: 0».<br>• The row then read «على 3 · 1 من 45», and the hub «الخانات المملوءة: 1 من 270», still so after the app was closed and opened again. |

## Part 3c: the justification of a pupil's mark

- **Where it opens** (answers 443 and 454): a row «تبرير التقويم المستمر» on «نقاط التقويم المستمر», on its term or month, and a row in the Documents tab, on the first class and subject with continuous assessment.
- **The screen** (Marks-pupil):
  - chips for the class and subject, the term and, in primary, the month;
  - the previous and next pupil with «3 من 45»;
  - the pupil, the class and subject with «التقويم المستمر» and the period;
  - T out of the scale, once every component has a mark, else «—» with «عناصر بلا نقطة: 2»; a mark above points since lowered counts as empty;
  - for a term, «الفرض 12.00 · الاختبار 10.00 · المعدل 11.67»: the test mean, the exam and the average by the level's formula, Σ weight × part ÷ Σ weights, each once the term has it, the average only when every part it weighs has one. Primary's page is a month's, with none of them;
  - each component with what was recorded, as component entry says it, and its mark out of its points, then the total and the board's two notes.
- **Output:** «لهذا التلميذ» or «للقسم كله», then «طباعة» or «حفظ PDF». The whole class prints one A4 page per pupil on the list, each framed «داخلي · سري». Each print and saved PDF goes into the activity log as «تبرير التقويم المستمر · الفصل الأول», never with a pupil's name. A saved PDF is named by the class and subject, «التلميذ 3» for one pupil, and the term or month, never the pupil's name (answer 455).

| Check | Result |
|---|---|
| Core tests | T once every component has a mark, a mark above points since lowered counted as empty, and a month's marks apart; the term average by CEM's and primary's formulas, none while a weighted part is missing. |
| Android tests | A pupil's page with T, the test, the exam and the average beside what was recorded; the next pupil with components still empty; an exam marked absent, with no average; one pupil and the whole class printed, framed «داخلي · سري», and saved under the class and list number; the four outputs in the activity log with the term; primary's month page with no average, saved under the month's name; a subject with no continuous assessment not offered; the rows on the components and in the Documents tab; the log's words for a term and a month; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, with 45 made-up pupils and the teacher's own setup, on Friday 23 October:<br>• The Documents tab showed the row «تبرير التقويم المستمر». It opened on the class's only subject, so no class chip, with the three term chips and «1 من 45».<br>• The first pupil's page read the class with «التقويم المستمر · الفصل الأول», T «—» on «/ 20» with «عناصر بلا نقطة: 5», «الفرض 14.00 · الاختبار 16.75» with no average yet, and the six components with what was recorded: «الانضباط والمواظبة» «2.50 / 3» from part 3b, the others «— / 3» and «— / 5», then «المجموع — / 20» and the notes.<br>• «التلميذ التالي» showed «2 من 45» with that pupil's test only, and «التلميذ السابق» went back.<br>• «للقسم كله» read «الأوراق: 45».<br>• «طباعة» for one pupil opened Android's print screen on A4 with «Page 1 of 1», and back returned to the screen.<br>• The row on «نقاط التقويم المستمر» opened the same screen on «الفصل الأول». |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the hub's test, exam, capture and component rows, the components' month chips and rows, the evidence and «اعتماد المقترح», the keypad, the current pupil announced after «التالي», the over-maximum message, the summary's clear buttons, capture's session and item chips and pupil tiles, and the justification's pupil step, page and output choices.
- **On a phone in French and English:** the entry and its summary, capture, component entry, and the justification, printed and saved. The emulator check was in Arabic.
- **With a teacher:** entering a real test's marks in one sitting, and saying whether one pupil at a time is quick enough; tapping during a real session, and saying whether the tiles are quick enough to use while teaching; giving a term's component marks with what was recorded beside each pupil, and saying whether the attendance proposal matches the mark they would give; a justification printed on paper, and whether it would answer a parent's appeal.
