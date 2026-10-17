# A full demo year for load checks

The test-only generator for [#77](https://github.com/djazairdev/minhajna/issues/77) gives [#19](https://github.com/djazairdev/minhajna/issues/19) and [#46](https://github.com/djazairdev/minhajna/issues/46) the same synthetic records. No real pupil data or official lesson content is included. Nothing is downloaded, and no new dependency is needed.

## The workload

`makeDemoYear(reference, deps, level = 'cem')` lives at `@minhajna/core/test-support/demo-year`. It returns `{ reference, classId, entries }`. Pass the public, validated country profile and calendar from `data/dz/profile.json` and `data/dz/calendar-2026-2027.json`; no input plan pack is required. `deps` supplies the platform's SHA-256 and secure random bytes, just as for `RecordBook`.

The range is **21 September 2026 through 8 July 2027**, inclusive. A shorter year is rejected. These are the issue's load-test bounds, not a claim that pupils attend lessons until July: the official pupils' last day is still unknown ([data notes](../../data/README.md)). Calendar exclusions, including expected dates, use the bundled data as it stands, not a forecast established by this test.

Both variants reuse the small demo class and timetable from `cemEvents()` or `primaryEvents()`. Each expands the roster to 45 invented identities with unique IDs and registration numbers, Arabic and Latin names, and deliberate duplicate names. Middle school retains long names and hamza spellings, with 23/22 pupils in A/B half-groups. Primary retains the small fixture's arrival and unconfirmed departure; 44 pupils are enrolled before the arrival, then 45.

Setup is recorded on the first day. Every ordinary timetable session is confirmed as done, with nonempty coverage from a generated `example` plan that lasts all year. Its text, three-stage template and one-session budgets are invented, not a reproduction of a Ministry plan. Primary retains reading/writing activity slots; middle school retains alternating TD groups. The generated plan belongs to the returned reference and is not published as reference data.

Every required roll-call unit is taken: per session at middle school, per half-day at primary. Holiday, closure and exam sessions have no confirmation or roll call. Attendance includes all-present units, rotating justified/unjustified absences and lateness, limited to enrolled pupils in the relevant group. It invents no medical or family explanation.

Every tenth session has homework and a factual detail; every thirtieth also has a test detail. Homework dates are clipped to the year. Every twentieth teaching day corrects the previous teaching day's first session and roll call. Both versions remain, the correction has a later date, and the lesson correction's reason stays in the private layer. All history fields use dates, never clock times.

## Counts and bytes

Measured with the bundled profile release `2026.2` and the current 2026/27 calendar. The tests lock these figures; a reference-data or workload change must update them intentionally.

| Variant | Teaching sessions | Roll-call units | All history entries | UTF-8 JSON bytes |
|---|---:|---:|---:|---:|
| Middle school (`cem`, default) | 161 | 161 | 396 | 260,598 |
| Primary (`primary`) | 256 | 225 | 554 | 368,444 |

Middle school has 50 setup entries; primary has 49. Both add eight session corrections, eight roll-call corrections and eight private correction notes. There are 16/25 homework details and 5/8 test details respectively, already inside the session entries.

Bytes mean exactly `new TextEncoder().encode(JSON.stringify(entries)).length`: compact JSON, UTF-8, no newline or byte-order mark. This includes all history headers, IDs, salts, hashes and bodies. It excludes the returned reference/plan, encryption, database/index overhead, archives and backups. Fresh secure randomness changes IDs, salts and hashes but not the byte count. This is not an on-disk size or a browser quota guarantee.

## Load an isolated store

The helper is TypeScript with no Node APIs and no hashing implementation. Node, browser and Android test harnesses can supply their own validated reference and platform dependencies. A harness that maps package paths, such as the current Android Jest setup, must also map this separate test-only subpath when it starts consuming it. Do not add it to production imports or use a teacher's database.

```ts
import { RecordBook, makeContext, todayView } from '@minhajna/core';
import { makeDemoYear } from '@minhajna/core/test-support/demo-year';

const fixture = await makeDemoYear(validatedBundledReference, platformDeps);
const store = await createEmptyIsolatedTestStore();
for (const entry of fixture.entries) await store.append(entry);

const book = await RecordBook.open(store, platformDeps);
const context = makeContext(fixture.reference, book.state);
const view = todayView(context, fixture.reference.year.to);
```

Use the returned `reference`, which holds the course's pinned example plan. Append in order to an **empty** store; do not merge independently generated histories. The caller owns closing and removing its isolated store. Generate outside a timed measurement; then let the relevant platform check decide whether to measure reopening, decryption or screen rendering. Do not silently exclude those operations from a launch budget.

## Verified here, and not yet verified

The core tests check exact counts and byte sizes, the complete session and roll-call sets, eligible marks, calendar exclusions, dated corrections and private reasons, example-pack validity, serialisation/reopening, hash verification, a new append after reopening, and independent repeated generation. A separate type check compiles the generator and its imports with only ES2022 types, without Node or DOM globals. The small demo fixtures retain their existing exports and tests; their data-only definitions are split from the Node convenience helpers.

This change supplies the workload only. It does **not** establish the two-second Today target, SQLCipher/device behaviour, browser persistence or storage quotas. Run those checks under #19 and #46 with this fixture; no device or browser performance result is claimed here.
