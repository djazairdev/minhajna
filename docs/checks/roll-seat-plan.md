# Printing the seating plan (#217)

Checks of 19 October 2026 for Roll-print, part 4, from [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-roll-seats`. Made-up classes and pupils only.

## What changed

- **«مخطط الجلوس»** (answers 254 and 265) is the sixth choice in «طباعة دفتر المناداة», shown only for a class with a seating plan:
  - every plan of the class prints, the whole class's first, then each group's, one A4 page each, with the group named;
  - the room faces as on the setup screen: «السبورة» on top, the rows from the board to the back, the seats from the start side, with the aisles;
  - a seat shows its pupil's full name only. An empty seat, or one whose pupil is no longer on the list today, is an outlined empty box to write in;
  - the pages turn landscape when a plan has more than six seats in a row. Seats shrink so that a plan of up to 12 rows keeps to one page;
  - «داخلي · سري» is at the head and foot of every page, as the plan is private;
  - it has no blank version and no «خانة توقيعي».
- **The seating setup screen** has a print icon, «طباعة مخطط الجلوس», once its plan exists. It opens Roll-print on «مخطط الجلوس» for that class, printing the plan on screen alone.
- `roll-print-book.ts` now holds the book helpers: a book's key, its name, and the book Roll-print opens on, from a course or a class. This keeps RollPrint.tsx under 300 lines.

## Checks

| Check | Result |
|---|---|
| Android tests | 1307 pass, 3 of them new, in `roll-seat-plan.test.tsx`: every plan on its own page, in order, with names, aisles and empty boxes, including a pupil who left; a wide room printing landscape, and no choice without a plan; and the setup screen's icon, shown only once the plan exists, printing its plan alone. All controls are named and at least 48dp |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | On the seating setup screen of 4AM1, the print icon appeared once «ملء بترتيب القائمة» had made the plan. It opened Roll-print on «مخطط الجلوس». The saved PDF is one A4 portrait page: «السبورة» on top, the three pupils from the start side in pairs, and empty boxes for the other seats |
| Desktop Chrome, layout only | A plan of 8 rows of 6 seats with 45 pupils keeps to one portrait page. The largest, 12 rows of 10 seats, keeps to one landscape page |

The review before committing found two small points, both fixed:
- An unused text key for a class without a plan, which never shows the choice.
- A single group's plan saved under the same file name as the whole class's; it now adds the group's name.

## Still to do by a person

- Printing the plan on paper (#44).
- TalkBack in Arabic on the setup screen's print icon (see #206).
