// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each class's week and the A/B weeks' check on the timetable page (#576,
// answer 593), against a made-up demo server: on the PC a template read with
// alternating groups shows the first class's grid as a table, its working days
// as columns, each time as a row header and each session with its week, group,
// subject and teacher, the table named for its class and the days with sessions
// in the morning only named under it, and another class's chip shows that
// class; the check names each group and teacher whose weeks differ, in hours,
// with minutes when there are any, and says the balance counts the sessions
// imported when rows were left out; a timetable whose weeks balance says so,
// and one with no week A or B says it does not alternate. On the phone the week
// is a list by day, a day with no session saying so. Every class and teacher is
// made up.

import { readTimetable, type SchoolCalendar } from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';
import { TimetableImport } from '../src/timetable/TimetableImport';
import { timetableWords } from '../src/timetable/timetable-words';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const workingDays = reference.profile.workingDays;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const tt = text.ttImport;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
  calendarInput.readTable.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const within = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A national world started on this PC, on the director's timetable page, with a template file read. */
async function readFile(file: string) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
    await settle();
  });
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-timetable');
  await press('tt-source-template');
  calendarInput.readTable.mockResolvedValueOnce(file);
  await press('tt-open');
}

const HEAD = 'class,group,subject,teacher,day,start,end,week\n';
const ALTERNATING =
  HEAD +
  '4AM2,,arabic,Teacher A,sunday,8:00,9:00,\n' +
  '4AM2,G1,physics,Teacher B,monday,9:00,11:00,A\n' +
  '4AM2,G2,physics,Teacher B,monday,9:00,11:00,B\n' +
  '4AM3,,math,Teacher C,tuesday,8:00,9:00,\n';

test('the PC shows the first class as a table, another chip shows that class, and uneven weeks are named', async () => {
  await readFile(
    ALTERNATING +
      '4AM3,,math,Teacher C,tuesday,8:00,9:00,\n4AM2,G1,art,Teacher E,monday,14:00,14:30,A\n' +
      '4AM2,,history,Teacher F,sunday,12:00,13:00,\n',
  );
  expect(within('tt-grid-table')).toEqual([
    tt.gridTime,
    ...workingDays.map((day) => text.week.days[String(day) as keyof typeof text.week.days]),
    '08:00–09:00',
    'arabic · Teacher A',
    '09:00–11:00',
    `${tt.weekA} · G1 · physics · Teacher B`,
    `${tt.weekB} · G2 · physics · Teacher B`,
    '12:00–13:00',
    'history · Teacher F',
    '14:00–14:30',
    `${tt.weekA} · G1 · art · Teacher E`,
  ]);
  const table = tree!.root.findAllByProps({ testID: 'tt-grid-table' })[0];
  expect((table.props as { accessibilityLabel: string }).accessibilityLabel).toBe(
    tt.gridOf.replace('{{class}}', '4AM2'),
  );
  expect(texts()).toContain(tt.freeAfternoons.replace('{{days}}', text.week.days['0']));
  await press('tt-grid-class-4AM3');
  expect(within('tt-grid-table')).toContain('math · Teacher C');
  expect(within('tt-grid-table')).not.toContain('arabic · Teacher A');
  const hours = (count: number) => tt.hours.replace('{{hours}}', String(count));
  expect(texts()).toEqual(
    expect.arrayContaining([
      tt.weeksUneven,
      tt.weekRow
        .replace('{{who}}', '4AM2 G1')
        .replace('{{a}}', tt.length.replace('{{hours}}', '4').replace('{{minutes}}', '30'))
        .replace('{{b}}', hours(2)),
      tt.weekRow.replace('{{who}}', '4AM2 G2').replace('{{a}}', hours(2)).replace('{{b}}', hours(4)),
      tt.weeksKept,
    ]),
  );
});

test('weeks that balance say so, and a timetable without week A or B says it does not alternate', async () => {
  await readFile(
    ALTERNATING +
      '4AM2,G1,technology,Teacher D,monday,9:00,11:00,B\n4AM2,G2,technology,Teacher D,monday,9:00,11:00,A\n',
  );
  expect(texts()).toContain(tt.weeksBalanced);
  expect(texts()).not.toContain(tt.weeksKept);
  await press('tt-source-fet');
  await press('tt-source-template');
  calendarInput.readTable.mockResolvedValueOnce(HEAD + '4AM2,,arabic,Teacher A,sunday,8:00,9:00,\n');
  await press('tt-open');
  expect(texts()).toContain(tt.weeksNone);
});

test('the phone lists the week by day, a day with no session saying so', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const result = readTimetable(
    ALTERNATING.split('\n').map((line) => line.split(',')),
    timetableWords(),
  );
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <TimetableImport
        level="cem"
        bells={reference.bells}
        workingDays={workingDays}
        read={{ source: 'template', result }}
        onRead={() => undefined}
      />,
    );
    await settle();
  });
  expect(tree!.root.findAllByProps({ testID: 'tt-grid-table' })).toHaveLength(0);
  expect(within('tt-grid-day-1')).toEqual([
    text.week.days['1'],
    `09:00–11:00 · ${tt.weekA} · G1 · physics · Teacher B`,
    `09:00–11:00 · ${tt.weekB} · G2 · physics · Teacher B`,
  ]);
  expect(within('tt-grid-day-2')).toEqual([text.week.days['2'], tt.dayEmpty]);
});
