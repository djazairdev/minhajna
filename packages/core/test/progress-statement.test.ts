// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  confirmDeparture,
  leavePupil,
  progressStatement,
  statementPayload,
  makeContext,
  pace,
  rollCallUnits,
  takeRollCall,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents, reference } from './fixtures.ts';
import { confirmStatementDays } from './statement-fixtures.ts';

test('a statement identifies the class, year and pinned release, with nothing invented as taught', async () => {
  const book = await openBook(cemEvents());
  const before = book.entries.length;
  assert.deepEqual(progressStatement(contextOf(book), 'c-math', d('2026-10-01')), {
    format: 'minhajna.statement',
    version: { major: 1, minor: 0 },
    day: '2026-10-01',
    class: { level: 'cem', grade: '1am', section: '1AM2', subject: 'math', year: '2026-2027' },
    pack: { id: 'dz.cem.1am.math.example', release: '2026.1' },
    lastUnit: null,
    lastResource: null,
    delay: { sessions: 0, weeks: null, bufferUsed: 0, bufferLeft: 3 },
    notHeld: { calendar: 0, other: 0 },
    td: { calendar: 0, other: 0 },
  });
  assert.equal(book.entries.length, before);
});

test('the last main resource can be in progress and TD never replaces it', async () => {
  const book = await openBook(cemEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-22'));
  const result = progressStatement(contextOf(book), 'c-math', d('2026-09-22'));
  assert.deepEqual(result?.lastResource, { id: 'l1', title: 'Reading and writing whole numbers', status: 'started' });
  assert.equal(result?.lastUnit, null);
  await confirmStatementDays(book, d('2026-09-23'), d('2026-09-23'));
  assert.equal(progressStatement(contextOf(book), 'c-math', d('2026-09-23'))?.lastResource?.status, 'done');
});

test('the main delay is exactly the existing buffer-aware pace, not unconfirmed sessions', async () => {
  const book = await openBook(cemEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-24'));
  await confirmStatementDays(book, d('2026-09-27'), d('2026-10-01'), { outcome: 'not-held' });
  const day = d('2026-10-15');
  const context = contextOf(book);
  const paced = pace(context, 'c-math', day)!;
  const result = progressStatement(context, 'c-math', day)!;
  assert.deepEqual(result.delay, {
    sessions: paced.delay,
    weeks: paced.weeksBehind,
    bufferUsed: paced.bufferUsed,
    bufferLeft: paced.bufferLeft,
  });
  assert.deepEqual(result.notHeld, { calendar: 0, other: 5 });
  assert.deepEqual(result.td, { calendar: 0, other: 1 });
});

test('week packs keep plan weeks and a missing pack produces no statement', async () => {
  const book = await openBook(primaryEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-27'), { outcome: 'not-held' });
  assert.equal(progressStatement(contextOf(book), 'c-lang', d('2026-09-27'))?.delay.weeks, 1);
  const course = book.state.courses.get('c-lang')!;
  await book.record(d('2026-09-28'), { kind: 'course.set', course: { ...course, pack: null } });
  assert.equal(progressStatement(contextOf(book), 'c-lang', d('2026-09-28')), null);
  const missing = makeContext({ ...reference, packs: new Map() }, book.state);
  assert.equal(progressStatement(missing, 'c-lang', d('2026-09-28')), null);
});

test('pupil records, erasure facts, private notes and lesson notes cannot change the statement', async () => {
  const book = await openBook(cemEvents());
  await confirmStatementDays(book, d('2026-09-20'), d('2026-09-24'));
  const day = d('2026-09-24');
  const before = statementPayload(progressStatement(contextOf(book), 'c-math', day)!);
  const sessionKey = [...book.state.sessions.keys()][0]!;
  const saved = book.state.sessions.get(sessionKey)!.at(-1)!.value!;
  await book.record(day, {
    kind: 'session.recorded',
    record: {
      ...saved,
      factual: 'Invented private factual line',
      unplanned: 'Invented private topic',
      homework: { text: 'Invented private homework', due: d('2026-09-27') },
    },
  });
  const unit = rollCallUnits(contextOf(book), 'k-1am2', day, day)[0]!;
  await book.record(
    day,
    takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p01', justified: false }], late: [] }),
  );
  await book.recordAll(day, [
    { kind: 'session.noted', note: { sessionKey, note: 'Invented private pupil detail', reason: 'other' } },
    {
      kind: 'mark.set',
      mark: { courseId: 'c-math', term: 1, target: { kind: 'exam' }, pupilId: 'p01', value: 12 },
    },
    {
      kind: 'lesson-note.set',
      note: {
        id: 'note-1',
        courseId: 'c-math',
        itemId: 'l1',
        number: 1,
        paragraphs: [{ key: 'objectives', text: 'Private preparation' }],
      },
    },
  ]);
  assert.equal(statementPayload(progressStatement(contextOf(book), 'c-math', day)!), before);
  const stripped = makeContext(reference, {
    ...book.state,
    pupils: new Map(),
    marks: new Map(),
    rollCalls: new Map(),
    notes: new Map(),
    lessonNotes: new Map(),
    personal: null,
  });
  assert.equal(statementPayload(progressStatement(stripped, 'c-math', day)!), before);
  assert.equal(before.includes('p01'), false);
  assert.equal(before.includes('Private'), false);
  await book.record(day, leavePupil(contextOf(book), 'p01', day, 'transfer'));
  await book.record(day, confirmDeparture(contextOf(book), 'p01'));
  await book.erasePupil(day, 'p01');
  assert.equal(book.state.pupils.has('p01'), false);
  assert.equal(book.state.erasedPupils?.length, 1);
  assert.equal(statementPayload(progressStatement(contextOf(book), 'c-math', day)!), before);
});
