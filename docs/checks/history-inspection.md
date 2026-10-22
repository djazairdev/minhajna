# Read-only history inspection

Core slice of [#235](https://github.com/djazairdev/minhajna/issues/235), requirement R-5.5-04 and PRD §5.5. Rebased on main `a8a5bf3` before submission and checked again on 22 October 2026. Only synthetic data is used.

## What this adds

`inspectHistory(digest, loadedRows)` returns an immutable, read-only inspection result. It accepts loaded rows, not a writable store. It never appends, erases, sorts, repairs or rebuilds application state.

- The result preserves each row's supplied position, including unreadable rows.
- It checks the entry envelope, date, sequence, link, header hash, content digest and duplicate identities. Unsupported envelope fields are omitted.
- A row is consistent only while the contiguous prefix remains consistent. A later matching hash does not re-establish trust after a break.
- An unchecked row can expose its validated header, marked unverified, but never its body or salt. An unreadable row exposes neither.
- A legitimate erasure requires unique targets in the same layer, earlier than the erasure, and never another erasure. Missing content is justified only by an erasure inside the consistent prefix. When that dependency fails, the boundary moves backwards.
- A valid but unfinished erasure is masked in the inspection view. Inspection does not finish the physical deletion or alter the stored original.
- Platform digest failures and unreadable containers are reported with fixed messages, without underlying payloads or exception details. They are not presented as evidence of tampering.
- Input rows are detached before hashing, and the result is frozen, so later caller changes cannot alter content already classified by the inspection.

The version-1 hash preimages are shared with the writer, without changing their bytes, the stored format or the normal writable-open behaviour. Existing writable history checks remain in place; the inspection result is not a replacement RecordBook.

## Trust limits

An intact result means the loaded chain is self-consistent, not authentic or complete. This unsigned chain cannot detect a full rewrite with recomputed hashes, or removal of an otherwise valid tail, without an independent trusted anchor. No signing key, checkpoint or new cryptographic format is introduced here.

The static Log-broken design shows trustworthy data after a damaged interval. This core API deliberately makes no such claim without an independent anchor. It withholds every later body; a future screen must distinguish readable metadata from verified content and must never replay these rows as a normal record book.

Even an exposed body is still an unknown event payload, not a validated RecordEvent. The log screen must use known event schemas and localised summaries, not render raw payloads. Private content must not enter error messages, diagnostics, notifications or outgoing files through this inspection API.

## Verification

The focused suite covers intact and empty histories, changed bodies and headers, missing and reordered rows, malformed dates and JSON values, duplicate identities, snapshot mutation, frozen results, digest failures, valid and invalid erasures, pending erasures, backwards erasure dependencies, and the unchanged writable-open gate. Separate tests document the unsigned rewrite and tail-truncation limits.

Checked with Node.js 22.23.2:

- Locked installs for the root workspace and Android complete.
- Repository and Android type checks pass. ESLint, Prettier and the whitespace check pass; all changed/new files stay within 300 lines.
- All 634 core tests pass, including 23 new inspection cases. The 14 sync, 17 web-storage and 14 APK-tool tests pass too.
- Focused Android history compatibility: 4 suites and 26 tests pass.
- Full Android run: all 226 suites and 2,035 assertions pass, but Jest exits 1 because today-lists.test.tsx schedules work after teardown. The same ReferenceError and non-zero exit were reproduced on pristine main 03a1756 with that file alone, despite its 9 assertions passing. That test and Today.tsx are unchanged between the original and updated base commits. This is not reported as a green full-suite run, and no unrelated test or UI fix is included.
- REUSE 6.2.0 with chardet passes for all 1,940 files.
- The offline Android release build passes with Temurin 17 and the installed SDK. All three unsigned APKs pass package verification. Existing biometric, camera, notification and boot permissions remain; there is no network permission.

The initial regression test failed because the core had no inspectHistory export. No native layout, TalkBack or budget-phone performance check is claimed for this core-only change.

## What remains in #235

- The normal activity-log selector, translated summaries, filters and missing audit-event hooks.
- Native startup handling and a read-only Log-broken screen, including a safe path when native storage cannot decode a row.
- Explicit recovery actions only once #247 implements backup and restore.
- Retention preferences and erasure offers. Full pupil/device erasure belongs to #248.
- Android 8 budget-device, native RTL/LTR at 200% text and spoken Arabic TalkBack acceptance.

No dependency, network call, permission, database migration, file format or record layer changes. No app route is enabled and no teacher-facing behaviour changes yet, so this core-only slice adds no CHANGELOG entry. Existing pending changelog notes are untouched. PRIVACY.md and prd/10 are not edited.

## ملخص بالعربية

هذه خطوة داخلية لفحص سجل النشاط دون تغيير البيانات أو حذفها. إذا وُجد خلل، لا تُعرض محتويات السجلات التي لم يكتمل التحقق منها، ولا يُصلح التطبيق السجل تلقائياً. شاشة سجل النشاط وإعدادات مدة الحفظ لم تُفعّلا بهذه الخطوة بعد.
