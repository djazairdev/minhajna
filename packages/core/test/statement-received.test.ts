// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's statements received (#246, answer 489): a statement kept once,
// as signed, read back with its key and day; text that is no signed statement,
// or checked under another key, refused; a teacher named per key, the latest
// name counting, and a name too long or empty refused; the first statement
// under a key; and the shared-statement layer, which goes to the reader's own
// devices and export, never into anything shared. Made-up keys and statements
// only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkStatement,
  firstUnderKey,
  layerOf,
  mayTravelAs,
  nameTeacher,
  progressStatement,
  receivedStatements,
  receiveStatement,
  recordKey,
  signStatement,
  teacherNames,
  type ProgressStatement,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { makeTestKey, nodeVerifier, type TestKey } from './signed-fixtures.ts';

const [first, second] = [makeTestKey('example-teacher'), makeTestKey('other-teacher')];
const sign = (key: TestKey, statement: ProgressStatement) =>
  signStatement(statement, key.trusted.spki, (text) => Promise.resolve(key.sign(text)));

async function checked(text: string) {
  const check = await checkStatement(text, nodeVerifier);
  assert.ok(check.ok);
  return check;
}

async function statements() {
  const context = contextOf(await openBook(cemEvents()));
  return [
    progressStatement(context, 'c-math', d('2026-10-01'))!,
    progressStatement(context, 'c-math', d('2026-10-08'))!,
  ];
}

test('a statement is kept once, as signed, and read back with its key and day', async () => {
  const [early, later] = await statements();
  const texts = [await sign(first, early!), await sign(second, later!), await sign(first, later!)];
  const book = await openBook([]);
  const keep = async (day: string, text: string, how: 'qr' | 'file' | 'pdf', id: string) => {
    const event = receiveStatement(book.entries, text, await checked(text), how, id);
    if (event !== null) await book.record(d(day), event);
    return event;
  };
  assert.notEqual(await keep('2026-10-02', texts[0]!, 'qr', 'r-1'), null);
  assert.equal(await keep('2026-10-03', texts[0]!, 'pdf', 'r-2'), null);
  await keep('2026-10-09', texts[1]!, 'file', 'r-3');
  await keep('2026-10-10', texts[2]!, 'pdf', 'r-4');
  const list = receivedStatements(book.entries);
  assert.deepEqual(
    list.map((one) => [one.id, one.day, one.how, one.spki === first.trusted.spki, one.statement.day]),
    [
      ['r-1', '2026-10-02', 'qr', true, '2026-10-01'],
      ['r-3', '2026-10-09', 'file', false, '2026-10-08'],
      ['r-4', '2026-10-10', 'pdf', true, '2026-10-08'],
    ],
  );
  assert.equal(firstUnderKey(list, first.trusted.spki)?.id, 'r-1');
  assert.equal(firstUnderKey(list, 'unknown'), undefined);
  const check = await checked(texts[0]!);
  assert.throws(
    () => receiveStatement(book.entries, '{"format":"minhajna.statement"}', check, 'file', 'r-5'),
    RangeError,
  );
  assert.throws(() => receiveStatement(book.entries, 'not json', check, 'qr', 'r-6'), RangeError);
  assert.throws(() => receiveStatement(book.entries, texts[1]!, check, 'qr', 'r-7'), RangeError);
});

test('a teacher is named per key, the latest name counting, and a bad name is refused', async () => {
  const book = await openBook([]);
  const spki = first.trusted.spki;
  await book.record(d('2026-10-02'), nameTeacher(spki, '  Made-up Teacher  '));
  await book.record(d('2026-10-03'), nameTeacher(spki, 'Made-up Teacher', 'Made-up School'));
  await book.record(d('2026-10-03'), nameTeacher(second.trusted.spki, 'Other Teacher', '   '));
  assert.deepEqual(
    [...teacherNames(book.entries).values()].map((one) => [one.name, one.school ?? null]),
    [
      ['Made-up Teacher', 'Made-up School'],
      ['Other Teacher', null],
    ],
  );
  assert.throws(() => nameTeacher(spki, '   '), RangeError);
  assert.throws(() => nameTeacher(spki, 'x'.repeat(81)), RangeError);
  assert.throws(() => nameTeacher(spki, 'Two\nlines'), RangeError);
  assert.throws(() => nameTeacher('', 'Made-up Teacher'), RangeError);
});

test('received statements and names stay on the reader’s own devices and export', async () => {
  const [early] = await statements();
  const text = await sign(first, early!);
  const events = [
    receiveStatement([], text, await checked(text), 'qr', 'r-1')!,
    nameTeacher(first.trusted.spki, 'Made-up Teacher'),
  ];
  for (const event of events) {
    assert.equal(layerOf(event), 'shared-statement');
    assert.equal(mayTravelAs(layerOf(event), event.kind, 'own-devices'), true);
    assert.equal(mayTravelAs(layerOf(event), event.kind, 'full-export'), true);
    assert.equal(mayTravelAs(layerOf(event), event.kind, 'statement'), false);
    assert.equal(mayTravelAs(layerOf(event), event.kind, 'school-space'), false);
  }
  assert.deepEqual(events.map(recordKey), ['statement-received:r-1', `teacher-named:${first.trusted.spki}`]);
});
