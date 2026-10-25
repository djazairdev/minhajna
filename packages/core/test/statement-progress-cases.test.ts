// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  makeContext,
  packKey,
  pace,
  progressStatement,
  readStatement,
  sessionKey,
  statementPayload,
  type CalendarEntry,
  type Coverage,
  type Day,
  type RecordBook,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook, reference } from './fixtures.ts';
import { confirmStatementDays } from './statement-fixtures.ts';
import { rotatingBook } from './rotation-fixtures.ts';

async function record(book: RecordBook, day: Day, coverage: readonly Coverage[], groupId = 'g-all') {
  const slot = { half: 'morning' as const, index: 1 };
  const session = { key: sessionKey('c-math', day, slot, groupId), courseId: 'c-math', groupId, day, slot };
  await book.record(day, {
    kind: 'session.recorded',
    record: { session, coverage, outcome: 'done', sessionType: 'lesson' },
  });
}

test('a unit needs actual whole-class teaching, not a skipped item or only one half', async () => {
  const pack = { ...mathPack, items: mathPack.items.filter((one) => ['u1', 'l1', 'r1', 't1'].includes(one.id)) };
  const ref = { ...reference, packs: new Map([[packKey(pack.id, pack.release), pack]]) };
  const book = await openBook(cemEvents());
  const at = (day: Day) => progressStatement(makeContext(ref, book.state), 'c-math', day)!;
  await record(book, d('2026-09-20'), [{ op: 'taught', item: 'l1', from: 0, to: 4 }], 'g-1');
  assert.equal(at(d('2026-09-20')).lastResource?.status, 'started');
  assert.equal(at(d('2026-09-20')).lastUnit, null);
  await record(book, d('2026-09-21'), [{ op: 'taught', item: 'l1', from: 0, to: 4 }], 'g-2');
  assert.deepEqual(at(d('2026-09-21')).lastUnit, { id: 'u1', title: 'Whole numbers' });
  assert.equal(at(d('2026-09-21')).lastResource?.status, 'done');
  const skipped = await openBook(cemEvents());
  await record(skipped, d('2026-09-20'), [{ op: 'skipped', item: 'l1' }]);
  const result = progressStatement(makeContext(ref, skipped.state), 'c-math', d('2026-09-20'))!;
  assert.equal(result.lastUnit, null);
  assert.equal(result.lastResource, null);
});

test('the latest resource follows actual teaching order, never a future or furthest plan item', async () => {
  const book = await openBook(cemEvents());
  await record(book, d('2026-09-20'), [{ op: 'taught', item: 'l5', from: 0, to: 4 }]);
  await record(book, d('2026-09-21'), [{ op: 'taught', item: 'l1', from: 0, to: 2 }]);
  await record(book, d('2026-09-23'), [{ op: 'taught', item: 'l2', from: 0, to: 4 }]);
  assert.equal(progressStatement(contextOf(book), 'c-math', d('2026-09-21'))?.lastResource?.id, 'l1');
  assert.equal(progressStatement(contextOf(book), 'c-math', d('2026-09-23'))?.lastResource?.id, 'l2');
  await record(book, d('2026-09-24'), [{ op: 'retaught', item: 'l5' }]);
  assert.equal(progressStatement(contextOf(book), 'c-math', d('2026-09-24'))?.lastResource?.id, 'l5');
});

test('calendar causes and other causes include TD, while private reasons and exams never leave', async () => {
  const book = await openBook(cemEvents());
  const entry = (
    id: string,
    day: Day,
    effect: CalendarEntry['effect'],
    layer: CalendarEntry['layer'],
  ): CalendarEntry => ({
    id,
    from: day,
    to: day,
    effect,
    layer,
    name: { en: 'Private marker text' },
    source: 'Never share this source',
    confidence: 'announced',
  });
  await book.recordAll(
    d('2026-09-19'),
    [
      entry('own-sunday', d('2026-09-20'), 'no-school', 'teacher'),
      entry('holiday', d('2026-09-21'), 'no-school', 'national'),
      entry('own-tuesday', d('2026-09-22'), 'no-school', 'teacher'),
      entry('exam', d('2026-09-23'), 'exam', 'national'),
      { ...entry('closure', d('2026-09-24'), 'closure', 'school'), schoolId: 's-cem' },
    ].map((one): RecordEvent => ({ kind: 'calendar.set', entry: one })),
  );
  const statement = progressStatement(contextOf(book), 'c-math', d('2026-09-24'))!;
  assert.deepEqual(statement.notHeld, { calendar: 2, other: 2 });
  assert.deepEqual(statement.td, { calendar: 0, other: 1 });
  const payload = statementPayload(statement);
  for (const hidden of ['own-sunday', 'own-tuesday', 'Private marker', 'Never share', '2026-09-20']) {
    assert.equal(payload.includes(hidden), false);
  }
});

test('a held session on a closed day is not lost, and a withdrawn confirmation does not invent a loss', async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-09-20');
  await book.record(day, {
    kind: 'calendar.set',
    entry: {
      id: 'closed',
      layer: 'school',
      schoolId: 's-cem',
      from: day,
      to: day,
      effect: 'closure',
      name: { en: 'Example closure' },
      source: 'Made up',
      confidence: 'announced',
    },
  });
  await record(book, day, [{ op: 'taught', item: 'l1', from: 0, to: 4 }]);
  assert.deepEqual(progressStatement(contextOf(book), 'c-math', day)?.notHeld, { calendar: 0, other: 0 });
  const second = await openBook(cemEvents());
  await confirmStatementDays(second, day, day, { outcome: 'not-held' });
  assert.equal(progressStatement(contextOf(second), 'c-math', day)?.notHeld.other, 1);
  const saved = [...second.state.sessions.values()][0]!.at(-1)!.value!;
  await second.record(day, { kind: 'session.withdrawn', session: saved.session });
  assert.deepEqual(progressStatement(contextOf(second), 'c-math', day)?.notHeld, { calendar: 0, other: 0 });
});

test('rotation costs stay calendar costs, never private reasons or teaching delay', async () => {
  const book = await rotatingBook();
  const day = d('2026-10-01');
  const paced = pace(contextOf(book), 'c-math', day)!;
  const result = progressStatement(contextOf(book), 'c-math', day)!;
  assert.ok(paced.lost.rotation > 0);
  assert.equal(result.notHeld.calendar, paced.lost.rotation + result.td.calendar);
  assert.equal(result.notHeld.other, 0);
  assert.equal(result.delay.sessions, 0);
});

test('uninstalled and stale pinned releases cannot produce misleading statements', async () => {
  const book = await openBook(cemEvents());
  const missing = makeContext({ ...reference, packs: new Map() }, book.state);
  assert.equal(progressStatement(missing, 'c-math', d('2026-09-20')), null);
  const stale = { ...mathPack, status: 'stale' as const };
  const context = makeContext(
    { ...reference, packs: new Map([[packKey(stale.id, stale.release), stale]]) },
    book.state,
  );
  assert.equal(progressStatement(context, 'c-math', d('2026-09-20')), null);
});

test('a teacher list has its own pack identity and survives the statement format', async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-09-20');
  await book.recordAll(day, [
    { kind: 'course.set', course: { ...book.state.courses.get('c-math')!, pack: null } },
    {
      kind: 'list.set',
      list: { courseId: 'c-math', started: day, items: [{ id: 'l1', kind: 'lesson', title: 'Own item', sessions: 1 }] },
    },
  ]);
  const statement = progressStatement(contextOf(book), 'c-math', day)!;
  assert.equal(statement.pack.release, 'own');
  assert.deepEqual(readStatement(statementPayload(statement)), { ok: true, value: statement });
});

test('a reshaped class carries inherited progress under its own section label', async () => {
  const book = await openBook(cemEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-24'));
  const day = d('2026-09-27');
  await book.recordAll(day, [
    { kind: 'class.set', schoolClass: { ...book.state.classes.get('k-1am2')!, id: 'k-new', name: '1AM3' } },
    {
      kind: 'course.set',
      course: {
        ...book.state.courses.get('c-math')!,
        id: 'c-new',
        classId: 'k-new',
        continues: { courseId: 'c-math', from: day },
      },
    },
  ]);
  const result = progressStatement(contextOf(book), 'c-new', day)!;
  assert.equal(result.class.section, '1AM3');
  assert.equal(result.lastResource?.id, 'l2');
  assert.equal(result.lastResource?.status, 'done');
});
