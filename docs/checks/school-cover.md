# School-cover foundation — not activated

Related to [#224](https://github.com/djazairdev/minhajna/issues/224); PRD §3.3, §7.1, §7.6, §7.7 and §7.8.

## Scope

This draft preserves the unmerged school-cover foundation only. The pilot's seminars, councils, Ramadan cards and teacher-entered cover already landed in #331–#335. None is replaced or changed here. The pilot intentionally leaves received cover for the school space; this draft does not close #224.

The shared core has an append-only school cover book. Only a director or deputy can mark a school timetable session needing cover, assign or correct its arrangement, or cancel it. Supervision is the initial unassigned choice. The alternatives are a study room, merging with a real host class, a swap, a move, a free colleague, or releasing pupils in their last session. A colleague must belong to the school and be free in its supplied timetable; simultaneous cover assignments within this school cannot double-book them.

The unconnected CoverBoard panel lets management choose the day's session, arrangement and a valid colleague or timetable alternative. It reports success only after saving, keeps a failed assignment visible for retry, and previews cancellation with Keep and Confirm. Its host must supply the authenticated book and readable staff/timetable names. There is no role picker or navigation route.

The teacher assigned a staffed cover can confirm that it took place, or withdraw their own confirmation, through the core API. Confirmation cannot precede the session's date. Management cannot overwrite or cancel a confirmed teacher record. Corrections and withdrawals leave earlier versions in the history. A teacher confirmation screen is not included.

A teacher projection contains only cover they give and cover for their own classes. A supervisor receives the day's sheet, including the assigned colleague, without the holder's identity or the history. Timetable preparers and inspectors have no cover access. Management can read confirmed cover given for fair distribution, not counts of teachers' absences.

The records have no field for an absence or a reason for cover. Session dates and timetable slots identify the work; history has dates, never clock times. Unknown fields on an assignment are not stored.

SchoolCoverCards reads the separate school projection port. Neither the cards nor their provider is mounted on Today. Journal helpers accept an explicit school projection and select only confirmed cover given; pending and received cover are not work the teacher gave. They are not connected to any document screen or renderer entry point. The pilot's journal and texts book stay unchanged, including its existing primary rules.

## The school-space gate stays closed

**This is not a complete, activated school-cover workflow.**

PRD §7.1 reserves the school's space for the national system. This repository has no authenticated school membership, school key service, master-timetable service or connected principal dashboard yet. This draft does not invent them.

- CoverAuthority is a trusted-adapter contract, not authentication. A boolean or a role supplied by a person is not proof of national deployment or school membership.
- SchoolCoverBook checks supplied authority on every operation, including queued writes. The future adapter must derive it from verified, current school membership and must own a separate encrypted school store.
- Only a director/deputy school-key holder opens the authoritative book. Readers receive restricted projections, never the full store, membership roster, history or school key. Method-level checks do not protect a raw store already handed to somebody; the future encrypted transport and key boundary must enforce this too.
- A teacher's confirmation must arrive as a current cover record, never a private history entry or its confirmation date (§7.6). The school book uses the school's processing day. Its operational history must not be copied into teacher/supervisor outputs or used to infer when a teacher entered their own records.
- SchoolCoverSource is a read-only projection boundary, not an authentication provider. No preview route, setting or role picker supplies it. An ordinary teacher cannot create school assignments or impersonate a principal.
- Real authentication, encrypted transport, key access, membership revocation delivery, retention rules and durable school-store integration remain prerequisites before connecting the panel or cards.
- A swap or move records the principal's choice and referenced session. Publishing its actual timetable change remains the master-timetable service's responsibility (§7.4); this module does not silently alter a teacher's week.
- The daily sheet and confirmed-cover log are structured core outputs. The supervisor's print/send interface and principal's fairness dashboard remain school-mode work.
- Before journal integration, settle the primary and specialist layouts and reconcile school assignments with teacher-entered pilot cover so that the same work cannot print twice.
- No new import format or school-data transfer is enabled. Connecting an adapter requires privacy review; the teacher's record book and outgoing routes are unchanged.

These school-space prerequisites are not scheduled by this draft. The pilot plan (#252) defers national-system functions; the sync experiment (#47) is not their production implementation. Maintainers still need separately scoped implementation issues before activation.

## Verification

Checked on 21 October 2026, based on main `2ff1052`, with Node.js 22.23.2. Only made-up classes and staff identities are used.

- Repository and Android type checks pass.
- All 491 core tests, 14 sync tests, 17 web-storage tests and 14 APK-tool tests pass.
- All 177 Android suites pass: 1,728 tests. A final targeted run of the school-cover and translation-configuration tests also passes, 25 tests.
- ESLint, Prettier and the whitespace check pass. Every changed or new file is within 300 lines.
- REUSE 6.2.0 passes for all 1,740 files, using its chardet encoding detector. The alternative charset-normalizer detector rejects the first 2,048-byte sample of the unchanged UTF-8 demo-pupils file and reports its existing header as missing; the file is left unchanged.
- The offline release build passes with Temurin 17 and the installed Android SDK selected. The unsigned universal, armeabi-v7a and arm64-v8a APKs pass package verification.
- The universal APK still requests only the existing biometric and camera permissions, with no network permission.

Synthetic core tests cover director/deputy authority, combined teaching roles, rejected roles, deployment and school boundaries, revoked membership, slot and year validation, default supervision, free-colleague checks, merge targets, last-session release, duplicate and queued writes, failed-save retry, reopen, confirmation ownership, cancellation, immutable earlier versions, tampered histories and stripped reason fields.

Android renderer tests exercise the unconnected management panel and projection cards in Arabic, French and English at 100% and 200% text settings, named controls, failed access, durable assignment and cancellation, journal-helper filtering and escaped class labels. Tests also keep the existing pilot journal and texts-book entry points unchanged. They do not establish native layout, spoken TalkBack, real authentication or A4 print acceptance.

Before activation, test verified school membership with invented classes: principal assignment → durable school save → correct teachers' offline views → teacher confirmation → journal and supervisor outputs. Test revoked membership, disconnected operation, failed saves, conflicting edits, correction after confirmation, and layouts on an Android 8 budget phone and A4 paper.

No change teachers can see in the ordinary preview. No dependency, permission, network call, teacher-database migration or public file format is added.

## ملخص بالعربية

هذه أعمال تمهيدية للتكليف بالتعويض في فضاء المؤسسة مستقبلاً، وليست ميزة مفعّلة في النسخة التجريبية. لا تغيّر طريقة تسجيل التعويض الحالية، ولا تفتح حسابات للإدارة، ولا ترسل أي بيانات. يبقى الربط بفضاء المؤسسة مؤجّلاً إلى حين استكمال التحقق من الصلاحيات والتشفير والحفظ، ومراجعتها قبل التفعيل.
