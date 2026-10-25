# Progress statement

Part 1 of [#245](https://github.com/djazairdev/minhajna/issues/245), scoped by [#436](https://github.com/djazairdev/minhajna/issues/436). Prepared on main `2ae76b0` on 24 October 2026, then updated to main `ac0013c` and rechecked on 25 October. All test data is invented.

Part 1 adds the statement's calculations and versioned signed text, with no teacher-facing feature. Part 3, the Share screen with print and PDF, and part 4, sharing by QR code or file with its history, are [below](#part-3-the-share-screen-print-and-pdf).

## Public API

| Function | Contract |
|---|---|
| `progressStatement(context, courseId, today)` | A detached statement for one course, or null without a usable pack. No write or sharing action |
| `statementPayload(statement)` | Canonical, allowlisted version-1.0 JSON, suitable for signing |
| `readStatement(text)` | Bounded, untrusted JSON; keeps known fields only. Newer minor versions retain their number; unsupported major versions fail |
| `signStatement(statement, spki, sign)` | Captures one canonical payload, then asks the platform callback to sign. Returns the complete signed file; no private key enters the core |
| `checkStatement(text, verify)` | Checks the original payload bytes before parsing it. Separates invalid files, unsupported envelope versions, bad signatures and invalid payloads |
| `fitsInQr(text)` | Checks the entire signed text in UTF-8 bytes, not characters or just the unsigned payload |

## Format 1.0

The field-by-field specification is at the head of `packages/core/src/statement-read.ts`. The signed envelope is specified in `statement-signature.ts`. The fixed version-1.0 example in `progress-statement.test.ts` and the format round trips guard compatibility.

The payload identifies the class by level, grade, section label, subject, school year and optional stream; the pack by ID and release. It holds the issue day, last completed main-plan unit, last main-plan learning resource (done or started), main-plan delay after buffers, buffers used and left, and anonymous counts of sessions not held. TD counts are a subset shown separately, never added twice. Plan weeks are null for non-week packs, not an invented conversion from hours.

A unit is complete once every non-buffer main item is finished for the whole class and at least one was taught. An item the teacher left out, skipped, or a plan layer skipped counts as finished, as `pace` counts it; a unit left out whole never completes, and teaching one half does not complete the class. TD and buffers do not prevent main-plan unit completion. The last resource follows actual recorded teaching order, including re-teaching, not the furthest item or a future proposal; a skipped lesson is never named (answer 484).

Main calendar losses reuse `pace`, including its rotation cost. A main half-session not held that this cost already counts is not counted again, so the sessions not held never exceed the sessions scheduled. TD sessions lost to holidays or closures are calendar causes, and TD's other losses are «أخرى» (answer 484). TD and other session types count their own slots. Holidays, closures and rotation are calendar causes; the teacher's own calendar and other missed sessions are only `other`. Exams replace lessons and are not losses. A held session on a closed day is not lost; an unconfirmed session is neither delay nor a confirmed missed session. Corrected and withdrawn records use their current version. Inherited progress follows the course lineage.

The statement has no pupil identifiers, names, marks, roll calls, private notes, lesson notes, factual lines, homework, session dates, reasons, school identifiers, teacher-card details or recipient information. Session records pass the existing `statement` layer gate, followed by an explicit field projection. No whole history entry is exported. The teacher's private calendar contributes anonymous counts only.

Text fields are bounded: 64 UTF-16 units for codes, year, stream and release; 128 for a section label or item ID; 192 for a pack ID; 512 for a title. Text must be non-empty, valid Unicode and free of control characters or bidi controls. Dates are real YYYY-MM-DD dates. Counts are finite, non-negative and at most one million, and all are integers: delay and buffer figures are rounded to whole sessions, as the class screen rounds them. A teacher's own list is named by its country, level, grade and subject with `.own`, never by the class's local ID; its items keep the random IDs the list gave them. No plan week shows as behind when the rounded delay is zero. A statement whose pack titles would break these bounds is not made. TD losses cannot exceed the totals. Files are at most 65,536 UTF-8 bytes.

The envelope has format `minhajna.signed-statement`, version `{major:1,minor:0}`, a base64 DER SPKI public key, the exact payload string and its base64 DER ECDSA P-256/SHA-256 signature. The core uses the existing platform `Verifier`; it implements no cryptographic algorithm. Signing failures and verification errors contain no underlying exception or payload.

**A valid signature is not a verified identity or legal signature.** Reader mode must handle known keys, continuity and key changes. The core creates no state certification, key store, trust list or recovery mechanism.

## QR contract for #437

`STATEMENT_QR_LIMIT` is **996 bytes**, for the complete signed text. Version 25-M has 1,000 data codewords; the UTF-8 ECI marker uses 12 bits and the byte segment header uses 20, leaving 996 bytes. The native encoder must use UTF-8 explicitly, error correction M, normal byte encoding (not compact mode), and version 25 or smaller. See [ZXing's encoder](https://github.com/zxing/zxing/blob/zxing-3.5.4/core/src/main/java/com/google/zxing/qrcode/encoder/Encoder.java).

A direct check with the already-bundled ZXing Core 3.5.4 encoded and decoded 996-byte ASCII, Arabic and emoji strings at version 25-M. At 997 bytes, ASCII and Arabic were refused. No new dependency was installed. This is a library check, not a camera or phone scan.

Oversized QR content remains a complete signed file: it is not truncated, compressed or replaced by a public link. File sharing is #439; local-network transfer stays deferred under pilot choice P4.

## Verification

The regression test first failed for the missing `progressStatement` export. The focused cases cover class identity, pack releases, completion and half-groups, actual teaching order, buffers and weeks, calendar and TD losses, rotation, corrections, private-data exclusion, own lists, inherited progress, canonical text, untrusted input, versions, signature tampering, sanitised platform failures, asynchronous snapshots and QR byte boundaries.

Initial checks on 24 October, with Node.js 22.23.2:

- Locked root and Android installs, repository and Android type checks, ESLint and Prettier pass.
- All 754 core tests pass, including 22 new statement tests. All 19 sync, 17 web-storage and 14 APK-tool tests pass. The final run kept sources unchanged between the two reproducibility builds.
- All 256 Android suites and 2,250 tests pass, with process exit 0. No current Android teardown failure is reported.
- REUSE 6.2.0 with chardet passes: 2,105/2,105 files covered. Every changed or new file stays below 300 lines; the whitespace check passes.
- The offline Android release build passes with Temurin 17. Universal, armeabi-v7a and arm64-v8a unsigned APKs pass package verification. This is one local build check, not a new independent cross-machine reproducibility claim.
- The direct ZXing boundary and round-trip checks described above pass. No camera, native layout, spoken TalkBack, physical-phone or printed-page acceptance is claimed.

## Rechecked after updating from main

On 25 October, the unpublished branch was fast-forwarded to `ac0013c`, then its safeguarded changes were restored. The statement exports merged cleanly with the archive, recovery, restore and erasure exports. No unrelated main changes were removed or added to this contribution.

The privacy test now also runs a confirmed pupil departure and actual pupil-data erasure. The pupil's data is removed and the erasure fact remains locally, but the statement payload is byte-for-byte unchanged. No calculation or public format needed changing.

Fresh results with Node.js 22.23.2 and Temurin 17:

- Locked root and Android installs, both type checks, ESLint and Prettier pass.
- All **800 core tests** pass, including the 22 statement tests. All 19 sync, 17 web-storage and 14 APK-tool tests pass.
- All **272 Android suites and 2,340 tests** pass, with process exit 0.
- REUSE 6.2.0 with chardet passes for **2,180/2,180 files**. The file-length and whitespace checks pass.
- The offline release build and verification of the universal, armeabi-v7a and arm64-v8a unsigned APKs pass. The manifest requests only USE_BIOMETRIC, CAMERA, POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED, with no network permission.
- The QR byte limit and signed-payload contract match the separately submitted native primitives in [PR #455](https://github.com/djazairdev/minhajna/pull/455). Those native changes are not included in this branch.

This is a fresh build and regression check, not a new independent reproducibility, camera, physical-phone or accessibility acceptance result.

## Review fixes

The review of [PR #456](https://github.com/djazairdev/minhajna/pull/456) found the cases above. Six new tests in `statement-review-cases.test.ts` failed on the first version and pass now: a unit with an item left out or skipped, and one left out whole; a rotating class whose sessions were all not held; whole-number delay figures; a pack title too long to sign; a later major version, which now reports `version` so reader mode can ask for an update; and an own list's pack ID.

With whole numbers, a signed Arabic statement fits one QR code only with short titles, about 30 Arabic characters for each of the two titles. Most real statements will leave as a signed file, which answer 471 already allows.

## Part 3: the Share screen, print and PDF

[#438](https://github.com/djazairdev/minhajna/issues/438), answer 485. The class page has a row «بيان التقدّم» for a class with a plan. The screen shows the statement as it will leave, every field in words, with chips for the subject's other classes with a plan. Nothing is signed, made or logged before «طباعة» or «PDF».

At either tap the app computes the statement as of that moment's day, signs it with the phone's Keystore key (#437), and lays out an A4 portrait page: the day, the title, the class, the fields, a privacy line, and a box with «توقيع رقمي للتحقق، وليس توقيعاً قانونياً.», the key fingerprint in groups of four and the signed text's QR code when it fits. The page has no «داخلي · سري» mark and no password, since it holds no pupil data. A failed signature makes nothing.

**The signed text in the PDF.** The signature line is a link to `minhajna-statement:` followed by the signed text's UTF-8 bytes in base64 (`statementLink` and `linkedStatement` in `packages/core/src/statement-link.ts`). The phone's web engine keeps a link's address in the PDF, so every saved PDF carries the whole signed text however long it is. Reader mode (#246) takes it back from the file and checks it with `checkStatement`. On paper, only the QR code carries it, which fits short Arabic titles only.

The PDF is named «بيان التقدّم <class> <subject> <day>.pdf» through `safeFileName`. Each print and each saved PDF adds one `output.recorded` line to the activity log, document `statement` and the day; a cancelled save adds nothing. Part 4 records them as `statement.shared` instead.

| Check | Result |
|---|---|
| Unit tests: core link round trip and refusals (4); screen, print, PDF, the day of the tap, failures and texts (10); class page row (2) | Pass |
| Emulator, Arabic, right to left: the class page row, then every field, the chips, both buttons and the signature line; «PDF» saves «بيان التقدّم القسم التجريبي الرياضيات 2026-10-25.pdf», one A4 page with the fields, the fingerprint in its true order and a QR code; «طباعة» opens Android's print screen on one A4 page; the log shows «بيان التقدّم · 25/10/2026 · PDF» | Pass |
| Emulator, French, left to right: the same screen and a PDF named «Relevé de progression … Mathématiques 2026-10-25.pdf» | Pass |
| Emulator, text at 200%: each label sits above its value and the buttons wrap. The printed page also grew with the phone's text size and ran onto a second page; every printed document does this, since the page's web view keeps the phone's text zoom, so it is fixed apart | Screen: pass. Page: separate fix |
| The saved PDF keeps the link's address unescaped, `linkedStatement` reads the signed text back from the file, and `checkStatement` accepts it; with one figure changed it fails with `signature` | Pass, Arabic and French PDFs |
| TalkBack in Arabic, A4 paper and a camera scan of the printed code | Not checked here; listed in #206 |

The emulator check ran on 25 October 2026 on an API 35 emulator, with a release build of this branch signed with the debug key and made-up data: the demo class, a made-up own list of five items and three confirmed sessions.

## Part 4: sharing by QR code or file, «لمن؟» and the history

[#439](https://github.com/djazairdev/minhajna/issues/439), answer 486. Every share is recorded in the teacher's shared-statement layer, which goes to their own devices and the full export but never into a statement or a school space:

- `statement.shared` holds the share's ID, the class and how it left: `print`, `pdf`, `qr` or `file`. It replaces Part 3's `output.recorded` line.
- `statement.sent` holds a share's ID and one of five roles: director, inspector, coordinator, teacher, other. There is never a name or free text; the issue's free-name field conflicts with PRD §3.10, and the PRD wins.

`sharingHistory` lists the shares newest day first, each with the role said last; an earlier role stays in the records. A role for an unknown share, or outside the five, is left out. The activity log shows «بيان التقدّم · <class> · <how>», with the role after it for a `statement.sent` line.

After a print, a saved PDF, a closed QR code or a shared file, «لمن؟» asks for the role. «حفظ في سجل المشاركة» records it only when it changed; «لاحقاً» and closing record nothing, since the share is already there. «سجل المشاركة» on the statement's screen opens the sheet again from any row.

**QR code or file.** `statementFitsInQr` measures the signed file before signing, with the public key at its 124 base64 characters and the signature at its longest, 96. A statement that fits shows «رمز QR»: the whole signed text, drawn large on a light ground with the screen kept on (`keepScreenOn`) until «إغلاق». A longer one shows «ملف موقّع» instead, with a line saying why: the signed text as a `.json` file, named like the PDF, sent through the share menu with no password, since it has no pupil data. «المشاركة» in Settings opens the statement on the current year's first class with a plan, or another year's when this year has none, and the row is hidden when no class has one. A share whose way out a later version added is left out of the history and the log, rather than shown as a raw key.

| Check | Result |
|---|---|
| Unit tests: the history, roles and log lines, and the layer's travel rules (3); the QR bound at its longest signature (core); the sheet, a row changing the role, the QR screen and screen kept on, the file, the log, Settings and the texts in three languages (8) | Pass |

## Still outside this part

- #437 / PR #455: Android Keystore key creation and signing, fingerprints, QR drawing and native tests, submitted separately.
- #246: reader mode, including identity and key-continuity checks. Main now contains #247's backup and transfer work; it does not transfer a teacher's Keystore signing key.
- Native RTL/LTR at 200%, spoken Arabic TalkBack, A4 paper and budget-phone acceptance of those screens. None is claimed for this core-only work.

No dependency, permission, network call, database migration, existing format or layer rule changes. NETWORK.md, PRIVACY.md and the PRD are untouched. The new statement format does not alter existing signed reference updates.
