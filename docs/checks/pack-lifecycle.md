# Pack release lifecycle in a demo world

Verification of [#612](https://github.com/djazairdev/minhajna/issues/612), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01, refreshed on 2026-11-02 after rebasing. Every source, world and role used in the tests is made up.

## Agreed scope

The maintainer selected the existing encrypted demo-world flow rather than designing real publisher accounts for this issue. A national world's curator and Ministry roles can use the same headless lifecycle service. A Ministry demo publication carries Official status inside that world only. This is not authenticated state authority or completion of the PRD's eventual server-account requirement, R-4.3-09. Actual verified publisher accounts need their own design and maintainer decision.

The form (#613), review board and its human and automated checks (#614), migration work (#615), and teacher delivery (#617) remain separate. The service requires an under-review stage before publication, but does not claim that two reviewers or the later review checks have approved it. There is no new screen or user-facing text, so this change adds no unused translation keys or teacher release note.

## Contract

- Lifecycle stage is separate from source status. A release moves from draft to under review to published, then superseded or withdrawn. Editing a review returns it to draft. A curator cannot assign Official; the Ministry demo role can publish a curator's review as Official.
- A published source and its signed file are immutable. Withdrawal keeps them. Superseding requires a newer, already published release of the same pack and publishing role. Neither terminal stage can be reopened. Readers can follow the replacement chain to a publication still in force. A withdrawn replacement ends the chain without erasing its history. These operations never move a teacher's pinned release or rewrite a session.
- Revisions refuse stale edits, including an edit racing with another upload. An unrelated release can append first without losing the intended change. A write accepted but reported as a conflict is recognised on retry without another revision.
- Dates are calendar dates only, never clock times. The service checks the world's current date with the relay and refuses a missing, changed or malformed date; it never substitutes the device's date. History cannot move backwards or accept a future change.
- The service reuses the world's keys held in memory. It has no teacher store, history or settings input, and touches no teacher pin or real reference store. Real mode, teachers' worlds, unsupported roles and mismatched held keys are refused.

## Signed and sealed records

Every change is a world-signed `minhajna/pack-release/1` record. A publication also holds an ordinary version-1 pack-update payload, signed for that world. Its existing reader refuses it in real mode or another world. Replaying checks the signature, signing purpose, country, world, dates, exact revision chain and transitions; publication content must match its inner signed pack file.

The encrypted national space carries these records on a separately derived opaque stream, alongside the calendar's separate stream. No plaintext pack ID, source, role, stage or unsealed key reaches the relay. The relay still stores opaque batches; there is no new endpoint, dependency, permission or account table. `NETWORK.md` documents this additional caller of the existing flow. Encryption and relay writes make this a privacy-sensitive change.

A whole change fits one atomic upload of at most 128 fixed-size batches of 4,124 bytes. A draft or review must fit once it carries its signed publication, and oversized records fail before opening a space or uploading. This deliberately bounds demo sources rather than silently cutting off a pack. The codec reuses the existing signing and sealing primitives.

Authoring requires a complete stream. Damaged ciphertext, missing or unfinished batches, conflicting batch numbers, invalid signatures and broken revisions refuse another write rather than expose an earlier editable state. The read-only list can still show intact, verified releases when a batch is damaged. Authoring continues to require strict replay, including after an upload conflict.

## Checks

| Check | Result |
|---|---|
| Focused lifecycle tests | 10 core tests and 10 app tests passed, covering transitions, immutable publications, world isolation, dates, size limits, concurrency, damaged history and calendar coexistence |
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
