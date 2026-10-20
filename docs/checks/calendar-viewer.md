# Calendar: stages 1–4 of #222

This records the stages 1–4 checkpoint. Stage 5 adds receiving and database version 5; see the [receiving check](calendar-receiving.md) for the current additional scope and verification.

The viewer and local editors from [#222](https://github.com/djazairdev/minhajna/issues/222), following PRD §§3.2, 4.5 and 4.6 and the `Calendar`, `Calendar-add`, `Calendar-ab` and `Calendar-groups` designs. They open from Settings. The initial checkpoint used the Settings contribution from #298; that work later reached main through #308.

## What these stages include

- A month view within the bundled school year, with Western digits and the country's month names, weekdays and A/B weeks.
- A school selector and the four layer filters. Wilaya, school, level and grade restrictions are respected, including every level of a joint primary class.
- Entry details with their actual dates, source, confidence, calendar effect and stored origin. A source or an announced date never becomes a claim that a signature was verified.
- Arabic, French and English, with growing text and a horizontally scrollable month at enlarged text sizes.
- Adding school or wilaya closures, school markers and private training or duty entries for a whole day, morning or afternoon. An inclusive range applies the same half on every date. Entries keep a source and announced/expected confidence. Today labels a half-day closure without saying the whole day is closed; the other half remains available. Make-up choices distinguish morning and afternoon closures on the same date.
- Editing supported local entries under their same IDs, layers, school/wilaya and restrictions. A private entry cannot become shared by editing it. Reference entries, ordinary ID collisions with references, Ramadan rules and unsupported entries remain read-only. Lunar confirmations are the explicit, constrained exception below, not arbitrary reference edits.
- A preview before saving or cancelling: changed unrecorded sessions, recorded sessions kept, and the engine's before/after capacity figures with their actual exam confidence or explicit term-end basis. Browsing and previewing never write.
- The existing editor for make-up, support and revision days is reused, including editing an existing day without clashing with itself. It retains its session selection and existing live preview.
- Cancellation appends a withdrawal, not an erasure; every earlier version stays in the history. A late closure cannot relabel an already taught lesson as a calendar loss. An explicitly not-held lesson can still reflect that closure.
- Queued saves reject stale previews, keep failed drafts for retry, prevent duplicate taps and wait for durable success before navigation. Leaving before a prior queued write settles prevents a new calendar write; leaving after this write was queued does not abandon it or navigate from an unmounted page.
- A school A/B editor with the current letter, a selectable teaching week, source and confidence, and before/after letters and a changed-week count. Holiday weeks cannot be selected; exam weeks keep a letter. A school reset overrides broader resets in the same week; the latest local correction wins. Later resets limit its effect. Impact previews cover the rest of the year, not only the selected day, and recorded sessions are retained even when their old alternating slot disappears.
- Local confirmation of an explicitly marked expected lunar holiday. The teacher selects the announced first day within ±1 day and enters the announcement's source, reviews the effect and explicitly confirms. Duration, name, scope and other reference fields stay intact. The reference file is not edited; a local overlay keeps its exact canonical reference. Withdrawal restores it. If the reference entry changes, the old confirmation becomes visibly inactive and no longer drives sessions or month marks. This does not verify an issuer, fetch an announcement or confirm Ramadan hours.
- No import, new permission, network call or dependency. Sources and titles remain local text; the form asks not to enter pupil information.

## Rotating groups

- A local rule selects one class, two existing or newly prepared half-groups, an inclusive period, group order, source and confidence. It follows profile working days in week order, the optional Saturday and the school's A/B resets. Slots keep their places; a fixed half-group slot on its off-day is a calendar loss, with no roll call. Closures, exams and private teacher days keep their existing meanings. The whole class resumes outside the period.
- The proposed split preserves valid existing assignments; otherwise it suggests the first half of the list and the second. The teacher reviews each pupil's group, can move pupils and explicitly saves the split before previewing a rule. This uses existing class and pupil records, not new pupil fields. Changes apply from the recording date, not backdated membership. A failed batch exposes its saved prefix and keeps the draft; retry saves only remaining differences. It never activates a rule implicitly.
- Rotation entries and saved session/roll-call snapshots contain class/group IDs only, never pupil identities. Roster membership is derived from existing dated pupil history. The first taken roll call fixes its history cutoff, so later moves, including same-day moves, cannot rewrite its roster. A new or ambiguously assigned pupil blocks a new roll-call save with a review notice. The off-duty group never becomes absent or present by default.
- Main-plan and TD opportunities are counted separately, including primary activity queues. Eight balanced physical lesson sessions provide four whole-class opportunities; two TD sessions provide one in their own queue. Repeats are explicit calendar cost and reduce expected progress rather than become delay. Real missed teaching can still produce delay after buffers. A future second-group session can complete first-group work already recorded. No missing buffers are invented.
- An item taught to one group is started, not done. It completes on the date all required groups finish; projected rotation dates also use common completion. Whole-class resumption retains common stage/budget progress. Both the app and printed texts book keep a row per physical session, with its actual date and class/group label.
- Edits, A/B changes and cancellation do not reassign a recorded physical slot or create a second proposal alongside it. Saved roll calls remain addressable, including when a changed alternating slot disappears. The editor supports two half-groups, refuses overlapping rules for one class, and refuses option/level-only timetable scopes it cannot safely rotate. A bundled or signed rule is not made editable by this local flow; signed imports remain separate work.

## Compatibility

Android database migration **4** changes its compatibility marker, not its history or timing rows. Versions 0 and 1 still create the tables they need; versions 2 and 3 keep their existing timing table. Earlier apps refuse the newer database instead of misreading partial closures, lunar overlays or rotating-group snapshots. A failed migration is transactional; history rows and hashes are never rewritten.

Prepared calendar release `2026.3` adds only the safe optional `lunar: true` eligibility flag to the four expected lunar holidays. Dates, durations, sources and confidence are unchanged. An old format-1 reader can leave this metadata out safely. The current format-1 reader refuses local-only `half`, `confirmedFrom`, `rotation` and the `rotating-groups` effect, since silently dropping their meaning would be unsafe. No new wire format or signed release is published here; single-entry receiving and reference imports remain later work. See [data/README.md](../../data/README.md#changing-the-data).

## Automated checks

The calendar suites check scoping, joint classes, multi-month entries, colliding IDs, removed entries, leap years, month limits, navigation, source/confidence and 48 dp controls. Viewer and editor render at font scales 1 and 2 in all three languages. Date grids scroll horizontally to retain 48 dp targets on narrow screens. Catalogue and mocked Weblate tests cover the bundled namespace.

Core regressions cover local validation, preserved versions, private layers, immutable scopes, reference restrictions, half-day scoping, added-day edits, A/B precedence and withdrawal, complete-range lunar shifts, stale confirmations and recorded lessons. Rotation checks also cover separate queues and activities, weekly packs, completion dates, roster cutoffs, new pupils, saved roll calls, absence totals, missed teaching and resumption. Android regressions cover explicit previews, invalid dates, stale drafts, failed saves and retries, concurrent taps, pending writes, leaving, the focused editors, Today, texts-book app/print rows and route scope checks. All classes and notices used in these tests are made up.

Passed locally on Node.js 22.23.2:

- Repository type checks, lint/format checks and tests: 371 core tests, 13 sync checks, 17 web-storage tests and 14 APK-tool tests.
- Android type check and all 149 suites: 1,496 tests passed, including 104 calendar-specific tests in fourteen suites.
- REUSE: all 1,615 files covered. All 101 changed/new files remain within 300 lines.
- Offline release build with Temurin 17: unsigned universal, armeabi-v7a and arm64-v8a APKs; all three pass the release-package verifier.
- Android 8/API 26 native storage tests: **16 passed**, including three migration tests. Version 1 upgrades with its entries kept; version 2 upgrades with its entries and timing table kept; version 3 upgrades without changing an opaque rotation snapshot; version 5 is refused without changing it. These ran on a separate read-only emulator, which was stopped afterwards; the existing emulator was not changed.

These renderer checks are not native layout or spoken TalkBack acceptance. No reproducibility comparison or new F-Droid scan is claimed.

## Manual acceptance still required

Use the demo classes and made-up notices only:

1. Open Today → Settings → Calendar. Switch school, month and layer; open an entry and use Back. The previous choices remain.
2. Read announced, expected and projected entries. Confirm that the source is readable and no issuer verification or last-update date is invented.
3. At 200% text on a 360×800 phone, scroll the month horizontally and the page vertically. No label or source is cut off.
4. With Arabic TalkBack, check school and layer selection, the month buttons, each full date and its event names, week letters, entry details and Back focus.
5. Repeat left to right. Check an empty month, no school and an entry removed before opening it.
6. Confirm the history is unchanged after browsing, and the release build still asks for no network permission.
7. Add a whole-day closure, a date range, a school marker and a private training/duty entry. Check the preview against the made-up timetable, then save. A marker must not remove lessons. The wilaya choice must identify the intended wilaya through the selected school; an unset wilaya is refused.
8. Edit the source or date and confirm the same ID remains. A changed scope must require cancellation and a new entry. Confirm cancellation only after its preview; Keep must leave the entry untouched. Earlier versions must remain in the book.
9. Open an existing make-up, support or revision day from its details. Its own sessions must not clash; changing it must retain its ID. Recheck the original additional-session entry point and Undo.
10. Record a made-up lesson as taught, then add a closure on that date. The recorded lesson must remain taught. Test a failed save, double taps and Back during a pending save; there must be no false success or duplicate entry.
11. Add morning and afternoon closures on a day with both halves scheduled. Check their separate lesson impacts, Today, make-up choices and the edit back to a whole day. Private training still must not affect the school's A/B weeks.
12. Confirm a made-up lunar holiday, checking the announcement source and full duration, then correct or withdraw it. After a changed reference, the old confirmation must be visibly inactive, not a second holiday mark. No official verification or auto-confirmation may be implied.
13. Reset a school's A/B letter from a teaching week. Check current and changed letters, holiday weeks, exam weeks, a later reset, an edit to an earlier reset and withdrawal. Record a made-up alternating session first: its record must remain intact even if its old pattern disappears.
14. Open Rotating groups, choose a class, review the proposed list, move a made-up pupil and confirm. Preview both week letters, per-group sessions, separate lesson/TD capacities and their before-exam figures. Nothing activates before the rule's separate Save.
15. Confirm a lesson for each group: after the first it is started for that group only; after the second it is done on that date. Check both texts-book rows, group labels and actual dates in the app and print output. Check common progress after the period ends.
16. Take a group roll call, move a pupil the same day, reverse the rule or cancel it. The saved roster and unit must remain unchanged. An off-duty group has no absence. A newly added unassigned pupil must trigger group review before a new roll call can be saved.
17. Test an interrupted split, retry, duplicate taps, Back while saving and a stale rule preview. Keep any already saved prefix visible, do not duplicate it on retry and never report an active rotation before its own durable save.

Budget-phone performance and native visual/TalkBack acceptance remain pending until these steps are performed on a device. There are no new screenshots in these stages. These pending checks are not an assertion of native acceptance.

## Later stages

Offline single-entry receiving is covered by [stage 5](calendar-receiving.md). Signed reference-release imports remain in #223 and are not presented as working. No automatic networking, official adoption or issuer verification is implied.
