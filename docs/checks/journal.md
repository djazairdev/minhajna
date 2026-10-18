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

A primary class teacher keeps «الكراس اليومي» instead (R-3.8-09). It leaves out the subjects a specialist teaches, French, English and Tamazight, which have their own journal. The Documents tab lists it only to a teacher of a primary class's other subjects this school year, and the CEM journal and its front pages only to a teacher with another class, so a teacher of both gets each session in one journal only. Its output chooses the day, as the CEM journal's does.

Each primary class with a session that day gets an A4 landscape page, with the school and the class, the day and the year on top. The sessions sit in a morning band and an afternoon band, a band with none left out, in six columns:

- **The duration,** from the school's bells, Ramadan's on its days, or the class's session length without them, such as «45 د».
- **The subject,** with the level in a multigrade class, such as «الرياضيات · 2 ابتدائي».
- **The activity** the slot or the plan item names, when the app has a name for it («قراءة», «كتابة»), or else the session type when it is not a lesson, such as «معالجة».
- **The content:** the resources covered, «تابع» with its stages, content outside the plan, how the session went when it was not as proposed, and the remarks. A session done as proposed with nothing else to say keeps «سير الحصة: تمّت كما هو مقترح», so no cell looks unrecorded.
- **The competence indicator,** left for the pen, since no plan carries one yet.
- **The domain and the lesson note's number:** the item's unit; the number is left for the pen until the app keeps lesson notes.

A session awaiting confirmation prints in grey with what confirming it would record. Boxes for the teacher's signature and the director's visa close the page (R-3.8-10). The type is set so a full day of seven sessions of three lines fits one sheet. The blank version gives every primary class a page with five empty rows in the morning and three in the afternoon.

## The primary journal's front pages

«الكراس اليومي · الصفحات الأولى» prints, for each primary class this school year, six A4 portrait pages marked «داخلي · سري», as they hold pupils' names (R-3.8-08, R-5.9-15):

- **The cover:** the school, the year, «الكراس اليومي», the class and the teacher's name, with no logo.
- **The teacher's card:** the name and rank as given in setup, the school, the class with its number of pupils, such as «5 ابتدائي أ · 34 تلميذاً», and the year, with the director's visa.
- **Holidays and national days,** then **seminars and training,** for the class's school and its levels, as the CEM front pages give them, with 23 rules a page.
- **The pupil list** on the day it is printed, in the class list's order: the number, the name and the registration number only, never a birth date, an address or a parent's details. A long list runs on to the next sheet with its heads.
- **The weekly timetable** in force that day: the teacher's sessions with the class by slot and day, a lesson of week A or B marked «(أ)» or «(ب)», and the levels of a multigrade session that is not for all of them. The bell times are the usual ones, even when printed in Ramadan, or the slot's name without bells, in a morning band and an afternoon band. Boxes for the day it was approved and the director's signature and stamp close it; the specialists' hours are the director's to write.

Printed before the school year starts, the pages take its first day, and before the first timetable applies, the first timetable drawn. The blank version keeps the labels, the heads, the class on the cover, the card and the timetable, and one page of 23 empty rules for the pupil list.

## The specialists' journal

A primary French, English or Tamazight specialist keeps «كراس الأستاذ المختص», in the subject's language (R-3.8-11, PS-Journal). The country profile names those subjects (`data/README.md`). The Documents tab lists it to a teacher of one of them, and its output chooses the day and the layout, as the CEM journal's does:

- **One journal for all classes:** a page for the day, with a band for each school and half-day in clock order, each school's bells included, or in the slots' order when a session of that half-day has no time, such as «⁨مدرسة الفتح⁩ · Matinée», and a director's visa for each school taught that day.
- **One journal per class:** a page for each class with a session that day, with its school in the head and its school's visa.

The columns are the time from the school's bells, or the slot's name without bells; the class, with the level in a multigrade class; then the activity, content, competence indicator and domain, as in the class teacher's journal. A French or English page runs left to right in the Latin face, with the day, the year and every label in that language. Tamazight keeps the book's Arabic words and direction until its script is settled. A teacher of two such subjects gets each language's pages in turn. The blank version gives a page with a morning and an afternoon band of empty rows, for all classes or for each class.

## The result

| Check | Result |
|---|---|
| Android tests | 1213 pass. The new ones cover a carried-on item with its unit, stages and remarks; guided work with its field, a skipped item, an earlier lesson and content off the plan; a session not held; a session awaiting confirmation; one page or a page per class, on a day with sessions, a day without and blank; the book clock; French colons and an isolated class name; the file name of each layout; a journal opened before the school year; and the output stepping through the days and printing a page per class. For the front pages: the card, events in order with those to come in grey and none of another school's, the days off with their confidence, day-first dates and ranges in both directions, the blank version, the file name, each school's event of the same name, an event for one grade or for a joint class's second level, an entry across the whole year, and a long row taking more rules. For the primary journal: the bands with duration, subject, activity and content, a session awaiting confirmation in grey, the boxes, a day without sessions and the blank version, a multigrade level with a remediation session, the journals each level of teacher sees, and a teacher of both levels. For the primary front pages: the cover, the card with the pupils' number, the calendar tables, the pupil list with names and registration numbers only and without a pupil who left, the confidential mark, the timetable's cells and boxes, a multigrade class's levels and weeks A and B, the usual times in Ramadan, printing before the year and before the first timetable, the blank version, and the tab listing them to a primary teacher only. For the specialists' journal: the day in French with a band for each school and half-day and each school's visa, a page per class with its school, sessions in clock order across two schools' bells, or in the slots' order when one has no time, a multigrade class's level, Tamazight, French and English pages in turn, the blank version for all classes and for each, a day without sessions, and the class teacher's journal, front pages and tab leaving the specialist's subjects to it |
| The journal's output opens on Sunday 18 October with «قسمان · الأحد 18 أكتوبر 2026», the day between its two arrows, then «الدفتر» with «دفتر واحد للأقسام» chosen and «دفتر لكل قسم», then the version | **Passed** |
| Ten taps on the day before reach Thursday 8 October; the line under the title follows | **Passed** |
| 8 October as one journal: 4AM1 at «08سا – 09سا» with its French content as «المورد», «سير الحصة: تمّت كما هو مقترح» and its homework under «ملاحظات»; 4AM2 at «09سا – 10سا» in grey, «سير الحصة: تنتظر التأكيد» | **Passed** after a fix |
| 8 October with «دفتر لكل قسم»: two pages, «القسم: 4AM1» and «القسم: 4AM2» under the day | **Passed** |
| The front pages print as three A4 portrait pages: the card with «اللغة العربية», «CEM Test», «2026-2027» and «4AM1 · 4AM2», name and rank blank as setup left them, and the visa box; the seminars table with its 25 rules and its note; the twelve days off from the autumn holiday to Independence Day, each with its status, then empty rules | **Passed** after a fix |
| The primary front pages, made from the tests' made-up class with 34 made-up pupils and printed through desktop Chrome: the cover, the card with «5 ابتدائي أ · 34 تلميذاً», the twelve days off within 23 rules, the seminars, the list on two sheets with its heads repeated, and the timetable with Arabic and mathematics on Thursday and both boxes, each page marked «داخلي · سري»; the blank version on six pages | **Passed** after a fix |
| The specialists' journal, made from the tests' made-up French specialist, with four more made-up classes added for the render, seven classes at two schools, and printed through desktop Chrome: one landscape page in French, left to right, with «Jeudi 15 octobre 2026», a band for each school's morning or afternoon, the Arabic class and school names in their own direction, and a visa for each school; a page per class with its school; the blank version on one page | **Passed** after a fix |
| The primary journal, made from the tests' made-up class and printed through desktop Chrome, since the emulator's teacher has no primary class: one landscape page with both bands and the boxes; a made-up full day of seven sessions of three lines fits one sheet | **Passed** after a fix |

Faults found and fixed while checking:
- French words in an Arabic line were not isolated; titles, units, stages, content off the plan and the factual line now are, as the homework already was.
- The front pages' ranges first printed year first and in the wrong order on a right-to-left page; they are now day first and read from the right.
- A full primary day ran over one sheet; the type, the head and the boxes are now set so it fits.
- The blank pupil list ran on to a second sheet; it now holds one page of rules, and the blank card keeps the class.
- The specialists' journal's time column was too narrow for «08:00 – 08:45»; it is now wider.

## Repeating the checks

1. Open the Documents tab and «الدفتر اليومي».
2. Step to a day with confirmed sessions and press «حفظ PDF». Look at the lines of each session.
3. Choose «دفتر لكل قسم» and save again: each class taught that day has its own page.
4. Open «الدفتر اليومي · الصفحات الأولى» and press «حفظ PDF». Look at the card, the seminars and the holidays.
5. With a primary class, open «الكراس اليومي», step to a day with sessions and press «حفظ PDF».
6. Open «الكراس اليومي · الصفحات الأولى» and press «حفظ PDF». Look at each class's cover, card, tables, pupil list and timetable.
7. As a French specialist, open «كراس الأستاذ المختص», step to a day with sessions and press «حفظ PDF», for all classes and for each.

## Still open

- TalkBack on the output's day and journal choices, on a real phone.
- The page on paper, against a paper journal.
- The primary journal and its front pages on a phone and on paper, with a primary teacher's records.
- The specialists' journal on a phone and on paper, with a specialist's records; Tamazight's words once its script is settled.
