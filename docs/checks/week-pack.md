# Week-pack release checks

Local implementation and verification of [#609](https://github.com/djazairdev/minhajna/issues/609), part of [#531](https://github.com/djazairdev/minhajna/issues/531), on 2026-11-01. This is the prerequisite for #610. All fixtures are made up.

## Contract

`checkWeekPack(pack, weeks)` checks a parsed source pack before release (R-4.3-12). `weeks` is the positive, safe, whole number of plan weeks declared by the source, independent of holidays or a class's progress. The caller supplies it explicitly: taking the largest item week would conceal a missing final week. Nothing is added to the pack format.

The function returns a checked result with findings, or a not-applicable result for other anchors. The findings contain source details:

| Finding | Source detail |
|---|---|
| `missing-weeks` | First missing week and inclusive `through`; adjacent gaps form one range, with no invented item IDs |
| `outside-horizon` | Week and item IDs beyond the declared horizon |
| `invalid-week` | Main item IDs with missing or invalid weeks in an in-memory pack |
| `activity-sessions` | Week, activity code, expected and actual sessions, and contributing item IDs; an absent activity has no item IDs |

A supplied weekly model applies to regular teaching weeks. An unclassified item can fill an untyped slot, so it does not count towards a named activity. A week holding only buffer, diagnostic, term assessment, or assessment and remediation items counts toward the horizon without being checked against the model. In a regular week an activity counts its tagged items as the engine schedules them, whatever their kind, and a tagged buffer may fill a slot or sit spare beside a full one, never counting as too many. A primary half-week of integration, assessment and remediation is keyed by marking those items as buffers and giving each the activity of the slot it fills. A pack without a weekly model still receives the horizon checks. Unit headings and the separate TD queue are excluded.

Each finding carries a kind and the affected item IDs, like the budget checker. The week checker also includes the affected week or range. Budget and hybrid anchors use separate capacity checks. An invalid horizon throws `RangeError`. The check reads no teacher records and makes no network call.

## Verification

Tests cover the bundled primary Arabic example, packs with and without a model, invalid in-memory weeks, leading and trailing gaps, activity counts and untyped slots, buffer, diagnostic and assessment weeks, buffers filling a slot or sitting spare in a regular week, assessments counted in one, and the separate TD queue.

## Scope

There is no change teachers can see yet, so no changelog or catalogue entry is needed. The editor's translated presentation belongs to the later #531 screens. This change adds no dependency, stored field, permission or data flow, and touches neither the workspace router nor the existing catalogues. No app layout, native behaviour or device accessibility acceptance is claimed.
