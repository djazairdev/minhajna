# The PC's words, the last sweep before 0.6.0 (#250)

Checks of 28 October 2026 for the last sweep of answer 509, from the pull request that adds this record. It follows [Help on a PC](web-help.md). Made-up data only.

## What changed

- **38 texts get PC wording** in Arabic, French and English. Each one is a line a PC shows that named the phone, its share menu, Bluetooth, an SD card, a finger or TalkBack. The PC versions say «هذا الحاسوب», "ce PC" and "this PC", or drop what a PC doesn't have:
  - the teacher card, the plans' missing release, the language screen, the drawn signature's pad and note, the full export's confidential line, and the erase screen's count when there is no change yet;
  - a calendar update's file and its refusal page, which no longer offers scanning, and the closure notice;
  - a records history that could not be opened, a change that could not be saved, the setup card, the classes' week, the roll call's day sheet and the texts book's corrections;
  - the pilot's timings, which this PC measures, the notifications, the broken history, the marks check's file, the statement, a pack release's move, and the reader's spot check and merge.
- **Notifications:** a PC gets none, so the screen says so and no longer offers «السماح بالإشعارات», which did nothing there.
- **The plan-error report** goes through the browser's share menu, or is copied where the browser has none, as Help's report does (answer 523). The screen says it was copied, or how to copy the report by hand, and its preview can be selected. Before, a browser with no share menu sent nothing and said nothing.
- **Offering a list as a community pack** saves its file on a PC, as the PC's transfer and marks export do, since Chrome and Edge share no JSON file. Before, every offer from those browsers failed. The button reads «حفظ للمراجعة», and the screen says to send the saved file to contact@djazair.dev by email. The offer is recorded once the file is saved, and nothing is recorded when the save dialog is closed. As everywhere on a PC, a download counts as saved. The phone still shares, with its own line, since the plan-error report's line now speaks of copying.
- **Left as they are**, each for a reason:
  - the phone's PIN, fingerprint and lock screens: a PC has its own passphrase pages;
  - «القفل والأمان»: it already swaps or hides its phone-only lines on a PC;
  - lines shown only while scanning or sharing a file, which a PC doesn't offer: the camera hint, the restore's scan line, Quick Share and the marks' share sheet;
  - «الملف المحمي بكلمة سر يُصنع على الهاتف» on the marks' file and the council pack: a PC-only line, true as it is;
  - the backup reminder's notification body, since a PC plans no notification;
  - the licences' titles for Android libraries: the PC's list holds only the data, the fonts and the packages in its bundle;
  - PC texts that rightly name the phone, key fingerprints, and screenshots of the demo class;
  - the privacy notice, the connections screen and the camera line under the privacy notice, which are the founder's to word ([#483](https://github.com/djazairdev/minhajna/pull/483)).

## Checks

| Check | Result |
|---|---|
| Jest (`apps/android`) | The 5 new tests in `web-pc-words.test.tsx` pass: on a PC the notifications screen says a PC gets none, with no button to allow; the plan-error report shows the PC's lines, goes to the browser and says it was copied, or how to copy it; offering a list saves its file, shares nothing, and records the offer only once a save is not cancelled; the language screen and the drawn signature name this PC, and the pad's hint drops TalkBack; on a phone all three keep their words and the button. `pc-wording.test.tsx` and `web-erase.test.tsx` now compare each language's PC texts by key, whatever plural forms the language has. The rest pass, but for the two notice tests (`dependency-notices`, `i18n-notices`), which read the shared local `node_modules`, where i18next is older than the lock file's; they pass in CI, which installs from the lock file. |
| Web tests (`apps/web`) | Pass (74) |
| Type checks | Pass: the Android app, and the web app with its scripts and tests |
| Web build | Pass |
| ESLint, Prettier | Pass |

## The follow-up: saving and copying on a PC

The next pull request settles what this one left for later: the screens that only shared.

- **A school layer** («مشاركة طبقة مؤسسة») saves its file on a PC, with «حفظ الملف». The screen then says where the file is, and to send it to colleagues by USB key or by email. A closed save dialog says nothing and counts nothing, and a refused save says so.
- **A statement too long for one code** leaves as a signed file saved on the PC, and the line under its buttons says so. It enters the sharing history and asks «لمن؟» only once saved; a closed save dialog records nothing.
- **The pilot's timings** go through the browser's share menu, or are copied where it has none or it refuses, as Help's report does. The screen says they were copied, or that they were not and to select them, and the lines can be selected. The button waits while the menu is open.
- The phone keeps its share sheet on all three screens.

| Check | Result |
|---|---|
| Jest (`apps/android`) | The 3 new tests in `web-pc-sending.test.tsx` pass: on a PC a school layer and a long statement are saved, never shared, and count only once a save goes through; the timings go to the browser and say whether they were copied, and the button waits while the menu is open. The phone's own tests for the three screens pass unchanged. The rest pass, but for the two notice tests, as above. |
| ESLint, Prettier, type checks | Pass |

## Left for later

- **The notifications screen on a PC** still shows its switches, which change nothing there.
- **The privacy and connections screens' PC words:** the founder's, with [#483](https://github.com/djazairdev/minhajna/pull/483).
- **Still to check by hand:** these screens in Chrome, Edge and Firefox on Windows, with a screen reader and text at 200%.
