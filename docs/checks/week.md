# Drawing the week (#28)

Checks of 17 October 2026 for the second pull request of [#28](https://github.com/djazairdev/minhajna/issues/28), on `feat/28-draw`. It builds on the core rules of #145 and the WeekGrid of #146. Made-up schools and classes only.

## What changed

- **Setup-5-Week** is setup's step 4 of 5. It shows one of two things:
  - the week drawn so far, with the day it starts and its sessions a week, read cell by cell;
  - a line saying the week is not drawn yet.
  
  Below that, a button draws or changes the week, and a note says that receiving the school's timetable by code or file comes in a later version (§2.5). Bell times come with #29, so the step leads to the tabs for now.
- **Week-draw** draws the week with pens:
  - one pen for each class, one for the teacher's own time, and an eraser;
  - a tap puts the pen's class in the slot, whole and every week, and a second tap with the same pen clears it;
  - Saturday and a fifth morning slot are options, kept on the version. One can't be removed while its slots hold something, and TalkBack says why;
  - under the grid: each class's sessions, the total, and the clashes.
- **Saving the week:**
  - A class's slots go to its course for the year, made in the school's first subject when it has none yet.
  - Each change is saved once the taps pause; «حفظ الأسبوع» saves at once.
  - The first week starts with the school year. A changed week starts on the day it is drawn and adds one version, never changing a recorded session (§4.6).
- **Rows are named «ص1» to «م4»** (morning and afternoon, by position), never by clock times.
- **Class names in the totals are isolated**, so a Latin name such as 4AM3 does not turn an Arabic line around.

A slot's group, A/B weeks, subject, room and kind of own time come with Week-slot in the next pull request.

## Checks

| Check | Result |
|---|---|
| Android tests | 537 pass, 27 of them new: the rules (which version a drawing edits, each pen, courses, totals, what sits on Saturday), the drawing (default pen, one version from the year's start, clearing, own time, erasing, both options and their lock, saving after a pause, a later week from the day it is drawn, 200% text, every control named and 48dp in the three languages and both directions) and the setup step (with and without a week, its totals, cells read one by one, 200% text, names and targets) |
| Core tests | Unchanged and passing |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | From the classes, «التالي» opened step 4 of 5 with «لم يُرسم الأسبوع بعد» and the note on the school's timetable. In the drawing, 4AM3 and «القسم التجريبي» were drawn in five slots, and the totals read «4AM3: 2 · القسم التجريبي: 3 · المجموع: 5 حصص» right to left, with «لا تعارض في الأسبوع». The changes were kept without pressing save, and step 4 then showed the week «ساري من 21/09/2026 · 5 حصص في الأسبوع». A long class name stayed whole on one line, its day wider, every row even |

## Still to do by a person

TalkBack in Arabic on these screens, with the other setup screens (see the BrowserStack note on #20).
