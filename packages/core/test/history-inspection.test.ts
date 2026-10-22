// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectHistory, type Entry } from '../src/index.ts';
import { inspectionEntry, inspectionSample } from './history-inspection-fixtures.ts';
import { deps } from './support.ts';

test('inspection returns an immutable, read-only snapshot of an intact chain', async () => {
  const { entries, store } = await inspectionSample();
  const before = JSON.stringify(await store.load());
  const result = await inspectHistory(deps.digest, entries);
  assert.equal(result.readOnly, true);
  assert.equal(result.integrity, 'intact');
  assert.equal(result.consistentPrefixLength, 3);
  assert.deepEqual(
    result.rows.map((row) => row.status),
    ['consistent', 'consistent', 'consistent'],
  );
  assert.deepEqual(
    result.rows.map((row) => row.entry),
    entries,
  );
  assert.equal(JSON.stringify(await store.load()), before);
  assert.equal('append' in result, false);
  assert.equal('erase' in result, false);
  assert.throws(() => Object.assign(result.rows[0]!.entry!, { day: 'edited' }), TypeError);
  assert.throws(() => Object.assign(result.rows[0]!.entry!.content!.body!, { value: 'edited' }), TypeError);
});

test('an empty chain is intact; an invalid container is refused rather than treated as empty', async () => {
  const empty = await inspectHistory(deps.digest, []);
  assert.equal(empty.integrity, 'intact');
  assert.deepEqual(empty.rows, []);
  await assert.rejects(inspectHistory(deps.digest, null), /^TypeError: A history must be an array$/);
});

test('a changed body withholds that content and every suffix body, even when later hashes still match', async () => {
  const { entries } = await inspectionSample();
  const second = entries[1]!;
  const changed = [...entries];
  changed[1] = { ...second, content: { ...second.content!, body: { value: 'MUST_NOT_DISPLAY' } } };
  const result = await inspectHistory(deps.digest, changed);
  assert.equal(result.integrity, 'broken');
  assert.equal(result.consistentPrefixLength, 1);
  assert.deepEqual(result.rows[1]!.problems, ['content']);
  assert.equal(result.rows[2]!.status, 'unverified');
  assert.deepEqual(result.rows[2]!.problems, []);
  assert.equal(result.rows[2]!.entry!.kind, entries[2]!.kind);
  assert.equal(result.rows[2]!.entry!.content, null);
  assert.equal(result.rows[2]!.contentStatus, 'withheld');
  assert.doesNotMatch(JSON.stringify(result), /MUST_NOT_DISPLAY|private synthetic note|third/);
});

test('missing and reordered entries stay in input order and cannot become a repaired chain', async () => {
  const { entries } = await inspectionSample();
  for (const input of [
    [entries[0]!, entries[2]!],
    [entries[0]!, entries[2]!, entries[1]!],
  ]) {
    const before = JSON.stringify(input);
    const result = await inspectHistory(deps.digest, input);
    assert.equal(result.consistentPrefixLength, 1);
    assert.equal(result.rows[1]!.status, 'unverified');
    assert.ok(result.rows[1]!.problems.includes('sequence'));
    assert.ok(result.rows[1]!.problems.includes('link'));
    assert.deepEqual(
      result.rows.map((row) => row.entry?.id),
      input.map((entry) => entry.id),
    );
    assert.equal(JSON.stringify(input), before);
  }
});

test('malformed rows preserve their positions without returning their payload or throwing its details', async () => {
  const { entries } = await inspectionSample();
  for (const bad of [
    null,
    'MUST_NOT_DISPLAY',
    { secret: 'MUST_NOT_DISPLAY' },
    { ...entries[1], day: '2026-10-21T08:00' },
  ]) {
    const result = await inspectHistory(deps.digest, [entries[0], bad, entries[2]]);
    assert.equal(result.consistentPrefixLength, 1);
    assert.equal(result.rows[1]!.position, 1);
    assert.equal(result.rows[1]!.status, 'unreadable');
    assert.equal(result.rows[1]!.entry, null);
    assert.deepEqual(result.rows[1]!.problems, ['structure']);
    assert.equal(result.rows[2]!.status, 'unverified');
    assert.doesNotMatch(JSON.stringify(result), /MUST_NOT_DISPLAY|08:00/);
  }
});

test('duplicate identities invalidate their first occurrence, not just the repeated row', async () => {
  const { entries } = await inspectionSample();
  const duplicate = await inspectionEntry(entries, { id: entries[1]!.id });
  const result = await inspectHistory(deps.digest, [...entries, duplicate]);
  assert.equal(result.consistentPrefixLength, 1);
  assert.ok(result.rows[1]!.problems.includes('identity'));
  assert.ok(result.rows[3]!.problems.includes('identity'));
});

test('the inspector snapshots every row before the first asynchronous digest', async () => {
  const { entries } = await inspectionSample();
  const pending = inspectHistory(async (text) => {
    await Promise.resolve();
    return deps.digest(text);
  }, entries);
  (entries[2]!.content!.body as { value: string }).value = 'changed after inspection started';
  const result = await pending;
  assert.equal(result.integrity, 'intact');
  assert.deepEqual(result.rows[2]!.entry!.content!.body, { value: 'third' });
});

test('unknown header fields are omitted, and non-JSON or malformed values are not exposed', async () => {
  const { entries } = await inspectionSample();
  const result = await inspectHistory(deps.digest, [{ ...entries[0], clock: 'MUST_NOT_DISPLAY' }]);
  assert.equal(result.integrity, 'intact');
  assert.doesNotMatch(JSON.stringify(result), /MUST_NOT_DISPLAY/);
  const circular: { self?: unknown } = {};
  circular.self = circular;
  const bad = { ...entries[0], content: { salt: entries[0]!.content!.salt, body: circular } };
  const unreadable = await inspectHistory(deps.digest, [bad]);
  assert.equal(unreadable.rows[0]!.status, 'unreadable');
});

test('a digest-service failure is not reported as damaged data and leaks no exception content', async () => {
  const { entries } = await inspectionSample();
  await assert.rejects(
    inspectHistory(() => Promise.reject(new Error('MUST_NOT_DISPLAY')), entries),
    /^Error: History inspection is unavailable$/,
  );
});

test('a fully recomputed unsigned chain is only self-consistent, never authentic or complete', async () => {
  const replacement = await inspectionEntry([]);
  const result = await inspectHistory(deps.digest, [replacement]);
  assert.equal(result.integrity, 'intact');
  assert.equal('authentic' in result, false);
  assert.equal('complete' in result, false);
});

test('a readable header edit and an unexplained missing body are distinguished', async () => {
  const { entries } = await inspectionSample();
  const changed: Entry[] = [{ ...entries[0]!, day: entries[1]!.day }, ...entries.slice(1)];
  assert.ok((await inspectHistory(deps.digest, changed)).rows[0]!.problems.includes('hash'));
  const missing = [{ ...entries[0]!, content: null }, ...entries.slice(1)];
  const result = await inspectHistory(deps.digest, missing);
  assert.equal(result.consistentPrefixLength, 0);
  assert.ok(result.rows[0]!.problems.includes('missing-content'));
});

test('an unreadable container and an invalid platform digest fail without exposing exception details', async () => {
  const { entries } = await inspectionSample();
  const container = new Proxy(entries, {
    get() {
      throw new Error('MUST_NOT_DISPLAY');
    },
  });
  await assert.rejects(inspectHistory(deps.digest, container), /^Error: History inspection is unavailable$/);
  await assert.rejects(
    inspectHistory(() => Promise.resolve('invalid'), entries),
    /^Error: History inspection is unavailable$/,
  );
});

test('invalid envelope fields and non-JSON bodies never enter the readable prefix', async () => {
  const { entries } = await inspectionSample();
  const first = entries[0]!;
  for (const fields of [
    { id: '' },
    { seq: -1 },
    { seq: Number.MAX_SAFE_INTEGER + 1 },
    { layer: 'unsupported' },
    { kind: '' },
    { day: '2026-02-30' },
    { previous: 'bad-hash' },
    { hash: 'bad-hash' },
    { digest: 'bad-hash' },
    { content: undefined },
    { content: { salt: 'bad-salt', body: {} } },
    { content: { salt: first.content!.salt } },
    { content: { salt: first.content!.salt, body: () => undefined } },
    { content: { salt: first.content!.salt, body: Number.NaN } },
  ]) {
    const result = await inspectHistory(deps.digest, [{ ...first, ...fields }]);
    assert.equal(result.integrity, 'broken');
    assert.equal(result.rows[0]!.status, 'unreadable');
    assert.equal(result.rows[0]!.entry, null);
  }
});

test('a snapshot keeps every row position, ignores a custom iterator and shows sparse rows as unreadable', async () => {
  const { entries } = await inspectionSample();
  Object.defineProperty(entries, Symbol.iterator, {
    value: function* () {
      yield entries[0]!;
    },
  });
  assert.equal((await inspectHistory(deps.digest, entries)).rows.length, 3);
  const sparse = new Array<unknown>(3);
  sparse[0] = entries[0];
  sparse[2] = entries[2];
  const result = await inspectHistory(deps.digest, sparse);
  assert.equal(result.rows.length, 3);
  assert.equal(result.consistentPrefixLength, 1);
  assert.equal(result.rows[1]!.status, 'unreadable');
});

test('a row is copied before it is checked, so a getter cannot pass one salt and supply another', async () => {
  const { entries } = await inspectionSample();
  const first = entries[0]!;
  let reads = 0;
  const content = {
    body: first.content!.body,
    get salt() {
      reads += 1;
      return reads === 1 ? first.content!.salt : 'not a salt';
    },
  };
  const result = await inspectHistory(deps.digest, [{ ...first, content }, ...entries.slice(1)]);
  const row = result.rows[0]!;
  const shown = row.entry?.content?.salt;
  assert.ok(shown === undefined || shown === first.content!.salt);
  assert.equal(row.status === 'consistent', shown === first.content!.salt);
});
