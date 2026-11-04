# Budget-pack release checks

The contract and checks of [#610](https://github.com/djazairdev/minhajna/issues/610), part of [#531](https://github.com/djazairdev/minhajna/issues/531). All source plans, allocations and calendar entries used in tests are made up.

## Contract

`checkBudgetPack(pack, reference, scope)` checks a parsed budget or hybrid source pack against an explicitly supplied grid and plan horizon (R-4.3-13). The scope has `from`, `to`, an optional calendar zone, and a grid or `null`. A grid names its source, its usual session length and its weekly slots, session types and A/B pattern. It represents one class's reference allocation, not a teacher's workload. No official hours grid exists in the bundled reference data yet; the checker invents none.

| Result | Meaning |
|---|---|
| `not-applicable` | A week pack belongs to the separate week checker |
| `not-checked`, `missing-grid` | No grid was supplied; this is not a pass or a zero allocation |
| `checked` | Source-labelled counts for each checked period, a hybrid pack's skipped week targets, and zero or more advisory findings |

The calendar/session engine runs on a new, empty sample course made solely from the source inputs. No teacher state, records, progress, decisions or private calendar are accepted. Only national and zone reference calendar layers are used, with the pack's level and grade. Holidays, individual and half-day closures, exams, make-up days, partial weeks and A/B resets therefore follow the same engine as the apps.

Counts use the engine's per-item conversion of hour budgets into sessions, including its rounding and default minimum. Main and TD allocations stay apart. Unit headings take no session; buffers and optional items retain their source budgets. The whole source pack must fit within the explicit horizon. A hybrid pack's week target reads as the plan's does (answer 390): the last main item marked with the week, a checkpoint on the items up to it, buffers aside. A TD item's week and a unit heading's week set no target, and a week period's TD reads 0 needs, as it isn't checked there. A target outside the horizon or the calendar is listed in `skippedTargets` with its item. Known term targets are also checked cumulatively before the first applicable exam, or the sourced term end when there is no exam window, as in `pacing.ts`. A TD item without its own term follows its unit's last lesson term. A term deadline that precedes the scope is skipped. A hybrid checkpoint compares cumulative budgets through its target item against the sessions available by the end of its reference teaching week.

An overrun returns `budget-overrun` with severity `advisory`, its queue, term, week or whole-horizon marker, dates, sessions needed and available, shortfall and the item IDs that extend past capacity. It remains a valid source pack: no import is rejected, no item changes, and no teacher is judged. Reporting the finding to the source issuer is a later editor action; this checker sends nothing. Invalid caller inputs (dates outside the reference year, unknown profile coordinates, an unsourced, conflicting or unsupported grid) throw `RangeError` rather than silently passing.

## Verification

The tests cover the results above, source and profile validation, other working weeks, missing versus zero grid data, stale and hybrid packs, a hybrid pack's week checkpoints and skipped targets, term deadlines, separate TD needs and unchanged inputs on repeated checks.

There is no change teachers can see yet, so no changelog or catalogue entry is needed. The later editor provides translated presentation in its own namespace. This change adds no dependency, stored data, file format, permission, network flow or workspace route. No native build, manual layout, screen-reader or device acceptance is claimed for this reference-only API.
