# Progress statement: the core

Part 1 of [#245](https://github.com/djazairdev/minhajna/issues/245), scoped by [#436](https://github.com/djazairdev/minhajna/issues/436). Prepared on main `2ae76b0` on 24 October 2026, then updated to main `ac0013c` and rechecked on 25 October. All test data is invented.

This adds the statement's calculations and versioned signed text, not the Share screen. No teacher-facing feature is enabled, so CHANGELOG.md has no new announcement.

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

A unit is complete only once every non-buffer main item has been fully taught to the whole class. Skipping an item does not complete it; teaching one half does not complete the class. TD and buffers do not prevent main-plan unit completion. The last resource follows actual recorded teaching order, including re-teaching, not the furthest item or a future proposal.

Main calendar losses reuse `pace`, including its rotation cost. TD and other session types count their own slots. Holidays, closures and rotation are calendar causes; the teacher's own calendar and other missed sessions are only `other`. Exams replace lessons and are not losses. A held session on a closed day is not lost; an unconfirmed session is neither delay nor a confirmed missed session. Corrected and withdrawn records use their current version. Inherited progress follows the course lineage.

The statement has no pupil identifiers, names, marks, roll calls, private notes, lesson notes, factual lines, homework, session dates, reasons, school identifiers, teacher-card details or recipient information. Session records pass the existing `statement` layer gate, followed by an explicit field projection. No whole history entry is exported. The teacher's private calendar contributes anonymous counts only.

Text fields are bounded: 64 UTF-16 units for codes, year, stream and release; 128 for a section label or item ID; 192 for a pack ID; 512 for a title. Text must be non-empty, valid Unicode and free of control characters or bidi controls. Dates are real YYYY-MM-DD dates. Counts are finite, non-negative and at most one million; losses and plan weeks are integers. TD losses cannot exceed the totals. Files are at most 65,536 UTF-8 bytes.

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

## Still outside this part

- #437 / PR #455: Android Keystore key creation and signing, fingerprints, QR drawing and native tests, submitted separately.
- #438: the preview, A4 print/PDF and a recoverable representation of the signed text in the PDF.
- #439: QR/file sharing, optional recipient roles and append-only sharing history. Its free-name field conflicts with PRD §3.10; the PRD wins: role only, never a recipient's name.
- #246: reader mode, including identity and key-continuity checks. Main now contains #247's backup and transfer work; it does not transfer a teacher's Keystore signing key.
- Native RTL/LTR at 200%, spoken Arabic TalkBack, A4 paper and budget-phone acceptance of those screens. None is claimed for this core-only work.

No dependency, permission, network call, database migration, existing format or layer rule changes. NETWORK.md, PRIVACY.md and the PRD are untouched. The new statement format does not alter existing signed reference updates.

## ملخص بالعربية

هذه خطوة تمهيدية لحساب بيان التقدّم والتحقق من توقيعه. يعرض البيان تقدّم القسم والحصص التي لم تُعقد، دون بيانات التلاميذ أو الملاحظات والأسباب الخاصة. لا ترسل هذه الخطوة أي شيء، ولا تضيف شاشة مشاركة بعد. التوقيع للتحقق من سلامة البيان، وليس توقيعاً قانونياً أو اعتماداً من الدولة.
