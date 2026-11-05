# Pack release lifecycle in a demo world

Verification of [#612](https://github.com/djazairdev/minhajna/issues/612), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01, refreshed on 2026-11-02 after rebasing. Every source, world and role used in the tests is made up.

## Scope

A national world's curators and Ministry work through pack-editor accounts on the demo server (R-4.3-09, R-6.7-02, answer 767). The device that started a world makes them, and shows a role's code for another PC. Each change first takes its step on the server, which refuses what the account may not do and signs what it allows with the world's stand-in CA. Every reader refuses a change without that signature, or whose role, status or content differs from what it signed. So anyone with the world's code can read and sign with the world's key, but only the Ministry's account makes a pack Official. An Official pack stays inside its world. Named people, two-factor sign-in and the Ministry's own signing key wait for the real system.

The server sees a release's name, stage and status, and a digest keyed with the world's sealing key, never the release. The two-person review and checks come in #614, migration work in #615 and teacher delivery in #617.

## Contract

- Lifecycle stage is separate from source status. A release moves from draft to under review to published, then superseded or withdrawn. Editing a review returns it to draft. A curator cannot assign Official; the Ministry's account can publish a curator's review as Official.
- A published source and its signed file are immutable. Withdrawal keeps them. Superseding requires a newer, already published release of the same pack and publishing role. Neither terminal stage can be reopened. Readers can follow the replacement chain to a publication still in force. A withdrawn replacement ends the chain without erasing its history. These operations never move a teacher's pinned release or rewrite a session.
- Revisions refuse stale edits, including an edit racing with another upload. An unrelated release can append first without losing the intended change. A write accepted but reported as a conflict is recognised on retry without another revision.
- Dates are calendar dates only, never clock times. The service checks the world's current date with the relay and refuses a missing, changed or malformed date; it never substitutes the device's date. History cannot move backwards or accept a future change.
- The service reuses the world's keys held in memory. It has no teacher store, history or settings input, and touches no teacher pin or real reference store. Real mode, teachers' worlds, unsupported roles and mismatched held keys are refused.

## Signed and sealed records

Every change is a world-signed `minhajna/pack-release/1` record. A publication also holds an ordinary version-1 pack-update payload, signed for that world. Its existing reader refuses it in real mode or another world. Replaying checks the signature, signing purpose, country, world, dates, exact revision chain and transitions; publication content must match its inner signed pack file.

The encrypted national space carries these records on a separately derived opaque stream, alongside the calendar's separate stream. No plaintext pack ID, source, role, stage or unsealed key reaches the relay. The relay still stores opaque batches; the pack desk's endpoints are in `apps/server/README.md`, and there is no new dependency, permission or account table. `NETWORK.md` documents this additional caller of the existing flow. Encryption and relay writes make this a privacy-sensitive change.

A whole change fits one atomic upload of at most 128 fixed-size batches of 4,124 bytes. A draft or review must fit once it carries its signed publication, and oversized records fail before opening a space or uploading. This deliberately bounds demo sources rather than silently cutting off a pack. The codec reuses the existing signing and sealing primitives.

Authoring requires a complete stream. Damaged ciphertext, missing or unfinished batches, conflicting batch numbers, invalid signatures and broken revisions refuse another write rather than expose an earlier editable state. The read-only list can still show intact, verified releases when a batch is damaged. Authoring continues to require strict replay, including after an upload conflict.

## Checks

| Check | Result |
|---|---|
| Focused lifecycle tests | Core and app tests passed, covering transitions, immutable publications, world isolation, dates, size limits, concurrency, damaged history and calendar coexistence |
| Root checks on main `8a35f321` | Types passed; 1,158 core, 24 sync, 17 web-storage and 57 tools tests passed |
| Full app suite on main `8a35f321` | 400 suites and 3,054 tests passed; the four previously reported notices failures did not reproduce |
| PC web app on main `8a35f321` | Types, all 128 tests and production build passed |
| Root checks on main `ed58be27` | Types passed; 1,178 core, 24 sync, 17 web-storage and 57 tools tests passed |
| Full app suite on main `ed58be27` | Types, all 406 suites and 3,083 tests passed; no notices failures |
| PC web app on main `ed58be27` | Types, all 129 tests and production build passed |
| Repository lint and formatting | Passed, including on main `ed58be27` |

A regression test first demonstrated that damaged history allowed a new edit. Requiring a complete authoring history fixed it; the same test now refuses the edit without another upload.

The branch rebased cleanly onto main `8543dbe2` after the server-only bulk-seeding update (#771), and then onto `ed58be27` after the seeded-world and dashboard work (#772–#780). Its lifecycle code needed no changes. The checks above distinguish the original and refreshed runs.

No native build, browser interaction or physical-device acceptance is claimed for this headless service. No screen, platform permission or native module changes. All new source and test files carry AGPL-3.0-or-later headers; this note follows the repository's document licence.

## Accounts (answer 767)

`apps/server/test/packs.test.ts` and `pack-store.test.ts` cover the accounts, the rules for each step and what the store keeps. `packages/core/test/pack-lifecycle-files.test.ts` covers a step refused for its role, status, content, world or CA. `apps/android/__tests__/pack-release-accounts.test.ts` and `pack-desk.test.tsx` cover the session and the page. PostgreSQL's store is tested only by CI. Nothing here has been checked in a browser against the deployed server, on a device or with a screen reader.

## A release reaching a teacher

A joined teacher's page of the world's plans (#617, answer 771) reads the stream with the world's keys. Each class and subject of the timetable in force keeps its pin: the one the world's class starts on, or the one it moved to. Publishing moves nothing. A course on an older release of the pack, or on none when its grade and subject fit, is offered the latest published release, with what changed and which account's step signed it. When the steps between don't fit, no move is offered, and it says why. A move is kept in the world's store, dated by the world, and leaves the teacher's own store untouched. Real mode refuses a world's signed file.

Plan-error reports (#616, answer 770) go sealed on their own stream of the national space, with no server endpoint and no account, and reach the curators' reports page with the item, release, kind, note and the credit the teacher chose.
