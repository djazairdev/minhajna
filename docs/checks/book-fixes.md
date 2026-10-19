# Texts-book corrections for the director (#218)

Checks of 19 October 2026 for [#218](https://github.com/djazairdev/minhajna/issues/218), on `feat/218-book-fixes`. Made-up classes and records only.

## What changed

- **«تصحيحات دفتر النصوص»** (Book-fixes, R-3.8-16, R-5.5-02, answer 266) shows a month's corrections to the texts book, for the director's monthly check.
  - **Where it opens:**
    - a new row on the Documents tab, on this month and every class;
    - a button in the texts book, «تصحيحات أكتوبر», on its month and class.
  - **Choosing what shows:** chips pick a month of the school year up to today, and «الكل» or one class.
- **What counts:**
  - every version of a confirmed session or of a logged extra session after its first record, the same day too;
  - a withdrawn confirmation, then its new record;
  - an extra session moved, changed kind or removed.
  - A correction belongs to the month of the entry it corrects, so the director finds it beside that month's paper page. An extra session moved from one month to another shows in both, as both months' pages change, under the day it stood on in each.
  - A change the book does not show, such as a re-record with the same words, is left out.
  - The rule is in the core, `bookCorrections`.
- **Each correction's card:**
  - the class, the day and the time;
  - what changed, with «كان» struck through and «أصبح»:
    - the session's result, written as the book writes it, in the subject's language;
    - its homework apart, its due day alone when only that moved;
    - or the extra session's day and time, with its kind when that changed.
  - «صُحّحت يوم 16/10/2026», then the reason's kind («أُضيف بعد التأكيد», «خطأ في الإدخال», «سبب آخر») or «دون ذكر سبب». A reason typed in words stays in the private note and never prints.
  - **The paper note:** «كُتبت في الدفتر قبل التصحيح: تُصحَّح هناك أيضاً، وتُوقَّع.» shows when the texts book, or page 08 for an extra session of any kind, was printed with that day before the change. The history keeps days, not times, so a print on the day of the change counts as before it. This is the core's `printedBefore`.
- **Printing:** «طباعة» and «حفظ PDF» make A4 portrait pages with one row per change, black on white, with no scores or colours (R-2.6-07). «كان» and «أصبح» take the direction of their own words, so a subject taught in French reads left to right on an Arabic page. A month without corrections says «لا تصحيحات في هذا الشهر.» and still prints.

## Checks

| Check | Result |
|---|---|
| Core tests | 305 pass, 4 of them new:<br>• a first record is no correction, and later versions are, the same day too, with their reasons;<br>• a withdrawal and its new record;<br>• an extra session moved to another month, in both months, then removed;<br>• a page printed before the change. |
| Android tests | 1313 pass, 6 of them new:<br>• each change's label, «كان» and «أصبح», day, reason and paper note, a class alone, and a month without corrections;<br>• a catch-up session's kind and month changed, listed in both months, against page 08;<br>• the screen's cards, the struck-through print and the class chip;<br>• the empty month's print;<br>• the Documents tab's row;<br>• the texts book's button.<br>All controls are named and at least 48dp. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | The Documents tab's row opened October and «الكل». The card for 4AM2 showed its support session of 1 October removed on 18 October, «دون ذكر سبب». The saved PDF is one A4 portrait page with that row, «كان» struck through. |

## Still to do by a person

- Showing the page to a director at a monthly check, on the phone and on paper (#44).
- TalkBack in Arabic on the screen (see #206).
