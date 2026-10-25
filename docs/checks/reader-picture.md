# Reader mode: the reader's start and the school's picture

Checks of 25 October 2026 for [#246](https://github.com/djazairdev/minhajna/issues/246), part 2 (R-Picture, answers 489 and 490), after [#470](https://github.com/djazairdev/minhajna/pull/470) (part 1), from the pull request that adds this record. Made-up keys, classes and statements only.

## What changed

- **The reader's start:** «فتح بيان أستاذ» on the welcome, under «لنبدأ», leads to the privacy notice, then to «صورة المؤسسة» as the home.
  - On a fresh install it leads through the first PIN first, like «لنبدأ» and the restore.
  - The home has no way back to the welcome.
  - The app opens there again while setup is not finished and a statement is kept. Nothing records the choice: a reader who kept no statement starts from the welcome again.
- **The home** heads itself with Settings and Help. It opens a new statement and the list of those received, and offers «إعداد التطبيق للتدريس», which goes to setup's first step. Teachers reach the same picture from «البيانات المستلمة».
- **Settings and Help for a reader:** before setup is finished and while no school is entered, Help leaves out the demo class and the plan-error row, and Settings shows only these rows:
  - «البيانات المستلمة»;
  - the lock, backup and language;
  - the activity log, the export of all files and erasing;
  - help and the privacy notice.
- **«صورة المؤسسة»:**
  - **Scope:** the statements received for the latest school year among them. The heading gives the day the last of them was received.
  - **Misdated statements:** a statement dated after the day it came, or outside its school year (August to July), is left out, and a line says how many. So no key, and no phone with a wrong clock, can take over the picture or a cell. In «البيانات المستلمة» its row says «خارج الصورة», and opened, it says why.
  - **Layout:** one grade at a time, as chips in the profile's order. Rows are the sections, by name. Columns are the subjects with a statement, in the profile's order.
  - **Cells:** each cell is the latest statement for its class and subject, by its day, then the one kept last. It reads «لا تأخر» or «تأخر» and the sessions, then the day as dd/mm, and opens that statement. An empty cell reads «—», and TalkBack says no statement came.
  - **Counts:** each grade says how many statements its cells show, and from how many teachers.
  - **Schools:** rows are grouped by school once the teachers are named with two schools or more. Those named with none come last, under «دون مؤسسة مذكورة». Until then, with two teachers or more and one not named with a school, a line suggests naming teachers by school, since rows of two schools would merge.
- **From the list:** «صورة المؤسسة» goes back to the reader's home when it is under the list, rather than opening a second copy.
  - **No judgement:** a line says nothing is ranked or coloured for a person.
- **Wording:** a tampered statement now reads «عُدّل البيان بعد إصداره، فلا يُعتمد ولا يوضع في الصورة.», as answer 489 says.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `statement-picture.test.ts` (3): only the latest year; one part per grade with the statements and keys in its cells counted; each cell the latest statement by day, then the one kept last; rows by section name; the heading's day; nothing received gives an empty picture. A statement dated after it came, a year in the future, a statement outside its year and a malformed year left out and counted. Rows grouped by school only when two schools are named, those with none last, else the sign that rows may merge |
| Android tests | `reader-picture.test.tsx` (8). The welcome's reader start leads through the notice to the home, with the welcome no longer under it; the list's «صورة المؤسسة» goes back to the home; Help from the home has no demo or plan-error row; and the app's start route becomes the home once a statement is kept. On a fresh install, the start goes through the first PIN to the notice for reader mode, then home. The picture in Arabic, French and English, with no missing text and no accessibility problem: the profile's grade order, the counts, a cell's delay and day, cells opening their statements, an empty cell absent as a button, and the home's Settings, Help and teaching buttons. The left-out line in the three languages. A misdated statement marked in the list and when opened, and left out of the picture. Grouping by school. Settings with nothing set up. `welcome.test.tsx` and `history.test.tsx`: the welcome lists the reader start. `help.test.tsx`: the plan-error row for a teacher whose setup is finished |
| Emulator | Release arm64 APK on Android 15 (API 35). **Teacher's path:** installed over a teacher's history with two statements kept. «البيانات المستلمة» → «صورة المؤسسة» showed «السنة الرابعة متوسط: بيانان من أستاذ واحد» and the Arabic and mathematics cells («لا تأخر», 25/10); a cell opened its statement. **Reader's start:** the app's data cleared, «فتح بيان أستاذ» led through the first PIN and the notice to the home, and Back left the app. Relaunched with nothing kept, the app opened on the welcome. After the reader start again, a statement PDF opened from the home was kept and showed in its cell. After a full restart, the app opened on the home. Settings showed only «البيانات المستلمة», the lock, backup, language, the log, the export, erasing, help and the notice. «إعداد التطبيق للتدريس» opened setup's step 1, and Back returned home. No error in the log |
| Type check, ESLint, Prettier | Pass |
| Languages | Every new text in Arabic, French and English, with the same placeholders and plural forms |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the grade chips read as radios. Each cell reads its section, subject, delay and day as one button. An empty cell says no statement came. A school's heading reads as a heading.
- **On a phone:** the picture right to left and left to right, with text at 200%, on Android 8 at 360×800, scrolling sideways when a grade has many subjects. Also a director's phone started as a reader from a fresh install, then set up for teaching from the picture.
