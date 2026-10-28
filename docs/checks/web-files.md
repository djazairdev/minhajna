# The PC web app's files in and out (#250, part 3, first pull request)

Checks of 27 October 2026 for the first pull request of part 3 of [#250](https://github.com/djazairdev/minhajna/issues/250), from the pull request that adds this record. It follows [the lock and history](web-lock.md). Made-up data, keys and passwords only.

## What changed

- **Files on a PC** (`apps/web/src/native/Files.ts` and `files/`):
  - files are picked through the browser's file dialog, one dialog at a time. A dialog that a browser closes without saying so stops blocking once the page has its focus back, and the next pick, from any screen, replaces it; until then a file arriving late still counts;
  - a file is saved through the browser's save dialog where it has one (Chrome and Edge), which tells the app when the teacher closes it, so nothing is recorded as saved then. Where there is none, or the browser refuses it, the file is downloaded; the page cannot follow a download, so it counts as saved;
  - browsers share few kinds of file, and Chrome and Edge refuse a ZIP even where `canShare` says yes, so a PC's transfer and marks export offer Save alone. Sending, where a screen has nothing else, uses the computer's share menu and fails where the browser cannot share the file; it never turns into a download that says it was shared;
  - archives are written and read with zip.js 2.23.0, in the phone's AES-256 form (WinZip's AE-2, strength 3, deflated), with no WebAssembly and no workers, as the page's security policy allows neither;
  - a picked archive is refused as `ZipRead.kt` refuses it: over 16 MB, over 32 MB inside, not an archive, a name found twice, a changed file, ZipCrypto or weaker AES, no password where one is needed, or a wrong one;
  - a picked text file is read as UTF-16 after its mark, then strict UTF-8, then Windows-1256; a binary file and one over 2 MB are refused;
  - a PDF to keep stays on the phone (answer 507).
- **Calendar input on a PC** (`CalendarInput.ts`): updates, plan layers and statements come as files within the phone's limits; a statement PDF gives only its `minhajna-statement:` link; a shared file keeps the phone's names; the camera is never asked for (answer 506).
- **QR codes:** the JavaScript port of the phone's ZXing encoder, 0.21.3, with the UTF-8 mark in the code. It differed from the phone's Java 3.5.4 in two places, both replaced with Java's:
  - its version check did not round bits down to bytes, so a text that filled a version went one up, and a 996-byte statement did not fit version 25;
  - its mask penalty counted cells past the code's edge as light, so it chose another mask than the phone for some texts.

  The build marks ZXing free of side effects, so only its encoder is bundled: 69 KB of it, not 416 KB.
- **Signing on a PC (answers 508 and 510):** an ECDSA P-256 pair made once, while the history is open. Its private half is sealed with the history's key, like every record (`vault/signing.ts`), so a copy of the browser's files signs nothing without the passphrase. It is opened once per unlock, imported as a key the page cannot read back, and dropped when the history locks; its sealed text passes through the page's memory as it is made and opened. Erasing content reseals it under the new key in the same step, and the step fails if another tab made a pair in between. A new passphrase over an empty history drops it. A locked history, a full browser and another tab's change keep their own codes. Signatures go out in the phone's DER form, and DER signatures from the phone are checked.
- **No scan buttons on a PC:** restore, the reader, calendar updates, received calendars and plan layers offer the file or the typed key, and the file button becomes the main one.
- **The PC's words (answer 509):**
  - `useDeviceText` shows a text's PC wording where the catalogue has one in the interface's own language, under the same key with `pc` before its last part. A PC text missing in that language gives that language's phone text, never another language's.
  - These have their PC wording, in Arabic, French and English:
    - restore and its refusals;
    - the transfer;
    - the devices page and the recovery sheet;
    - exporting everything, and the marks export's save line;
    - the settings group «هذا الحاسوب»;
    - the welcome's three lines, with a lock icon in place of the phone;
    - the reader's opening lines, and its spot check's;
    - the unreadable-file messages of updates, received calendars and plan layers.
  - Lines false on a PC, such as screenshots being blocked or the camera, are left out there.
- **New packages** in the web app, downloads approved by the founder on 26 October: `@zip.js/zip.js` 2.23.0 (BSD-3-Clause) and `@zxing/library` 0.21.3 (Apache-2.0) with `ts-custom-error` 3.3.1 (MIT). ZXing's newer 0.22 and 0.23 need Node 24. All three are credited in `licences.json`.

## Checks

| Check | Result |
|---|---|
| Web tests (`apps/web`, 55, 22 new) | Pass:<br>• **making files:** a plain file and an AES-256 one made and downloaded, each forgotten once saved; the AE-2 field read in the archive, and no text readable in it; several texts zipped; names given twice, with a folder or none refused;<br>• **saving:** through a save dialog, the content written; a closed dialog says not saved and downloads nothing; a failed write refused; a refused dialog downloads instead;<br>• **archives refused:** a wrong or empty password, a missing name, one changed byte of the sealed data, a plain archive where a sealed one is needed, a file that is not an archive, one over 16 MB, and a dropped file;<br>• **text files:** UTF-16, UTF-8 and Windows-1256 read; a PDF and a file over 2 MB refused; a closed dialog gives nothing; one closed saying nothing blocks a second pick until the page has its focus back, then the next pick replaces it;<br>• **sharing:** refused, with nothing downloaded, where the browser has no share menu or refuses the file; a closed share menu is no failure;<br>• **calendar input:** an update over 1 MB or not UTF-8 refused; a statement PDF giving only its link, or the bare scheme; no camera; a short key's code read back by ZXing's reader; the phone's share names only, and a refusal, never a download, where the browser cannot share;<br>• **signing:** one pair, sealed, with no key readable in it; its fingerprint the SHA-256 of its key; no signing while locked; the same pair after locking and after erasing content; a pair changed on disk refused once opened again, never replaced; two tabs making it at once both using one; an erase refused when another tab made a pair in between; its signatures checked by Node's crypto, and the phone's DER signatures by it; padded, raw, broken, empty, other-curve and other-key signatures not checking; empty, broken and long texts not signed;<br>• **statement codes:** the four-cell quiet zone; `x` × 996, `م` × 498 and 249 emoji at version 25 (125 cells), read back by ZXing's reader; 997 bytes, broken text and empty text refused, as `StatementQrTest.kt` checks on the phone;<br>• **the phone's cells:** eight texts give the same cells as ZXing 3.5.4 in Java, by the SHA-256 of their rows. |
| The phone's encoder, beyond the tests | 300 made-up texts, in byte, alphanumeric and numeric modes, Arabic and emoji, from 1 to 996 bytes, drawn by ZXing 3.5.4 in Java (the phone's jar, run with the local JDK) and by the PC: all 300 the same once both differences were replaced. Of the eight kept in the test, a transfer key and `{"example":1}` differed before |
| Jest (`apps/android`) | The 6 new tests pass: `pc` put before a key's last part; every PC text beside the phone's it replaces, the same in all three languages, none saying "this phone" or screenshots; on a PC, the transfer and restore in their PC words, with no scan button, no Send and no missing key; a PC text missing in the interface's language giving that language's phone text; on a phone, both unchanged.<br>The full run: 2425 pass. The 4 failures are the two i18next notice tests, because the shared checkout's installed i18next is 26.4.5 while the lockfile has 26.5.4. CI installs from the lockfile. |
| Type checks | Pass: the Android app, and the web app with its scripts and tests |
| ESLint, Prettier | Pass |
| Bundle | `app.js` is 3.4 MB minified (901 KB gzipped), from 3.2 MB. `dist/` is 7.4 MB. Two builds give the same checksum |
| Chrome, headless, from the local server, at 1280 × 800 | Pass, in Arabic and English:<br>• **a backup restored:** a made-up backup, written by the app's own archive code and zipped by the PC's writer, chosen through the file dialog with the key typed in lower case with spaces; the browser then held 55 entries, and the app opened on Today;<br>• **a transfer sent back:** Settings › Devices and backups › Direct transfer showed the PC's words, the QR code and the six groups; Chrome's own barcode detector read the code on the screen as the transfer form with the same key; «إرسال الملف» was not offered, and «حفظ الملف», now the main button, downloaded the file, as a script's click carries no gesture for the save dialog;<br>• **that transfer file restored** in a fresh browser profile with the typed code; a code one letter off was refused with the PC's message, and nothing was stored;<br>• no errors in the console. |

## Left for the next parts

- **Part 3, next pull requests:** the keep-storage request and warning, with the install prompt (R-6.6-08); the handover rule, read-only until the copy comes back (answer 503), on both devices.
- **Part 4:** accepting an update, «مسح هذا الحاسوب», which also deletes the sealed signing pair, and printing through the browser; the PC words of those screens and of Help.
- **Before 0.6.0:**
  - a last sweep of the texts that still name the phone or the camera (answer 509): done, as in [the PC's words record](web-pc-words.md), but for the privacy notice;
  - the screens that could only send, a plan layer and a statement's file, save on a PC: done, as in [the PC's words record](web-pc-words.md#the-follow-up-saving-and-copying-on-a-pc);
  - the privacy notice's PC wording needs the founder's review;
  - the changelog's entry for the PC web app, once a host serves it (answer 500).
- **A download counts as saved:** in Firefox and Safari, and in Chrome when the save dialog is refused, the page cannot tell a download cancelled or blocked from one kept.
- **Still to check by hand:**
  - a backup made on a real phone and restored on a PC, and a PC's transfer opened on a real phone;
  - the save dialog with a real click in Chrome and Edge;
  - Edge and Firefox on Windows;
  - the share menu on Windows and macOS.
