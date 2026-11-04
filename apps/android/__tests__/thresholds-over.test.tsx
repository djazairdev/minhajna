// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The committee's cut on the teacher's list once an exam above the school is
// over (#606, R-3.3-39, R-7.10-04, answer 640), against a made-up demo server:
// a cut with its day and the committee's words unchanged, named by the
// committee's own plan; no cut decided, and none adopted; a national exam's
// committee of five, read beside a directorate's; a moved exam; a subject with
// no plan; no keys, no bundled reference; a problem said with a way to read
// again; and the section's heading once. Every world, school and share is made
// up.

import {
  addDays,
  directorateSpace,
  NATIONAL_COMMITTEE,
  worldExams,
  type Day,
  type ExamChart,
  type PlanPack,
  type WeekRecord,
  type WorldExam,
} from '@minhajna/core';
import { alerts, press, props, quoted, show, texts, textsIn, unmount } from '../jest/threshold-page';
import { server, setting } from '../jest/timetable-send';
import { NATIONAL_SPACE } from '../src/demo/world-calendar-read';
import { calendar, reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { seededWorld } from '../src/director/director-world';
import { leaveWorldNetwork } from '../src/network/world-network';
import { joinedPage } from '../src/school/JoinedPages';
import ar from '../src/text/ar.json';
import { castVote, committeeRooms, putWords } from '../src/threshold/committee-session';
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
const published = ar.demo.published;
const fill = (text: string, values: Record<string, unknown>) =>
  Object.entries(values).reduce((all, [key, value]) => all.replaceAll(`{{${key}}}`, String(value)), text);
const exams = worldExams(calendar.year, calendar.entries);
const mock = exams.find((one) => one.id === 'mock')!;
const bem = exams.find((one) => one.id === 'bem')!;
const pack = reference.packs.find((one) => one.items.length >= 4)!;
const items = pack.items.map((one) => one.id);
const LINE = 'The text from unit 5, the questions up to unit 6.';
const written = (one: Day) => `day ${one}`;

const realOver = ownExamsModule.overExams;

/** The committee's real room of a seeded world's 4th grade Arabic, with its plan. */
const roomOf = (world: string, exam: WorldExam, scope: string) => {
  const { schools } = seededWorld(world, reference);
  const covering = scope === NATIONAL_COMMITTEE ? schools : schools.filter((one) => one.directorateId === scope);
  return committeeRooms({ world, scope }, exam, '4am', covering, reference.packs).find(
    (one) => one.subject === 'arabic',
  )!;
};

/** A joined phone after the exams, listing `shown` as over and `coming` above the school. */
async function listed(shown: readonly WorldExam[], coming: readonly WorldExam[] = []) {
  const { id, joined, held } = await setting();
  const directorate = seededWorld(id, reference).schools[0].directorateId;
  const date = addDays(bem.to, 1);
  const coming0 = (exam: WorldExam) => ({
    exam,
    asOf: exam.figuresDay,
    charts: [
      {
        exam: exam.id,
        from: exam.from,
        figuresDay: exam.figuresDay,
        subject: 'arabic',
        grade: '4am',
        forecastDay: exam.from,
        pack,
        items,
        classes: [{ name: '4M1', position: items[1], forecast: items[2] } as ExamChart['classes'][number]],
      },
    ],
  });
  const of = (exam: WorldExam) => ({ exam, rows: [{ subject: 'arabic', grade: '4am' }] });
  jest.spyOn(ownExamsModule, 'overExams').mockImplementation(() => shown.map(of));
  jest.spyOn(ownExamsModule, 'ownExams').mockImplementation(() => coming.map(coming0) as never);
  const page = {
    ...props({ world: id, date }, joined),
    school: { directorateId: directorate } as never,
    committees: { held, bundled: reference },
    said: '',
    onRoom: jest.fn(),
    onTotals: jest.fn(),
  };
  return { id, held, date, page, directorate };
}

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
  leaveWorldNetwork();
  server.reset();
});

test('a directorate exam’s cut says its day, named by the committee’s plan, and its words unchanged', async () => {
  const { id, held, date, page, directorate } = await listed([mock]);
  const { room, plan } = roomOf(id, mock, directorate);
  await castVote(held, room, 0, room.items[1], mock.figuresDay, nodeKit, server.send);
  await castVote(held, room, 2, room.items[1], mock.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  let card = textsIn('thresholds-over');
  expect(card).toContain(list.level.directorate);
  const cut = fill(words.cut, { item: quoted(plan.items[1].title), day: written(mock.figuresDay) });
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
  const { id, held, page, directorate } = await listed([mock]);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(published.noneAdopted);
  expect(textsIn('thresholds-over')).not.toContain(committee.words.title);
  await unmount();
  const { room } = roomOf(id, mock, directorate);
  await castVote(held, room, 0, null, mock.figuresDay, nodeKit, server.send);
  await castVote(held, room, 1, null, mock.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(fill(published.noCut, { day: written(mock.figuresDay) }));
  expect(textsIn('thresholds-over')).not.toContain(committee.words.title);
});

test('a national exam reads the national committee of five', async () => {
  const { id, held, page } = await listed([bem]);
  const { room, plan } = roomOf(id, bem, NATIONAL_COMMITTEE);
  await castVote(held, room, 0, room.items[2], bem.figuresDay, nodeKit, server.send);
  await castVote(held, room, 1, room.items[2], bem.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  expect(textsIn('thresholds-over')).toContain(published.noneAdopted);
  await unmount();
  await castVote(held, room, 2, room.items[2], bem.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  const card = textsIn('thresholds-over');
  expect(card).toContain(list.level.national);
  expect(card).toContain(fill(words.cut, { item: quoted(plan.items[2].title), day: written(bem.figuresDay) }));
});

test('the cut is named by its committee’s own plan, the directorate’s or the nation’s', () => {
  const world = 'K7QF4';
  const [first, second] = reference.packs.filter((one) => one.items.length > 0);
  const form = (id: string, one: PlanPack) => ({
    id,
    grade: '4am',
    name: id,
    pupils: [],
    packs: { arabic: { id: one.id, release: one.release } },
  });
  const schools = [
    { directorateId: 'dir-1', classes: [form('a', first)] },
    { directorateId: 'dir-2', classes: [form('b', second), form('c', second)] },
  ];
  const rows = [{ subject: 'arabic', grade: '4am' }];
  const [own] = overCuts(world, [{ exam: mock, rows }], 'dir-1', schools, reference.packs);
  expect(own.plan.pack).toBe(first);
  expect(own.room.name.scope).toBe('dir-1');
  expect(own.room.items).toEqual(first.items.map((one) => one.id));
  const [national] = overCuts(world, [{ exam: bem, rows }], 'dir-1', schools, reference.packs);
  expect(national.plan.pack).toBe(second);
  expect(national.room.name.scope).toBe(NATIONAL_COMMITTEE);
  const [none] = overCuts(world, [{ exam: mock, rows }], 'dir-1', [], reference.packs);
  expect(none.room.items).toEqual([]);
});

test('a subject no committee has a plan for says that none was adopted', async () => {
  const { page } = await listed([mock]);
  const rows = [{ subject: 'made-up-subject', grade: '4am' }];
  jest.spyOn(ownExamsModule, 'overExams').mockImplementation(() => [{ exam: mock, rows }]);
  await show(<ExamThresholds {...page} />);
  expect(alerts().length).toBe(0);
  expect(textsIn('thresholds-over')).toContain(published.noneAdopted);
});

test('the joined pages list what the real over list gives, on the classes and subjects signed', async () => {
  const { id, held, date, page } = await listed([mock]);
  const weeks = [
    { class: '4AM1', totals: { subject: 'arabic' } },
    { class: '1AM1', totals: { subject: 'french' } },
  ] as unknown as WeekRecord[];
  const form = (name: string, grade: string) => ({ name, grade });
  const school = { classes: [form('4AM1', '4am'), form('1AM1', '1am')] } as never;
  jest.spyOn(ownExamsModule, 'overExams').mockImplementation((_w, _s, one, on) => realOver(weeks, school, one, on));
  expect(realOver(weeks, school, reference, date).map((one) => [one.exam.id, one.rows])).toEqual([
    ['mock', [{ subject: 'arabic', grade: '4am' }]],
    ['bem', [{ subject: 'arabic', grade: '4am' }]],
  ]);
  const { room } = roomOf(id, bem, NATIONAL_COMMITTEE);
  for (const place of [0, 1, 2]) await castVote(held, room, place, null, bem.figuresDay, nodeKit, server.send);
  const base = { ...page, year: '2026-2027', dates: null, onJoin: () => undefined, onPage: jest.fn() };
  await show(joinedPage({ page: 'thresholds', join: page.join }, base)!);
  const all = texts();
  expect(all).toContain(list.level.directorate);
  expect(all).toContain(list.level.national);
  expect(all).toContain(fill(published.noCut, { day: written(bem.figuresDay) }));
});

test('a directorate’s exam and a national one are read together, each from its own committee', async () => {
  const { id, held, page, directorate } = await listed([mock, bem]);
  const own = roomOf(id, mock, directorate);
  const nation = roomOf(id, bem, NATIONAL_COMMITTEE);
  await castVote(held, own.room, 0, own.room.items[1], mock.figuresDay, nodeKit, server.send);
  await castVote(held, own.room, 1, own.room.items[1], mock.figuresDay, nodeKit, server.send);
  for (const place of [0, 1, 2])
    await castVote(held, nation.room, place, nation.room.items[2], bem.figuresDay, nodeKit, server.send);
  await show(<ExamThresholds {...page} />);
  const all = texts();
  expect(alerts().length).toBe(0);
  expect(all).toContain(fill(words.cut, { item: quoted(own.plan.items[1].title), day: written(mock.figuresDay) }));
  expect(all).toContain(fill(words.cut, { item: quoted(nation.plan.items[2].title), day: written(bem.figuresDay) }));
});

test('a moved exam says its dates and why, without what only matters before it', async () => {
  const entries = calendar.entries.map((one) =>
    one.effect === 'exam' && one.term === 3 && one.zone === undefined
      ? {
          ...one,
          from: addDays(one.from, 7),
          to: addDays(one.to, 7),
          moved: { from: one.from, to: one.to, reason: 'A made-up reason' },
        }
      : one,
  );
  const moved = worldExams(calendar.year, entries).find((one) => one.id === 'mock')!;
  const { page } = await listed([moved]);
  const made = { ...reference, calendar: { ...calendar, entries } };
  await show(<ExamThresholds {...page} reference={made} updates={[]} />);
  const card = textsIn('thresholds-over');
  expect(card.some((text) => text.includes('A made-up reason'))).toBe(true);
  expect(card.some((text) => text.includes(written(mock.from)) && text.includes(written(moved.from)))).toBe(true);
  expect(card).not.toContain(list.movedCalendar);
  expect(card).not.toContain(list.movedFigures);
});

test('without the keys it says so once, and without the reference it lists none', async () => {
  const { page } = await listed([mock, bem]);
  await show(<ExamThresholds {...page} committees={{ held: null, bundled: reference }} />);
  expect(texts().filter((text) => text === committee.keys).length).toBe(1);
  expect(textsIn('thresholds-over')).toContain(list.level.directorate);
  await unmount();
  await show(<ExamThresholds {...page} committees={{ held: page.committees.held }} />);
  expect(texts()).not.toContain(list.level.directorate);
  expect(texts()).not.toContain(published.noneAdopted);
});

test('a problem reading is said, with a way to read again', async () => {
  const { id, page, directorate } = await listed([mock, bem]);
  const space = await directorateSpace(id, directorate, nodeKit.mac);
  let broken = true;
  const send: Send = (request) =>
    broken && (request.path.includes(space) || request.path.includes(NATIONAL_SPACE))
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : server.send(request);
  await show(<ExamThresholds {...page} send={send} />);
  expect(alerts().length).toBe(1);
  broken = false;
  await press('thresholds-over-again');
  expect(alerts().length).toBe(0);
  expect(textsIn('thresholds-over')).toContain(published.noneAdopted);
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
