# Pack release

Checks of 25 October 2026 for [#322](https://github.com/djazairdev/minhajna/issues/322), part 4, after [#466](https://github.com/djazairdev/minhajna/pull/466) (part 1), [#467](https://github.com/djazairdev/minhajna/pull/467) (part 2) and [#468](https://github.com/djazairdev/minhajna/pull/468) (part 3), from the pull request that adds this record. Made-up classes, layers and packs only.

## What changed

- **The row** (R-4.2-12, [Plan](../design/screens/Plan.png)): when a newer release of the class's pack is in the app, bundled or added from a signed file, the badge on the class's plan becomes a row. It names the release, its number of fixes and that the class stays on its own release until it is moved. «مخطط كل قسم» in Settings has the same row. An archived class has no row.
- **«إصدار جديد للمخطط»** ([Pack-release](../design/screens/Pack-release.png)), opened by the row:
  - The plan and its newer release, the number of fixes since the class's release, and who signed it: «يأتي مع التطبيق» for a bundled release, or the key holder and the key's fingerprint for one added from a signed file.
  - «ما تغيّر», one line per change: a page, a new title (with the note that no class loses its place), a split, a merge, a new item or a removed one.
  - The classes on an older release of the pack this year, as chips, each moved on its own.
  - The effect of the move on the class's buffer before the exams, with the answers given so far.
- **Questions before the move** (R-4.2-18, answers 487 and 488):
  - Each change of the class's own, or of a layer it follows, that a split or merged item makes unclear is asked once. The choices are the items it can go to, or «عدم نقله». The app never guesses.
  - A choice that no longer fits after the answers before it is disabled. Changing an answer clears the ones after it.
  - The move button reads «الجواب أولاً» until every question is answered.
  - The answers are recorded as the class's own changes on the newer release's IDs, after `course.moved`.
- **What is not carried**, and **the layers on the plan**: changes on an item the newer release removes are listed. The class's own changes and each layer it follows say whether they are carried as they are, through the release's entries, or asked about, with the rule under them.
- **Staying** records nothing and goes back to the plan. After a move, the page says the class moved and offers «رجوع إلى المخطط».
- **Reading records on the release they were made on:** the texts book, the journal, the primary cells, the book's pages, the fixes, Today's written lines and the export of all files read each session on the pack it was recorded on (`recordPack`), so nothing recorded changes after a move. Today's previous item, the lesson's taught days, a correction's recorded stage and a lesson note's draft follow the migration's IDs.
- **Data:** the bundled packs are named `<id>@<release>.json`. The example Arabic plan for 4AM gets a release 2026.2 with a page, a rename and a split, so the move can be tried. The signing tool compares a new release with the newest bundled one.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `release-changes.test.ts` (3): the changes through three releases, a part merged with another item, and how each list is carried with the class moved. `record-pack.test.ts` (1): a record read on its own release, with newer items kept. `lesson-notes.test.ts`: a note's draft for an item taught before the move. `release-move.test.ts`: changes taken back not counted. `data.test.ts`: every bundled release names its file and follows a chain of migrations. `signing-tools.test.ts`: a release not after the newest bundled one is refused |
| Android tests | `pack-release.test.tsx` (7): the page in Arabic, French and English with no missing text and no accessibility problem; a class without changes moved at once and back to its plan; questions from a split, an answer cleared when an earlier one changes, the answer recorded; a layer's change asked and each list's line; staying records nothing; no class on an older release; a choice that does not fit disabled. `pack-import.test.tsx`: the row on the plan and in Settings opens the newest release. `plan-retired-lines.test.ts`: correcting a session recorded before the move keeps its stage |
| Emulator | Release arm64 APK on Android 15 (API 35), upgraded from a build of `main`. The demo class's Arabic course was pinned to 2026.1 before the upgrade. After it, «مخطط كل قسم» and the plan showed «الإصدار 2026.2 متوفر · 3 تصحيحات · يبقى القسم على 2026.1 حتى يُنقل». The page listed the page, title and split changes, with «يأتي مع التطبيق». Giving u1-5 two sessions raised one question, with u1-5a, u1-5b and «عدم نقله», and «الجواب أولاً» stayed disabled until it was answered. Choosing u1-5b updated the effect line, and the move pinned the class to 2026.2, with u1-5b at two sessions and no row left. No error in the log |
| Type check, ESLint, Prettier | Pass |
| Languages | Every new text in Arabic, French and English, with the same placeholders |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the row reads its title then the release and fixes. Each question reads as one item, then each choice with its release. A disabled choice says so.
- **On a phone:** the page right to left and left to right, with text at 200%, on Android 8 at 360×800. Also a release added from a signed file, with its signer and fingerprint shown.
