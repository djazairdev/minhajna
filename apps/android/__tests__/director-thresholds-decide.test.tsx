// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's decision on D-Threshold (#603, answer 637), with the rooms
// read and the decision put stood in for: the exams are offered as chips, the
// latest chosen; opening a subject says so and marks its row; a cut proposed is
// offered to adopt until the day before the exam, a press signing it once, the
// choices held while it signs, then said and the rooms read again, and from the
// exam's first day no choice is offered and the decision is said to have
// lapsed; a refusal is said in the director's words until read again, and what
// was said holds for its date alone, a new date read again; on a phone what is
// opened, decided or refused is announced; after the year's last day it says
// the year has ended; and the page is the director's alone. Every world,
// school, setter and class is made up.

import { addDays, worldExams, type CutState, type Day, type ExamChart, type WorldExam } from '@minhajna/core';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, alerts, controls, press, show, texts, unmount, update } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { failed } from '../src/demo/world-session';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import { DirectorThresholds } from '../src/director/DirectorThresholds';
import * as issueSession from '../src/director/issue-session';
import { subjectName } from '../src/extra/extra-rules';
import ar from '../src/text/ar.json';
import * as schoolRooms from '../src/threshold/school-rooms';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.schoolThreshold;
const exams = worldExams(calendar.year, calendar.entries).filter((one) => one.setBy === 'school');
const [earlier, latest] = exams;
const date = addDays(latest.signBy, 1);
const pack = reference.packs.find((one) => one.items.length >= 3)!;
const items = pack.items.map((one) => one.id);

const roomOf = (exam: WorldExam, subject: string): schoolRooms.SchoolRoom => {
  const chart: ExamChart = {
    world: 'made-up-world',
    school: 'made-up-school',
    exam: exam.id,
    subject,
    grade: '1am',
    from: exam.from,
    figuresDay: exam.figuresDay,
    signBy: exam.signBy,
    forecastDay: addDays(exam.from, -1),
    pack: { id: pack.id, release: '1' },
    items,
    setters: [{ assignment: 'made-up-assignment', name: 'Made-up setter', key: 'made-up-key' }],
    classes: [{ name: '1م1', position: items[1], forecast: items[2] }],
  };
  const state: CutState = {
    signed: new Map([['made-up-assignment', items[1]]]),
    days: new Map([['made-up-assignment', exam.figuresDay]]),
    proposed: { item: items[1], by: 'made-up-assignment', day: exam.figuresDay },
    settled: null,
    director: true,
  };
  return { exam, chart, state, epoch: 0, ca: 'made-up-ca' };
};

const page = (on: Day = date) => (
  <DirectorThresholds
    world={{ world: 'made-up-world', date: on, book: {} as never }}
    school={{} as never}
    reference={reference}
    kit={nodeKit}
    dayText={(day: Day) => `day ${day}`}
  />
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(issueSession, 'holdSchool').mockResolvedValue({} as never);
  jest
    .spyOn(schoolRooms, 'readSchoolRooms')
    .mockResolvedValue([roomOf(earlier, 'math'), roomOf(latest, 'math'), roomOf(latest, 'arabic')]);
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('offers the latest exam, adopts the cut proposed once, and says it', async () => {
  let done = () => undefined as void;
  const decide = jest
    .spyOn(schoolRooms, 'decideCut')
    .mockImplementation(() => new Promise((resolve) => (done = () => resolve({} as never))));
  await show(page());
  const chip = (exam: string) => controls(`schoolThreshold-exams-${exam}`)[0]?.props as { selected: boolean };
  const open = controls('schoolThreshold-open').length;
  const shown = texts().filter((line) => line === words.shown).length;
  expect([chip(earlier.id).selected, chip(latest.id).selected, open, shown]).toEqual([false, true, 1, 1]);
  const named = () => controls('schoolThreshold-open').map((one) => (one.props as { name: string }).name);
  expect(named()[0]).toContain(subjectName(reference.profile, 'arabic'));
  await press('schoolThreshold-open');
  expect([texts().some((line) => line.startsWith(words.opened.split('{{')[0])), named()[0]]).toEqual([
    true,
    expect.stringContaining(subjectName(reference.profile, 'math')),
  ]);
  expect(texts()).toContain(words.decideWhy.replace('{{until}}', `day ${addDays(latest.from, -1)}`));
  await press('schoolThreshold-adopt');
  expect([
    texts().includes(words.signing),
    (controls('schoolThreshold-adopt')[0].props as { disabled: boolean }).disabled,
  ]).toEqual([true, true]);
  await press('schoolThreshold-adopt');
  expect(decide).toHaveBeenCalledTimes(1);
  expect(decide.mock.calls[0][3]).toBe(items[1]);
  const reads = jest.mocked(schoolRooms.readSchoolRooms).mock.calls.length;
  await act(() => done());
  const adopted = () => texts().some((line) => line.startsWith(words.adopted.split('{{')[0]));
  expect([jest.mocked(schoolRooms.readSchoolRooms).mock.calls.length, adopted()]).toEqual([reads + 1, true]);
  await update(page(latest.from));
  expect([jest.mocked(schoolRooms.readSchoolRooms).mock.calls.length, adopted()]).toEqual([reads + 2, false]);
  expect([controls('schoolThreshold-adopt').length, controls('schoolThreshold-none').length]).toEqual([0, 0]);
  expect(texts()).toContain(words.lapsed);
});

test('on a phone what is opened, decided or refused is announced', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  jest.spyOn(schoolRooms, 'decideCut').mockRejectedValueOnce(failed('closed', 'E_CUT_CLOSED'));
  await show(page());
  await press('schoolThreshold-open');
  expect(announce).toHaveBeenLastCalledWith(expect.stringContaining(words.opened.split('{{')[0]));
  await press('schoolThreshold-none');
  expect([announce.mock.lastCall?.[0], alerts()]).toEqual([words.closed, [words.closed]]);
  jest.mocked(schoolRooms.decideCut).mockResolvedValueOnce({} as never);
  await press('schoolThreshold-none');
  expect([announce.mock.lastCall?.[0], alerts()]).toEqual([words.noneDone, []]);
});

test('after the year’s last day it says the year has ended', async () => {
  jest.mocked(schoolRooms.readSchoolRooms).mockResolvedValue([]);
  await show(page(addDays(calendar.year.to, 1)));
  expect(texts()).toEqual(expect.arrayContaining([words.ended]));
  expect(texts()).not.toContain(words.none);
});

test('a refusal is said in the director’s words, and the page is the director’s alone', async () => {
  jest.spyOn(schoolRooms, 'decideCut').mockRejectedValue(failed('closed', 'E_CUT_CLOSED'));
  await show(page());
  await press('schoolThreshold-none');
  expect(alerts()).toEqual([words.closed]);
  await press('schoolThreshold-again');
  expect(alerts()).toEqual([]);
  await press('schoolThreshold-none');
  expect(alerts()).toEqual([words.closed]);
  await update(page(addDays(date, 1)));
  expect(alerts()).toEqual([]);
  const props = { open: {}, school: {}, reference: { profile: {} } } as unknown as WorkspacePagesProps;
  expect(workspacePage('director', 'thresholds', props)?.type).toBe(DirectorThresholds);
  expect(workspacePage('teacher' as never, 'thresholds', props)).toBeNull();
});
