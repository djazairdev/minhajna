# Erasing a device after a direct transfer

Local verification for [#494](https://github.com/djazairdev/minhajna/issues/494), on 2026-11-01. All records are made up.

## Behaviour

- A transfer counts only after the teacher confirms that the other device opened it. Saving or sharing a file alone grants no coverage.
- The confirmed file covers entries through its recorded hash. Changes between making the file and confirming it remain uncovered, as do later changes. The confirmation itself is bookkeeping.
- A later backup or a transfer holding more of the history becomes the warning's reference. Confirming an older file does not discard better coverage. History order settles transfers on the same day.
- Ending the handover does not undo the fact that a copy reached another device. Changes recorded after it still count.
- Unknown, malformed, future and erased transfer boundaries grant no coverage.
- The phone and PC warning name the transfer's date when it is the reference. An earlier backup keeps its own date. The warning still says that personal teacher-card fields and the drawn signature do not travel.
- `lastBackup`, `sinceBackup` and the backup reminder are unchanged. A transfer is not a retained backup.

The core exposes `lastCopy` and `sinceCopy` through `deviceFacts()`, separately from the backup facts and the active handover. These values are derived, never new stored records. No file format, dependency, permission or network flow changes.

## Automated checks

The new core regression suite failed all nine cases on main before the fix. It covers the boundaries above alongside the existing devices and handover suites.

The shared screen suite renders Arabic right to left and French and English left to right, in phone and PC modes. It checks zero uncovered changes, a change during file preparation, later changes, both orders of backup and transfer, an invalid confirmation, the warning texts and accessibility properties. The existing erase tests still check confirmation, single execution, failure and waiting for other PC tabs.

| Check | Result |
|---|---|
| Locked root, Android and PC installs | Passed; no lockfile changes |
| Root and Android type checks | Passed |
| Full lint and formatting | Passed |
| Root tests | 1,132 core, 24 sync, 17 web-storage and 57 tool tests passed |
| Final focused core suites | All 25 passed, including 10 erase-coverage regressions |
| Android screen tests | All 378 suites, 2,961 tests passed |
| PC type check, tests and production build | Passed; all 128 tests passed |
| Android release build | Passed offline with Node 22.23.2, Temurin 17 and SDK 37 |
| APK verification | All three unsigned APKs passed `tools/android/release-apks.js verify`; each has only the existing biometric, scan-camera, notifications and boot permissions, with no `INTERNET` |
| REUSE 6.2.0 | All 2,907 files covered, with no missing licences |
| Whitespace and file length | Passed, apart from the approved existing changelog exception below |

The first lint run needed the server's generated Prisma types refreshed with `npm run generate`, as CI does; no database was used. On this machine REUSE's `charset-normalizer` detector falsely missed two existing UTF-8 headers. The supported alternative passed with `REUSE_ENCODING_MODULE=chardet uvx --with chardet --from reuse==6.2.0 reuse lint`; neither source file was changed.

The task's Android install was separate from main's tracked dependency shortcut. After tests and the build, the original shortcut was restored unchanged. Logs are under `/tmp/minhajna-494-checks` while that temporary folder remains available. This is one local APK build, not a new claim of independent reproducibility.

## Translation and review

New texts live in `apps/android/src/settings/text/erase/{ar,fr,en}.json`, bundled under `settings.eraseTransfer`. Keeping them separate avoids growing the existing Settings catalogues past their current length. The `android-erase-transfers` Weblate component shares the existing repository, licence and review branch. Its fake-API tests make no network call. A maintainer reruns the existing configuration tool after merge; this work changes no live instance.

This branch starts at main `507518a10053001d75c630c59ca7239200f5a436`. [#690](https://github.com/djazairdev/minhajna/pull/690), the separate backup/restore-boundary fix for #485, was still open when this work began. Both touch the warning and device facts: reconcile their exact backup/restore coverage when the second change is integrated, retaining both sets of regression tests.

The existing changelog exceeds the 300-line rule. The approved approach remains to keep published releases intact and add the normal English/Arabic note; no release is moved or rewritten. Every other changed or new file stays within 300 lines.

No manual phone, spoken screen-reader or 200% layout acceptance is claimed here. The PC's Windows browser acceptance remains separate. The locked PC erase screen cannot read its history and keeps its existing general warning.
