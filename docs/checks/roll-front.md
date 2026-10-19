# The roll-call book's front pages and blank sheet (#217)

Checks of 19 October 2026 for Roll-print, part 2, from [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-roll-front`. Made-up classes and pupils only.

## What changed

- **«الصفحات الأولى»** (answers 254 and 262) is a new choice in «طباعة دفتر المناداة»: four A4 portrait pages for the chosen class:
  - the cover: «دفتر المناداة», the class, the subject and the school, the school year, «الأستاذ» with the teacher's name, the boys, girls and total on the book's list today, and the marks' legend;
  - «قائمة تلاميذ القسم»: number, name and registration number in the class's order, then empty numbered rows up to 50;
  - «بيانات التلاميذ (1) · سري» and «بيانات التلاميذ (2) · سري», with 50 numbered rows each, left empty because the app does not keep parents' details or addresses. The screen says so.
  - The blank version keeps the cover's lines and the headings, and leaves the names, registration numbers and counts empty.
- **«ورقة مناداة فارغة»** (answers 254, 262 and 263) is the paper fallback, a single A4 portrait page for one of the class's session days:
  - the day is stepped through the class's session days only, starting today or at the next one;
  - one column per roll call that day for the book's group, headed by its time, or by its half when there are no bells, so a primary half-day is one column (answer 263);
  - the pupils called that day, both years' in a joint class's shared roll call, then empty numbered rows up to 50, with a box per roll call for «غ» or «ت», grey for a pupil outside that roll call's group (answer 263);
  - a key under the table, and the teacher's box to sign by hand;
  - it has no blank version, as it is blank already, and the screen hides «خانة توقيعي», as the teacher's box is always signed by hand.
- **The Roll screen** has a print icon in its header, «طباعة ورقة مناداة فارغة لهذا القسم», that opens the blank sheet of its class and day. The Roll route now carries the session's course.
- «داخلي · سري» is at the head and foot of every page of both. On the blank sheet, the notice no longer speaks of two versions.
- The output of each choice now lives in `roll-print-output.ts`. «يوم الحصص» uses `DayStep` with a new list of days to step through.

## Checks

| Check | Result |
|---|---|
| Android tests | 1297 pass, 5 of them new: the front pages, recorded and blank; the blank sheet stepping through the session days and saving one day; the Roll screen's print icon; a joint class's sheet from either year's book; and a half group's greyed boxes. All controls are named and at least 48dp |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | The Roll screen's print icon opened Roll-print on 4AM1 with «ورقة مناداة فارغة» and Monday 19 October. The saved PDF is one A4 portrait page headed «ورقة المناداة · الإثنين 19 أكتوبر 2026», with a «08:00 – 09:00» column, the three pupils, rows to 50, the key and the teacher's box. «الصفحات الأولى» saved four A4 portrait pages: the cover with the counts and the legend, the list with the three pupils, and the two confidential pages |
| Desktop Chrome, layout only | With 45 pupils, the blank sheet keeps to one page and the front pages to four |

Faults found while building and fixed:
- The blank sheet's signature box ran onto a second page; the rows' room was cut.
- The blank sheet's notice said «في النسختين», though it has only one version.

The review before committing found more, all fixed:
- In a joint primary class, the sheet listed only the book's year, though the roll call is shared, so the other year's pupils could not be marked.
- The screen said a box per session, though a primary half-day is one roll call; answer 263 keeps one column per roll call.
- A whole-class sheet gave every pupil a box in a half group's session; answer 263 greys the boxes of pupils outside it.
- The Roll screen read its course from the session key; the route now carries it.

Seen once on the emulator: the WebView's renderer was killed as the front pages started, and the screen stayed busy until the app restarted. A second try saved them. The PDF maker does not yet handle a renderer that dies.

## Still to do by a person

- Printing the front pages and the blank sheet on paper (#44).
- TalkBack in Arabic on Roll-print and the Roll screen's print icon (see #206).
