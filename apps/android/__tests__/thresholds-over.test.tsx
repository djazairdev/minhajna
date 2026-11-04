// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The committee's cut on the teacher's list once an exam above the school is
// over (#606, R-3.3-39, R-7.10-04, answer 640), against a made-up demo server:
// a cut with its day and the committee's words unchanged, named by the
// committee's own plan where the teacher's differs; no cut decided, and none
// adopted; a national exam's committee of five; no keys, no bundled reference;
// a problem said with a way to read again; and the section's heading once.
// Every world, school and share is made up.

import {
  addDays,
  directorateSpace,
  NATIONAL_COMMITTEE,
  worldExams,
  type Day,
  type ExamChart,
  type WorldExam,
} from '@minhajna/core';
import { Platform } from 'react-native';
import { alerts, controls, press, props, quoted, show, texts, textsIn, unmount } from '../jest/threshold-page';
import { server, setting } from '../jest/timetable-send';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { castVote, committeePlan, putWords, type CommitteeRoom } from '../src/threshold/committee-session';
import { ExamThresholds } from '../src/threshold/ExamThresholds';
import { overCuts } from '../src/threshold/over-cuts';
import * as ownExamsModule from '../src/threshold/own-exams';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.thresholds.over;
const list = ar.demo.thresholds;
const committee = ar.demo.committee;
const fill = (text: string, values: Record<string, unknown>) =>
  Object.entries(values).reduce((all, [key, value]) => all.replaceAll(`{{${key}}}`, String(value)), text);
const SCOPE = 'dir-1';
const exams = worldExams(calendar.year, calendar.entries);
const mock = exams.find((one) => one.id === 'mock')!;
const bem = exams.find((one) => one.id === 'bem')!;
const pack = reference.packs.find((one) => one.items.length >= 4)!;
const items = pack.items.map((one) => one.id);
const LINE = 'The text from unit 5, the questions up to unit 6.';
const written = (one: Day) => `day ${one}`;

const roomOf = (world: string, exam: WorldExam, scope: string, subject = 'math'): CommitteeRoom => ({
  name: { world, scope, exam: exam.id, subject, grade: '4am' },
  items,
  days: { from: exam.figuresDay, to: exam.signBy },
  lastDay: exam.to,
});

/** A joined phone after the exams, listing `shown` as over and `coming` above the school. */
async function listed(shown: readonly WorldExam[], coming: readonly WorldExam[] = []) {
  const { id, joined, held } = await setting();
  const date = addDays(bem.to, 1);
  const chartOf = (exam: WorldExam) => ({
    exam: exam.id,
    from: exam.from,
    figuresDay: exam.figuresDay,
    subject: 'math',
    grade: '4am',
    forecastDay: exam.from,
    pack,
    items,
    classes: [{ name: '4M1', position: items[1], forecast: items[2] } as ExamChart['classes'][number]],
  });
  const of = (exam: WorldExam) => ({ exam, asOf: exam.figuresDay, charts: [chartOf(exam)] });
  jest.spyOn(ownExamsModule, 'overExams').mockImplementation(() => shown.map(of) as never);
  jest.spyOn(ownExamsModule, 'ownExams').mockImplementation(() => coming.map(of) as never);
  const page = {
    ...props({ world: id, date }, joined),
    school: { directorateId: SCOPE } as never,
    above: { held, bundled: reference },
    said: '',
    onRoom: jest.fn(),
    onTotals: jest.fn(),
  };
  return { id, held, date, page };
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
});

test('a directorate exam’s cut says its day and the committee’s words unchanged', async () => {
  const { id, held, date, page } = await listed([mock]);
  const room = roomOf(id, mock, SCOPE);
  await castVote(held, room, 0, items[1], mock.figuresDay, nodeKit, server.send);
  await castVote(held, room, 2, items[1], mock.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  let card = textsIn('thresholds-over');
  expect(card).toContain(list.level.directorate);
  const cut = fill(words.cut, { item: quoted(pack.items[1].title), day: written(mock.figuresDay) });
  expect(card).toContain(cut);
  expect(card).toContain(committee.words.none);
  await unmount();
  await putWords(held, room, 0, LINE, date, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  card = textsIn('thresholds-over');
  expect(card).toContain(cut);
  expect(card).toContain(LINE);
  expect(card).not.toContain(committee.words.none);
});

test('a committee that decided no cut says so, and one that adopted none that the paper was as usual', async () => {
  const { id, held, page } = await listed([mock]);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(words.none);
  expect(textsIn('thresholds-over')).not.toContain(committee.words.title);
  await unmount();
  const room = roomOf(id, mock, SCOPE);
  await castVote(held, room, 0, null, mock.figuresDay, nodeKit, server.send);
  await castVote(held, room, 1, null, mock.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(fill(words.noCut, { day: written(mock.figuresDay) }));
  expect(textsIn('thresholds-over')).not.toContain(committee.words.title);
});

test('a national exam reads the national committee of five', async () => {
  const { id, held, page } = await listed([bem]);
  const room = roomOf(id, bem, NATIONAL_COMMITTEE);
  await castVote(held, room, 0, items[2], bem.figuresDay, nodeKit, server.send);
  await castVote(held, room, 1, items[2], bem.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(words.none);
  await unmount();
  await castVote(held, room, 2, items[2], bem.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  const card = textsIn('thresholds-over');
  expect(card).toContain(list.level.national);
  expect(card).toContain(fill(words.cut, { item: quoted(pack.items[2].title), day: written(bem.figuresDay) }));
});

test('the cut is named by the committee’s plan, where the seeded schools pin one', () => {
  const world = 'K7QF4';
  const { schools } = seededWorld(world, reference);
  const plan = committeePlan(schools, reference.packs, '4am', 'arabic')!;
  const directorate = schools[0].directorateId;
  const chart = { subject: 'arabic', grade: '4am', pack: { id: 'other', release: '1' }, items: ['other-1'] };
  const over = [{ exam: mock, asOf: mock.figuresDay, charts: [chart] }] as unknown as Parameters<typeof overCuts>[1];
  const [cut] = overCuts(world, over, directorate, schools, reference.packs);
  expect(cut.plan.pack).toBe(plan);
  expect(cut.room.items).toEqual(plan.items.map((one) => one.id));
  expect(cut.room.name.scope).toBe(directorate);
  expect(cut.room.lastDay).toBe(mock.to);
  const [national] = overCuts(world, [{ ...over[0], exam: bem }] directorate, schools, reference.packs);
  expect(national.room.name.scope).toBe(NATIONAL_COMMITTEE);
  const [own] = overCuts(world, over, directorate, [], reference.packs);
  expect(own.plan).toBe(chart);
  expect(own.room.items).toEqual(['other-1']);
});

test('without the keys it says so, and without the reference it lists none', async () => {
  const { page } = await listed([mock]);
  await show(<ExamThresholds {...page} above={{ held: null, bundled: reference }} />);
  expect(textsIn('thresholds-over')).toContain(words.keys);
  await unmount();
  await show(<ExamThresholds {...page} above={undefined} />);
  expect(controls('thresholds-over-again').length).toBe(0);
  expect(texts()).not.toContain(words.keys);
  expect(texts()).not.toContain(words.none);
});

test('a problem reading is said, with a way to read again', async () => {
  const { id, page } = await listed([mock]);
  const space = await directorateSpace(id, SCOPE, nodeKit.mac);
  let broken = true;
  const send: Send = (request) =>
    broken && request.path.includes(space)
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : server.send(request);
  await show(<ExamThresholds {...page} send={send} />);
  expect(alerts().length).toBe(1);
  broken = false;
  await press('thresholds-over-again');
  expect(alerts().length).toBe(0);
  expect(textsIn('thresholds-over')).toContain(words.none);
});

test('the section’s heading shows once, whether or not an exam above is still coming', async () => {
  const heading = () => texts().filter((text) => text === list.above).length;
  const first = await listed([mock]);
  await show(<ExamThresholds {...first.page} />);
  expect(heading()).toBe(1);
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
  const second = await listed([mock], [bem]);
  await show(<ExamThresholds {...second.page} />);
  expect(heading()).toBe(1);
});
