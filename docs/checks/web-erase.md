# Erasing a PC (#250, part 4, second pull request)

Checks of 28 October 2026 for the second pull request of part 4 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [the updates](web-update.md). Made-up data and passphrases only.

## What changed

- **«مسح هذا الحاسوب» (Web-erase, answers 518 to 520):** the web storage module erases everything the app keeps in this browser:
  - first, the IndexedDB database goes whole, with the sealed key, the history, the timings and the signing pair in it;
  - then the open history's keys are forgotten, and every setting under the `minhajna:` prefix goes, the interface language among them.

  A database the browser fails to delete leaves everything as it was, with the history still open, and the screen says the erase did not finish. When another tab keeps the database open for more than three seconds, the erase cannot be called back: the screen says it waits for the app's other tabs or windows, asks for them to be closed, and stays busy. Once they are closed, the erase finishes and this tab starts again.

  The app's own files stay in the offline worker's cache, so it opens again without internet, empty as at first (answer 520). Every other tab of the app reloads once the database is gone, so none goes on showing what was erased.
- **From the lock page (answer 518):** under «نسيت عبارة المرور؟», a link leads to a short erase page. The history is locked, so the page shows no counts. It says:
  - what is erased from this browser;
  - that what was handed over to the phone, and the backups and files saved elsewhere, stay;
  - that whatever reached neither the phone nor a backup is lost, and to open the PC and make a backup first if the passphrase comes back to mind.

  «مسح هذا الحاسوب» stays closed until the teacher ticks that erasing cannot be undone, and erases once however often it is pressed. A failure is said, with the page kept. «رجوع» goes back to the passphrase.
- **After erasing (answer 519):** the app starts again. The tab that erased keeps a mark in its own session storage, read once as the page loads, so its welcome says, for as long as the page lasts:
  - that Minhajna was erased from this browser, with nothing of the data or this PC's key left;
  - that the app stays installed, empty;
  - how to add the PC again from the phone's transfer or a backup.

  No other tab and no later opening sees the mark. The board's line about the phone's devices list is left out, as the phone lists no PC.
- **From Settings:** the erase screen, with its counts, keeps the phone's steps, and its route cannot be left while an erase runs. On a PC it says what goes from this browser and this PC's key, has a PC line before any backup, offers the export to a USB key or another disk, and names its button «مسح هذا الحاسوب»; the Settings row's line names this browser (answer 509).
- **Words:** every new text in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`, 70) | Pass, among them **erasing** (`test/erase.test.ts`, new), on a made-up IndexedDB and made-up storages:<br>• erasing while the history is open deletes the database and every setting under the prefix, and keeps another site's key; nothing more is read or written; the PC then starts as at first, and the tab's mark is read once;<br>• erasing a locked PC leaves a passphrase that opens nothing;<br>• with another tab keeping the database open, the erase answers that it waits, with the settings kept, then finishes once that tab lets go. |
| Jest (`apps/android`) | The 7 new tests pass, and the full run's 2463; its 4 failures are the two i18next notice tests, as before, from the shared checkout's installed version. The new tests (`web-erase.test.tsx`):<br>• the lock page's forgot line leads to the erase page with every line and no counts; the button is closed until ticked, then two quick presses erase once and start the app again once;<br>• a failed erase is said with the page kept, and «رجوع» returns to a passphrase that still opens;<br>• an erase kept waiting by other tabs says so, with the button and «رجوع» closed and the app not started again;<br>• the welcome says the PC was erased only when this tab erased it;<br>• on a PC the Settings erase screen names this browser and this PC;<br>• the Settings erase kept waiting by other tabs says so, stays busy, and tells its route to hold the screen;<br>• every new text is in French and English. |
| Type checks | Pass: every package, the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. A made-up backup was restored, leaving 54 entries and 2 key rows in the database and two settings, and a second tab was opened on the lock page. After a reload, the forgot line led to the erase page, whose button did nothing until ticked. Erasing left a database with no rows in any store, no setting, and the app's cache in place, still serving it. The welcome then said the PC was erased, in Arabic, as the language had gone too. The second tab reloaded to the welcome without the card, and so did the first after a reload. No errors in the console. |

## Left for the next parts

- **Part 4:** printing through the browser (answer 507), then the PC words of Help and the remaining screens.
- **Before 0.6.0:** as in [the files record](web-files.md) and [the updates record](web-update.md).
- **On both devices:** the erase screen's counts treat a direct transfer as not reaching another device ([#494](https://github.com/djazairdev/minhajna/issues/494)).
- **Still to check by hand:** erasing in Chrome and Edge on Windows 10 and 11, installed and in a tab, with a second tab open, and erasing from Settings once the history is open.
