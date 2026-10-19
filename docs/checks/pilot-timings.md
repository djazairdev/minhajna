# The pilot's own timings (#220)

Checks of 19 October 2026 for [#220](https://github.com/djazairdev/minhajna/issues/220), on `feat/220-timings`. Made-up figures only.

## Part 1: where the timings are kept, and the figures

- **Kept beside the history, never in it** (choice P7, answer 267):
  - The encrypted database gains a `timing` table (schema version 2).
  - Each timing holds what was timed (a session or a roll call), the first day of its school week, whole tenths of a second, and whether a session took one tap. There is no day and no clock time.
  - The week is always the school week's first day (`timingWeek`). A timing with any other day is refused, so a single day is never kept.
  - Each batch is checked three times: in the app (`readTimings`), by the native side, which takes each field only with its own type and a real date, and by the table's own checks. One malformed timing refuses the whole batch.
  - Timings are not records. They travel nowhere: not to the teacher's other devices, nor the export, nor any document. Clearing them deletes them, and `secure_delete` overwrites them.
  - A history from 0.1.0 is upgraded in place and keeps its entries.
- **The figures, in the core** (`timingSummary`):
  - the median seconds per session;
  - the 90th percentile, by nearest rank;
  - the sessions confirmed in one tap, out of all sessions timed;
  - the minutes per week on sessions and roll calls, averaged over the weeks with any timing.
- **Several sessions at once:** a tap that confirms several sessions splits its time evenly among them, in whole tenths that add up to the tap's time (`splitTenths`).
- **Reading back:** `readTimings` refuses anything malformed, such as a clock time or a mid-week day in the week's place.
- **In the app:** `timingStore` wraps the native module. Screens reach it through `PilotTimings`. When none is given, nothing is timed.

| Check | Result |
|---|---|
| Core tests | 309 pass, 4 of them new:<br>• the split;<br>• the summary;<br>• the week's first day;<br>• reading back. |
| Android tests | 1316 pass, 3 of them new:<br>• timings kept beside the history, read back and cleared;<br>• a malformed batch, or one with a mid-week day, refused whole;<br>• nothing while the history is locked. |
| Device tests, Android 15 emulator | `StorageTest`: 13 pass, 4 of them new:<br>• timings kept with no day column, then cleared, with the history untouched;<br>• a malformed timing refused with its whole batch;<br>• each field read only with its own type, and the week only as a real date;<br>• a version 1 history upgraded with its entries kept. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
