# Minhajna for the web

The PC web app ([#250](https://github.com/djazairdev/minhajna/issues/250), and its week, [#251](https://github.com/djazairdev/minhajna/issues/251)): the phone app's own screens, texts and rules, running in a browser on the teacher's own computer, offline once installed (PRD §6.6, answers 499 and 501).

**Status: all four parts.** The app starts, offers installing itself, asks for a passphrase of at least 12 characters (answer 502), and keeps the history encrypted in this browser, warning while the browser may clear it. It restores a backup or a transfer file from the phone, sends a transfer back, hands the work over and takes it back, and makes, opens and shares files. It offers updates and installs one only once the teacher accepts it, erases everything it keeps in this browser on request, prints through the browser's dialog, which also saves a PDF, and speaks of this PC on the screens it brings, Help among them. The PC words of the remaining screens come in a last sweep before 0.6.0. Its frame, a rail in place of the phone's bottom tabs, and the week at once, with a session's details beside it, come from the week's issue; confirming and correcting there come next. Use made-up data only.

## Build and try it

From the repository's root, install the three lockfiles, as CI does, then build and serve:

```bash
npm ci && (cd apps/android && npm ci) && cd apps/web && npm ci
npm run build
npm run serve
```

The build reads the Android app's code and its TypeScript settings, so it stops at any warning, such as a package left uninstalled, rather than build a different bundle. Then open <http://127.0.0.1:4180/> in Chrome, Edge or Firefox. The server answers on this computer only and serves `dist/` and nothing else, with the host's headers.

- `npm test` builds the bundle twice and checks it.
- `npm run typecheck` checks the web code and the scripts.
- `npm run zip` packs the build into `release/minhajna-web-<version>.zip` for the host, and `npm run check-host -- <address>` checks a deployed build. Teachers open it at <https://minhajna.djazair.dev>; the [host guide](../../docs/contributing/web-host.md) says what the host serves and how a release is deployed (answers 528, 531 and 532).

## How it is built

- **One bundle, made by esbuild** from `src/index.tsx`, which starts the phone app's `App.tsx`. `scripts/resolve.ts` redirects the app's imports:
  - `react-native` goes to `src/react-native.js`, which is React Native Web plus what it leaves out: the layout's direction, view tags for focus, the Android drawables, and inert Android-only pieces.
  - each native module goes to its web version in `src/native/`. The build stops if one is missing.
  - every package comes from this folder's own lockfile, so only one React runs.
- **Fonts and images:** the phone app's fonts, and its vector drawables written as SVGs (`scripts/drawables.ts`).
- **Version and checksum:** the version is the Android app's. `build.json` lists each file's SHA-256, and the build's checksum. The checksum is the SHA-256 of those lines as `sha256sum` writes them, sorted by name, and the same sources always give the same checksum (R-6.6-07). To check a build by hand:

  ```bash
  cd dist
  find . -type f ! -name build.json | sed 's|^\./||' | LC_ALL=C sort | xargs sha256sum | sha256sum
  ```
- **Nothing loaded from elsewhere:** the page's security policy allows only its own files, and no inline script (R-6.6-01).
- **Licences:** `licences.json` holds a notice for every package in the bundle, with the reference data's and the fonts'.

## Offline and updates

`public/sw.js` reads `build.json` once and fetches every file it lists past the browser's HTTP cache. It checks each file against its SHA-256, so a changed file or a redirected page fails the install, and one cache never mixes two builds. It keeps the files in one cache named after the checksum and answers only from it, so the app opens with no network (R-6.6-05). The worker never changes between builds, so the browser never swaps the app on its own. A new build is installed only when the teacher accepts it (R-6.6-06):

- **Looking for one (answer 516):** at each opening, when the PC is online, the app asks the worker for the server's build. The worker fetches `build.json` past every cache and checks its checksum, as an install does, then `notes.json`, checked against its line. The version and version code are read from `notes.json`, which the checksum covers, never from `build.json` alone, and a build is offered only when its version code is higher than the installed one's, so no older build, and no other build of the same version, is ever offered. Offline, or on any failure, nothing is offered.
- **The offer (Web-update):** Today shows the version, what changed in the interface's language, and the new build's checksum beside the current one's, to compare with the published ones. «تثبيت التحديث» installs it; «لاحقاً» leaves the current build running, with a line that the update waits, and the offer comes back at the next opening.
- **Installing:** the worker installs the server's build only if its checksum is the one the teacher saw, into a cache of its own beside the current one. Every file is checked as on the first install; the old cache answers until the new one is whole, and is deleted only then. Every page of the app then reloads into the new build, which asks for the passphrase; another tab of the app reloads too, its changes already saved as each was made. A file that fails its hash, or a server that changed its build meanwhile, leaves the current build as it was.
- **After:** Today says which version was installed and that the data is as it was, and the history records the update with its day, version and checksum, a device entry that never leaves the PC.
- **Release notes (answer 517):** `release-notes.json` holds at most five short lines in Arabic, French and English for one version. The build always writes `notes.json`, among the files the checksum covers, with the version and version code; the lines go in only when they were written for the version it builds, and otherwise the offer has the version and checksum alone. The release guide says when to write them.

## The lock and the history

Part 2 (answers 502, 504 and 505) puts the phone's lock and history in the browser, with the same rules:

- **The passphrase** stands in for the PIN: at least 12 characters, typed twice, compared in one Unicode form. The `.web.tsx` screens beside the PIN screens in `apps/android/src/lock` take the same props, and esbuild picks them first.
- **The history's key** is 32 random bytes for AES-GCM. On disk it is sealed with a key drawn from the passphrase by PBKDF2-HMAC-SHA256, 600,000 rounds, with a random salt. While the history is open the page holds the key in memory only, as a key it cannot read back; locking or closing the tab forgets it.
- **Rows** live in IndexedDB (`src/native/vault/`), each sealed with its own nonce and bound to its sequence number. The count and the last sequence number are sealed beside them, so a row changed on disk, moved or dropped from the end refuses to open. The pilot's timings are one sealed row.
- **Erasing content** seals every row again under a new history key, in the same transaction that keeps the new key. IndexedDB cannot overwrite old records at once as SQLCipher's secure delete does, so the browser may keep the old copies in its files for a while; the old key that opens them is sealed with the passphrase in those same old files.
- **Wrong passphrases** are counted as the phone counts wrong PINs: four are free, then the wait doubles from 30 seconds up to an hour. The wait only slows guessing on the lock page; someone who copies the browser's files can guess without it, which is why the passphrase is long and slow to try.
- **The automatic lock** uses the phone's choices, 1, 5 or 15 minutes, 5 by default. A click, a key or a wheel turn counts as use.
- **A forgotten passphrase** cannot be recovered by anyone; the PC must then be erased. «نسيت عبارة المرور؟» on the lock page leads to «مسح هذا الحاسوب» (answer 518).
- **Erasing this PC (answers 518 to 520):** from Settings, or from the lock page with no counts as the history is locked. The IndexedDB database goes whole first, with the sealed key, the history, the timings and the signing pair; then the open history's keys are forgotten and every setting under the `minhajna:` prefix goes. A delete the browser refuses leaves everything as it was. Another tab that keeps the database open for more than three seconds makes the screen say the erase waits for the app's other tabs, and stay busy: the delete cannot be called back, so the erase finishes once they are closed. The app's own files stay in the offline worker's cache, so it opens again without internet, empty as at first. Every other tab of the app reloads once the database is gone. The tab that erased keeps a mark in its session storage, so its welcome says the PC was erased; no other tab or opening sees it. As with erasing content, the browser may keep the deleted rows in its files for a while; they stay sealed, and open only with the passphrase.
- **Printing (answers 507, 521 and 522):** the document goes into a hidden frame of the page. The page's policy refuses a style element or attribute there, so the document's rules go through the frame's own style sheet, its style attributes become rules on numbered data attributes, and the bundled fonts come from the app's `fonts` folder. The print dialog opens once the fonts and pictures are loaded, under the document's file name, so "Save as PDF" proposes it. Each screen's «طباعة» and «حفظ PDF» become one «طباعة أو حفظ PDF», logged as a print. The week's print counts no pages first, as the dialog shows them, so a two-sided print gets no blank page between books. The mark sheet as a PDF and the council file print, and a password-protected file is made on the phone.
- **Help on a PC (answers 509 and 523):** the problem and crash reports name the PC web app in place of Android's version. They go through the browser's share menu where it has one; otherwise, or when it refuses, the text is copied to the clipboard and the screen says so, or says how to copy it by hand. A crash report is deleted once shared or copied, and kept when it was not or the menu was closed; while the menu is open, the buttons wait. The demo-class timings, the real-names lines in Help, on the welcome and on the setup's class list, and a refused checksum speak of this PC, the browser and the passphrase. The privacy notice and its connections keep the phone's words until the founder words them for a PC.
- **Password managers** get the usual hints: the lock's field is the current password, and the new and repeated ones are new passwords.

## Files in and out

The first pull request of part 3 (answers 506, 508 and 509) brings the phone's files to the PC:

- **Files** come through the browser's file dialog. They leave through the browser's save dialog where it has one (Chrome and Edge), which tells the app when the teacher closes it; elsewhere they leave as a download, which the page cannot follow, so it counts as saved. Browsers share few kinds of file, Chrome and Edge no ZIP at all, so a PC's transfer and marks export offer Save alone. Where a screen can only send, sending fails where the browser cannot share the file; it never turns into a download that says it was shared. Nothing is uploaded.
- **A file dialog** that a browser closes without saying so stops blocking once the page has its focus back: the next pick, from any screen, replaces it.
- **Archives** are written and read with zip.js, in the same AES-256 form as the phone's (WinZip's AE-2, strength 3), so a backup or a transfer file opens on either. A picked archive is refused as the phone refuses it: too large, not an archive, a changed file, a wrong password, or a file with no password where one is needed.
- **Text files** are read as the phone reads them: UTF-16 after its mark, then strict UTF-8, then Windows-1256, as Excel writes them. Binary files and files over 2 MB are refused.
- **QR codes** come from the JavaScript port of the ZXing encoder the phone uses. The port differs from the phone's Java 3.5.4 in two places, which `src/native/files/qr.ts` replaces with Java's: its version check did not round bits down to bytes, so a text filling a version went one version up; and its mask penalty counted cells past the code's edge as light, so it chose another mask for some texts. With both replaced, 300 made-up texts in every mode gave the same cells as the Java encoder, and `test/qr.test.ts` keeps eight of them. The build bundles only ZXing's encoder.
- **No camera (answer 506):** a PC scans nothing. Every place the phone scans already takes a file or a typed key, and on a PC the scan buttons are gone.
- **Signing (answers 508 and 510):** the PC signs with its own ECDSA P-256 pair, made once while the history is open. Its private half is sealed with the history's key, like every record (`src/native/vault/signing.ts`), so a copy of the browser's files signs nothing without the passphrase; it is opened once per unlock, imported as a key the page cannot read back, and dropped when the history locks. Erasing content reseals it under the new key. Signatures are in the phone's DER form, so either device checks the other's.
- **Words (answer 509):** on a PC, `useDeviceText` shows a text's PC wording where the catalogue has one in the interface's language, under the same key with `pc` before its last part. Restore, transfer, the devices page, the recovery sheet, exporting everything, the welcome, the reader's opening and spot-check pages, and the screens that lost their scan button or gained the save dialog have theirs; the other screens get theirs in their own parts.

## Keeping the data and installing

The second pull request of part 3 (answers 511 and 512) handles what the browser decides:

- **Keeping the data:** a browser may clear a site's data when the PC runs short of space, unless it has agreed to keep it. Clearing this site's data in the browser deletes it either way, and the warning says so. The app asks through the storage manager as the passphrase is sent, on the first run and at the first try of each opening, while the click still counts as the teacher's. Chrome and Edge decide on their own, by how the site is used, and agree for an installed app; Firefox asks the teacher. The app reads the answer as it starts. While the browser has not agreed, the lock page says so at every opening, and Today offers «نسخة احتياطية الآن», the usual backup, until one is saved that day. It cannot be put off or turned off, unlike the 30-day reminder.
- **Installing:** Chrome and Edge offer installing the app. `public/offer.js`, a small script that runs before the app's bundle, holds the offer from the page's first moment, and the app shows its own button instead. On the first run, when the browser offers it as the page shows and the app is not installed, a page before the passphrase says what installing gives, with «تثبيت «منهاجنا»», which opens the browser's own dialog, and «لاحقاً». Settings › «الأجهزة والنسخ» keeps the button while the offer lasts. A browser that makes no such offer, as Firefox, shows neither. The installed app shares the browser's storage, so nothing moves.

## The frame

The first pull request of [#251](https://github.com/djazairdev/minhajna/issues/251) (answers 524 and 525) gives the PC a frame of its own:

- **The rail:** at the start of the window, in place of the phone's bottom tabs, the app's name, the teacher and the schools, Today, Classes, which reads «الأقسام والنقاط» on a PC, and Documents, and Settings, which opens over them with its back bar as on the phone, where the design keeps the rail beside it; that waits for the week. The current tab is marked for screen readers.
- **Its foot:** the banner of a working copy on the other device, a line on where the copy here came from, and «قفل الآن», which locks at once, as the automatic lock does, and comes back to the same screen once unlocked.
- **Where the copy came from:** there is no sync, so the line states the fact: transferred from the phone, restored from a backup, opened from an export file, or back from the phone, with its day, and nothing on a PC that started fresh. A restore notes its route, and the history keeps it as a device event once it opens, which never leaves the device and shows in the log under the devices.

## The week

The second pull request of [#251](https://github.com/djazairdev/minhajna/issues/251) (answers 526 and 527) adds «الأسبوع» to the rail, after Today, on a PC only:

- **The grid:** the week's days across and its slots down, each row timed by its first session. Each session shows in its cell with its class and its lesson in Today's own words, in ink once recorded, in pencil, dashed, while proposed, and muted when the calendar takes it.
- **Above it:** the week's dates, how many sessions it holds and how many are confirmed, the weeks before and after within the school year, and, on the current week, the week's print set. Today's column says so in words.
- **The side pane:** the chosen session's class, day and time, its lesson and its state, what the plan proposes for one still to confirm, and, for a recorded one, that it can be corrected later. The sessions are one group of choices for a screen reader. The week opens on the first session still to confirm, else on the next one held.
- **Acting from the pane (the third pull request):** a session still to confirm, up to today, is confirmed as proposed, or given another outcome on Today's own sheet, with Today's «تراجع» after; its details open in the pane, with a way back to the session. A recorded one is corrected there through «تصحيح الحصة», and «صفحة الدفتر» opens the course's texts book on the page that holds it. The week's confirmations stay out of the pilot's timings, which measure Today's one tap on the phone.
- **From the core:** `weekView` gives the week's days as Today has them, each course walked once for the week, with the timetable's slots and the counts, so the phone and the PC agree.

## Handing the work over

The third pull request of part 3 (answers 503 and 513 to 515) keeps one working copy at a time, on the phone and on the PC alike:

- **Handing it over:** once a transfer file is saved, the sending device asks whether the other device opened it. Confirmed, it notes the last entry the file held, and from then on a banner over Today, Classes and Documents says since when the work has been on the other device, and that here is for reading and printing only. A change made after the file was saved would stay behind, so the file is asked for again; and while the copy is away, no transfer file leaves.
- **Read-only:** while the copy is away, every change is refused in one place, before anything is stored, with a sheet over whichever screen made it that says it was not saved and why. The device still records what never leaves it, its recovery key, its backups and the handover itself, and the log of what it prints or saves.
- **Taking it back:** «استلام النسخة» opens a transfer file or a backup from the other device, never an export. It is taken only if it continues this device's copy: every entry handed over, but the device layer's, is in it with the same ID and content, in the same order, so the copy can go back and forth any number of times. The history stays append-only: what the other device recorded since is added after this device's own entries, with the same IDs and content, then the end of the handover, all in one write. The device layer stays each device's own, so this device keeps its recovery key and backup facts. An erasure made on the other device applies here too, to entries handed over only. A backup leaves behind what the other device records after it, which the screen says.
- **Working here again:** «استعادة العمل هنا» ends the handover after asking, as what the other device recorded since would not come here.

## The native modules

| Module | On the web |
|---|---|
| Interface, Lock (settings), Crash | Kept in the browser's local storage under `minhajna:`, never a record. A browser cannot block screenshots. A crash report keeps what the phone keeps, with the browser's name left out. |
| Build, Licences | Read from `build.json` and `licences.json`. |
| Notify | None: the phone carries the reminders. |
| StorageCheck | Absent, as in a release build. |
| Storage | The browser's SHA-256 and random bytes, the passphrase lock, and the history and timings sealed in IndexedDB, a copy taken back added in one transaction. A PC has no fingerprint prompt. Erasing the PC deletes the database and the settings, and keeps the app's files. |
| Files | The file dialog, the save dialog or a download, and the share menu where the browser shares the file; archives with zip.js. A PDF to keep is the phone's only. |
| CalendarInput | Updates, plan layers and statements as files, a statement PDF giving only its link; QR codes drawn, none scanned. |
| Signature | Web Crypto's ECDSA P-256: the PC's own pair, sealed in the vault, and others' signatures checked. QR codes for statements. |
| Pdf | Printing through the browser's dialog, from a hidden frame of the page. A PDF made without the dialog, to share or keep, and the count of pages before printing are the phone's only. |
| Update | The server's newer build, through the offline worker, installed only by the checksum the teacher saw. A phone has no such module. |
| Browser | The web's own: whether the browser keeps the data, its install offer, whether this tab has just erased the PC, and sending a report's text through the share menu or the clipboard. A phone has no such module. |

A step that stays on the phone is refused with `E_WEB_PHONE_ONLY`.
