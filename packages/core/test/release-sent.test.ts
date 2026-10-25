// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's records sent after it changed pack (#322, answers 487 and 488):
// those read in on a pack it had before an edition change, or on its own
// list, go out with the class set back for them, so every record reads the
// same pin where it arrives, and the class ends on its own. Made-up data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  parsePlanPack,
  recordsForRoute,
  type Course,
  type PinnedPack,
  type RecordBook,
  type RecordEvent,
  type SessionRecord,
} from '../src/index.ts';
import { sentCourse, sentSessions } from '../src/course-state.ts';
import { cemEvents, d, mathPack, openBook } from './fixtures.ts';
import { withFix } from './migration-fixtures.ts';
import { mathPackSource } from './reference-fixtures.ts';

const moved = (from: string, to: string): RecordEvent => ({
  kind: 'course.moved',
  move: { courseId: 'c-math', from, to },
});

async function confirmUntil(book: RecordBook, from: string, upTo: string) {
  const context = withFix(book);
  const sessions = awaitingBetween(context, d(from), d(upTo));
  await book.recordAll(
    d(upTo),
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
}

describe('records sent after a class changed pack', () => {
  it('sends the records read in on the pack the class had before on that pack', async () => {
    const other = parsePlanPack({ ...mathPackSource, id: 'dz.cem.1am.math.other' });
    assert.ok(other.ok);
    const book = await openBook(cemEvents());
    await confirmUntil(book, '2026-09-21', '2026-09-21');
    await book.record(d('2026-09-22'), moved('2026.1', '2026.2'));
    await confirmUntil(book, '2026-09-22', '2026-09-22');
    const course = book.state.courses.get('c-math')!;
    const pack = { id: other.value.id, release: '2026.1' };
    await book.record(d('2026-09-23'), { kind: 'course.set', course: { ...course, pack } });
    const context = withFix(book, other.value);
    const sessions = awaitingBetween(context, d('2026-09-23'), d('2026-09-23'));
    await book.recordAll(
      d('2026-09-23'),
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    const records = recordsForRoute(book.state, 'school-space');
    assert.deepEqual(
      records.filter((one) => one.kind === 'course.moved'),
      [moved('2026.1', '2026.2')],
    );
    const pins = (state: RecordBook['state']) =>
      [...state.sessions.values()]
        .flatMap((versions) => {
          const last = versions.at(-1);
          return last?.value?.session.courseId === 'c-math' ? [[last.value.session.day, last.pack]] : [];
        })
        .sort();
    const sent = await openBook(records);
    assert.deepEqual(pins(sent.state), pins(book.state));
    assert.deepEqual(
      pins(book.state).map(([, one]) => one),
      [{ id: mathPack.id, release: '2026.1' }, { id: mathPack.id, release: '2026.2' }, pack],
    );
    assert.deepEqual(sent.state.courses.get('c-math')?.pack, pack);
  });

  it('sends the records read in on its own list with the class on its own list', () => {
    const pack = { id: mathPack.id, release: '2026.1' };
    const course: Course = { id: 'c-math', classId: 'k', subject: 'math', year: '2026', pack };
    const read = (key: string, on?: PinnedPack) => ({
      record: { session: { key, courseId: 'c-math' } } as unknown as SessionRecord,
      ...(on !== undefined && { pack: on }),
    });
    const reads = [read('s1'), read('s2', pack)];
    assert.equal(sentCourse(course, reads).pack, null);
    assert.deepEqual(
      sentSessions(new Map([[course.id, course]]), reads).map((one) =>
        one.kind === 'session.recorded' ? one.record.session.key : one.kind === 'course.set' ? one.course.pack : one,
      ),
      ['s1', pack, 's2'],
    );
  });
});
