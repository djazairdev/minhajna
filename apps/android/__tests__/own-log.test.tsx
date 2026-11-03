// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// My log in a national demo world (#573, answer 603), against a made-up demo
// server: before the director acts it says nothing was done; once the school's
// seeded key is taken on this PC (#548) and codes and a key issued, it lists
// them, dated, each teacher named, the seeding's codes never, so a code that
// replaces a seeded one is new, with the rule and days only; the preparer's
// page on the same device says its actions are not kept yet and shows none of
// the director's; and an issue for no teacher of the staff list names a teacher
// of the school. Every world, school and teacher is made up.

import { directorSchool, seedNationalWorld, type Day, type DemoSchool, type SchoolCalendar } from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { startWorld } from '../src/demo/world-session';
import { personName } from '../src/director/dashboard-text';
import { OwnLog } from '../src/director/OwnLog';
import { holdSchool } from '../src/director/issue-session';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const words = text.demo.ownLog;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

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
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const logRows = () =>
  tree!.root
    .findAll((node) => /^own-log-row-/u.test(String(node.props.testID)) && node.type === Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

async function turns() {
  for (let turn = 0; turn < 20; turn += 1) await ReactTestRenderer.act(async () => void (await settle()));
}

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
}

test('the director’s log lists the key and the codes, and the preparer’s shows none of them', async () => {
  const storage = new FakeStorage();
  await render(
    <DemoRoot
      kit={nodeKit}
      calendar={calendar}
      profile={reference.profile}
      storage={storage.asSpec()}
      world={new FakeWorld(storage).asSpec()}
      send={server.send}
      onBack={() => undefined}
      onLeft={() => undefined}
      reference={reference}
    />,
  );
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-log');
  expect(has('own-log-none')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining([words.none, words.rule, words.days]));
  for (const one of ['world-page-keys', 'keys-take-seeded', 'world-page-codes']) await press(one);
  const id = worldNetworkOpen()!;
  const { zones = [], workingDays } = reference.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const [first, second] = school.teachers;
  await press(`issue-row-${first.id}`);
  await press('issue-new-code');
  await press('issue-cancel');
  await press(`issue-row-${second.id}`);
  await press('issue-key-instead');
  await press('world-page-log');
  const lines = logRows();
  const name = (one: typeof first) => isolate(personName(one));
  expect(lines).toHaveLength(4);
  expect(lines[0].endsWith(` · ${words.line.keyTaken}`)).toBe(true);
  expect(lines[1].endsWith(` · ${words.line.codeReplaced.replace('{{name}}', name(first))}`)).toBe(true);
  expect(lines[2].endsWith(` · ${words.line.codeReplaced.replace('{{name}}', name(first))}`)).toBe(true);
  const key = words.line.keyIssued.replace('{{name}}', name(second)).split('{{number}}');
  expect(lines[3]).toMatch(new RegExp(`· ${key[0]}\\d{4}${key[1]}$`, 'u'));
  expect(lines.every((one) => !/\d{1,2}:\d{2}/u.test(one))).toBe(true);
  await press('world-change-role');
  await press('world-role-preparer');
  await press('world-page-log');
  expect(has('own-log-none')).toBe(true);
  expect(texts()).toContain(words.preparer);
  expect(logRows()).toHaveLength(0);
});

test('an issue for no teacher names a teacher of the school, and a log not worked out says so', async () => {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const book = await openRecordBook(new FakeStorage().asSpec());
  const director = { world: started.keys.world, date: started.date, book };
  const desk = await holdSchool(director, nodeKit, server.send);
  const day = '2026-11-02' as Day;
  const issued = { school: desk.held.school, assignment: 'a1'.repeat(16), issue: 1, epoch: 0 } as const;
  await book.record(day, { kind: 'school.issued', issued: { ...issued, access: 'phone', keyNumber: null } });
  const school = { teachers: [] } as unknown as DemoSchool;
  const teacher = { id: 'teacher-1', name: 'Made Up', latinName: 'Made Up', subject: 'math', classIds: [], sex: 'f' };
  const page = (kit: typeof nodeKit, staff = school) => (
    <OwnLog world={{ book }} school={staff} role="director" kit={kit} dayText={String} />
  );
  await render(page(nodeKit));
  await turns();
  expect(logRows().at(-1)).toBe(`${day} · ${words.line.codeIssued.replace('{{name}}', isolate(words.someone))}`);
  await ReactTestRenderer.act(() => tree?.unmount());
  const failing = { ...nodeKit, mac: () => Promise.reject(new Error('Made up')) };
  await render(page(failing, { teachers: [teacher] } as unknown as DemoSchool));
  await turns();
  expect(has('own-log-failed')).toBe(true);
  expect(texts()).toContain(text.demo.problem.pc.device);
  expect(logRows()).toHaveLength(0);
});
