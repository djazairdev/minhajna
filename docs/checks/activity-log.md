# The activity log, a broken history and retention

Checks of 22 October 2026 for the rest of [#235](https://github.com/djazairdev/minhajna/issues/235), after the read-only inspection in [#399](https://github.com/djazairdev/minhajna/pull/399) ([history-inspection.md](history-inspection.md)): the core in [#400](https://github.com/djazairdev/minhajna/pull/400), the screens in [#401](https://github.com/djazairdev/minhajna/pull/401), and a history changed outside the app in this pull request. Answers 425 to 428. Made-up classes, pupils and notes only.

## What changed

- **The log in the core** ([#400](https://github.com/djazairdev/minhajna/pull/400), answer 425):
  - `activityLog` works out the log from the history, never kept apart. Corrections are a later version of a session, with the fields it changed and its reason; a withdrawal; and a roll call's correction, each pupil's marks by ID and its reason.
  - Files and printing are the week's print set, outputs, and signed calendar updates, packs and layers taken in. Deletions are each erasure, with the kinds it removed; the erased versions leave no line.
  - Days go newest first, sorted when the phone's date went back. No line holds a clock time, a name, a note or free text: a reason shows only as one of the app's codes.
- **Outputs** (answer 426): a new private event, `output.recorded`, with the document, the period its file is named after, print or PDF, and whether it was blank. Recorded from:
  - a document's output, the texts book's corrections, the September check, the inspector's question, the roll-call book, and a re-pace draft (a primary one keeps its `print.recorded`);
  - a print once Android's print screen opens, which never tells the app whether it printed;
  - a PDF only once it is saved.
- **Retention** (answer 428): a private `retention.set` with the drawn defaults, and each school year's offers from its own end: pupil data in July after the next year, or after its own; lesson records three years after, when chosen; private notes with pupil data, when chosen. Nothing is erased; [#248](https://github.com/djazairdev/minhajna/issues/248) offers it.
- **The screens** ([#401](https://github.com/djazairdev/minhajna/pull/401), [Log](../design/screens/Log.png), [Settings-retention](../design/screens/Settings-retention.png)):
  - «سجل النشاط» and «مدة الحفظ» open from Settings. The log has the tabs «الكل», «التصحيحات», «الملفات والطباعة» and «الحذف», one item per line. A class is named by its name, a pupil by their number on the list, and a signed plan by its subject and year.
  - «مدة الحفظ» keeps each choice at once and shows the month each year would be offered.
  - **Not as drawn on Log:** «الأجهزة» waits for transfer and backup ([#247](https://github.com/djazairdev/minhajna/issues/247)), and «الإحصاءات» for insights, which the pilot has none of (P12).
- **A history changed outside the app** (this pull request, answer 427, [Log-broken](../design/screens/Log-broken.png)):
  - When the history does not open, its rows are read once more as they are, and inspected read-only. When they read but the chain breaks, the app shows, in place of the app and after the lock:
    - why this happens;
    - the first day that cannot be checked, and the changes since then by kind, naming no class or pupil;
    - what still checks;
    - that nothing was changed or erased;
    - the log as far as it checks, with each later change by its kind and day only.
  - The screen is guarded as a screen of records, and it locks like the app. A history that cannot be read at all, or whose key is gone, keeps its one short line.
  - **Not as drawn on Log-broken:**
    - The core trusts nothing after a break, so the board's "what came after is trusted" is left out.
    - «الاسترجاع من نسخة» and «الإبلاغ عن مشكلة» say where they will come from, as backup and transfer ([#247](https://github.com/djazairdev/minhajna/issues/247)) and problem reports ([#249](https://github.com/djazairdev/minhajna/issues/249)) are not built yet.
    - No «فحص السجل» line is added, as nothing is written to a broken history.

PRIVACY.md is unchanged: the new events stay in the private layer and leave on no route. No new permission.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `activity-log.test.ts`: a first record not listed, the fields a correction changed and its reason, every field named, a withdrawal and a record after it, a roll call's marks, a reason that is not a code never shown, files, erasures, days sorted, and lines past a break. `history-damage.test.ts`: an intact history, a changed body, a first row gone, a header moved earlier, each version counted, and an erasure before the break. `retention.test.ts`: the defaults, the last choice and its offers, a year brought in later, no outbound route, and a stored choice checked |
| Android tests | `log`, `log-text`: the empty log, each kind of line in words, the tabs, a class or a pupil gone, plan names, each language's comma, and English and French. `output-log`, `roll-print`: a print and a PDF of a document with its period and version, a cancelled save and a failed print, the texts book's corrections, and the roll-call book's year. `retention-screen`: the defaults, each choice kept privately, the offers moving, nothing erased, the Settings line, and French. `log-broken`, `history`: the broken screen read-only and guarded, locking after the lock's delay and going with the history, its days or an unknown first day, its counts and trusted log, nothing written, English, and a history that cannot be read keeping its line |
| Languages | Every new text in Arabic, French and English, with the same keys and placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** «سجل النشاط», each line read as its tab then its words, and the tabs; «مدة الحفظ», its three choices and the offers; and «تغيّر شيء من خارج التطبيق».
- **At 200% text,** right to left and left to right: the three screens.
- **On a phone,** a history changed with a database tool shows the broken screen after the lock, and nothing in it changes.

Retention's erasure offers, and erasing a pupil or a past year, stay in [#248](https://github.com/djazairdev/minhajna/issues/248).
