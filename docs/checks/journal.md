# The daily journal

How the CEM and lycée daily journal's page was checked for [#216](https://github.com/djazairdev/minhajna/issues/216) (PRD [§3.8](../prd/PRD.md#38-the-documents)). Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What it does

The daily journal is the page a CEM or lycée teacher keeps for each day (R-3.8-13). It is on the Documents tab as «الدفتر اليومي». The page layout is the one checked in [Arabic PDFs on the phone](arabic-pdf.md): A4 portrait, the school, the year and the day on top, three columns, ruled lines, and the teacher's and the director's boxes at the foot. This part fills the third column as the journal asks.

- **The time** is written as the book writes it by hand, such as «08سا – 09سا» or «08h – 09h». Without the school's bells, the slot's name stands in.
- **«المقطع»:** the unit of each item the session covered, once each.
- **«الميدان»:** the session type when it is not a lesson, such as «أعمال موجهة» or «إدماج».
- **«المورد»:** each item covered. An item carried on from an earlier session reads «تابع» and lists the stages it covered (R-4.7-13). A skipped item reads «تُرك», an earlier lesson taught again «إعادة», and content from outside the plan is written as it was recorded.
- **«سير الحصة»:** how the session went: as proposed, partly, two items together, the proposed item skipped, an earlier lesson again, another lesson, or not held. A session not held prints that line alone.
- **«ملاحظات»:** a test given, the homework with the day it comes back, and the factual line.
- **A session awaiting confirmation** prints in grey with what confirming it would record and «سير الحصة: تنتظر التأكيد», and no remarks (R-3.1-05). It is never read as an absence.

The output screen adds two choices for the journal:

- **The day:** the day before and the day after, within the school year, so any day's page can be printed (R-3.8-01). Opened outside the school year, it starts on the year's nearest day. The line under the title says the day, and TalkBack reads out the new day as it changes.
- **The journal** (R-3.8-38): «دفتر واحد للأقسام» puts the day's sessions on one page; «دفتر لكل قسم» gives each class with a session that day its own page, with «القسم: …» under the day. In the blank version, every class taught this school year gets a page. The saved file's name says the layout when it is one per class.

The front pages, the primary journal and the specialists' journal come in the next parts of #216.

## The result

| Check | Result |
|---|---|
| Android tests | 1187 pass. The new ones cover a carried-on item with its unit, stages and remarks; guided work with its field, a skipped item, an earlier lesson and content off the plan; a session not held; a session awaiting confirmation; one page or a page per class, on a day with sessions, a day without and blank; the book clock; French colons and an isolated class name; the file name of each layout; a journal opened before the school year; and the output stepping through the days and printing a page per class |
| The journal's output opens on Sunday 18 October with «قسمان · الأحد 18 أكتوبر 2026», the day between its two arrows, then «الدفتر» with «دفتر واحد للأقسام» chosen and «دفتر لكل قسم», then the version | **Passed** |
| Ten taps on the day before reach Thursday 8 October; the line under the title follows | **Passed** |
| 8 October as one journal: 4AM1 at «08سا – 09سا» with its French content as «المورد», «سير الحصة: تمّت كما هو مقترح» and its homework under «ملاحظات»; 4AM2 at «09سا – 10سا» in grey, «سير الحصة: تنتظر التأكيد» | **Passed** after a fix |
| 8 October with «دفتر لكل قسم»: two pages, «القسم: 4AM1» and «القسم: 4AM2» under the day | **Passed** |

Faults found and fixed while checking:
- French words in an Arabic line were not isolated; titles, units, stages, content off the plan and the factual line now are, as the homework already was.

## Repeating the checks

1. Open the Documents tab and «الدفتر اليومي».
2. Step to a day with confirmed sessions and press «حفظ PDF». Look at the lines of each session.
3. Choose «دفتر لكل قسم» and save again: each class taught that day has its own page.

## Still open

- TalkBack on the output's day and journal choices, on a real phone.
- The page on paper, against a paper journal.
