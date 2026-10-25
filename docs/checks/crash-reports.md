# Crash reports (#249)

Checks of 25 October 2026 for the second pull request of [#249](https://github.com/djazairdev/minhajna/issues/249), on `feat/249-crash`. Made-up records only. The first pull request, Help and problem reports, is checked in [help-reports.md](help-reports.md).

## What changed

- **«تقارير الأعطال»** in Help is off until the teacher turns it on (answer 483). Turning it off deletes a kept report. If the switch can't be saved, it keeps its old value and says so.
- **While it is on, a crash that stops the app keeps one file** in the app's own folder, outside the history. The file holds:
  - the error's type;
  - where the stack says it happened: a JavaScript function's name with its line and column in the bundle, or a native class, method and line, never a file path;
  - the route names of the last ten screens;
  - the version and Android's version.
- **What is never kept:** the error's message, since it may hold data. If a JavaScript stack's first line can't be matched to its message and set aside, no place in the code is kept.
- **JavaScript crashes**, an error in a screen's render among them, reach the same handler as native ones, through an error boundary around the app. A crash already kept from JavaScript isn't kept again by its native exception.
- **At the next start,** «تقرير عطل، قبل إرساله» shows over Today exactly what would be shared:
  - «إرسال» opens Android's share sheet with that text;
  - «عدم الإرسال» sends nothing;
  - either way the file is deleted.
  - Closing the sheet chooses nothing: it comes back at the next start, not after an unlock.
  - A file that doesn't read as a report is deleted.
- **What the app doesn't do:** it makes no request, and logs nothing in the activity log. Android's backup takes neither the file nor the switch, and erasing the phone's data deletes both. NETWORK.md and «ما يتصل به التطبيق، ولماذا» say so.

## Checks

| Check | Result |
|---|---|
| Android tests | 2351 pass, 11 of them new. They cover: the type and frames kept without the message or a path, and none when the message can't be set aside; a crash kept only while the switch is on, and passed on; a render error through the boundary; the sheet's lines exactly as shared; «إرسال» and «عدم الإرسال» deleting the report; closing until the next start; a report that doesn't read deleted; Help's switch off at first, deleting a kept report, and saying when it didn't save; the steps given to native memory; every text in French and English |
| Core tests, type check, ESLint, Prettier | Pass |
| Audit | Clean after two rounds. The first round's four findings were fixed before this commit: render errors, the switch failing to save, unreadable reports, and the sheet coming back after an unlock |
| Android 15 emulator, release build | **Switch off:** a forced crash (`am crash`) kept nothing. **Switch on:** it was saved, and the next crash kept only the type, ten `class.method:line` frames, the steps "Today › Classes › Today › Help", version 0.4.0 and Android 15. **Next start:** the sheet showed those lines. Closed, it didn't come back after the app locked and was unlocked, and it came back at the next start. **«إرسال»:** the share sheet received the shown text, and the file was gone. **Switch turned off with a report kept:** the file was deleted |

## Still to do by a person

TalkBack in Arabic on the switch and on the sheet, at 200% text. A real crash on a real phone, sent to a mail app (see #206).
