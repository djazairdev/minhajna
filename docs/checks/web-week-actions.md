# Acting from the PC week's pane (#251, third pull request)

Checks of 28 October 2026 for the third pull request of [#251](https://github.com/djazairdev/minhajna/issues/251), from the pull request that adds this record. It follows [the week on a PC](web-week.md). Made-up data only.

## What changed

- **Confirming in the pane (answer 526):** a session still to confirm, up to today, shows Today's «تمّت كما هو مقترح» and «نتيجة أخرى» under what the plan proposes. A later session keeps its proposal only, as on Today, which confirms nothing before its day.
  - Confirming records it as Today does, and Today's «تراجع» shows after it, in the week's own snackbar. While no session was chosen, the pane moves on to the next one to confirm.
  - «نتيجة أخرى» opens Today's own outcome sheet, with the session's class, time and lesson, the plan's next and previous items and where the lesson would carry over. The sheet keeps the session it was opened for, so its reason step stays once the choice is recorded, and the focus goes back to «نتيجة أخرى» when it closes.
  - «تفاصيل الحصة» opens the session's own screen inside the pane, beside the week, with «العودة إلى الحصة» above it. Saving there brings the pane back to the session. While it is open, the session stays chosen, so an undo that changes the session to confirm first leaves what was typed in place. Moving to another week closes it.
  - **The pilot's timings:** the week's confirmations are not timed. The timings measure Today's one tap on the phone, and a confirmation from the week takes a click to choose the session first.
- **Correcting a recorded session:** «تصحيح الحصة» opens the same screen in the pane, as a correction that keeps the first version.
- **The texts book page:** «صفحة الدفتر» opens the course's texts book on the page that holds the session, its month's page, instead of the latest. The texts book takes the session from its route; without one it opens as before.
- **Bidi:** the sheet's line names the class and the lesson isolated, so «4م1» reads whole in English.
- **Words:** «تصحيح الحصة», «صفحة الدفتر» and «العودة إلى الحصة» are in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Core (`packages/core`) | Pass (873) |
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`) | Pass |
| Jest (`apps/android`) | The 8 new tests pass:<br>• in `web-week-actions.test.tsx` (new): a session confirmed from the pane is recorded, and its undo takes it back; another outcome is chosen on Today's sheet, which stays for its reason; the session's details open in the pane and lead back to it; a recorded session is corrected in the pane, and its texts book opens on it; a later session keeps its proposal, with nothing to confirm before its day; a session open in the pane stays open when an undo changes the session to confirm first; the week's confirmations stay out of the pilot's timings, which Today's keep;<br>• in `book-view.test.tsx`: the texts book opens on the page of the session it is given.<br>The week's 10 tests pass with the pane's new props. The rest pass, but for the two notice tests (`dependency-notices`, `i18n-notices`), which read the shared local `node_modules`, where i18next is older than the lock file's; they pass in CI, which installs from the lock file. |
| Type checks | Pass |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. After a made-up backup was restored, the week of 18 to 22 October opened on its first session to confirm. «تمّت كما هو مقترح» recorded it and moved the pane to the next one, with «تراجع» in the snackbar; «تراجع» took it back. «نتيجة أخرى» opened the sheet over the window; «لم تُعقد الحصة» recorded the session and the sheet asked for a reason, then closed. «تفاصيل الحصة» opened the session's screen in the pane, 340 pixels wide beside the week, and «العودة إلى الحصة» came back to the session. On the session not held, «تصحيح الحصة» showed the correction's notice in the pane, and «صفحة الدفتر» opened the texts book of 4م1 on «الصفحة 1 · أكتوبر 2026», in English "Page 1 · October 2026". No error was in the console. |

## Left for later

- **The session's screen in French and English:** its first line names the class without isolating it, so «4م1» shows split there, on the phone too. The screen is at its 300-line limit, so this goes in its own change.
- **Settings beside the rail:** as in [the frame's record](web-rail.md).
- **Not drawn in the week yet:** as in [the week's record](web-week.md).
- **Still to check by hand:** the pane's actions with a screen reader and at 200% text in Chrome, Edge and Firefox on Windows.
