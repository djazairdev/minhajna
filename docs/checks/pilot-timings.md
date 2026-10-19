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

## Part 2: the clock and «توقيتاتي»

- **The clock** (`useStopwatch`) runs while its screen is in front and the app is open. It stops while another screen covers it or the app is in the background. Only the elapsed tenths are kept: the clock's own readings never are.
  - **Today:** a session confirmed in one tap from its card is timed from Today's opening, or from the last timing there, as one tap. A choice in the outcome sheet is timed, not as one tap. A tap that confirms several sessions, such as a week of the backlog or a joint class's years, splits its time among them.
  - **Undo:** while «تراجع» can still undo a tap, its timing is held. An undo drops it, so a mis-tap never counts. A second choice for the same session adds its time and makes it no longer one tap. The timing is kept once another tap replaces it, another screen covers Today, the app goes to the background, or Today closes, so a phone that ends the app between periods loses nothing.
  - **A session's own screen:** its first confirmation is timed, not as one tap. A correction is not timed.
  - **A roll call:** its first taking is timed. A correction is not timed.
  - With no store given, outside a pilot build, nothing is timed.
- **«توقيتاتي في التجربة»** opens from the last row of the Documents tab, in a pilot build only (answer 267). This build counts as a pilot build (`PILOT_BUILD`).
  - **The four cards:**
    - the median seconds, with «و9 من كل 10 حصص في … أو أقل»;
    - the share confirmed in one tap;
    - the minutes a week on sessions and roll calls, with the weeks they average, shown even before any session is timed;
    - the term's export, «لم يتم بعد» until it exists.
  - **Rounding:** the median is rounded, and the 90th percentile rounded up, so «أو أقل» stays true.
  - **«ما يُرسل بالضبط إن شاركت»** lists the very lines shared, and «لا يُرسل أبداً» what never is.
  - **Sharing:** «مشاركة هذه الأرقام» opens the phone's share sheet with those lines. The teacher picks the app and the person.
  - **No server switch:** the design's switch to send the figures to the project's server is left out. The build asks for no network permission, and nothing is sent by the app (choices P4 and P7).
  - **Clearing:** «مسح القياسات» asks first, then deletes every timing.
  - Before the first timing, the screen says so and offers nothing to share.

| Check | Result |
|---|---|
| Android tests | 1325 pass, 9 of them new:<br>• the cards and the shared lines, rounded, minutes from roll calls alone, and the plurals;<br>• the screen, the share sheet and clearing after the question;<br>• no timings yet;<br>• the Documents tab's row in a pilot build only;<br>• Today's one tap with the time in the background left out, kept once Today closes;<br>• an undone confirmation leaving no timing, and the sheet's choice not one tap;<br>• a second choice adding its time, and the timing kept when the app goes to the background;<br>• a week of the backlog split among its sessions;<br>• a session's own screen, its correction not timed, and a roll call. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android 15 emulator, debug build | A made-up teacher's backlog session, confirmed from its own screen, showed as «15 ثانية» on «توقيتاتي», 0% in one tap, and «لم يتم بعد». The share sheet opened with the summary text only, and was closed without sending. «مسح القياسات» asked first, then the screen said «لا قياسات بعد». |

## Still to do by a person

- Timing a real teacher's week on a budget phone during the pilot (#252).
- TalkBack in Arabic on the screen (see #206).
