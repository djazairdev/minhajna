# The PC's frame (#251, first pull request)

Checks of 28 October 2026 for the first pull request of [#251](https://github.com/djazairdev/minhajna/issues/251), from the pull request that adds this record. It follows [Help on a PC](web-help.md). Made-up data only.

## What changed

- **The rail (answer 524):** on a PC, the home tabs are a rail at the start of the window, as in the design's `Web-week`, in place of the phone's bottom tabs.
  - It holds the app's name, the teacher and the schools, Today, Classes, which reads «الأقسام والنقاط» on a PC as on the board, as does its page's heading, and Documents, and Settings.
  - Settings opens over the tabs with its back bar, as the deeper pages do and as on the phone. On the board it is a rail item beside the main area; see below.
  - The current tab is marked with `aria-selected`, which the browser reads, where the phone's `accessibilityState` is not passed on by the web.
  - The phone keeps its bottom tabs, unchanged.
- **Lock now:** «قفل الآن» at the rail's foot locks at once through the same step as the automatic lock, so the screen it was on comes back once unlocked.
- **Where the copy came from (answer 525):** the rail's foot says how and when the copy here arrived, never a sync: transferred from the phone, restored from a backup, opened from an export file, or back from the phone. A PC that started fresh shows nothing.
  - A restore notes its route, and the history records it as the device event `copy.received` once it opens again. Like the other device events, it never leaves the device: an archive, a backup or a transfer keeps only its kind and digest, never the route.
  - A copy taken back is already recorded by the end of its handover, which the line reads as back from the phone; working here again does not change the line.
  - The log lists a restored copy's route under the devices. A route that is not one of the three is ignored, by the line and the log alike.
- **Code:** the home tabs move to `navigation/HomeTabs.tsx`, and App hands down its lock step through `lock/lock-away.ts`.
- **Words:** every new text is in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Core (`packages/core`) | Pass, among them **where the copy came from** (`test/devices.test.ts`): the last restore's route or the copy back from the other device, unchanged by working here again, a route that is not one ignored, also by the log, the log's line under the devices, and no route in an archive. |
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`) | Pass |
| Jest (`apps/android`) | The 8 new tests pass (`web-rail.test.tsx`):<br>• on a PC, the rail with the name, the schools, the current tab and Settings, and no bottom bar;<br>• the home tabs and the Classes page on a PC, with Classes named as on the board and Today current;<br>• a tab and Settings open from it, and Lock now locks once;<br>• the foot's line after a restore, then after the copy came back;<br>• a noted restore recorded once, in the device layer;<br>• the phone's bottom bar;<br>• the log's line;<br>• every new text in French and English.<br>The backup restore (`restore-screen.test.tsx`) now also checks that the opened history keeps its route. |
| Type checks | Pass |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. After a made-up backup was restored, the rail stood at the start of the window, on the right in Arabic and on the left in English, 232 px wide, with no bottom tabs. It held the name, the school, the three tabs with Today marked current and Classes as «الأقسام والنقاط», Settings, the line "This copy was restored from a backup on 28 October" and Lock now. Classes became the current tab; Settings opened and its back bar returned to Classes; Lock now showed the passphrase page, and the passphrase brought back Classes, still current. No error was in the console. |

## Left for the next pull requests

- **#251:** the week, with the selected session in a side pane (answers 526 and 527), its link in the rail, then confirming and correcting in the pane and the texts book's page.
- **Settings beside the rail:** on the board, Settings opens in the main area with the rail kept. Here it opens over the whole window, as on the phone, until the week puts its own screen beside the rail.
- **The deployment's name:** in the national system the rail shows the name the Ministry sets, never «منهاجنا» (WebShell); the pilot keeps the project's name.
- **Still to check by hand:** the rail with a screen reader and at 200% text in Chrome, Edge and Firefox on Windows.
