// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An exam whose days an update of the world's calendar moved, on the teacher's
// threshold pages (#602, answer 634, R-7.10-06), on the made-up room of
// cut-room.ts: the term 2 exam windows moved a week later by a made-up update
// make the exams list and the exam's page say the days it had and has, its
// figures day among them, the room opened before the move signing by its
// chart's deadline, the day the update was published and its reason, kept apart
// from the words around it; with no update nothing is said of a move; a room
// opened before its exam moved says its chart was taken on the old figures day
// and still signs by its deadline, names neither a new deadline nor figures
// day, shows the exam's first day as it now is, and gets no second card; and an
// exam above the school says its days moved without a signing deadline, a
// reason in another script kept apart, with no day announced when no update
// holds the move, and that its figures are taken on the new figures day; and a
// move within the exam's week says its figures day stays, one of its last day
// alone saying that day, a room opened before it still signing by its chart's
// deadline. Every school, teacher and calendar entry is made up.

import { addDays, examMoves, type CalendarUpdate, type ExamChart, type ExamMove, type WorldExam } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';
import { openedRoom } from '../jest/cut-room';
import { server } from '../jest/timetable-send';
import { props, show, texts, unmount } from '../jest/threshold-page';
import { reference } from '../jest/world-calendar';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { ExamThreshold } from '../src/threshold/ExamThreshold';
import { ExamThresholds } from '../src/threshold/ExamThresholds';
import * as ownExamsModule from '../src/threshold/own-exams';
import { examsOf, movedLines, roomId, roomMoves } from '../src/threshold/threshold-text';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const list = ar.demo.thresholds;
const ROOM = roomId({ exam: 'term-2', subject: 'math', grade: '1am' });
const REASON = 'قرار مختلق لمجلس الأساتذة';

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
});

/** The reference with the term 2 exam windows a week later, and the made-up update that moved them. */
function movedTerm() {
  const entries = reference.calendar.entries.map((one) =>
    one.effect === 'exam' && one.term === 2
      ? {
          ...one,
          from: addDays(one.from, 7),
          to: addDays(one.to, 7),
          moved: { from: one.from, to: one.to, reason: REASON },
        }
      : one,
  );
  const moved = { ...reference, calendar: { ...reference.calendar, entries } };
  const published = addDays(entries.find((one) => one.moved !== undefined)!.from, -21);
  const update = { published, entries: entries.filter((one) => one.moved !== undefined) } as unknown as CalendarUpdate;
  const [move] = examMoves(moved.calendar.year, entries, [update]);
  return { moved, update, move, published };
}

test('the list and the exam’s page say the days it had and has, when it was announced and why', async () => {
  const { id, date, joined } = await openedRoom();
  const { moved, update, move, published } = movedTerm();
  const now = moved.calendar.entries.find((one) => one.moved !== undefined)!;
  expect(move.exam).toBe('term-2');
  expect(move.before.from).not.toBe(now.from);
  const said = [
    list.movedAnnounced.replace('{{day}}', `day ${published}`),
    list.movedReason.replace('{{reason}}', isolate(REASON)),
  ];
  const page = { ...props({ world: id, date }, joined), reference: moved, updates: [update] };
  await show(<ExamThresholds {...page} said={list.title} onRoom={jest.fn()} onTotals={jest.fn()} />);
  const line = texts().find((one) => one.startsWith(list.moved.split('{{')[0]))!;
  expect(line).toContain(`day ${move.before.from}`);
  expect(line).toContain(`day ${move.before.figuresDay}`);
  expect(texts()).toEqual(expect.arrayContaining([...said, list.movedCalendar]));
  expect(texts()).not.toContain(list.movedFigures);
  await unmount();
  await show(<ExamThreshold {...page} said={ar.demo.threshold.title} room={ROOM} />);
  expect(texts()).toEqual(expect.arrayContaining(said));
});

test('says nothing of a move without an update moving the exam', async () => {
  const { id, date, joined } = await openedRoom();
  await show(
    <ExamThresholds
      {...props({ world: id, date }, joined)}
      updates={[]}
      said={list.title}
      onRoom={jest.fn()}
      onTotals={jest.fn()}
    />,
  );
  expect(texts().some((one) => one.startsWith(list.moved.split('{{')[0]))).toBe(false);
});

test('a room opened before its exam moved says its chart is old, with no second card', async () => {
  const { id, date, joined, pack, items } = await openedRoom();
  const { moved } = movedTerm();
  const now = examsOf(moved).get('term-2')!;
  expect(now.figuresDay).not.toBe(date);
  const coming = { ...now, setBy: 'school' as const };
  const chart = { exam: 'term-2', subject: 'math', grade: '1am', forecastDay: date, pack, items, classes: [] };
  const one = { name: '1م2', position: items[0], forecast: items[1] };
  jest
    .spyOn(ownExamsModule, 'ownExams')
    .mockReturnValue([{ exam: coming, asOf: date, charts: [{ ...chart, classes: [one] }] }] as never);
  const page = { ...props({ world: id, date }, joined), reference: moved, updates: [], school: {} as never };
  await show(<ExamThresholds {...page} said={list.title} onRoom={jest.fn()} onTotals={jest.fn()} />);
  const stale = ar.demo.threshold.stale
    .replace('{{day}}', `day ${date}`)
    .replace('{{now}}', `day ${now.figuresDay}`)
    .replace('{{signBy}}', `day ${addDays(date, 2)}`);
  expect([texts().includes(stale), texts().includes(list.shows.school)]).toEqual([true, false]);
  expect(texts().some((line) => line.startsWith(list.movedAnnounced.split('{{')[0]))).toBe(false);
  expect(texts().filter((line) => line.includes(`day ${now.signBy}`) || line === list.movedFigures)).toEqual([]);
  expect(texts().some((line) => line.startsWith(list.days.split('{{')[0]) && line.includes(`day ${now.from}`))).toBe(
    true,
  );
});

test('an exam above the school says its days moved, with no signing deadline, its reason kept apart', async () => {
  const { id, date, joined, pack, items } = await openedRoom();
  const reason = 'A made-up Latin reason';
  const mock = {
    id: 'mock',
    setBy: 'directorate',
    term: 3,
    from: addDays(date, 40),
    to: addDays(date, 42),
    figuresDay: addDays(date, 30),
    signBy: addDays(date, 35),
  } as const;
  const chart = { exam: 'mock', subject: 'math', grade: '1am', forecastDay: addDays(date, 39), pack, items };
  const one = { name: '1م2', position: items[0], forecast: items[1] };
  jest
    .spyOn(ownExamsModule, 'ownExams')
    .mockReturnValue([{ exam: mock, asOf: date, charts: [{ ...chart, classes: [one] }] }] as never);
  const entries = reference.calendar.entries.map((each) =>
    each.effect === 'exam' && each.term === 3 && each.grades?.includes('4am')
      ? {
          ...each,
          from: addDays(each.from, -7),
          to: addDays(each.to, -7),
          moved: { from: each.from, to: each.to, reason },
        }
      : each,
  );
  const moved = { ...reference, calendar: { ...reference.calendar, entries } };
  const move = examMoves(moved.calendar.year, entries, []).find((each) => each.exam === 'mock')!;
  const page = { ...props({ world: id, date }, joined), reference: moved, updates: [], school: {} as never };
  await show(<ExamThresholds {...page} said={list.title} onRoom={jest.fn()} onTotals={jest.fn()} />);
  expect(move.reason).toBe(reason);
  const line = texts().find((each) => each.startsWith(list.movedAbove.split('{{')[0]))!;
  expect(line).not.toContain(`day ${move.before.signBy}`);
  expect(texts()).toEqual(
    expect.arrayContaining([list.movedReason.replace('{{reason}}', isolate(reason)), list.movedFigures]),
  );
});

test('a move within the week keeps the figures day; a room opened before it signs by its own deadline', () => {
  const t = ((key: string, values?: { signBy?: string }) => `${key} ${values?.signBy ?? ''}`.trim()) as TFunction;
  const day = (one: string) => one as ExamChart['from'];
  const before = {
    from: day('2027-01-10'),
    to: day('2027-01-12'),
    figuresDay: day('2027-01-07'),
    signBy: day('2027-01-08'),
  };
  const now = { ...before, id: 'term-2', setBy: 'school' as const, from: day('2027-01-12'), signBy: day('2027-01-10') };
  const move: ExamMove = { exam: 'term-2', before, reason: null, announced: null };
  const moves = new Map([['term-2', move]]);
  const exams = new Map([['term-2', now as WorldExam]]);
  const chart = { ...before, exam: 'term-2' } as unknown as ExamChart;
  const keys = (lines: string[]) => lines.map((one) => one.split(' ')[0]);
  expect(keys(movedLines(t, move, now, String))).toEqual([
    'demo.thresholds.movedWeek',
    'demo.thresholds.movedCalendar',
  ]);
  const end = { ...before, id: 'term-2', setBy: 'school' as const, to: day('2027-01-13') };
  expect(keys(movedLines(t, move, end, String))).toEqual(['demo.thresholds.movedEnd', 'demo.thresholds.movedCalendar']);
  expect(roomMoves(t, chart, moves, exams, String)).toEqual([
    'demo.thresholds.movedWeekAbove',
    'demo.thresholds.movedCalendar',
    'demo.threshold.staleSign 2027-01-08',
  ]);
});
