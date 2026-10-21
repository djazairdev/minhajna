# Signed calendar updates

This is the first part of [#223](https://github.com/djazairdev/minhajna/issues/223), implementing PRD §4.8 (R-4.8-03 to R-4.8-05) and §4.5 (R-4.5-15). A calendar update is a signed file, opened from a file or a QR code. The phone checks its signature with a key the app trusts before it reads anything in it. Signed plan packs follow in the second part.

## The signed file

One UTF-8 JSON object, at most **16,384 bytes**:

| Field | Requirement |
|---|---|
| `format` | Exactly `minhajna.signed` |
| `version` | `{"major":1,"minor":0}`; another major is refused, and a newer minor is read as far as it is known |
| `key` | The ID of a key in `data/dz/keys.json` |
| `payload` | The update, as JSON text |
| `signature` | ECDSA P-256 over SHA-256 of the payload's UTF-8 bytes, in DER form, base64 with padding |

Any other field is refused. The signature is checked first, by Android's own crypto on the phone and by Node's in the tests. A file changed after signing, or signed by a key the app doesn't list, is refused, and nothing in it is read or applied.

## The calendar update

The payload is a `minhajna.calendar-update`, version 1.0:

- `country` and `year`: the bundled calendar's, `dz` and `2026-2027`.
- `release`: later than the bundled calendar's release, which is now `2026.4`.
- `published`: the day it was published.
- `entries`: calendar entries in the [reference format](../../data/README.md), any layer but `school`. The Ramadan entry may carry `hours`: the confidence of its times, apart from its first day's, and each level's session length in minutes, which then replace the bell data's (answer 318). While its first day is still expected, it keeps `lunar: true`, so teachers can confirm the day on the sighting. A teacher's earlier sighting stops applying when an update changes the Ramadan entry, and they confirm again; Ramadan ends on the eve of Eid al-Fitr (answer 330).
- `removed`: the IDs of entries it takes away; it may be left out when there are none.

It holds at least one entry or one removal. Applied updates lie over the bundled calendar in the order of their releases, one for each release. A release at or below the bundled one, or one already applied, is not offered again. A received closure notice whose ID an applied update sets or removes stops applying.

## The keys

`data/dz/keys.json` lists the keys the app trusts. For each one, it gives the ID, who holds it, the public half (SubjectPublicKeyInfo, DER, base64) and its SHA-256 fingerprint. The tests check that every key is on P-256 and that its fingerprint matches. The list stays empty until the project's key is made. The tests make a fresh key on each run and never write it down, and a release build trusts only the listed keys.

## Making the project's key

The key's holder makes it, offline, on their own computer (answer 304). The private half never touches the repository, a server or an assistant.

1. Use a copy of the repository at a known commit, with Node.js 22.18 or later, on a computer that is offline.
2. Run the key tool. `--out` must be a folder outside any Git working copy, this repository or another clone, so a home folder kept in Git means choosing one elsewhere, such as a USB drive; the repository also ignores `*.private.pem`:

   ```sh
   node packages/core/scripts/make-key.ts --id <key-id> --out <folder> --holder-ar <name> --holder-fr <name> --holder-en <name>
   ```

3. Type a passphrase of at least 20 characters, twice; it isn't shown. Make it five random words or more: the PEM's key derivation is cheap, so the passphrase carries the protection. The tool writes `<key-id>.private.pem`, encrypted under the passphrase and readable by its owner only on macOS and Linux, and never overwrites a file.
4. Keep the private file and the passphrase apart, both offline.
5. The tool prints the key's entry. Add it to `data/dz/keys.json` in a pull request, and publish the fingerprint where teachers and inspectors can compare it with the one the import screen shows.

## Signing an update

1. Write the update as JSON, as above.
2. Run the signing tool, and type the passphrase:

   ```sh
   node packages/core/scripts/sign-update.ts --key <key-id>.private.pem --id <key-id> --in <update.json> --out <signed.json>
   ```

3. The tool refuses to sign, and writes nothing, when:
   - the update doesn't read against the bundled calendar;
   - its release isn't later than the bundled one;
   - it holds a field that format 1.0 would drop or read otherwise, such as a misspelled one;
   - the key isn't the one `data/dz/keys.json` lists under that ID;
   - the signed file would weigh more than 16,384 bytes.
4. Otherwise it signs the update, opens the result as the phone would, and only then writes it. The output must end in `.json`, the only kind the phone's file picker offers.
5. The tool says whether the file also fits one QR code: at most 2,953 bytes, a version-40 code at the lowest error correction. Make the code with an offline encoder that keeps the file's bytes as they are, then scan it with the app before sending it.

## On the phone

- **Opening an update:** «استيراد تحديث» on the Calendar and in Settings opens a file or scans a code.
- **Before applying:** the screen says how the update was opened and on which day, who signed it, the key's fingerprint and the release. For a new release, it shows what the update changes for the teacher's own schools and classes, with the others only counted, and the sessions it would take (answers 307 to 310).
- **A refused file:** the screen says why, which checks passed, and that nothing changed.
- **After applying:** «ما تغيّر» shows what the update changed, and the sessions it still takes or gives back from today on (answers 312 and 314).
- **On Today:** a card shows on the day an update that concerns the teacher is applied (answers 311 and 315).
- **On the Calendar:** «آخر تحديث» names the latest update (answer 313), and an entry from an update names it.
- **A moved exam window:** the class plan shows the new dates with the first ones struck and the reason, as does Today's card (answer 322). The preview and «ما تغيّر» show each class's spare sessions before the exams, counted from today, its sessions after them until the end of the term, and, when there are more of them, the plan items that no longer fit, with its plan to open (answers 323, 324). A move announced less than two weeks before its new first day is said to be late, dated by the release that first made the move, and nothing is blocked (answer 325).

## Checks

- **Core tests:** they cover the signed reader, the update format, the order of updates, the preview and what changed. They also cover both tools: the key's entry reads, the private half is encrypted, a signed update opens, and each refusal above happens before anything is written.
- **Shared vector:** `SignatureCheckTest` checks the same Node-signed vector with Android's crypto (`connectedDebugAndroidTest`). On 21 Oct 2026 its 4 tests passed on Android 15 (API 35) and Android 8.0 (API 26) emulators.
- **Jest tests:** they cover the import, refused, what-changed and Today screens.
- **The two tools, 21 Oct 2026:** both ran in a pseudo-terminal with a made-up key written outside the repository.
  - The private file was readable by its owner only.
  - Both passphrases pasted at once, and an arrow key typed into one, were read as typed.
  - An output folder naming the repository in different capitals was refused.
  - The signed file weighed 655 bytes and fit one QR code.
  - A second run with the same output name and a wrong passphrase were both refused.
  - The made-up key was never added to the repository.
- **Not checked yet:** scanning a signed code and applying it on a phone. These checks are listed in [#206](https://github.com/djazairdev/minhajna/issues/206).
