# A new phone without sync (#247)

Checks of 24 October 2026 for [#247](https://github.com/djazairdev/minhajna/issues/247), on `feat/247-restore-core`. Made-up records only.

Without sync in the pilot (P3), a teacher moves to a new phone by a transfer file or an encrypted backup, and nothing leaves the phone otherwise (answer 478). Every file is a Minhajna archive ([`docs/formats/archive.md`](../formats/archive.md)) in the app's AES-256 ZIP. A backup is under the recovery key, a transfer file under a one-time key, and an export under its password. This page covers the first pull request. The recovery sheet and backups, the restore at setup, the transfer and the reminder follow.

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

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206), once the screens exist: a backup opened on a computer with 7-Zip, using the recovery key.
