// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalJson,
  MemoryStore,
  SchoolCoverBook,
  verifyHistory,
  type CoverChoice,
  type CoverRole,
  type HistoryStore,
} from '../src/index.ts';
import { coverDay as day, coverFixture, schoolSession } from './school-cover-fixtures.ts';
import { deps } from './support.ts';
import { d } from './fixtures.ts';

test('the director marks a school session; supervision is pending until an explicit assignment', async () => {
  const { book, scope, store } = await coverFixture();
  await book.need('one', day);
  scope({ actorId: 'holder' });
  assert.deepEqual(
    book.teacherRows(day).map((row) => [row.direction, row.choice, row.assigned]),
    [['received', 'supervision', false]],
  );
  assert.equal((await store.load()).length, 1);
  assert.equal((await store.load())[0]?.day, day);
});

test('only the director and deputy may create, assign or cancel cover', async () => {
  const { book, scope, store, source } = await coverFixture();
  await book.need('one', day);
  const before = await store.load();
  for (const actorId of ['holder', 'colleague', 'supervisor', 'preparer', 'inspector', 'not-joined']) {
    scope({ actorId });
    await assert.rejects(SchoolCoverBook.open(store, deps, source));
    assert.throws(() => book.sessions(day));
    assert.throws(() => book.choices('one', 'colleague'));
    await assert.rejects(book.need('later', day));
    await assert.rejects(book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day));
    await assert.rejects(book.cancel('one', day));
    assert.deepEqual(await store.load(), before);
  }
  scope({ actorId: 'deputy' });
  await book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day);
  assert.deepEqual(book.choices('busy', 'colleague'), []);
  scope({ actorId: 'colleague' });
  assert.equal(book.teacherRows(day)[0]?.direction, 'given');
});

test('deployment, school and membership gates fail closed, including after access is revoked', async () => {
  const { book, scope, source, store } = await coverFixture();
  scope({ nationalSystem: false });
  await assert.rejects(book.need('one', day));
  await assert.rejects(SchoolCoverBook.open(store, deps, source));
  scope({ nationalSystem: true, schoolId: 'other-school' });
  await assert.rejects(book.need('one', day));
  scope({ schoolId: 's-cem', members: new Map() });
  await assert.rejects(book.need('one', day));
  assert.throws(() => book.teacherRows(day));
  assert.deepEqual(await store.load(), []);
});

test('foreign sessions, missing sessions, an invalid slot and out-of-year sessions cannot be marked', async () => {
  const { book, scope, store } = await coverFixture();
  await assert.rejects(book.need('missing', day));
  await assert.rejects(book.need('elsewhere', day));
  scope({ sessions: [schoolSession('bad', { day: d('2027-07-01') })] });
  await assert.rejects(book.need('bad', day));
  scope({ sessions: [schoolSession('bad', { slot: { half: 'morning', index: 0 } })] });
  await assert.rejects(book.need('bad', day));
  await assert.rejects(book.need('bad', '2026-10-15T08:00:00' as typeof day));
  assert.deepEqual(await store.load(), []);
});

test('failed writes report failure, stay absent on read, and allow a durable retry', async () => {
  const memory = new MemoryStore();
  let fail = true;
  const store: HistoryStore = {
    load: () => memory.load(),
    eraseContent: (ids) => memory.eraseContent(ids),
    append: (entry) => (fail ? Promise.reject(new Error('Invented storage failure')) : memory.append(entry)),
  };
  const { book, scope } = await coverFixture(store);
  await assert.rejects(book.need('one', day));
  scope({ actorId: 'holder' });
  assert.deepEqual(book.teacherRows(day), []);
  scope({ actorId: 'director' });
  fail = false;
  await book.need('one', day);
  assert.equal((await store.load()).length, 1);
});

test('simultaneous marks and identical assignments save once; role changes affect queued writes', async () => {
  const { book, scope, store } = await coverFixture();
  await Promise.all([book.need('one', day), book.need('one', day)]);
  await Promise.all([
    book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day),
    book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day),
  ]);
  assert.equal((await store.load()).length, 2);
  const pending = book.need('later', day);
  scope({ actorId: 'holder' });
  await assert.rejects(pending);
  assert.equal((await store.load()).length, 2);
});

test('confirmation belongs to the assigned teacher, never to the holder or director; it is undoable', async () => {
  const { book, scope, store } = await coverFixture();
  await book.need('one', day);
  await book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day);
  for (const actorId of ['holder', 'director', 'other']) {
    scope({ actorId });
    await assert.rejects(book.confirm('one', true, day));
  }
  scope({ actorId: 'colleague' });
  await assert.rejects(book.confirm('one', true, d('2026-10-14')));
  await book.confirm('one', true, day);
  assert.equal(book.teacherRows(day)[0]?.completed, true);
  const prefix = await store.load();
  scope({ actorId: 'director' });
  assert.equal(book.givenCover().length, 1);
  await assert.rejects(book.cancel('one', day));
  await assert.rejects(book.assign('one', { kind: 'study-room' }, day));
  scope({ actorId: 'colleague' });
  await book.confirm('one', false, day);
  scope({ actorId: 'director' });
  assert.equal(book.givenCover().length, 0);
  await book.cancel('one', day);
  assert.deepEqual((await store.load()).slice(0, prefix.length), prefix);
  assert.deepEqual(await verifyHistory(deps.digest, await store.load()), []);
});

test('corrections survive reopen and earlier versions remain; no reason or injected field is stored', async () => {
  const { book, scope, source, store } = await coverFixture();
  await book.need('one', day);
  const old = await store.load();
  const injected = { kind: 'colleague', teacherId: 'colleague', reason: 'SHOULD_NOT_BE_STORED', absences: 3 } as const;
  await book.assign('one', injected, day);
  assert.deepEqual((await store.load()).slice(0, old.length), old);
  assert.equal(canonicalJson(await store.load()).includes('SHOULD_NOT_BE_STORED'), false);
  assert.equal(canonicalJson(await store.load()).includes('absences'), false);
  const reopened = await SchoolCoverBook.open(store, deps, source);
  scope({ actorId: 'colleague' });
  assert.equal(reopened.teacherRows(day)[0]?.direction, 'given');
  assert.equal(reopened.teacherRows(d('2026-10-16')).length, 0);
});

test('opening a store for the wrong school or with a damaged chain is refused', async () => {
  const { book, store, source } = await coverFixture();
  await book.need('one', day);
  await assert.rejects(SchoolCoverBook.open(store, deps, () => ({ ...source(), schoolId: 'elsewhere' })));
  const entries = await store.load();
  const broken: HistoryStore = {
    load: () => Promise.resolve([{ ...entries[0]!, day: d('2026-10-16') }]),
    append: () => Promise.resolve(),
    eraseContent: () => Promise.resolve(),
  };
  await assert.rejects(SchoolCoverBook.open(broken, deps, source));
});

test('teachers see no other cover or holder identity; supervisors get only the daily cover sheet', async () => {
  const { book, scope, source } = await coverFixture();
  await book.need('one', day);
  await book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day);
  scope({ actorId: 'other' });
  assert.deepEqual(book.teacherRows(day), []);
  assert.throws(() => book.givenCover());
  assert.throws(() => book.dailySheet(day));
  scope({ actorId: 'colleague' });
  const row = book.teacherRows(day)[0]!;
  assert.equal('teacherId' in row.session, false);
  (row.session.slot as { index: number }).index = 9;
  assert.equal(book.teacherRows(day)[0]?.session.slot.index, 1);
  scope({ actorId: 'supervisor' });
  const sheet = book.dailySheet(day);
  assert.equal('teacherId' in sheet[0]!.session, false);
  assert.deepEqual(sheet[0]?.choice, { kind: 'colleague', teacherId: 'colleague' });
  assert.throws(() => book.teacherRows(day));
  for (const role of ['timetable-preparer', 'inspector'] as CoverRole[]) {
    scope({ members: new Map(source().members).set('supervisor', [role]) });
    assert.throws(() => book.dailySheet(day));
  }
});

test('choices respect a free colleague, a real host class, and last-session-only release', async () => {
  const { book, scope } = await coverFixture();
  await book.need('one', day);
  for (const choice of [
    { kind: 'colleague', teacherId: 'holder' },
    { kind: 'colleague', teacherId: 'other' },
    { kind: 'colleague', teacherId: 'missing' },
    { kind: 'merge', teacherId: 'other', classId: 'missing' },
    { kind: 'release' },
    { kind: 'swap', sessionId: 'one' },
    { kind: 'move', sessionId: 'elsewhere' },
    { kind: 'invented' },
  ])
    await assert.rejects(book.assign('one', choice as CoverChoice, day));
  await book.assign('one', { kind: 'merge', teacherId: 'other', classId: 'k-2' }, day);
  for (const choice of [
    { kind: 'supervision' },
    { kind: 'study-room' },
    { kind: 'swap', sessionId: 'later' },
    { kind: 'move', sessionId: 'later' },
  ] as CoverChoice[])
    await book.assign('one', choice, day);
  await book.need('later', day);
  await book.assign('later', { kind: 'release' }, day);
  scope({ actorId: 'holder' });
  assert.equal(book.teacherRows(day)[1]?.choice, 'release');
});

test('a deputy who also teaches keeps both roles, without a teacher acquiring management rights', async () => {
  const { book, scope, source } = await coverFixture();
  scope({ actorId: 'deputy', members: new Map(source().members).set('deputy', ['deputy', 'teacher']) });
  await book.need('one', day);
  await book.assign('one', { kind: 'colleague', teacherId: 'deputy' }, day);
  assert.equal(book.teacherRows(day)[0]?.direction, 'given');
  await book.confirm('one', true, day);
  assert.equal(book.givenCover().length, 1);
  scope({ actorId: 'holder' });
  await assert.rejects(book.cancel('one', day));
});

test('one free colleague cannot be assigned to two overlapping covers', async () => {
  const { book, scope, source, store } = await coverFixture();
  scope({ sessions: [...source().sessions, schoolSession('another', { classId: 'k-3', className: '2م3' })] });
  await book.need('one', day);
  await book.need('another', day);
  await book.assign('one', { kind: 'colleague', teacherId: 'colleague' }, day);
  const before = await store.load();
  await assert.rejects(book.assign('another', { kind: 'colleague', teacherId: 'colleague' }, day));
  assert.deepEqual(await store.load(), before);
});
