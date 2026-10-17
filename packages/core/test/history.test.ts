// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERASURE,
  HistoryLog,
  MemoryStore,
  RecordBook,
  canonicalJson,
  verifyHistory,
  type Day,
  type Entry,
  type HistoryStore,
  type Layer,
} from '../src/index.ts';
import { d } from './fixtures.ts';
import { deps } from './support.ts';

async function sampleLog(store: HistoryStore = new MemoryStore()): Promise<HistoryLog> {
  const log = await HistoryLog.open(store, deps);
  await log.append(d('2026-09-20'), 'lesson-record', 'session.recorded', { outcome: 'done', item: 'l1' });
  await log.append(d('2026-09-20'), 'pupil-records', 'roll-call.taken', { absent: ['p01'] });
  await log.append(d('2026-09-21'), 'private', 'session.noted', { note: 'made-up private note' });
  return log;
}

/**
 * An entry chained properly after `entries`, as a faulty restore could write
 * it, or someone who knows the format. Only the rules of an erasure can
 * catch it.
 */
async function forge(
  entries: readonly Entry[],
  layer: Layer,
  kind: string,
  body: unknown,
  id = 'f'.repeat(32),
): Promise<Entry> {
  const salt = '0'.repeat(32);
  const header = {
    id,
    seq: entries.length,
    day: d('2026-10-02'),
    layer,
    kind,
    digest: await deps.digest(`minhajna/content/1\n${salt}\n${canonicalJson(body)}`),
    previous: entries.at(-1)?.hash ?? '',
  };
  return { ...header, hash: await deps.digest(`minhajna/entry/1\n${canonicalJson(header)}`), content: { salt, body } };
}

describe('the history', () => {
  it('chains every entry to the one before it', async () => {
    const log = await sampleLog();
    const [first, second, third] = log.entries;
    assert.equal(first?.seq, 0);
    assert.equal(first?.previous, '');
    assert.equal(second?.previous, first?.hash);
    assert.equal(third?.previous, second?.hash);
    assert.deepEqual(await verifyHistory(deps.digest, log.entries), []);
  });

  // An app bridge can pass any text as the day, so the day is checked at run
  // time.
  it('keeps the day of a change, never its time', async () => {
    const log = await sampleLog();
    for (const entry of log.entries) {
      assert.deepEqual(Object.keys(entry).sort(), [
        'content',
        'day',
        'digest',
        'hash',
        'id',
        'kind',
        'layer',
        'previous',
        'seq',
      ]);
    }
    const clockTime = '2026-10-04T08:15:00Z' as Day;
    await assert.rejects(log.append(clockTime, 'lesson-record', 'teacher.set', {}), /YYYY-MM-DD/);
    await assert.rejects(log.erase('2026-10-04 08:15' as Day, [log.entries[1]?.id ?? '']), /YYYY-MM-DD/);
    assert.equal(log.entries.length, 3);
    assert.ok(log.entries[1]?.content);
  });

  it('shows an edit made without recomputing the chain', async () => {
    const entries = [...(await sampleLog()).entries];
    const second = entries[1] as Entry;
    entries[1] = { ...second, content: { salt: second.content?.salt ?? '', body: { absent: [] } } };
    assert.deepEqual(await verifyHistory(deps.digest, entries), [{ seq: 1, kind: 'content' }]);

    const moved = [...(await sampleLog()).entries];
    moved[0] = { ...(moved[0] as Entry), day: d('2026-09-19') };
    assert.deepEqual(await verifyHistory(deps.digest, moved), [{ seq: 0, kind: 'hash' }]);
  });

  it('shows an entry deleted without recomputing the chain', async () => {
    const entries = [...(await sampleLog()).entries];
    entries.splice(1, 1);
    const problems = await verifyHistory(deps.digest, entries);
    assert.deepEqual(problems, [
      { seq: 2, kind: 'sequence' },
      { seq: 2, kind: 'link' },
    ]);
  });

  // Swapping two entries' places in the history changes what their hashes
  // cover, so recomputing their sequence numbers does not hide it.
  it('shows entries reordered without recomputing the chain', async () => {
    const [first, second, third] = (await sampleLog()).entries as Entry[];
    assert.deepEqual(await verifyHistory(deps.digest, [first, third, second] as Entry[]), [
      { seq: 2, kind: 'sequence' },
      { seq: 2, kind: 'link' },
      { seq: 1, kind: 'sequence' },
      { seq: 1, kind: 'link' },
    ]);
    const swapped = [first, { ...third, seq: 1 }, { ...second, seq: 2 }] as Entry[];
    assert.deepEqual(await verifyHistory(deps.digest, swapped), [
      { seq: 1, kind: 'link' },
      { seq: 1, kind: 'hash' },
      { seq: 2, kind: 'link' },
      { seq: 2, kind: 'hash' },
    ]);
  });

  it('erases content for real, and the chain still verifies', async () => {
    const log = await sampleLog();
    const target = log.entries[1] as Entry;
    const erasure = await log.erase(d('2026-10-01'), [target.id]);
    assert.equal(erasure.kind, ERASURE);
    assert.equal(erasure.layer, 'pupil-records');
    assert.equal(log.entries[1]?.content, null);
    assert.doesNotMatch(JSON.stringify(log.entries), /p01/);
    assert.deepEqual(await verifyHistory(deps.digest, log.entries), []);
  });

  it('shows content removed without an erasure', async () => {
    const entries = [...(await sampleLog()).entries];
    entries[2] = { ...(entries[2] as Entry), content: null };
    assert.deepEqual(await verifyHistory(deps.digest, entries), [{ seq: 2, kind: 'missing-content' }]);
  });

  it('erases one layer at a time, and never an erasure', async () => {
    const log = await sampleLog();
    const [first, second] = log.entries;
    await assert.rejects(log.erase(d('2026-10-01'), [first?.id ?? '', second?.id ?? '']), /one layer/);
    const erasure = await log.erase(d('2026-10-01'), [second?.id ?? '']);
    await assert.rejects(log.erase(d('2026-10-02'), [erasure.id]), /cannot be erased/);
    await assert.rejects(log.append(d('2026-10-02'), 'private', ERASURE, { entries: [] }), /erase\(\)/);
  });

  it('finishes an erasure that was interrupted', async () => {
    let failOnce = true;
    const inner = new MemoryStore();
    const store: HistoryStore = {
      load: () => inner.load(),
      append: (entry) => inner.append(entry),
      eraseContent: async (ids) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('The battery ran out');
        }
        await inner.eraseContent(ids);
      },
    };
    const log = await HistoryLog.open(store, deps);
    const entry = await log.append(d('2026-09-20'), 'pupil-records', 'pupil.set', { name: 'made up' });
    await assert.rejects(log.erase(d('2026-10-01'), [entry.id]), /battery/);

    const reopened = await HistoryLog.open(store, deps);
    assert.equal(reopened.entries[0]?.content, null);
    assert.deepEqual(await verifyHistory(deps.digest, reopened.entries), []);
  });

  // An erasure names a list of entries, each of which exists, is in the
  // erasure's own layer, and comes before it. An erasure itself is never
  // erased. Each forged erasure below breaks one of these rules, in turn.
  it('checks every rule of an erasure', async () => {
    const log = await sampleLog();
    const entries = [...log.entries];
    const rollCall = entries[1] as Entry;
    const erasure = async (layer: Layer, body: unknown): Promise<Entry[]> => [
      ...entries,
      await forge(entries, layer, ERASURE, body),
    ];
    const refused = [{ seq: 3, kind: 'erasure' }];

    assert.deepEqual(
      await verifyHistory(deps.digest, await erasure('pupil-records', { entries: rollCall.id })),
      refused,
    );
    assert.deepEqual(
      await verifyHistory(deps.digest, await erasure('pupil-records', { entries: ['0'.repeat(32)] })),
      refused,
    );
    assert.deepEqual(await verifyHistory(deps.digest, await erasure('private', { entries: [rollCall.id] })), refused);
    const early = await forge(entries, 'pupil-records', ERASURE, { entries: ['e'.repeat(32)] });
    const later = await forge([...entries, early], 'pupil-records', 'roll-call.taken', { absent: [] }, 'e'.repeat(32));
    assert.deepEqual(await verifyHistory(deps.digest, [...entries, early, later]), refused);
    const real = await log.erase(d('2026-10-01'), [rollCall.id]);
    const again = await forge(log.entries, 'pupil-records', ERASURE, { entries: [real.id] });
    assert.deepEqual(await verifyHistory(deps.digest, [...log.entries, again]), [{ seq: 4, kind: 'erasure' }]);
  });

  // The forged entry is a properly chained erasure from the wrong layer,
  // naming the roll call. The error names the kind of problem only, never an
  // entry or a pupil.
  it('refuses to open a history that does not verify, and runs no erasure from it', async () => {
    const store = new MemoryStore();
    const log = await sampleLog(store);
    const rollCall = log.entries[1] as Entry;
    await store.append(await forge(log.entries, 'private', ERASURE, { entries: [rollCall.id] }));
    await assert.rejects(HistoryLog.open(store, deps), /^HistoryError: The history does not verify: erasure$/);
    const stored = await store.load();
    assert.deepEqual(stored[1]?.content?.body, { absent: ['p01'] });

    const book = await RecordBook.open(new MemoryStore(), deps);
    await book.record(d('2026-09-13'), { kind: 'teacher.set', card: { rank: 'Example rank' } });
    const [entry] = book.entries as Entry[];
    assert.ok(entry?.content);
    const edited = {
      ...entry,
      content: { ...entry.content, body: { kind: 'teacher.set', card: { rank: 'Edited' } } },
    };
    const tampered: HistoryStore = {
      load: () => Promise.resolve([edited]),
      append: () => Promise.resolve(),
      eraseContent: () => Promise.resolve(),
    };
    await assert.rejects(RecordBook.open(tampered, deps), /^HistoryError: The history does not verify: content$/);
  });
});
