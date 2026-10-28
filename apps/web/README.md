# Minhajna for the web

The PC web app ([#250](https://github.com/djazairdev/minhajna/issues/250)): the phone app's own screens, texts and rules, running in a browser on the teacher's own computer, offline once installed (PRD §6.6, answers 499 and 501).

**Status: parts 1 to 3 of four, and the first pull request of part 4.** The app starts, offers installing itself, asks for a passphrase of at least 12 characters (answer 502), and keeps the history encrypted in this browser, warning while the browser may clear it. It restores a backup or a transfer file from the phone, sends a transfer back, hands the work over and takes it back, and makes, opens and shares files. It offers updates and installs one only once the teacher accepts it. Erasing the PC and printing come next in part 4; until then those steps are refused. Use made-up data only.

## Build and try it

```bash
npm ci
npm run build
npm run serve
```

Then open <http://127.0.0.1:4180/> in Chrome, Edge or Firefox. The server answers on this computer only and serves `dist/` and nothing else.

- `npm test` builds the bundle twice and checks it.
- `npm run typecheck` checks the web code and the scripts.

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
- **A forgotten passphrase** cannot be recovered by anyone; the PC must then be erased. Until part 4 brings «مسح هذا الحاسوب», that means clearing this site's data in the browser's settings.
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
| Storage | The browser's SHA-256 and random bytes, the passphrase lock, and the history and timings sealed in IndexedDB, a copy taken back added in one transaction. A PC has no fingerprint prompt. Erasing the PC comes in part 4. |
| Files | The file dialog, the save dialog or a download, and the share menu where the browser shares the file; archives with zip.js. A PDF to keep is the phone's only. |
| CalendarInput | Updates, plan layers and statements as files, a statement PDF giving only its link; QR codes drawn, none scanned. |
| Signature | Web Crypto's ECDSA P-256: the PC's own pair, sealed in the vault, and others' signatures checked. QR codes for statements. |
| Pdf | Printing through the browser, in part 4. |
| Update | The server's newer build, through the offline worker, installed only by the checksum the teacher saw. A phone has no such module. |
| Browser | The web's own: whether the browser keeps the data, and its install offer. A phone has no such module. |

Until its part comes, a module refuses each step with `E_WEB_NOT_YET`.
