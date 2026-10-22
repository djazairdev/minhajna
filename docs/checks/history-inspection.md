# Read-only history inspection

Checks of 22 October 2026 for the core slice of [#235](https://github.com/djazairdev/minhajna/issues/235), requirement R-5.5-04 and PRD §5.5, prepared with OpenAI Codex in [#394](https://github.com/djazairdev/minhajna/pull/394). Made-up data only.

## What changed

- **`inspectHistory(digest, loadedRows)`** returns a frozen, read-only view of loaded rows. It takes rows, not a writable store, and never appends, erases, sorts, repairs or rebuilds the record book.
  - Each row keeps its position, unreadable rows included. Each row is copied before it is checked, then the copy is checked: its envelope, day, sequence, link, header hash, content digest and identity. Unknown envelope fields are dropped.
  - A row is consistent only while every row before it is. A later matching hash does not restore trust after a break.
  - Past the consistent prefix, a row shows its header, marked unverified, but never its body or salt. An unreadable row shows neither.
  - An erasure counts only when its targets are unique, earlier, in the same layer and not erasures themselves. Missing content is justified only by an erasure inside the consistent prefix; otherwise the prefix ends earlier. A body removed by an erasure past the prefix is marked `unverified-erasure`, so a later screen can tell it from content gone with no erasure at all (`missing-content`).
  - A valid erasure not yet carried out is masked in the view only; the inspection never completes it.
  - A digest that fails, or an unreadable container, gives a fixed message with no payload or exception detail, and is never presented as tampering.
- **The version-1 hash texts** move to `history-text.ts`, byte for byte, shared by the writer and the inspection. The stored format and the normal open are unchanged.
- **Trust limits:** an intact result means the loaded chain is self-consistent, not that it is authentic or complete. An unsigned chain cannot show a full rewrite with recomputed hashes, or a valid tail removed, without an independent trusted anchor; this slice adds no key, checkpoint or format. The Log-broken board shows trusted data after a damaged stretch; the core makes no such claim and withholds every later body. Even a shown body is an unknown payload, not a checked RecordEvent: the log screen must summarise known kinds, never show raw payloads or replay rows.

No app route, permission, layer, format or dependency changes, and nothing teachers can see yet, so CHANGELOG.md is unchanged. PRIVACY.md and NETWORK.md are unchanged.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `history-inspection.test.ts` and `history-inspection-erasure.test.ts`: intact and empty histories, changed bodies and headers, missing and reordered rows, bad days and JSON values, duplicate identities, a getter that changes between reads, frozen results, digest failures, valid, invalid and unfinished erasures, an erasure past a break, erasure dependencies moving the prefix back, the unsigned rewrite and tail-removal limits, and the unchanged writable open |
| Android tests | The history suites pass unchanged |
| Type check, ESLint, Prettier, REUSE | Pass |

## Still to do

In [#235](https://github.com/djazairdev/minhajna/issues/235):
- the activity log: its selector, summaries in each language, filters and the missing audit events;
- handling a damaged history at start-up, and the read-only Log-broken screen, with a safe path when native storage cannot read a row;
- recovery actions, once [#247](https://github.com/djazairdev/minhajna/issues/247) brings backup and restore;
- how long records are kept, and erasure offers; erasing a pupil or a device belongs to [#248](https://github.com/djazairdev/minhajna/issues/248).

By a person, once the screens exist: Android 8 on a budget phone, right-to-left and left-to-right at 200% text, and TalkBack in Arabic.
