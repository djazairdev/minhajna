// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The mark entry's rules (#239, answers 440 and 447): the keypad, two digits
// at most each side of the point; the quick quarters; what a pupil's cell
// starts with; what «التالي» does with what was typed; a level's scale; and
// the sheet, refused for another course's test or another term's, and a
// joint class's exam sat by the course's level only.

import { assessmentData } from '../src/marks/marks-rules';
import { parseDay } from '@minhajna/core';
import { entrySheet, levelScale, nextStep, pressKey, startBuffer, withQuarter } from '../src/marks/entry-rules';
import { openTestData, type TestData } from '../jest/app-data';
import { pupil, withTest } from '../jest/marks-class';
import { coreContext } from '../src/storage/core-context';

const contextOf = (data: TestData) => coreContext({ ...data, state: data.book.state });

const typed = (keys: readonly string[]) => keys.reduce(pressKey, '');

test('the keypad keeps two digits at most on each side of the point', () => {
  expect(typed(['1', '2', '3'])).toBe('12');
  expect(typed(['0', '7'])).toBe('7');
  expect(typed(['.', '5'])).toBe('0.5');
  expect(typed(['1', '.', '.', '2', '5', '9'])).toBe('1.25');
  expect(typed(['1', '4', 'erase'])).toBe('1');
  expect(typed(['erase'])).toBe('');
});

test('a quick quarter keeps the whole part typed', () => {
  expect(withQuarter('12', '.5')).toBe('12.5');
  expect(withQuarter('9.75', '.25')).toBe('9.25');
  expect(withQuarter('', '.75')).toBe('0.75');
  expect(withQuarter('.', '.5')).toBe('0.5');
});

test('a cell starts with its mark, never «غائب»', () => {
  expect([startBuffer(13.5), startBuffer('absent'), startBuffer(undefined)]).toEqual(['13.5', '', '']);
});

test('«التالي» refuses a mark over the maximum, records a change or a clearing, or moves on', () => {
  expect(nextStep('20.25', undefined, 20)).toEqual({ kind: 'over' });
  expect(nextStep('11', undefined, 10)).toEqual({ kind: 'over' });
  expect(nextStep('12.5', undefined, 20)).toEqual({ kind: 'record', value: 12.5 });
  expect(nextStep('12.5', 12.5, 20)).toEqual({ kind: 'move' });
  expect(nextStep('12.', 'absent', 20)).toEqual({ kind: 'record', value: 12 });
  expect(nextStep('', undefined, 20)).toEqual({ kind: 'move' });
  expect(nextStep('', 'absent', 20)).toEqual({ kind: 'move' });
  expect(nextStep('', 14, 20)).toEqual({ kind: 'record', value: null });
});

test('marks are out of 20, or 10 in primary', async () => {
  const data = assessmentData((await openTestData()).profile)!;
  expect(['primary', 'cem', 'lycee', 'none'].map((level) => levelScale(data, level))).toEqual([10, 20, 20, null]);
});

test('a test is entered only from its own course and term', async () => {
  const data = await withTest();
  const assessment = assessmentData(data.profile)!;
  const sheet = (courseId: string, term: number, testId?: string) =>
    entrySheet(contextOf(data), assessment, courseId, term, testId);
  expect(sheet('c-1', 1, 't-1')?.listed.map((one) => one.id)).toEqual(['p-1', 'p-2', 'p-3']);
  expect([sheet('c-2', 1, 't-1'), sheet('c-1', 2, 't-1'), sheet('c-1', 1, 't-9')]).toEqual([null, null, null]);
  expect(sheet('c-1', 2)?.day).toBe('2027-03-02');
});

test('a joint class’s exam is sat by the course’s level only', async () => {
  const data = await withTest();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'j-1',
        schoolId: 's-1',
        level: 'primary',
        grade: '4ap',
        name: '4-5 أ',
        groups: [
          { id: 'j-1-w', kind: 'whole', name: '4-5 أ' },
          { id: 'j-1-4', kind: 'level', name: '4', grade: '4ap' },
          { id: 'j-1-5', kind: 'level', name: '5', grade: '5ap' },
        ],
      },
    },
    {
      kind: 'course.set',
      course: { id: 'j-math', classId: 'j-1', subject: 'math', year: '2026-2027', pack: null, grade: '5ap' },
    },
    ...[
      ['q-1', 'j-1-4'],
      ['q-2', 'j-1-5'],
      ['q-3', 'j-1-5'],
    ].map(([id, group]) => {
      const event = pupil(id, `تلميذ ${id}`);
      return event.kind === 'pupil.set'
        ? { ...event, pupil: { ...event.pupil, classId: 'j-1', groups: [group] } }
        : event;
    }),
  ]);
  const sheet = entrySheet(contextOf(data), assessmentData(data.profile)!, 'j-math', 1);
  expect([sheet?.max, sheet?.listed.map((one) => one.id)]).toEqual([10, ['q-2', 'q-3']]);
});
