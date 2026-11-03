// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's decision on D-Threshold (#603, answer 637), with the rooms
// read and the decision put stood in for: the exams are offered as chips, the
// latest chosen; opening a subject says so; a cut proposed is offered to adopt
// until the day before the exam, a press signing it once, the choices held
// while it signs, then said and the rooms read again; a refusal is said in the
// director's words; and the page is the director's alone. Every world, school,
// setter and class is made up.

import { addDays, worldExams, type CutState, type Day, type ExamChart, type WorldExam } from '@minhajna/core';
import { Platform } from 'react-native';
import { alerts, controls, press, show, texts, unmount } from '../jest/threshold-page';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { failed } from '../src/demo/world-session';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import { DirectorThresholds } from '../src/director/DirectorThresholds';
import * as issueSession from '../src/director/issue-session';
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

const page = () => (
  <DirectorThresholds
    world={{ world: 'made-up-world', date, book: {} as never }}
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
  expect([chip(earlier.id).selected, chip(latest.id).selected, controls('schoolThreshold-open')]).toEqual([
    false,
    true,
    expect.objectContaining({ length: 2 }),
  ]);
  await press('schoolThreshold-open', 1);
  expect(texts().some((line) => line.startsWith(words.opened.split('{{')[0]))).toBe(true);
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
  await press('schoolThreshold-open', 1);
  done();
  await press('schoolThreshold-open', 1);
  expect(jest.mocked(schoolRooms.readSchoolRooms).mock.calls.length).toBe(reads + 1);
  expect(texts().some((line) => line.startsWith(words.adopted.split('{{')[0]))).toBe(true);
});

test('a refusal is said in the director’s words, and the page is the director’s alone', async () => {
  jest.spyOn(schoolRooms, 'decideCut').mockRejectedValue(failed('closed', 'E_CUT_CLOSED'));
  await show(page());
  await press('schoolThreshold-none');
  expect(alerts()).toEqual([words.closed]);
  const props = { open: {}, school: {}, reference: { profile: {} } } as unknown as WorkspacePagesProps;
  expect(workspacePage('director', 'thresholds', props)?.type).toBe(DirectorThresholds);
  expect(workspacePage('teacher' as never, 'thresholds', props)).toBeNull();
});
