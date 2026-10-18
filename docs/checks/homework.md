# Homework in the texts book

How the texts book's homework record and its printed page were checked for [#214](https://github.com/djazairdev/minhajna/issues/214) (PRD [§3.8](../prd/PRD.md#38-the-documents), [§3.3](../prd/PRD.md#33-today-and-the-session)). Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What it does

Homework written in a session's details, with the day it comes back, is the texts book's homework record for that class and subject (R-3.8-19, P67).

- **The record** opens from «الواجبات» at the foot of the texts book in the app. It lists each piece of homework in the order it was set: the day it was set over the day it comes back, then the activity, in the subject's language and direction, then its two counts. Counts not entered yet are blank, as they print.
- **On Today,** the class's first session held on the day homework comes back carries «يُسلَّم اليوم» with the homework's own words, and «إحصاء», which opens the record on that homework. Once counted, the strip gives the two counts. The roll call's strip stays after it.
- **The two counts** (R-3.8-20, 23): pupils who did not do it, and pupils who relied on someone else, one stepper each. Under each is its share of the pupils on the class list on the day the homework came back, for the session's group, rounded to a whole number (R-3.8-21); in a joint class, the list of the course's level. A pupil is counted once at most, so the two together never pass the list. «الجميع أنجزه بنفسه» records none of either at once. Homework is counted once it has come back; homework still out is shown only.
- **Corrections:** any homework that has come back can be opened again and its counts corrected. A correction of the session that moves the homework to another day leaves its counts behind; homework set again for the same day finds them again, as it is most likely the same homework. «تراجع» puts back what was there before, while the count is still the latest. The history keeps every version.
- **Counts only, never names** (R-3.8-22). A class with no pupil list says so, and counts nothing.

In the core, the counts are their own record, `homework.counted`, keyed by the session that set the homework, in the lesson-record layer, and `homework.uncounted` takes them back. `homeworkRecord` lists a course's homework, `homeworkDue` what comes back on a day, and `homeworkPercent` rounds a share. Homework a correction no longer sets leaves the record, and its counts with it.

**The printed page** is «سجل الواجبات» on the Documents tab, and «طباعة سجل الواجبات» at the foot of the record. It covers the school year: for each class and subject taught, a page on the book's head titled «دفتر النصوص · الواجبات», with the continuous-assessment line and the paper book's seven columns: the day it was set, the day it comes back, the activity, then each count with its percentage. Each homework is in the order it was set. Counts not entered are left blank. A count the list no longer holds prints without a percentage. A subject's page is in its language and direction; a French one runs left to right with its dates day first. A subject with no homework, and every subject in the blank version, gets the page with its heads and empty rules. A long activity wraps and its rules are counted, so a year of homework runs on to more pages. No name is printed.

Counts proposed from per-pupil homework marks (R-3.8-24) wait for the in-session capture that records those marks (PL-30). The pasted strip (R-3.8-15) comes in the last part of #214.

## The result

| Check | Result |
|---|---|
| «الواجبات» at the foot of 4AM1's texts book opens «دفتر النصوص · 4AM1 · اللغة العربية · الواجبات», with the continuous-assessment line and the two homework pieces of 24 September and 8 October | **Passed** |
| The page heads read «التاريخ / تاريخ إعادة الواجب», «النشاط الواجب إنجازه», «التخلي عن إنجاز النشاط» and «الاعتماد على الغير», each count «العدد · %» | **Passed** |
| With no pupil list, opening the homework of 8 October says the class has no list yet and offers no count | **Passed** |
| With a list of 45 (made up in the build tree only), 3 and 1 show 7% and 2%; «تأكيد» saves them, the row reads «3 · 7%» and «1 · 2%», and «تراجع» blanks them again | **Passed** |
| «سجل الواجبات» from the Documents tab prints 4AM1's Arabic page with both homework pieces, their two dates, the French activity wrapping inside its column, and blank counts, then 4AM2's page blank with its heads | **Passed** after a fix |

Faults found and fixed while checking:
- The steppers had no visible names; each now has its column's name above it.
- «من 45 تلميذاً» showed twice under each stepper; the share now gives the percentage alone.
- The two buttons had different widths; they now share the row.
- On the printed page, the day the homework comes back touched its column's edge; dates now use the book's smaller date style.

The review before committing found more, all fixed:
- A joint class's homework was counted against every level's pupils; it now counts against its own level's list.
- Counts stayed with a session after a correction moved its homework to another day, so they could show against other homework and leave the teacher; counts now carry the day the homework came back and are left behind when it moves.
- Today offered a count on a session recorded as not held; it now offers it on the day's first session held.
- A count kept from a longer list could open the stepper above its limit, and showed more than 100%; the stepper now starts at what the list allows, and the row gives the count alone.
- A French subject's page wrote its dates year first; it now writes them as the page does.
- The strip's counts did not agree with 1 or 2 in Arabic and French; it now names each count.

## Repeating the checks

1. Build and install the debug app: `./gradlew :app:installDebug` in `apps/android/android`.
2. In a session's details, write homework and choose a day it comes back, then confirm.
3. On that day, press «إحصاء» on the class's card on Today, or open the texts book from the Classes tab and press «الواجبات».
4. Press «طباعة سجل الواجبات», or open «سجل الواجبات» on the Documents tab, and save or print the PDF.

The core tests in `packages/core/test/homework.test.ts` and the app tests in `apps/android/__tests__/homework.test.tsx` and `homework-page.test.ts` cover:
- the record's order, each group's list on the day the homework comes back, and a pupil who left before it;
- counting only once it has come back, never past the list, corrections, and taking a count back with the history kept;
- the rounding, and a count the list no longer holds;
- a joint class's level list;
- counts left behind when a correction moves the homework, here and on every route;
- homework a correction no longer sets;
- the layer, with no name in a count;
- Today's strip on the first session held only, then the counts;
- the screen: the homework due today open, homework still out shown only, the shares, «الجميع أنجزه بنفسه», «تراجع», no list and no homework, and printing;
- the printed page: its heads, rows and blank counts, a subject with none, the blank version, a French page, the rules a long activity takes, no name, and its Documents entry.

## Still open

- **TalkBack in Arabic and text at 200%,** on a real phone.
- **Today's strip on the device,** on a day when homework comes back.
- **Counts proposed from per-pupil marks** (R-3.8-24), with PL-30's in-session capture.
- **Printing on paper,** matched against a paper texts book's homework page.
- **The pasted strip,** in the last part of #214.
