# Help on a PC (#250, part 4, fourth pull request)

Checks of 28 October 2026 for the fourth and last pull request of part 4 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [printing on a PC](web-print.md). Made-up data only.

## What changed

- **Sending a report (answer 523):** on a PC, the problem report and the crash report go through the browser's share menu where it has one. Otherwise they are copied to the clipboard (`sendText` in the web Browser module, `help/send-report.ts` in the app).
  - When the report is copied, the screen says so and where to paste it. When the browser refused to copy it, the screen says how to copy it by hand, and the preview's text can be selected.
  - The crash report is deleted once shared or copied, and kept when it was not or the share menu was closed, so the sheet can be tried again. Once copied, its send button is turned off; once shared, the sheet closes. On the phone, Android's share sheet never says whether it was closed, so the report is deleted once handed to it, as before.
  - While the browser's share menu is open, the report's button, and both of the crash sheet's, wait, so a second press neither sends the text twice nor copies it under the open menu.
  - The phone still hands both reports to Android's share sheet, unchanged.
- **The report's version line (answer 509):** on a PC it names the PC web app in place of Android's version. Reading Android's version is skipped on a PC: before this, opening the problem report in the web app crashed on the browser's missing platform constants.
- **PC words:** Help's screens read their texts through the PC wording, so a text with a PC version reads it on a PC:
  - the problem report's line on what the app sends, its version line and where to send it;
  - the crash sheet's line on when the report is deleted;
  - the demo-class timings' line, which names this PC;
  - the real names' lines in Help, on the welcome and on the setup's class list, which say the names stay encrypted in this browser;
  - a refused checksum in the update preview.
- **Words:** every new text is in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`, 74) | Pass, among them **sending a text** (`test/browser.test.ts`): through the share menu, a closed menu, the clipboard where there is no share menu or it refused, and a refused clipboard. |
| Jest (`apps/android`) | The 8 new tests pass, and the full run's 2477; its 4 failures are the two i18next notice tests, as before, from the shared checkout's installed version. The new tests, in `web-help.test.tsx` but for the last:<br>• the problem report on a PC names the PC web app, copied, refused and shared, with no Android share sheet;<br>• a crash report not copied is kept, and one copied is deleted, with the sheet saying so and its button turned off;<br>• while the share menu is open, the problem report waits and sends once, and a closed menu shows neither line;<br>• a crash report whose menu is closed is kept, with an earlier attempt's line cleared, and both buttons wait while the menu is open;<br>• a crash report shared through the browser is deleted and the sheet closes;<br>• the timings, the real-names lines and a refused checksum name this PC;<br>• every new text in French and English;<br>• on a PC, the class list and the welcome say the names stay in this browser (`real-names.test.tsx`).<br>Every earlier Help, problem-report, crash-report and class-list test still passes on the phone. |
| Type checks | Pass: every package, the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. From Today, through Settings and Help, the problem report opened with the PC web app's version line, and a made-up note was typed. The browser's share menu was replaced by one the check held open: while it was open, the button waited and a second press called it no more; once it was closed, the button was back, and neither the copied nor the refused line showed. With the share menu then taken away, sharing again copied the report: the copied line showed, and the clipboard held the previewed report with the PC web app's version line. No policy violation or error was in the console. |

## Left for later

- **The privacy and connections screens' PC words** are the founder's to write, with the privacy notice ([#483](https://github.com/djazairdev/minhajna/pull/483)); until then they read the phone's words.
- **The remaining screens' PC words:** 49 texts outside Help still name the phone or Android with no PC version, among them the phone's lock and security screens, the pilot timings, the marks, the reader and the statement. They are the last sweep of answer 509, before 0.6.0, as in [the files record](web-files.md).
- **Before 0.6.0:** as in [the files record](web-files.md) and [the updates record](web-update.md).
- **Still to check by hand:** the share menu of Chrome and Edge on Windows 10 and 11, and copying in Firefox, which has no share menu there.
