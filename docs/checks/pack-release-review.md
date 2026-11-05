# Pack release review checks

The automated results E-Release reads ([#614](https://github.com/djazairdev/minhajna/issues/614), R-4.3-11, R-4.3-16), from `checkPackReleaseReview(draft, history, weekHorizon)`. All packs in the tests are made up. Reviewer consent, the screen, budget capacity and publication stay in #614, so a clean result here is no all-clear.

## Contract

Each check is `not-checked` with its reason, or `checked` with findings that name their items, as `checkWeekPack` and `checkBudgetPack` do.

| Check        | Not checked when                                                                                           | Findings                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `source`     | The draft doesn't parse                                                                                    | `missing-source-page`, `invalid-source-page`               |
| `comparison` | The draft doesn't parse, or the history is unavailable (`null`)                                            | `invalid-migration`, with its `problem`, `release` and IDs |
| `weeks`      | The draft doesn't parse, or the horizon is missing or invalid. A budget or hybrid pack is `not-applicable` | The week checker's own                                     |

History holds every published release of the pack, superseded or withdrawn too, never the draft itself. An empty history is a known first release, which reads as `checked` with `previous: null` and no findings. The check can only see what the history holds: a draft `2026.3` on an empty history, or an oldest release that names no earlier one, reads as clean with any release before it unseen.

`invalid-migration` reports:

- `not-newer`: the draft isn't after every release the history holds.
- `missing`: a release is absent. That's one the draft's migration or a release in the history names, which the history lacks, or a number skipped within a year. A new year can start at any number. A skipped number is reported with the rest and doesn't stop the comparison, as a published gap can't be repaired.
- `broken`: an entry doesn't fit the release it starts from, a removed ID has no entry, a step skips a known release, or an ID an earlier release held comes back. The finding can name a published release as well as the draft.

Every problem but a skipped number stops the comparison: `previous` is null and the lists are empty.

A clean comparison gives the release before, its migration entries, the teachers' summary (`changes`), and `details`: every other field a kept item or the pack changed, as well as the items' order, which the summary leaves out.

## The review screen

E-Release reads these checks, plus `extractionArtefacts` and `checkBudgetPack`, in `apps/android/src/editor/release-checks.ts` (answer 768). A check that fails or can't run holds the release back, with two exceptions: a budget check, whose overrun R-4.3-13 reports to the IGP, and a number skipped within a year. The page asks for what the bundled data doesn't hold: a week pack's horizon, and a budget pack's grid figures and their source.

Publishing also needs the two-person review in `packages/core/src/pack-review.ts`: a curator and a subject maintainer, different people, each with their latest word an approval. The core refuses to publish without it, and a reader refuses a replayed publication that lacks it. An inspector's review never counts, and their name is kept only by choice (R-4.3-08). Saving the draft again clears the reviews.
