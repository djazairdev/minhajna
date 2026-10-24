# A new phone without sync (#247)

Checks of 24 October 2026 for [#247](https://github.com/djazairdev/minhajna/issues/247), on `feat/247-restore-core`, `feat/247-backups` and `feat/247-restore`. Made-up records only.

Without sync in the pilot (P3), a teacher moves to a new phone by a transfer file or an encrypted backup, and nothing leaves the phone otherwise (answer 478). Every file is a Minhajna archive ([`docs/formats/archive.md`](../formats/archive.md)) in the app's AES-256 ZIP. A backup is under the recovery key, a transfer file under a one-time key, and an export under its password. This page covers the first three pull requests. The transfer and the reminder follow.

## Part 1: reading the files back, and restoring a history (core and native)

- **The recovery key:** 24 characters in six groups of four, from the 32 digits and letters without I, L, O and U, so 120 random bits.
  - It is read as typed: in either case, with spaces or dashes, in Arabic-Indic digits, with O read as zero and I or L as one.
  - A transfer's QR code holds `minhajna-key:1:` and the key, read only exactly as the old phone made it.
- **The restore's entries:** the archive's entries as they were, then one erasure per layer of the entries it left out, on the day of the restore. The device layer is always among them, so the personal fields and the drawn signature are typed and drawn again (R-3.8-47). The whole chain is checked before anything is stored.
- **Reading a ZIP the teacher picked:**
  - **The forms read:** a plain ZIP, or an AES-256 one in WinZip's AE-2 form, or AE-1.
  - **The file is untrusted:** it is found from the central directory, every offset and size is checked, and nothing is inflated past its stated size or 64 MB.
  - **Each refusal has its reason:**
    - not an archive holding the file;
    - a password that does not open it;
    - a changed file;
    - too large.

    A wrong password is told apart from a change, save one in 65,536 that passes WinZip's two check bytes.
- **Storing a restore:** only into an empty history, all or none, in one transaction.

| Check | Result |
|---|---|
| Core tests (`recovery-key.test.ts`, 6 tests, and `restore.test.ts`, 4 tests) | Pass. They cover:<br>• keys drawn from the 32 characters, every one used, and the bits in order;<br>• a key read as typed, and what is not one refused;<br>• the six groups;<br>• the QR code read back, and nothing else;<br>• a restored history with an erasure for the personal fields and one for the private notes, on the restore's day, which opens again with its classes and pupils and no personal fields;<br>• the private notes carried when the archive holds them;<br>• nothing added when nothing was left out;<br>• content missing without being left out, and a day that is not one, refused. |
| Instrumented tests (`ZipReadTest.kt`, 5 tests, and `RestoreTest.kt`, 3 tests), on my Android 15 emulator | Pass. They cover:<br>• the archive read back with its password from among other files, including 3 MB of random bytes;<br>• a plain ZIP read whatever the password;<br>• a wrong or missing password told apart from a changed byte, a changed code and a changed plain file;<br>• AE-1 read only when its CRC matches;<br>• refusals for a file that is not a ZIP, an empty one, one without the archive, one holding it twice, one over the limit, a cut one, a moved header, and a size that lies or reads as 0xFFFFFFFF;<br>• a restore stored whole, entries without content among them, and kept when opened again;<br>• a restore refused into a history that is not empty;<br>• nothing stored when an entry is refused halfway.<br>`AesZipTest` (4) and `StorageTest` (14) still pass. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |

## Part 2: the recovery sheet, the devices page and backups

- **«الأجهزة والنسخ» in Settings:**
  - It says sync is not open yet, and why.
  - The transfer is listed, not yet available.
  - It shows the day of the last backup, or that there is none, with «نسخة الآن».
  - The sheet's row says the day it was made, or that it comes with the first backup.
  - It says the project holds no key.
- **The first backup gives the sheet first:**
  - A new key is drawn on the phone and shown in six numbered groups, left to right.
  - It prints on one A4 page that names no one, or is written by hand.
  - It is typed back in full, with no keyboard suggestions, and only then kept, in the device layer. The backup then starts.
  - Screenshots of the sheet are refused, whatever the teacher allowed.
- **The sheet again:**
  - The key kept is shown to print again, with no check.
  - «مفتاح جديد» draws another, confirmed the same way.
  - Once the new key is saved, the earlier keys' content is erased. If it is not saved, the earlier key stays, the failure is said, and the sheet stays open.
- **A backup:**
  - **What it holds:** everything as the Minhajna archive, private notes included, in an AES-256 ZIP whose password is the key. The archive leaves out the device layer: the personal fields, the drawn signature and the key itself.
  - **Saving:** through the file picker only, as «نسخة منهاجنا» and the day. Once saved, its day is recorded and said. A cancelled save is neither said nor recorded.
- **The activity log:** backups and new sheets are listed under «الأجهزة», a tab shown once it lists something, and never with the key. An earlier key's erasure is listed under the deletions.

| Check | Result |
|---|---|
| Core tests (`devices.test.ts`, 5 tests) | Pass. They cover:<br>• nothing kept before the first sheet, and the first change's day;<br>• the key and backups in the device layer, the key never in an archive, and the last backup;<br>• the earlier keys a new sheet names, and none once erased;<br>• a malformed key ignored;<br>• the log's lines under the devices, never the key. |
| Android tests (`devices.test.tsx`, 5 tests, `recovery-sheet.test.tsx`, 6 tests, and the log and Settings tests) | Pass. They cover:<br>• **the devices page:** its words; the sheet before a first backup; a backup saved under the key, with the private notes and without the personal fields or the key, then recorded and said; a cancelled save; the first backup started once after its sheet;<br>• **the sheet:** the six groups read one by one; the printed page in two rows of three with the key and no class; a wrong key refused and a lowercase key with spaces kept; the key kept shown again, and a new key erasing the earlier one; a failed save keeping the earlier key and saying so; two quick taps confirming once; no keyboard suggestions; the way back to the devices page; the screen guard;<br>• **the log:** the devices tab only once it has a line;<br>• **everywhere:** every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key, on Saturday 24 October | Pass. Set up from scratch with the 4AM demo class of 45 made-up pupils and a made-up personal name.<br>• **Settings:** «الأجهزة والنسخ · لا نسخة بعد». The page matched the board; «ورقة الاسترجاع» was closed, with «تُعطى مع أول نسخة».<br>• **«نسخة الآن»** opened the sheet, with six groups left to right. A screenshot of it came out black. The print preview showed one A4 page with the key in two rows of three, the key on one line, and «7-Zip» read correctly.<br>• **The check:** a key with its last character wrong was refused with «لا يطابق ما كُتب المفتاح…». Typed again in lowercase with spaces, it was accepted, and the file picker opened on «نسخة منهاجنا 2026-10-24.zip». The page then said «حُفظت النسخة.» and «آخر نسخة: السبت 24 أكتوبر», and the sheet's row «أُعدّت في السبت 24 أكتوبر».<br>• **The file:** 10 KB, one AES-256 entry, `minhajna-archive.json`. Decrypted on the Mac with the key, its code checked, and a wrong key was refused. The core's `readArchive` accepted it: 53 entries, the personal fields and the key left out, and neither the made-up name nor the key anywhere in the file. Restored by the core, it gave one class and 45 pupils, with no personal fields.<br>• **«سجل النشاط»:** the «الأجهزة» tab showed «حُفظت نسخة احتياطية» and «أُعدّت ورقة استرجاع جديدة، دون مفتاحها».<br>• **The sheet again** showed the same key, with no check. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- a backup opened on a computer with 7-Zip, using the recovery key;
- the sheet printed on paper and read back;
- the devices page and the sheet with TalkBack in Arabic, and at 200% text.

## Part 3: the restore at setup

- **The way in:** «لديّ نسخة من هاتف آخر» on Welcome, under «لنبدأ».
  - On a fresh install it leads through the first PIN, which the encrypted history needs first, to «استرجاع البيانات», with Welcome under it for Back (answer 479).
  - After the PIN, the navigator's Welcome shows it only while the history is empty.
- **The routes:**
  - «ملف نسخة احتياطية»: the file, then the recovery key, typed with no keyboard suggestions. A file without a password is refused here, pointing to the export's route.
  - «فتح أرشيف «منهاجنا»»: the export, with its password if it has one.
  - «الهاتف القديم في اليد» and «حساب المزامنة» show as not available yet.
- **The file:**
  - It comes through the system's file picker, any type, and is copied into the app's cache under a token of its own. A key typed again needs no second pick.
  - The copy is dropped once restored, when another file or route is chosen, when the screen closes, and at the next start.
  - A file over 16 MB, or holding an archive over 32 MB, is refused before it fills the app's memory.
- **What does not come back** is said first: the teacher card's personal fields and the drawn signature.
- **The restore:**
  - The archive is checked as a Minhajna archive from this country, made into the restored history with the device layer erased on the restore day, and stored all or none into the empty history.
  - The history is then read again, and the app opens on Today once setup was finished on the old phone.
- **Refusals:** each is said under the button, with nothing stored:
  - a key that is not 24 characters;
  - a key or password that does not open the file;
  - a file without a password on the backup route;
  - a file that is not a Minhajna archive;
  - one too large;
  - one from a newer major version;
  - one from another country.

  A changed file, or an archive whose chain does not check, opens «لم يُسترجع شيء». Its wording, for a backup or an export, also allows for a wrong key or password that passed the ZIP's two check bytes. Nothing is logged, as there is no history yet.
- **The screen guard:** screenshots of the restore are refused, whatever the teacher allowed.

| Check | Result |
|---|---|
| Android tests (`restore-run.test.ts`, 9 tests, `restore-screen.test.tsx`, 8 tests, `restore-flow.test.tsx`, 2 tests, and the welcome, history and real-names tests) | Pass. They cover:<br>• **the restore:** a backup restored whole, with the key typed in lowercase with spaces, the private notes kept, and the personal fields and the key gone; an export with its password or none, read without a seal; a malformed key refused before any read; each ZIP refusal by route; nothing stored from a plain file, from text that is not an archive, from a later major version, or from a changed entry; an archive from another country, and a history not empty, refused;<br>• **the screen:** the routes, two of them not open; what does not come back; a file asked for first; a backup restored, its copy dropped and the history opened again; a wrong key said and cleared as it is typed again; the changed-file page and the way back from it, worded for a backup or an export; the recovery sheet's line only on the backup route; the copy dropped when the screen closes; every text in French and English;<br>• **the flow:** Welcome, the first PIN, the restore, then Home on Today; the restore guarded as the PIN pads are; a history begun on this phone hiding the link. |
| Instrumented tests (`ZipReadTest.kt`, 6 tests, `PickedFilesTest.kt`, 3 tests, `AesZipTest.kt`, 4 tests, `RestoreTest.kt`, 3 tests), on my Android 15 emulator | Pass. They add:<br>• a plain archive refused where a password is wanted;<br>• the archive kept and read again after a wrong key;<br>• a file inside that is not UTF-8 refused;<br>• nothing read once the copy is dropped;<br>• a file over 16 MB refused. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key, on Saturday 24 October | Pass. Starting from an empty phone, with part 2's backup of the 4AM demo class (45 made-up pupils) and a made-up personal name in Downloads.<br>• **The way in:** «لديّ نسخة من هاتف آخر» led to the first PIN, then straight to «استرجاع البيانات», which matched the board, with the transfer and sync not available. A screenshot of it came out black.<br>• **Refusals:** «استرجاع» with no file said «يُختار الملف أولاً.». The CSV export was refused as «ليس هذا الملف نسخة من «منهاجنا».». A copy of the backup with one byte changed opened «لم يُسترجع شيء · تغيّر الملف بعد حفظه», and the file stayed in Downloads, unchanged. The backup with the key's last character wrong was refused with «لا يفتح هذا المفتاح الملف…».<br>• **The restore:** the key typed again in lowercase with spaces restored the backup. The app opened on Today, after Android's notification question, which was declined. Settings showed the demo class with its 45 pupils, the card's name empty, and «الأجهزة والنسخ» with no backup and no sheet. The log's chain was intact, and the erasure of the two left-out entries was listed under «الحذف».<br>• **The export route:** an export saved without a password from the restored phone was refused on the backup route, pointing to the export's route. On «فتح أرشيف «منهاجنا»», with no password, it restored the class and its 45 pupils. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- the restore with TalkBack in Arabic, and at 200% text;
- a backup moved to the new phone from a computer or a USB key, on a real phone.

