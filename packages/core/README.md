# The shared core

The core holds the rules that both apps run: the records and their history, the record layers, the calendar, the lesson engine and roll call ([PRD §5.2](../../docs/prd/PRD.md#52-architecture)). It has no platform code. Each app passes in its own storage, hashing and source of random bytes, so the Android app and the web app give the same results.

It is the first part of the field-check prototype: setup, Today and roll call ([PRD §10.1](../../docs/prd/PRD.md#101-the-roadmap)).

## What is here

| Module | What it does | PRD |
|---|---|---|
| `day.ts` | Calendar days, without clock times | §5.5 |
| `history.ts` | The history: only ever added to, with real deletion. It is chained, so an edit, a deletion or a reordering made without recomputing the chain shows, and a history that does not verify is never opened | §5.5 |
| `layers.ts` | The record layers, and the routes each layer may travel. Only the teacher's own routes take history entries | §5.4 |
| `state.ts` | The events the teacher records, each in one layer, and the state built from them. Routes that leave the teacher take the current version of each record, never the day it was made. Erasure takes whole records | §5.3, §5.4, §7.6 |
| `reference.ts`, `pack.ts` | Reference data: the country profile, the school year, the calendar and plan packs, which are checked when read | §4.2, §4.5, §5.9 |
| `calendar.ts`, `sessions.ts` | Teaching weeks, A/B weeks, and each class's dated sessions. A later timetable applies from the day it was recorded, and the teacher's own calendar marks only the teacher's sessions | §4.5, §4.6 |
| `engine.ts` | Proposals, progress by stages, each stage kept on its own, and the six session outcomes | §3.3, §4.7 |
| `today.ts` | The Today screen, and confirming a whole day or week at once | §3.3 |
| `pacing.ts` | Delay in sessions, sessions lost to the calendar, buffers and the September check. Sessions lost to the teacher's own calendar are counted apart, for the teacher alone | §4.7 |
| `roll-call.ts` | Roll call by half-day or by session, corrections, and the totals for each pupil. Every roll call taken counts, and those the rest of the record leaves out are listed for the teacher | §3.4 |

## Running the tests

The core needs Node.js 22.18 or later, which runs TypeScript directly. It has no runtime dependencies. TypeScript itself is a development dependency of the repository, for the type check only.

```bash
npm test
```

```bash
npm run typecheck
```

The type check covers both `src/` and `test/`, using Node.js's type definitions for the tests.

The test data is made up ([engineering rules](../../docs/contributing/engineering.md#test-data)). The two plan packs in the tests are invented, with the status `example`, and are never published as reference data. Only `data.test.ts` reads real files: Algeria's reference data in [`data/`](../../data/README.md), which it runs made-up classes against.

### Shared hashing checks

[`test/sha256-vectors.json`](test/sha256-vectors.json) is a portable list for every platform's SHA-256 implementation. Each case gives a `name`, the exact `text`, its `utf8Bytes` length and its lowercase hexadecimal `sha256`. Read the JSON, encode each text as UTF-8 without normalising it or adding a byte-order mark, then compare the byte count and digest. Node's crypto and Web Crypto both run every case here; Android's native tests and future web tests can consume the same file without importing the Node test runner.

The cases cover empty text, Arabic, French, emoji, control characters, 55-, 56- and 64-byte inputs, multiple blocks, and literal Unicode escapes. Inputs are well-formed strings: raw lone UTF-16 surrogates do not belong in this hashing interface. `canonicalJson` escapes those units in both keys and values before the history calls a platform digest. Its regression tests simulate older JSON behaviour, preserve valid surrogate pairs, and check fixed pre-change history hashes.

### Shared storage checks

`@minhajna/core/test-support` exports `historyStoreTests(register, createFixture, deps)` for [#76](https://github.com/djazairdev/minhajna/issues/76). It registers the same eight checks with Node's `it`, Jest's `test`, or another Node-based runner that awaits each callback. Hashing and randomness come from the caller's `HistoryDeps`. This separate entry imports Node's assertions; the normal `@minhajna/core` entry and the app bundle do not.

For example, from the core's tests:

```ts
import { describe, it } from 'node:test';
import { MemoryStore } from '@minhajna/core';
import { historyStoreTests } from '@minhajna/core/test-support';
import { deps } from './support.ts';

describe('MemoryStore contract', () => {
  historyStoreTests(it, () => {
    const store = new MemoryStore();
    return { store, readCommitted: () => store.load() };
  }, deps);
});
```

Each callback gets a **fresh, empty fixture**. Its factory may be asynchronous. A fixture supplies `store`, `readCommitted()`, and optionally `dispose()`; after the factory returns, disposal is awaited on success or failure. A factory that fails during setup must clean up its own partial setup. Persistent adapters must use an isolated synthetic database, and disposal must close its handles and remove only that fixture's test data.

`readCommitted()` must read the backing data through an independent reader, not the writer's cache, and must not flush or wait for pending writes. MemoryStore's backing data is its memory, so it can use `load()`. This probe lets the suite detect an append or erasure that acknowledges success while committed data is still missing or unchanged. It is not proof of crash, power-loss or physical erasure safety; those remain platform checks under [#19](https://github.com/djazairdev/minhajna/issues/19).

The checks cover empty loads, append order and exact entry fields (including same-day/backdated changes and Unicode), committed writes, targeted content erasure with headers intact, harmless empty/repeated erasures, reopening, concurrent calls through `HistoryLog`, and a verifiable history after erasure. The former MemoryStore-only reopen/concurrent tests now run through this suite; the existing history-integrity tests remain in `history.test.ts`.

`memory-store.test.ts` runs it with Node. Android's `history-store.test.ts` runs the actual JavaScript adapter with Jest and synthetic native rows; it does **not** certify SQLCipher, the Keystore or device crash recovery. The suite's own tests reject deliberately faulty stores and verify delayed writes and fixture cleanup. No new dependency, runtime behaviour, record format or network call is introduced, and there is no change teachers can see.

## Not here yet

- Marks, appreciations and the term export.
- The documents, and the files Minhajna reads and writes, such as the class list and the Minhajna archive.
- Encryption of the stored records, sync, backup and signing. Until entries are signed with the teacher's key, a full rewrite of the history that recomputes every hash goes unseen ([PRD §5.5](../../docs/prd/PRD.md#55-history-corrections-and-signatures)).
- Insights ([PRD §1.6](../../docs/prd/PRD.md#16-anonymous-insights-rules-for-openness)) and totals above the school ([PRD §5.10](../../docs/prd/PRD.md#510-the-permission-model)). They will carry only figures formed later from the records, never history entries or records, so they are not routes here.
- Multigrade classes, sessions outside the timetable, the teacher's own changes to a plan, and moving a class to a new pack release.
