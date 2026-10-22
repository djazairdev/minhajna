// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary double shift on Week-draw (#230, answer 385): a slot saved
// from Week-slot goes into the same slot of the other half-day for the other
// week, with its activity and room, in place of what that slot held, a new
// session too, and «حذف الخانة» clears both; the
// afternoon gets a fifth slot with the morning's, and the double shift stays
// on while that slot holds something. Made-up data only.

import { LocaleDirContext } from '@react-navigation/native';
import { TextInput, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { i18n } from '../src/text/i18n';
import { WeekDraw } from '../src/week/WeekDraw';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <WeekDraw onDone={jest.fn()} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const state = (id: string): unknown =>
  root().findAll((node) => node.props.testID === id && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState;

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function saved(data: TestData) {
  await press('week-save');
  await settle();
  return data.book.state.timetables.at(-1)!.version;
}

const sunday = async (data: TestData) =>
  (await saved(data)).entries
    .filter((entry) => entry.weekday === 0)
    .map((entry) => [entry.slot.half, entry.slot.index, entry.weeks, entry.activity ?? null, entry.room ?? null]);

test('copies a slot saved from Week-slot into the other half-day for the other week, and removes both', async () => {
  const data = await withPrimary();
  await render(data);
  await press('option-doubleShift');
  await press('draw-0-m3');
  await press('pen-details');
  await press('draw-0-m3');
  await press('slot-0-activity-writing');
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === 'slot-0-room')
        .findByType(TextInput).props as TextInputProps
    ).onChangeText?.('3');
  });
  await press('slot-save');
  expect(await sunday(data)).toEqual([
    ['morning', 3, 'A', 'writing', '3'],
    ['afternoon', 3, 'B', 'writing', '3'],
  ]);
  await press('draw-0-a3');
  await press('slot-remove');
  expect(await sunday(data)).toEqual([]);
});

test('adds a fifth afternoon slot, and keeps the double shift while it holds something', async () => {
  const data = await withPrimary();
  await render(data);
  await press('option-doubleShift');
  expect(exists('draw-0-a5')).toBe(false);
  await press('option-fifthMorning');
  expect(exists('draw-0-a5')).toBe(true);
  await press('draw-0-m5');
  expect(await sunday(data)).toEqual([
    ['morning', 5, 'A', null, null],
    ['afternoon', 5, 'B', null, null],
  ]);
  expect(state('option-doubleShift')).toMatchObject({ disabled: true });
  expect(state('option-fifthMorning')).toMatchObject({ disabled: true });
});

test('gives a session added on Week-slot the slot’s week, and mirrors it', async () => {
  const data = await withPrimary();
  await render(data);
  await press('option-doubleShift');
  await press('pen-details');
  await press('draw-0-a2');
  await press('slot-0-kind-class');
  await press('slot-save');
  expect(await sunday(data)).toEqual([
    ['afternoon', 2, 'B', null, null],
    ['morning', 2, 'A', null, null],
  ]);
});
