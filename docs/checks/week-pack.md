# Week-pack release checks

Local implementation and verification of [#609](https://github.com/djazairdev/minhajna/issues/609), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01. This is the prerequisite for #610. All fixtures are made up.

## Contract

`checkWeekPack(pack, weeks)` checks a parsed source pack before release (R-4.3-12). `weeks` is the positive, safe, whole number of plan weeks declared by the source, independent of holidays or a class's progress. The caller supplies it explicitly: taking the largest item week would conceal a missing final week. Nothing is added to the pack format.

The function returns findings, never edited items or translated interface strings:

| Finding | Source detail |
|---|---|
| `missing-weeks` | First missing week and inclusive `through`; adjacent gaps form one range, with no invented item IDs |
| `outside-horizon` | Week and item IDs beyond the declared horizon |
| `missing-model` | Pack-level finding (`week: null`) and main item IDs when no weekly model was supplied |
| `missing-activity` | Week and item IDs with no activity code; no activity is guessed |
| `activity-sessions` | Week, activity code, expected and actual sessions, and contributing item IDs; an absent activity has no item IDs |

Each present week must match every activity's session count exactly. The count uses the engine's per-item rounding and default budget. Unit headings and the separate TD queue are excluded; optional and buffer items in the main queue still take their declared sessions. Findings are ordered by week and model order, with a missing-model finding first. Existing items retain their order within each finding. Consecutive missing weeks are checked as ranges, without looping over every absent week.

Budget and hybrid anchors have no findings in this checker. An invalid horizon throws `RangeError` rather than silently passing a check. The function reads no records or class progress and makes no network call. Parsing and importing earlier packs remain unchanged: a missing model is a release finding, not a new file-import restriction.

## Verification

The focused suites passed all 25 cases: 14 new release-check cases alongside the existing pack and weekly-proposal tests. They cover leading, internal and trailing gaps, a very large horizon, out-of-horizon items, missing and surplus activity sessions, several items per activity, rounding and defaults, missing classifications and models, TD and unit exclusion, optional/buffer items, other anchors, stable ordering, unchanged source data and invalid horizons.

All checks below were repeated after the rebase, with Node 22.23.2:

| Check | Result |
|---|---|
| Locked root, Android, web and server/tool installs | Passed; no dependency or lockfile changes |
| Root and Android type checks | Passed |
| Full lint and formatting | Passed |
| Root tests | 1,136 core, 24 sync, 17 web-storage and 57 tool tests passed |
| Full app Jest suite | All 379 suites and 2,951 tests passed |
| PC type check, tests and production build | Passed; all 128 tests passed |
| REUSE 6.2.0 | All 2,911 files covered, with no missing licences |
| Whitespace, file length, header-only comments and Arabic placement | Passed |

The reported four notices-test failures did not reproduce with this worktree's fresh locked Android install; no notices or dependencies were changed. The installs and server type generation stayed in this worktree. The Android install was made here separately from main's tracked dependency shortcut, then retained in the temporary check folder and that original shortcut restored unchanged after testing. No database or server was started. REUSE used its supported `chardet` detector. Logs are in `/tmp/minhajna-609-checks` while that temporary folder remains available.

## Scope

There is no change teachers can see yet, so no changelog or catalogue entry is needed. The editor's translated presentation belongs to the later #531 screens. This change adds no dependency, stored field, permission or data flow, and touches neither the workspace router nor the existing catalogues. No app layout, native behaviour or device accessibility acceptance is claimed.

The work is isolated on `codex/609-week-pack-checks`, branched from main `7bdce06560bf08b3ff0955b8a0abbdb1183fc0f3`, then rebased cleanly onto `b7c653c3c81f71f05986ba429022115cb1048b31` after #752 merged. All changed files stay below 300 lines, new code comments are confined to file headers, and no Arabic is added outside tests or catalogues. Before opening a PR, refresh main, rebase and repeat any checks the rebase affects.
