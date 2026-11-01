# Budget-pack release checks

Local verification for [#610](https://github.com/djazairdev/minhajna/issues/610), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01. All source plans, allocations and calendar entries used in tests are made up.

## Contract

`checkBudgetPack(pack, reference, scope)` checks a parsed budget or hybrid source pack against an explicitly supplied grid and plan horizon (R-4.3-13). The scope has `from`, `to`, an optional calendar zone, and a grid or `null`. A grid names its source, its usual session length and its weekly slots, session types and A/B pattern. It represents one class's reference allocation, not a teacher's workload. No official hours grid exists in the bundled reference data yet; the checker invents none.

| Result | Meaning |
|---|---|
| `not-applicable` | A week pack belongs to the separate week checker |
| `not-checked`, `missing-grid` | No grid was supplied; this is not a pass or a zero allocation |
| `checked` | Source-labelled counts for each checked period, with zero or more advisory findings |

The calendar/session engine runs on a new, empty sample course made solely from the source inputs. No teacher state, records, progress, decisions or private calendar are accepted. Only national and zone reference calendar layers are used, with the pack's level and grade. Holidays, individual and half-day closures, exams, make-up days, partial weeks and A/B resets therefore follow the same engine as the apps.

Counts use the engine's per-item conversion of hour budgets into sessions, including its rounding and default minimum. Main and TD allocations stay apart. Unit headings take no session; buffers and optional items retain their source budgets. The whole source pack must fit within the explicit horizon. Known term targets are also checked cumulatively before the first applicable exam, or the sourced term end when there is no exam window, as in `pacing.ts`. A TD item without its own term follows its unit's last lesson term. An exam that has already started leaves zero capacity before its deadline; no date is moved to make it fit.

An overrun returns `budget-overrun` with severity `advisory`, its queue, term or whole-horizon marker, dates, sessions needed and available, shortfall and the item IDs that extend past capacity. It remains a valid source pack: no import is rejected, no item changes, and no teacher is judged. Reporting the finding to the source issuer is a later editor action; this checker sends nothing. Invalid caller inputs (dates outside the reference year, unknown profile coordinates, an unsourced, conflicting or unsupported grid) throw `RangeError` rather than silently passing.

## Verification

The focused suites passed 28 cases: 19 new source-check cases plus the existing pacing tests. They cover the results above, source/profile validation, other working weeks, missing versus zero grid data, stale and hybrid packs, term deadlines, separate TD needs and unchanged inputs on repeated checks.

| Check | Result |
|---|---|
| Root and Android type checks | Passed |
| Repository lint and formatting | Passed |
| Root tests | 1,150 core, 24 sync, 17 web-storage and 57 tools tests passed |
| Android full Jest suite | 388 suites and 2,993 tests passed on main `06b989be`; the four previously reported notices failures did not reproduce |
| Android checks after rebase | Type check and all 18 tests in the four affected access/core suites passed on main `4b6c0c46` |
| PC web app | Type check, 128 tests and production build passed after rebase |
| File licences | REUSE 6.2.0 passed using its supported `chardet` detector |
| Patch checks | No whitespace errors; file lengths, comment placement and language rules passed |

All installs used the committed lockfiles in this worktree. The main checkout's Android dependency shortcut was left unchanged; the checks used an isolated install.

## Scope and integration

The work is isolated on `codex/610-budget-pack-checks`, branched directly from main `06b989be1be50f5d52ef9661410de6592a15b9e6` and rebased without conflicts onto `4b6c0c46a0021393b6dd4d47f2ae0723fb33d9e5` after #760. It is prepared ahead of #754's merge at the maintainer's request; that PR remains the preceding step in the epic. It includes none of #609's changes. The budget checker has its own module and is exported from the shared core, so the two PRs remain independently reviewable.

There is no change teachers can see yet, so no changelog or catalogue entry is needed. The later editor provides translated presentation in its own namespace. This change adds no dependency, stored data, file format, permission, network flow or workspace route. New comments are in file headers only; all changed files stay below 300 lines. No native build, manual layout, screen-reader or device acceptance is claimed for this reference-only API. Before publishing, refresh main, rebase and repeat checks affected by new upstream code.
