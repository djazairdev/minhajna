// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's statement page on the jest server, for its tests (#630, answer
// 725): a world on a day with its school, a timetable naming a class with a
// pack and one named by no class, the page opened on it, and how to read and
// press it. Every pupil, school and world here is made up.

import { directorSchool, parseDay, seedNationalWorld, type DemoSchool, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { WorldStatement } from '../src/school/WorldStatement';
import ar from '../src/text/ar.json';
import { MINE, SUBJECTS, TEACHER } from './term-weeks';
import { BELLS, school as staff, sendParts, server, session, setting } from './timetable-send';
import { nodeKit as kit } from './world-server';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

export const words = ar.demo.statement;
const result = readReference(bundledReference);
if (!result.ok) throw new Error('The bundled reference does not read');
export const read = result;
export const DAY = parseDay('2027-01-12');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/** The page's tree. */
export const shown = () => tree!;

/** Leaves the page and the world, for another in one test. */
export async function leavePage() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await leavePage();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
export const said = () => String(tree!.root.findByProps({ testID: 'world-statement-said' }).props.children);
export const has = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length > 0;

export async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
export const press = (testID: string) =>
  act(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));

/** A world on a day, its school, a timetable naming a class with a pack, and one named by no class. */
export async function statementWorld(date: Day = DAY, parts = true) {
  const { id, here, joined } = await setting();
  const { zones = [], workingDays } = read.profile;
  const school: DemoSchool = directorSchool(seedNationalWorld(id, zones, workingDays, read.packs))!;
  const room = school.classes.find((one) => Object.keys(one.packs).length > 0)!;
  const code = Object.keys(room.packs)[0];
  const subject = SUBJECTS.find((one) => one.code === code)?.name.ar ?? code;
  const sessions = [
    { ...session(TEACHER, 0, 480, room.name), subject },
    { ...session(TEACHER, 1, 540, '9AM9'), subject },
  ];
  if (parts) await sendParts(here, staff, sessions, BELLS);
  server.worlds.get(id)!.date = date;
  return { world: { world: id, date }, school, joined, room, code, subject };
}

type World = Awaited<ReturnType<typeof statementWorld>>;

export async function open(
  { world, joined, school }: World,
  change: { mine?: unknown; school?: unknown; send?: Send; kit?: typeof kit; reference?: typeof read } = {},
) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <WorldStatement
          world={world}
          join={joined}
          kit={change.kit ?? kit}
          send={change.send ?? server.send}
          dayText={(day) => `day ${day}`}
          onClose={() => undefined}
          said={words.title}
          subjects={SUBJECTS}
          mine={'mine' in change ? (change.mine as never) : MINE}
          school={'school' in change ? (change.school as never) : school}
          reference={change.reference ?? read}
        />
      </LocaleDirContext.Provider>,
    );
  });
  await act();
}

export const chipsOf = (prefix: string) => [
  ...new Set(
    tree!.root
      .findAll((node) => String(node.props.testID).startsWith(prefix) && typeof node.type === 'string')
      .map((node) => String(node.props.testID)),
  ),
];
export const lineOf = (id: string) =>
  String(
    tree!.root.findAll((node) => node.props.testID === `statement-${id}` && typeof node.type === 'string')[0].props
      .accessibilityLabel,
  );
