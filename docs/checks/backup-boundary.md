# Backup and restore boundaries

Local implementation of [#485](https://github.com/djazairdev/minhajna/issues/485), based on main `cc840b25`, checked on 31 October 2026. All records, keys and files used in tests are invented.

## What changes

A backup captures its history before making the ZIP. Its saved fact keeps that exact last entry's hash and the file's creation day. A change saved while the file picker is open stays outside the backup, even though the backup's saved fact comes later.

A restore keeps its route, source file's day and source boundary in the same atomic write as the restored history. The old deferred receipt hook is removed; its source remains recoverable in Git. Closing the app before the next screen no longer loses the receipt, and opening the history records nothing twice.

The devices page, Settings' backup line, Today's reminder and the erase warning name a restored backup or archive. Only entries after the completed restore count as subsequent changes; the restore's own erasures and receipt do not. A new backup replaces that baseline.

A transfer records where the copy came from, but is not called a retained backup. It does not restart the backup reminder. The separate outgoing-transfer warning decision in #494 is unchanged.

## Compatibility and privacy

- Older backup facts without a boundary keep their original day and counting behaviour.
- Older restore receipts keep their route without inventing a recoverable file.
- An unknown hash, a malformed or future date, or user changes between a claimed restore boundary and its receipt grant no coverage.
- Snapshot metadata stays in the device layer, outside every archive, backup and transfer body. It contains no filename, location, password, pupil data or key.
- Existing history entries are never rewritten. The archive stays at version 1.0; its documentation explains these device-only facts.
- No new dependency, permission or network call. NETWORK.md, PRIVACY.md and the PRD are unchanged.
- The new Arabic, French and English messages have their own small bundled catalogue and Weblate namespace, with AGPL licence coverage. A maintainer can configure that namespace after merging; this work contacts no Weblate instance.

## Regression checks

Before the fix, 8 of the 10 new core cases failed, and the new Android picker test failed because the saved fact held no boundary.

The focused run passes 21 core tests and 55 Android tests. It covers changes during a save, creation and save on different dates, unknown and malformed boundaries, legacy facts, backup/archive/phone routes, atomic receipts, counts after restore, a later backup, reminders and private metadata excluded from the next export.

The connected screen tests use both Android and web platform modes and Arabic, French and English. They check the source-file date, no false “no backup” line, zero and one subsequent change, found translation keys, right-to-left/left-to-right context and accessible labels. These are rendered component checks, not a real browser's visual acceptance or spoken TalkBack.

## Full verification

- Locked root, Android and web installs pass. The current CI also needs the server and Prisma-tools lockfiles and generated types for repository-wide lint; these were installed/generated without starting a server or database.
- Root tests: 1,012 core, 23 sync, 17 web-storage and 57 Android/release/demo-tool tests pass.
- Android: 319 suites and 2,652 tests pass.
- PC web: all 124 tests and the production build pass.
- Root, Android and PC web type checks pass.

- Full ESLint and Prettier pass after installing CI's existing server type dependencies. REUSE passes for 2,664/2,664 files.
- The offline Android release build and verification of all three unsigned APKs pass. The manifest still requests only USE_BIOMETRIC, CAMERA, POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED, with no network permission.

The published changelog was already 465 lines. The maintainer approved keeping those releases intact and adding the normal English/Arabic entry; this is the only changed file above 300 lines. Every other changed or new file remains below the limit.

## Remaining manual acceptance

The wording has not been checked on a physical phone, with spoken Arabic TalkBack or visually at 200% text. No new layout, print format or native API is introduced. A fresh independent reproducibility check is not claimed.

## ملخص بالعربية

بعد استرجاع البيانات، يذكر التطبيق النسخة الاحتياطية أو الأرشيف الذي استرجعت منه وتاريخه، بدل أن يقول إنه لا توجد نسخة. ويعدّ تنبيه المسح التغييرات التي سجّلتها بعد الاسترجاع فقط. كما تُحسب محتويات كل نسخة احتياطية بدقة، حتى لو سُجّل تغيير أثناء اختيار مكان حفظها. تبقى هذه المعلومات على جهازك، ولا تُرسل إلى أي جهة.
