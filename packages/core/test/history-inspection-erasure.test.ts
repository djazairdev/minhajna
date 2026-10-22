// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERASURE, HistoryLog, inspectHistory, type Entry, type HistoryStore } from '../src/index.ts';
import { d } from './fixtures.ts';
import { inspectionEntry, inspectionSample } from './history-inspection-fixtures.ts';
import { deps } from './support.ts';

test('legitimate erasure leaves the chain inspectable without recovering the deleted body or salt', async () => {
  const { log } = await inspectionSample();
  await log.erase(d('2026-10-22'), [log.entries[1]!.id]);
  const result = await inspectHistory(deps.digest, log.entries);
  assert.equal(result.integrity, 'intact');
  assert.equal(result.consistentPrefixLength, 4);
  assert.equal(result.rows[1]!.entry!.content, null);
  assert.equal(result.rows[1]!.contentStatus, 'erased');
  assert.doesNotMatch(JSON.stringify(result), /private synthetic note/);
});

test('a pending valid erasure is masked in the view but is never physically completed by inspection', async () => {
  const { entries } = await inspectionSample();
  const erasure = await inspectionEntry(entries, {
    kind: ERASURE,
    layer: 'private',
    body: { entries: [entries[1]!.id] },
  });
  const stored = [...entries, erasure];
  const calls: string[] = [];
  const store: HistoryStore = {
    load: () => Promise.resolve(stored),
    append: () => {
      calls.push('append');
      return Promise.resolve();
    },
    eraseContent: () => {
      calls.push('erase');
      return Promise.resolve();
    },
  };
  const result = await inspectHistory(deps.digest, await store.load());
  assert.equal(result.integrity, 'intact');
  assert.equal(result.rows[1]!.entry!.content, null);
  assert.equal(result.rows[1]!.contentStatus, 'erased');
  assert.deepEqual(stored[1]!.content!.body, { value: 'private synthetic note' });
  assert.doesNotMatch(JSON.stringify(result), /private synthetic note/);
  assert.deepEqual(calls, []);
});

test('a wrong-layer erasure is flagged and never affects the stored or readable original', async () => {
  const { entries } = await inspectionSample();
  const erasure = await inspectionEntry(entries, {
    kind: ERASURE,
    layer: 'lesson-record',
    body: { entries: [entries[1]!.id] },
  });
  const result = await inspectHistory(deps.digest, [...entries, erasure]);
  assert.equal(result.integrity, 'broken');
  assert.equal(result.consistentPrefixLength, 3);
  assert.ok(result.rows[3]!.problems.includes('erasure'));
  assert.equal(result.rows[1]!.contentStatus, 'available');
  assert.deepEqual(result.rows[1]!.entry!.content!.body, { value: 'private synthetic note' });
});

test('erasure references need unique, earlier, non-erasure targets in their own layer', async () => {
  const { entries } = await inspectionSample();
  for (const body of [
    { entries: ['missing'] },
    { entries: [3] },
    { entries: ['f'.repeat(32)] },
    { entries: [entries[1]!.id] },
    { entries: 'not-an-array' },
    null,
  ]) {
    const erased = await inspectionEntry(entries, { kind: ERASURE, body });
    const result = await inspectHistory(deps.digest, [...entries, erased]);
    assert.ok(result.rows[3]!.problems.includes('erasure'));
  }
  const first = await inspectionEntry(entries, { kind: ERASURE, body: { entries: [entries[0]!.id] } });
  const next = await inspectionEntry([...entries, first], {
    id: 'e'.repeat(32),
    kind: ERASURE,
    body: { entries: [first.id] },
  });
  assert.ok((await inspectHistory(deps.digest, [...entries, first, next])).rows[4]!.problems.includes('erasure'));
});

test('an erasure after a broken link cannot justify missing earlier content', async () => {
  const { log } = await inspectionSample();
  await log.erase(d('2026-10-22'), [log.entries[1]!.id]);
  const entries = [...log.entries];
  entries[2] = { ...entries[2]!, content: { ...entries[2]!.content!, body: { value: 'changed' } } };
  const result = await inspectHistory(deps.digest, entries);
  assert.equal(result.consistentPrefixLength, 1);
  assert.ok(result.rows[1]!.problems.includes('missing-content'));
  assert.equal(result.rows[1]!.contentStatus, 'withheld');
});

test('missing-content dependencies move the safe boundary backwards until every earlier erasure is justified', async () => {
  const { log } = await inspectionSample();
  await log.erase(d('2026-10-22'), [log.entries[0]!.id]);
  await log.erase(d('2026-10-22'), [log.entries[1]!.id]);
  const entries = [...log.entries];
  entries[4] = { ...entries[4]!, day: d('2026-10-21') };
  const result = await inspectHistory(deps.digest, entries);
  assert.equal(result.consistentPrefixLength, 0);
  assert.ok(result.rows[0]!.problems.includes('missing-content'));
  assert.ok(result.rows[1]!.problems.includes('missing-content'));
  assert.ok(result.rows.every((row) => row.entry?.content === null));
});

test('removing an erasure reveals unexplained missing content rather than an intact prefix', async () => {
  const { log } = await inspectionSample();
  await log.erase(d('2026-10-22'), [log.entries[1]!.id]);
  const result = await inspectHistory(deps.digest, log.entries.slice(0, 3));
  assert.equal(result.integrity, 'broken');
  assert.equal(result.consistentPrefixLength, 1);
});

test('inspection does not weaken the writable-open gate or replay an untrusted erasure', async () => {
  const { entries } = await inspectionSample();
  const erased = await inspectionEntry(entries, {
    kind: ERASURE,
    body: { entries: [entries[1]!.id] },
  });
  const writes: unknown[] = [];
  const store: HistoryStore = {
    load: () => Promise.resolve([...entries, erased]),
    append: (entry: Entry) => {
      writes.push(entry);
      return Promise.resolve();
    },
    eraseContent: (ids) => {
      writes.push(ids);
      return Promise.resolve();
    },
  };
  await inspectHistory(deps.digest, await store.load());
  await assert.rejects(HistoryLog.open(store, deps), /history does not verify/);
  assert.deepEqual(writes, []);
});

test('an unsigned tail truncation needs an independent anchor and is not claimed detected here', async () => {
  const { entries } = await inspectionSample();
  const result = await inspectHistory(deps.digest, entries.slice(0, 2));
  assert.equal(result.integrity, 'intact');
  assert.equal(result.consistentPrefixLength, 2);
  assert.equal('complete' in result, false);
});
