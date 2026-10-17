// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll call on the seating plan (#41, Roll-seats): the list until a plan
// exists, then the plan; a tap on a seat marks an absence, a second a
// lateness, a third the pupil present again; the pupils without a seat
// marked on rows below; and the same roll call recorded as from the list.
// Made-up pupils only.

import { current, parseDay, type Seat } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Roll } from '../src/roll/Roll';
import { keepMarks } from '../src/roll/roll-rules';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onSeats = jest.fn();
const onDone = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  onSeats.mockReset();
  onDone.mockReset();
  keepMarks(unitKey(1), null);
});

async function roll(data: TestData) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <Roll sessionKey={key(1)} day={'2026-10-15' as never} onDone={onDone} onSeats={onSeats} />,
          '2026-10-15',
        )}
      </LocaleDirContext.Provider>,
    );
  });
}

const node = (id: string) =>
  root().findAll((one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (node(id)?.props as PressableProps).onPress?.({} as never);
  });
};
const exists = (id: string) => root().findAll((one) => one.props.testID === id).length > 0;
const figure = (id: string) =>
  root().findAll((one) => one.props.testID === `roll-stats-${id}`)[0]?.props.accessibilityLabel as string;

async function withPlan(seated: number) {
  const data = await withPupils();
  const seats: Seat[] = Array.from({ length: seated }, (_, index) => ({
    row: Math.floor(index / 6),
    column: index % 6,
    pupilId: `p-${index + 1}`,
  }));
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'seating.set',
    plan: { classId: 'k-1', groupId: 'k-1-w', rows: 8, columns: 6, aisleEvery: 2, seats },
  });
  return data;
}

test('takes the roll on the list until a plan exists, and opens the setup from the plan’s tab', async () => {
  await roll(await withPupils());
  expect(exists('roll-list')).toBe(true);
  await press('roll-view-seats');
  expect(onSeats).toHaveBeenCalledWith('k-1', 'k-1-w');
  expect(exists('roll-list')).toBe(true);
});

test('cycles a seat through absent, late and present, as the list marks them', async () => {
  const data = await withPlan(45);
  await roll(data);
  expect(exists('roll-seats-view')).toBe(true);
  expect(node('roll-seat-0-1')?.props.accessibilityLabel).toBe('الصف 1، المقعد 2: 2 مختلق آية · حضور');
  expect(accessibilityProblems(root())).toEqual([]);
  await press('roll-seat-0-1');
  expect(node('roll-seat-0-1')?.props.accessibilityLabel).toBe('الصف 1، المقعد 2: 2 مختلق آية · غياب');
  expect([figure('present'), figure('absent')]).toEqual([`44 ${text.roll.present}`, `1 ${text.roll.absentStat}`]);
  await press('roll-seat-0-1');
  expect(node('roll-seat-0-1')?.props.accessibilityLabel).toBe('الصف 1، المقعد 2: 2 مختلق آية · تأخر');
  await press('roll-seat-0-1');
  expect(figure('present')).toBe(`45 ${text.roll.present}`);
  await press('roll-seat-1-0');
  await press('roll-seat-1-3');
  await press('roll-seat-1-3');
  await press('roll-view-list');
  expect(exists('roll-list')).toBe(true);
  const toggle = root().findAll(
    (one) => one.props.testID === 'roll-7-absent' && one.props.accessibilityState !== undefined,
  )[0];
  expect(toggle?.props.accessibilityState).toEqual({ checked: true });
  await press('roll-save');
  const taken = current(data.book.state.rollCalls.get(unitKey(1)));
  expect(taken?.absent).toEqual([{ pupilId: 'p-7', justified: false }]);
  expect(taken?.late).toEqual(['p-10']);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('lists the pupils without a seat below the plan, marked on their rows', async () => {
  await roll(await withPlan(40));
  expect(exists('roll-seat-6-4')).toBe(true);
  expect(node('roll-seat-6-4')?.props.accessibilityLabel).toBe(`الصف 7، المقعد 5: ${text.seats.empty}`);
  expect(root().findAll((one) => one.props.children === 'دون مقعد بعد: 5')).not.toHaveLength(0);
  await press('roll-44-absent');
  expect(figure('absent')).toBe(`1 ${text.roll.absentStat}`);
});
