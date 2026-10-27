# Handing the work over (#250, part 3, third pull request)

Checks of 27 October 2026 for the third pull request of part 3 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [keeping the data and installing](web-keep.md). Made-up data, keys and passphrases only.

## What changed

- **One working copy at a time (answer 503), on the phone and the PC alike.** Two device events, which never leave the device: `handover.sent`, with the hash of the last entry the transfer file held, and `handover.ended`, taken back or taken over. `deviceFacts` gives `handedOver`, the day and that hash, while the copy is away.
- **Handing it over:** once a transfer file is saved, the transfer page asks whether the other device opened it. Confirmed, it records `handover.sent`, and says that work continues on the other device. A change made here after the file was saved would stay behind, so the page asks for the file again instead; and while the copy is away, no transfer file leaves, as each would be one more working copy.
- **Read-only (answer 513):**
  - a banner over Today, Classes and Documents says since when the work has been on the other device and that here is for reading and printing only, with «استلام النسخة» and «استعادة العمل هنا»;
  - every change is refused in one place, `AppData`, before anything is stored: records, erasures and a pupil's erasure alike. The device still records its recovery key, its backups, the handover itself and the log of what it prints or saves (`recordsWhileHandedOver`);
  - a refused change opens a sheet that says it was not saved and why, with the same two ways out. It is drawn once, beside the navigator, so a screen over the tabs shows it too;
  - «استعادة العمل هنا» asks first, as what the other device recorded since would not come here, then records the end of the handover. The banner's sheet gives the focus back to its button.
- **Taking it back (answers 514 and 515):**
  - «استلام النسخة» opens the restore page with a transfer file or a backup from the other device; an export is refused, and the page does not offer one. With a backup, the page says that what the other device records after it does not come here;
  - the copy is taken only if it continues this device's (`takenBack` in `packages/core/src/handover.ts`): every entry handed over, but the device layer's, is in it with the same ID and content, in the same order, and it leaves out nothing but the device layer. As entries keep their IDs and content wherever they are linked, the copy can go back and forth any number of times. Otherwise it is refused as not continuing this copy, and nothing is stored; the refusal points to «استعادة العمل هنا»;
  - the phone's history refuses deletions, so the take-back only appends: what the other device recorded since is linked on after this device's own entries, with the same IDs, days and content, then `handover.ended`. The whole history is checked first, and everything is stored in one write, `appendEntries`, new to the storage module on the phone and the PC: a take-back that fails stores nothing, and trying again works;
  - the device layer stays each device's own: none of the other device's entries are added, not even its erasures, so the erasure its restore made of this device's keys, and its own recovery key, never come here. This device keeps its recovery key and backup facts;
  - any other erasure made there applies here too, to entries handed over only, and runs as the history reopens; a copy whose erasure names an entry this device made since is refused;
  - the entries added keep the other device's days, which may come before this device's last ones; the log sorts by day already, as a phone's date can go back.
- **The log** shows the handover and its end, under the devices.
- **The web app:** React Native Web's text input has no `currentlyFocusedInput`, which the bottom sheet's keyboard handling reads; `src/react-native.js` adds it from `currentlyFocusedField`.
- **Code:** the activity log's change helpers moved to `packages/core/src/log-changes.ts`, keeping files under 300 lines. The sync check names the handover as one record, as the core's record keys do.
- **Words:** every new text in Arabic, French and English.

## Checks

| Check | Result |
|---|---|
| Core tests (`packages/core`, 869, 8 new) | Pass:<br>• what is recorded while the copy is away;<br>• the fact kept until the handover ends, a malformed hash ignored;<br>• the other device's entries added after this one's, which stay as they were, the key and last backup kept, the history whole;<br>• an erasure made on the other device applied here;<br>• a copy of another history refused, and any copy when nothing was handed over;<br>• this device's key kept when the other device set its own;<br>• an export without the private notes refused, and a copy whose erasure names a print made here since;<br>• back and forth: the PC hands the copy back to the phone, the phone records more and hands it over again, and the PC takes it, its own entries unchanged and every note there. |
| Other packages (`npm test` at the root) | Pass, the sync check's 21 among them |
| Jest (`apps/android`) | The 12 new tests pass:<br>• **take-back:** a phone's copy sent to a PC through a transfer file, restored there, the PC's own key set and a note recorded, and taken back: the phone's entries unchanged, the PC's note added, the phone's key kept, the handover ended; a failing write storing nothing, and the copy taken when tried again; a backup taken, an export refused; another history refused, and any copy when nothing was handed over, storing nothing;<br>• **on screen:** the transfer's confirmation recording the handover; no file while the copy is away; a change after the file asking for it again; the banner; a note refused with the sheet alone on screen, a print kept, the sheet opening «استلام النسخة»; taking over from the refusal sheet and from the banner, changes then saved and the banner gone; nothing while the copy is here; «استلام النسخة» offering a transfer or a backup only, and the backup's line; every text in French and English.<br>The full run: 2449 pass. The 4 failures are the two i18next notice tests, as before: the shared checkout's installed i18next is 26.4.5 while the lockfile has 26.5.4. CI installs from the lockfile. |
| Web tests (`apps/web`, 60, 1 new) | Pass: entries added after the last all at once, or none of them when one is out of order, already kept, or the list is not a list |
| Device test (`RestoreTest`) | Written, not run here: a copy taken back added after the last entry, all or none, and kept after reopening. CI builds the app's Kotlin; the device test runs with `connectedDebugAndroidTest` on an emulator |
| Type checks | Pass: every package, the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Bundle | `app.js` is 3.4 MB minified (918 KB gzipped). `dist/` is 7.4 MB |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English:<br>• a made-up backup restored, a transfer file saved, then the card asking whether the other device opened it; confirmed, it said work continues there;<br>• after a reload and the passphrase, the banner over Today with since when, and its two buttons;<br>• the transfer page saying no file leaves while the copy is away;<br>• Settings › «مدة الحفظ», a screen over the tabs: choosing another period opened the refusal sheet over it, and the choice stayed; «استلام النسخة» in the sheet opened the take-back page;<br>• «استعادة العمل هنا» opened its sheet; confirmed, the banner was gone;<br>• no errors in the console once the text input's focus was added. |

## Left for the next parts

- **Part 4:** accepting an update, «مسح هذا الحاسوب», which also deletes the sealed signing pair, and printing through the browser; the PC words of those screens and of Help.
- **Before 0.6.0:** as in [the files record](web-files.md).
- **Still to check by hand:**
  - `RestoreTest` on an emulator;
  - a handover from a real phone to Chrome or Edge on Windows 10 and 11 and back, by a transfer file and by a backup, with TalkBack on the phone's banner and sheets.
