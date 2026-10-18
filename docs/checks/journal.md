# The daily journal

How the CEM and lycée daily journal's page was checked for [#216](https://github.com/djazairdev/minhajna/issues/216) (PRD [§3.8](../prd/PRD.md#38-the-documents)). Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The front pages](#the-front-pages)
- [The primary journal](#the-primary-journal)
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

The primary journal's front pages and the specialists' journal come in the next parts of #216.

## The front pages

«الدفتر اليومي · الصفحات الأولى» on the Documents tab prints the pages at the front of a CEM or lycée journal (R-3.8-12), for the school year:

- **The teacher's card:** the name and the rank as given in setup, the subjects, schools and classes taught this school year, and the year as «2026-2027» (R-3.8-61), with a box for the director's visa. A field the teacher has not given is left blank.
- **Seminars, training and meetings:** the teacher's own calendar entries and the school's and zone's events, including one for a grade the teacher teaches, in date order, each with its date and its name and place. One still to come prints in grey. The remarks column is left for the pen, and empty rules follow; a long entry that wraps counts its lines, so the page still holds the rules and the note.
- **Holidays and national days:** the days off of the national and zone calendars that cover the teacher's schools or a grade they teach, each with its dates and «مُعلن», «متوقع» or «تقديري» (R-4.5-04). Exam windows and Ramadan are not days off and do not appear.

Dates are written day first, «01/11/2026», as the journal's pages are drawn (R-3.8-59), and a range reads in the page's direction. The blank version keeps the card's labels and the tables' heads, with every rule empty.


## The primary journal

A primary teacher keeps «الكراس اليومي» instead (R-3.8-09). The Documents tab lists it only to a teacher with a primary class this school year, and the CEM journal and its front pages only to a teacher with another class, so a teacher of both gets each session in one journal only. Its output chooses the day, as the CEM journal's does.

Each primary class with a session that day gets an A4 landscape page, with the school and the class, the day and the year on top. The sessions sit in a morning band and an afternoon band, a band with none left out, in six columns:

- **The duration,** from the school's bells, Ramadan's on its days, or the class's session length without them, such as «45 د».
- **The subject,** with the level in a multigrade class, such as «الرياضيات · 2 ابتدائي».
- **The activity** the slot or the plan item names, when the app has a name for it («قراءة», «كتابة»), or else the session type when it is not a lesson, such as «معالجة».
- **The content:** the resources covered, «تابع» with its stages, content outside the plan, how the session went when it was not as proposed, and the remarks. A session done as proposed with nothing else to say keeps «سير الحصة: تمّت كما هو مقترح», so no cell looks unrecorded.
- **The competence indicator,** left for the pen, since no plan carries one yet.
- **The domain and the lesson note's number:** the item's unit; the number is left for the pen until the app keeps lesson notes.

A session awaiting confirmation prints in grey with what confirming it would record. Boxes for the teacher's signature and the director's visa close the page (R-3.8-10). The type is set so a full day of seven sessions of three lines fits one sheet. The blank version gives every primary class a page with five empty rows in the morning and three in the afternoon.

## The result

| Check | Result |
|---|---|
| Android tests | 1199 pass. The new ones cover a carried-on item with its unit, stages and remarks; guided work with its field, a skipped item, an earlier lesson and content off the plan; a session not held; a session awaiting confirmation; one page or a page per class, on a day with sessions, a day without and blank; the book clock; French colons and an isolated class name; the file name of each layout; a journal opened before the school year; and the output stepping through the days and printing a page per class. For the front pages: the card, events in order with those to come in grey and none of another school's, the days off with their confidence, day-first dates and ranges in both directions, the blank version, the file name, each school's event of the same name, an event for one grade or for a joint class's second level, an entry across the whole year, and a long row taking more rules. For the primary journal: the bands with duration, subject, activity and content, a session awaiting confirmation in grey, the boxes, a day without sessions and the blank version, a multigrade level with a remediation session, the journals each level of teacher sees, and a teacher of both levels |
| The journal's output opens on Sunday 18 October with «قسمان · الأحد 18 أكتوبر 2026», the day between its two arrows, then «الدفتر» with «دفتر واحد للأقسام» chosen and «دفتر لكل قسم», then the version | **Passed** |
| Ten taps on the day before reach Thursday 8 October; the line under the title follows | **Passed** |
| 8 October as one journal: 4AM1 at «08سا – 09سا» with its French content as «المورد», «سير الحصة: تمّت كما هو مقترح» and its homework under «ملاحظات»; 4AM2 at «09سا – 10سا» in grey, «سير الحصة: تنتظر التأكيد» | **Passed** after a fix |
| 8 October with «دفتر لكل قسم»: two pages, «القسم: 4AM1» and «القسم: 4AM2» under the day | **Passed** |
| The front pages print as three A4 portrait pages: the card with «اللغة العربية», «CEM Test», «2026-2027» and «4AM1 · 4AM2», name and rank blank as setup left them, and the visa box; the seminars table with its 25 rules and its note; the twelve days off from the autumn holiday to Independence Day, each with its status, then empty rules | **Passed** after a fix |
| The primary journal, made from the tests' made-up class and printed through desktop Chrome, since the emulator's teacher has no primary class: one landscape page with both bands and the boxes; a made-up full day of seven sessions of three lines fits one sheet | **Passed** after a fix |

Faults found and fixed while checking:
- French words in an Arabic line were not isolated; titles, units, stages, content off the plan and the factual line now are, as the homework already was.
- The front pages' ranges first printed year first and in the wrong order on a right-to-left page; they are now day first and read from the right.
- A full primary day ran over one sheet; the type, the head and the boxes are now set so it fits.

## Repeating the checks

1. Open the Documents tab and «الدفتر اليومي».
2. Step to a day with confirmed sessions and press «حفظ PDF». Look at the lines of each session.
3. Choose «دفتر لكل قسم» and save again: each class taught that day has its own page.
4. Open «الدفتر اليومي · الصفحات الأولى» and press «حفظ PDF». Look at the card, the seminars and the holidays.
5. With a primary class, open «الكراس اليومي», step to a day with sessions and press «حفظ PDF».

## Still open

- TalkBack on the output's day and journal choices, on a real phone.
- The page on paper, against a paper journal.
- The primary journal on a phone and on paper, with a primary teacher's records.
