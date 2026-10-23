// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Corrections after the term (#243, answer 468): a term ends after its last
// day; a correction changes the mark, within its maximum, with a reason and a
// trimmed detail of at most 200 characters, and is refused when it changes
// nothing; the state keeps the corrected mark and every correction with its
// day, both versions staying in the history; a term's corrections are its
// own; the effect gives the pupil's average, the class average and how many
// reach 10, before and after; and the activity log lists it under corrections
// with the values and the reason, never the detail. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activityLog,
  correctMark,
  eventOf,
  fixEffect,
  setMark,
  termEnded,
  termFixes,
  type AssessmentData,
  type MarkTarget,
  type MarkValue,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { year } from './reference-fixtures.ts';

const data: AssessmentData = {
  country: 'dz',
  release: 'test.1',
  presets: [
    {
      level: 'cem',
      scale: 20,
      circular: '270',
      rulesYear: '2025-2026',
      components: [{ id: 'a', name: { ar: 'a' }, capture: 'manual', points: 20, min: 1, max: 20 }],
      source: 'Made up.',
    },
  ],
  formulas: [{ level: 'cem', id: 'cem', weights: { T: 1, F: 1, E: 4 } }],
};

const exam: MarkTarget = { kind: 'exam' };
const cell = (pupilId: string, target: MarkTarget = exam, term = 1) => ({ courseId: 'c-math', term, target, pupilId });
const marks = (pupilId: string, value: MarkValue): RecordEvent[] => [
  setMark(cell(pupilId, { kind: 'component', componentId: 'a' }), 15, 20),
  setMark(cell(pupilId, { kind: 'test', testId: 't-1' }), 12, 20),
  setMark(cell(pupilId), value, 20),
];
const testOn: RecordEvent = {
  kind: 'test.set',
  test: {
    id: 't-1',
    courseId: 'c-math',
    day: d('2026-11-08'),
    slot: { half: 'morning', index: 1 },
    groupId: 'g-all',
    title: 't-1',
  },
};

test('a term ends once its last day has passed', () => {
  assert.equal(termEnded(year, 1, d('2026-12-17')), false);
  assert.equal(termEnded(year, 1, d('2026-12-18')), true);
  assert.equal(termEnded(year, 2, d('2026-12-18')), false);
  assert.equal(termEnded(year, 4, d('2027-07-01')), false);
});

test('a correction changes the mark, with its reason and a trimmed detail', () => {
  const fixed = correctMark(cell('p01'), 7.75, 9.75, 20, 'sum-error', '  The second page was not added.  ');
  assert.deepEqual(fixed, {
    kind: 'mark.corrected',
    fix: {
      mark: { ...cell('p01'), value: 9.75 },
      before: 7.75,
      reason: 'sum-error',
      note: 'The second page was not added.',
    },
  });
  const absent = correctMark(cell('p01'), 7.75, 'absent', 20, 'transcription-error', '   ');
  assert.deepEqual(absent.kind === 'mark.corrected' && absent.fix, {
    mark: { ...cell('p01'), value: 'absent' },
    before: 7.75,
    reason: 'transcription-error',
  });
  assert.throws(() => correctMark(cell('p01'), 7.75, 7.75, 20, 'other'), /changes the mark/);
  assert.throws(() => correctMark(cell('p01'), 7.75, 21, 20, 'other'), /above the maximum/);
  assert.throws(() => correctMark(cell('p01'), 7.75, 9.754, 20, 'other'), /two decimals/);
  assert.throws(() => correctMark(cell('p01'), 7.75, 8, 20, 'other', 'x'.repeat(201)), /too long/);
  assert.doesNotThrow(() => correctMark(cell('p01'), null, 8, 20, 'appeal', 'x'.repeat(200)));
});

test('the state keeps the corrected mark and each correction with its day, both versions in the history', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-12-10'), [testOn, ...marks('p01', 7.75), ...marks('p02', 10)]);
  await book.record(d('2027-01-05'), correctMark(cell('p01'), 7.75, 9.75, 20, 'sum-error', 'Page two.'));
  await book.record(d('2027-01-06'), correctMark(cell('p02', exam, 2), null, 11, 20, 'appeal'));
  assert.deepEqual(book.state.marks.get('c-math/1/exam/p01'), { ...cell('p01'), value: 9.75 });
  const [first, ...others] = termFixes(book.state, 'c-math', 1);
  assert.equal(others.length, 0);
  assert.deepEqual([first?.day, first?.value.before, first?.value.mark.value], [d('2027-01-05'), 7.75, 9.75]);
  assert.equal(termFixes(book.state, 'c-math', 2).length, 1);
  assert.equal(termFixes(book.state, 'c-other', 1).length, 0);
  const versions = book.entries.flatMap((entry) => {
    const event = eventOf(entry);
    if (event?.kind === 'mark.set' && event.mark.pupilId === 'p01' && event.mark.target.kind === 'exam') {
      return [event.mark.value];
    }
    return event?.kind === 'mark.corrected' && event.fix.mark.pupilId === 'p01' ? [event.fix.mark.value] : [];
  });
  assert.deepEqual(versions, [7.75, 9.75]);
});

test('the effect gives the pupil’s average, the class average and how many reach 10, before and after', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-12-10'), [testOn, ...marks('p01', 7.75), ...marks('p02', 10)]);
  const effect = fixEffect(contextOf(book), data, { ...cell('p01'), value: 9.75 });
  assert.ok(effect);
  assert.deepEqual([effect.scale, effect.threshold, effect.counted], [20, 10, 2]);
  assert.equal(effect.before.average, (15 + 12 + 4 * 7.75) / 6);
  assert.equal(effect.after.average, (15 + 12 + 4 * 9.75) / 6);
  assert.deepEqual([effect.before.reached, effect.after.reached], [1, 2]);
  assert.ok((effect.after.mean ?? 0) > (effect.before.mean ?? 0));
  assert.deepEqual(book.state.marks.get('c-math/1/exam/p01')?.value, 7.75);
  assert.equal(fixEffect(contextOf(book), data, { ...cell('p01'), courseId: 'c-none', value: 9 }), null);
});

test('the log lists a correction under corrections, with its values and reason, never its detail', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-12-10'), [testOn, ...marks('p01', 7.75)]);
  await book.record(d('2027-01-05'), correctMark(cell('p01'), 7.75, 9.75, 20, 'sum-error', 'Page two.'));
  const [item, ...others] = activityLog(book.entries).flatMap((day) => day.items);
  assert.equal(others.length, 0);
  assert.equal(item?.category, 'corrections');
  assert.deepEqual(item?.line, {
    kind: 'mark-corrected',
    courseId: 'c-math',
    term: 1,
    target: exam,
    pupilId: 'p01',
    from: 7.75,
    to: 9.75,
    reason: 'sum-error',
  });
  assert.doesNotMatch(JSON.stringify(item), /Page two/);
});
