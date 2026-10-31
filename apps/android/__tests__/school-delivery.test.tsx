// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's term report (#589, answer 617), on the made-up term of
// term-weeks.ts with teacher-1 holding 1م2 and 1م3 and their two weeks of 1م2
// signed: the running term counts to the world's date, the course's row says
// five confirmed, three as planned, one not held for the calendar (Yennayer)
// and one for another cause, never the awaiting count, and opens its teacher,
// its lost sessions with the calendar's entry, the make-ups line and its two
// signed weeks, its test ID one line; a course of another level comes under its
// own chip, and the term before, which closed on its last day, has no row; the
// rows keep the records' order of classes, subjects and teachers, two teachers'
// courses of one class and subject are named by their teachers, the level chips
// come in order of their numbers with other classes last, and a secondary
// school's chips say so; the bells passed split the day, so an afternoon
// closure takes a session they put in the afternoon; a problem reading is
// shown, said in the live region and read again once however quickly pressed
// twice; the terms begun, the one shown first and a class's level; the page is
// the director's alone; and its words read in every language. Every school,
// class and teacher is made up.

import { parseDay, type CalendarEntry, type DemoSchool, type TimetablePart } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FIRST, MINE, SECOND, sign, signedTerm, TEACHER } from '../jest/term-weeks';
import { BELLS, school, sendParts, server, session, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { workspacePage, type WorkspacePagesProps } from '../src/demo/WorkspacePages';
import * as deliverySession from '../src/director/delivery-session';
import { levelOf, readDelivery, termFirst, termReport, termsBegun } from '../src/director/delivery-session';
import type { CourseRecord } from '../src/director/records-session';
import { SchoolDelivery } from '../src/director/SchoolDelivery';
import { leaveWorldNetwork } from '../src/network/world-network';
import { localized } from '../src/setup/names';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.delivery;
const STAFFED = { ...school, teachers: STAFF, level: 'cem' } as unknown as DemoSchool;
const YEAR = MINE.calendar.year;
const TERM = termFirst(termsBegun(YEAR, SECOND), SECOND)!;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 80; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const control = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && node.props.label !== undefined)[0];
const press = (testID: string) => act(() => (control(testID).props as PressableProps).onPress?.({} as never));
const rows = () => tree!.root.findAll((node) => node.props.testID === 'delivery-row' && typeof node.type === 'string');
const opens = () =>
  tree!.root
    .findAll((node) => String(node.props.testID).startsWith('delivery-open-') && node.props.label !== undefined)
    .map((node) => node.props as { testID: string; label: string });
const named = (of: string, subject = 'رياضيات') => `${isolate(of)} · ${isolate(subject)}`;

type World = Awaited<ReturnType<typeof signedTerm>>['here'] & { world: string };

function render(world: World, send = server.send, at: DemoSchool = STAFFED) {
  return act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolDelivery
          world={world}
          school={at}
          year={YEAR}
          mine={MINE}
          bells={[]}
          kit={kit}
          send={send}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

/** A course record moved to another class, subject or teacher, its weeks with it. */
const moved = (course: CourseRecord, change: { course?: string; class?: string; subject?: string }, key: string) => ({
  ...course,
  ...change,
  key,
  weeks: course.weeks.map((each) => ({ ...each, week: { ...each.week, ...change } })),
});

test('the term’s report counts each course from its signed weeks and opens its sessions not held', async () => {
  const { id, here } = await signedTerm();
  await render({ ...here, world: id, date: SECOND });
  const figures = words.figures
    .replace('{{confirmed}}', '5')
    .replace('{{held}}', '3')
    .replace('{{calendar}}', '1')
    .replace('{{other}}', '1');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.title.replace('{{number}}', String(TERM.number)),
      words.soFar.replace('{{day}}', `day ${SECOND}`),
      figures,
      words.foot.classes,
      words.foot.never,
      words.foot.print,
    ]),
  );
  expect([rows().length, opens().map((one) => one.label)]).toEqual([1, [named('1م2')]]);
  await press(opens()[0].testID);
  const yennayer = MINE.calendar.entries.find((one) => one.id === 'yennayer')!;
  expect(texts()).toEqual(
    expect.arrayContaining([
      isolate(STAFF[0].name),
      ar.demo.mine.counts.held.replace('{{count}}', '3'),
      words.makeUps,
      words.weeks_two.replace('{{day}}', 'day 2027-01-10'),
      ar.demo.report.lostOther.replace('{{session}}', 'day 2027-01-04 · 08:00–09:00'),
      ar.demo.report.lostCalendar
        .replace('{{session}}', `day ${SECOND} · 08:00–09:00`)
        .replace('{{entry}}', localized(yennayer.name)),
    ]),
  );
  const awaiting = ar.demo.mine.counts.awaiting.split('{{')[0];
  expect(texts().filter((one) => one.includes(awaiting))).toEqual([]);
  expect(opens()[0].testID).not.toContain('\n');
});

test('a term that ended says it closed, and another level’s classes come under their own chip', async () => {
  const { id, here, joined } = await signedTerm();
  const theirs = [0, 1, 2].map((day) => session(TEACHER, day as 0 | 1 | 2, 480));
  await sendParts(here, school, [...theirs, session(TEACHER, 0, 540, '1م3'), session(TEACHER, 1, 600, '2م1')], BELLS);
  await sign({ world: id, date: SECOND }, joined, { 1: 'held' }, '2م1', 600);
  await render({ ...here, world: id, date: SECOND });
  expect(rows()).toHaveLength(1);
  await press('delivery-level-2');
  expect([texts().includes(words.level.cem.replace('{{level}}', '2')), opens().map((one) => one.label)]).toEqual([
    true,
    [named('2م1')],
  ]);
  const [before] = termsBegun(YEAR, SECOND);
  await press(`delivery-term-${before.number}`);
  expect(texts()).toEqual(expect.arrayContaining([words.closed.replace('{{day}}', `day ${before.to}`), words.none]));
});

test('rows keep the records’ order, a shared course names its teachers, and levels come in order', async () => {
  const { id, here } = await signedTerm();
  const world = { ...here, world: id, date: SECOND };
  const desk = await readDelivery(world, STAFFED, kit, server.send);
  const [record] = desk.records;
  const [mine] = record.courses;
  const theirs = { ...mine, key: `teacher-4\n${mine.course}`, teacher: STAFF[3].name };
  const physics = moved(mine, { course: 'made-up-physics', subject: 'فيزياء' }, 'teacher-1\nmade-up-physics');
  const second = moved(mine, { course: 'made-up-2', class: '2م1' }, 'teacher-1\nmade-up-2');
  const unnumbered = moved(mine, { course: 'made-up-m', class: 'م1' }, 'teacher-1\nmade-up-m');
  const records = [
    { class: 'م1', courses: [unnumbered] },
    { class: '2م1', courses: [second] },
    { ...record, courses: [mine, theirs, physics] },
  ];
  const shown = termReport({ ...desk, records }, MINE, TERM, SECOND, []);
  expect(shown.map((one) => [one.class, one.subject, one.teacher])).toEqual([
    ['م1', 'رياضيات', STAFF[0].name],
    ['2م1', 'رياضيات', STAFF[0].name],
    ['1م2', 'رياضيات', STAFF[0].name],
    ['1م2', 'رياضيات', STAFF[3].name],
    ['1م2', 'فيزياء', STAFF[0].name],
  ]);
  jest.spyOn(deliverySession, 'readDelivery').mockResolvedValue({ ...desk, records });
  await render(world);
  const chips = ['1', '2'].map((one) => words.level.cem.replace('{{level}}', one)).concat(words.otherLevel);
  expect(texts().filter((one) => chips.includes(one))).toEqual(chips);
  expect(opens().map((one) => one.label)).toEqual([
    `${named('1م2')} · ${isolate(STAFF[0].name)}`,
    `${named('1م2')} · ${isolate(STAFF[3].name)}`,
    named('1م2', 'فيزياء'),
  ]);
  await press('delivery-level-other');
  expect(opens().map((one) => one.label)).toEqual([named('م1')]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(world, server.send, { ...STAFFED, level: 'lycee' });
  expect(texts()).toContain(words.level.lycee.replace('{{level}}', '1'));
});

test('the bells split the day, so an afternoon closure takes a session they put there', async () => {
  const { id, here } = await signedTerm();
  const desk = await readDelivery({ ...here, world: id, date: SECOND }, STAFFED, kit, server.send);
  const closure: CalendarEntry = {
    id: 'made-up-afternoon',
    layer: 'national',
    from: parseDay('2027-01-04'),
    to: parseDay('2027-01-04'),
    effect: 'closure',
    half: 'afternoon',
    name: { en: 'made-up-afternoon' },
    source: 'Made-up calendar',
    confidence: 'announced',
  };
  const closed = { ...MINE, calendar: { ...MINE.calendar, entries: [...MINE.calendar.entries, closure] } };
  const count = (bells: TimetablePart['bells']) =>
    termReport(desk, closed, TERM, SECOND, bells).map((one) => [one.calendar, one.other]);
  const early = [
    [360, 420],
    [480, 540],
  ] as unknown as TimetablePart['bells'];
  expect([count([]), count(early)]).toEqual([[[1, 1]], [[2, 0]]]);
});

test('a problem reading is shown, said in the live region and read again once however quickly pressed', async () => {
  const { id, here } = await signedTerm();
  let down = true;
  const send: typeof server.send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render({ ...here, world: id, date: SECOND }, send);
  const said = tree!.root.findAll((node) => node.props.testID === 'delivery-said' && node.type === Text);
  expect(said.map((node) => (node.props as TextProps).children)).toEqual([ar.demo.problem.other]);
  down = false;
  const reads = jest.spyOn(deliverySession, 'readDelivery');
  const again = (control('delivery-again').props as PressableProps).onPress!;
  await act(() => {
    again({} as never);
    again({} as never);
  });
  expect([reads.mock.calls.length, rows().length, texts().includes(ar.demo.problem.other)]).toEqual([1, 1, false]);
});

test('terms begun, the one shown first, and a class’s level', () => {
  const [first, second] = YEAR.terms;
  expect(termsBegun(YEAR, first.from)).toEqual([first]);
  expect(termFirst([first, second], second.from)).toEqual(second);
  expect(termFirst([first], second.from)).toEqual(first);
  expect(termFirst([], FIRST)).toBeNull();
  expect([levelOf('4م1'), levelOf(' 12 A'), levelOf('م1')]).toEqual([4, 12, null]);
});

test('the report is the director’s page alone, and its words read in every language', () => {
  const props = { open: {}, school: STAFFED, reference: { profile: {}, bells: { templates: [] } }, year: YEAR };
  const page = workspacePage('director', 'delivery', props as unknown as WorkspacePagesProps);
  expect(page?.type).toBe(SchoolDelivery);
  expect(workspacePage('preparer', 'delivery', props as unknown as WorkspacePagesProps)).toBeNull();
  const keys = (one: object) =>
    Object.keys(one)
      .filter((key) => !key.startsWith('weeks_'))
      .sort();
  for (const catalogue of [fr, en]) {
    expect(keys(catalogue.demo.delivery)).toEqual(keys(words));
    for (const part of ['foot', 'level'] as const)
      expect(keys(catalogue.demo.delivery[part])).toEqual(keys(words[part]));
  }
});
