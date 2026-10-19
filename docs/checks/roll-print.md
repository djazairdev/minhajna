# Printing the roll-call book (#217)

Checks of 19 October 2026 for Roll-print, part 1, from [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-roll-print`. Made-up classes and pupils only.

## What changed

- **Where it opens** (answer 260): the Month screen's «طباعة هذا الشهر» and the yearly summary's «طباعة الملخص السنوي», the Class page's «طباعة دفتر المناداة» row, and the Documents tab's «دفتر المناداة» row. From the tab it opens on the first class and the latest month, with chips for each class and month.
- **The monthly spread** (answers 253 and 261) is two A4 portrait pages for each class:
  - page 1 holds the number, the name and days 1 to 20; page 2 holds the number, days 21 to the month's end, «غ», «ح-ف», «تواريخ الغياب» (such as «12م، 15») and «التأخر» with its dates;
  - «ح-ك» gets its own column only when pupils' possible attendance differs, otherwise it sits under the table with the totals, the rate and «حتى» today's date;
  - both pages share their head, the month and the Hijri months it spans, so their rows line up;
  - marks are the Month screen's: «-», «ǀ», «+», in brackets when justified, and «+م½»;
  - weekends, national days and holidays are solid grey, and days with no session of the teacher's with the book's group, or before counting starts, are dotted, so a white cell means present up to today. A day with a session stays white, a make-up day too, and after today it is left to fill by hand, as the footer says. The legend explains both shadings and the «م» after a date, and a counting start in the month is stated;
  - each pupil on the list gets a row, then empty numbered rows up to 50. Rows shrink so that a class always keeps to one spread;
  - page 2 ends with the signature boxes of the teacher, the director and the inspector, the last two dated.
- **The yearly summary** is one A4 landscape page for each class, its choice naming its first and last months, July included when a roll call was taken then: «ح-ك», «غ», «ح-ف» and the rate for each month and the year, the class's totals, and the same signature boxes.
- **Both** print as recorded or blank (names, shading and empty rows kept), through «طباعة» or «حفظ PDF» only (answer 260). «داخلي · سري» is at the head and foot of every page.
- **«خانة توقيعي»** shows with «بتوقيعي المرسوم» disabled until the drawn signature (#236), as in answer 251, so the boxes print blank. The PDF password stays out (answer 231).
- **The Documents tab and «طباعة الأسبوع»** now print the portrait spread for every class. The landscape month is gone.
- **Print and save** now share one hook, `output-run.ts`, used by a document's output and Roll-print.

## Checks

| Check | Result |
|---|---|
| Android tests | 1292 pass, 16 of them new; 5 tests of the landscape month are removed or moved. They cover: the spread's two pages and split; shading; marks and dates; «ح-ك» as a column; rows shrinking past 50; the yearly page; the screen opening on the class and month; a morning of two sessions counting once; the yearly summary saving landscape; the blank spread; another class from the Documents tab; the disabled signature; a justified date with «م»; a newcomer's «ح-ك» column; the counting start; a weekend roll call printed white; one book per class; the spread inside a print set; and the Month and Class page print buttons. All controls are named and at least 48dp |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | Roll-print opened from the Documents tab on 4AM1 and October. The saved PDF has two A4 portrait pages. Absences show on 12 and 15 October, with «(-)» for the justified one. Fridays, Saturdays and the autumn holidays are grey, and days with no session are dotted. Page 2 gives «12م، 15» and a late arrival on 12 October, with the footer «ح-ك 2 لكل تلميذ · … · حتى 19/10.» and the three signature boxes. The yearly summary saved as one A4 landscape page with October's figures and the class's totals |
| Desktop Chrome, layout only | The yearly summary keeps 45 and 55 pupils on one page with the signature boxes, and a spread of 60 pupils keeps to two pages |

Faults found while building and fixed:
- The signature boxes ran onto a third page; the rows' room and the boxes' height were cut.
- The yearly summary's boxes ran onto a second page with 45 pupils, as rows cannot get shorter than their text; the figures' type and the rows' room were cut.
- The counting start was not said when no figure was counted yet.

The review before committing found more, all fixed:
- A head comment line ran past 80 columns.
- Session days after today printed white, though the legend says white is present; the footer now says the days after today are filled by hand.
- A make-up day outside the working week printed grey with its mark.
- In a joint class, a day with a session for the other year only printed white.
- The yearly choice always said September to June, though July is added when a roll call was taken then.
- The «م» after a date had no legend, in French and English especially.
- A test held literal bidi characters.

## Still to do by a person

- Printing the spread and the summary on paper (#44).
- TalkBack in Arabic on Roll-print (see #206).
