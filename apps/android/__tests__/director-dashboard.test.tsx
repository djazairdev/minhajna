// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's dashboard (#569, answer 591), against a made-up demo server: a
// national world started on a PC opens the director's workspace on the seeded
// school's dashboard, the thresholds first, saying no day is announced, and
// that this device holds no key to read who joined; every class and subject in
// the school's order, in a table on the PC, each not joined with its timetable
// only, its days named, during the trial term end and to join once the world's
// date moves past it; once the seeded key is taken, every seeded teacher reads
// joined with no signed week yet (#548); a level keeps the order, and the
// classes behind count none without figures; each teacher's sessions and cover
// in the staff's order, the staff's order said under them and the classes'
// under the others. Given a joined teacher's figures, the PC's table gives the
// place in the plan, the delay in weeks for a week pack and in sessions
// otherwise, the buffer and the sessions not held apart, each in its column,
// the phone's row the same in one line, the sessions awaiting confirmation in
// their own view, and a vacant post says so. Every world, school and person is
// made up.

import {
  dashboardCourses,
  directorSchool,
  seedNationalWorld,
  STATEMENT_FORMAT,
  type CourseStanding,
  type Day,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { DirectorDashboard } from '../src/director/DirectorDashboard';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const board = text.demo.dashboard;

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
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const rows = () => tree!.root.findAll((node) => /^dashboard-row-/u.test(String(node.props.testID)) && !!node.type);
const shownRows = () => [...new Set(rows().map((node) => String(node.props.testID)))];
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function press(testID: string, value?: unknown) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) {
        const props = tree!.root.findAllByProps({ testID })[0].props as PressableProps & {
          onValueChange?: (on: unknown) => void;
        };
        if (value === undefined) props.onPress?.({} as never);
        else props.onValueChange?.(value);
      }
      await settle();
    });
}

/** A national world started on this PC, its director's workspace open. */
async function director() {
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
  const id = worldNetworkOpen()!;
  const { zones = [], workingDays } = reference.profile;
  return directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
}

test('the director’s workspace opens on the seeded school, every class not joined in the trial', async () => {
  const school = await director();
  expect(tree!.root.findAllByProps({ testID: 'director-dashboard' }).length).toBeGreaterThan(0);
  expect(texts()).toEqual(expect.arrayContaining([board.threshold, board.noThreshold, board.order, board.noKey]));
  const names = school.classes.flatMap((one) => ['arabic', 'math', 'french'].map((subject) => `${one.id}-${subject}`));
  expect(shownRows()).toEqual(names.map((name) => `dashboard-row-${name}`));
  expect(tree!.root.findAll((node) => node.props.role === 'table' && typeof node.type === 'string')).toHaveLength(1);
  const first = school.classes[0];
  const days = [
    ...new Set(
      school.week.filter((one) => one.classId === first.id && one.subject === 'arabic').map((one) => one.weekday),
    ),
  ];
  const named = board.notJoined
    .replace(
      '{{days}}',
      days.map((day) => text.week.days[String(day) as keyof typeof text.week.days]).join(board.listSeparator),
    )
    .replace('{{count}}', '5');
  expect(texts()).toContain(named);
  const prefix = board.notJoined.split('{{days}}')[0];
  expect(texts().filter((one) => one.startsWith(prefix))).toHaveLength(18);
  await press('dashboard-grade-4am');
  expect(shownRows()).toEqual(
    names
      .filter((name) => school.classes.some((one) => one.grade === '4am' && name.startsWith(`${one.id}-`)))
      .map((name) => `dashboard-row-${name}`),
  );
  await press('dashboard-behind', true);
  expect(shownRows()).toEqual([]);
  expect(texts()).toEqual(expect.arrayContaining([board.none, board.behindNote]));
  await press('dashboard-view-sessions');
  const loads = tree!.root.findAll((node) => /^dashboard-load-/u.test(String(node.props.testID)) && !!node.type);
  expect([...new Set(loads.map((node) => String(node.props.testID)))]).toEqual(
    school.teachers.map((one) => `dashboard-load-${one.id}`),
  );
  expect(texts()).toContain(board.load.replace('{{sessions}}', '10').replace('{{cover}}', '0'));
  expect(texts()).toContain(board.orderStaff);
  expect(texts()).not.toContain(board.order);
});

test('once the world’s date moves past the trial term end, each class’s teacher is to join', async () => {
  await director();
  await press('world-page-world');
  await press('world-move-date');
  await press('world-page-dashboard');
  expect(texts()).toContain(board.toJoin);
  expect(texts().some((one) => one.startsWith(board.notJoined.split(' · ')[0]) && one !== board.toJoin)).toBe(false);
});

test('once the seeded key is taken, every seeded teacher reads joined, with no signed week yet', async () => {
  await director();
  for (const one of ['world-page-keys', 'keys-take-seeded', 'world-page-dashboard']) await press(one);
  expect(has('dashboard-note')).toBe(false);
  expect(texts().filter((one) => one === board.noFigures)).toHaveLength(18);
  expect(texts().some((one) => one.startsWith(board.notJoined.split(' · ')[0]))).toBe(false);
});

test('a joined class shows its place, delay, buffer and sessions not held, and awaiting apart', async () => {
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld('ABCDE', zones, workingDays, reference.packs))!;
  const first = school.classes[0];
  const late: CourseStanding = {
    statement: {
      format: STATEMENT_FORMAT,
      version: { major: 1, minor: 0 },
      day: '2026-12-01' as Day,
      class: { level: 'cem', grade: first.grade, section: '1', subject: 'math', year: '2026-2027' },
      pack: { id: 'made-up-pack', release: '2026.1' },
      lastUnit: null,
      lastResource: { id: 'r4', title: 'Made-up resource 4', status: 'done' },
      delay: { sessions: 2, weeks: 1, bufferUsed: 3, bufferLeft: 0 },
      notHeld: { calendar: 1, other: 2 },
      td: { calendar: 0, other: 0 },
    },
    awaiting: 3,
  };
  const vacant = { ...school, teachers: school.teachers.filter((one) => one.subject !== 'french') };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DirectorDashboard
        school={vacant}
        profile={reference.profile}
        when={{ trial: null, date: '2026-12-01' as Day }}
        dayText={(day) => day}
        joined={() => true}
        standing={(classId, subject) => (classId === first.id && subject === 'math' ? late : null)}
      />,
    );
    await settle();
  });
  const weeks = text.classPlan.weeksBehind.replace('{{weeks}}', text.count.weeks_one);
  const cells = (testID: string) =>
    tree!.root
      .findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0]
      .findAll(
        (node) => typeof node.props.role === 'string' && node.props.role !== 'row' && typeof node.type === 'string',
      )
      .map((node) =>
        node
          .findAllByType(Text)
          .map((one) => [(one.props as TextProps).children].flat().map(String).join(''))
          .join(''),
      );
  expect(cells(`dashboard-row-${first.id}-math`).slice(3)).toEqual(['Made-up resource 4', weeks, '3', '1', '2']);
  expect(texts()).toEqual(expect.arrayContaining([board.noFigures, board.vacant, board.noTeacher]));
  const spans = tree!.root.findAll((node) => node.props['aria-colspan'] !== undefined && typeof node.type === 'string');
  expect(spans.length).toBeGreaterThan(0);
  expect(spans.every((node) => node.props['aria-colspan'] === 5)).toBe(true);
  expect(
    dashboardCourses(
      vacant,
      { trial: null, date: '2026-12-01' as Day },
      () => true,
      () => null,
    ),
  ).toHaveLength(18);
  await press('dashboard-behind', true);
  expect(shownRows()).toEqual([`dashboard-row-${first.id}-math`]);
  await press('dashboard-view-awaiting');
  expect(texts()).toContain(board.awaiting.replace('{{count}}', '3'));
  expect(texts()).not.toContain(weeks);
  jest.replaceProperty(Platform, 'OS', 'android');
  await press('dashboard-view-progress');
  const sessions = text.classes.behind.replace('{{sessions}}', text.count.sessions_two);
  const line = (delay: string) =>
    board.standing
      .replace('{{position}}', 'Made-up resource 4')
      .replace('{{delay}}', delay)
      .replace('{{buffer}}', '3')
      .replace('{{calendar}}', '1')
      .replace('{{other}}', '2');
  expect(texts()).toContain(line(weeks));
  expect(tree!.root.findAll((node) => node.props.role === 'table' && typeof node.type === 'string')).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    tree!.update(
      <DirectorDashboard
        school={vacant}
        profile={reference.profile}
        when={{ trial: null, date: '2026-12-01' as Day }}
        dayText={(day) => day}
        joined={() => true}
        standing={(classId, subject) =>
          classId === first.id && subject === 'math'
            ? { ...late, statement: { ...late.statement, delay: { ...late.statement.delay, weeks: null } } }
            : null
        }
      />,
    );
    await settle();
  });
  expect(texts()).toContain(line(sessions));
});
