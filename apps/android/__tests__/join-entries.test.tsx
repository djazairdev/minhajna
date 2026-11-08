// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where joining starts (answer 808): Today offers to join the school while
// no class has arrived, and Settings offers each school's update once a
// joining code is kept for it, and its joining before. Made-up schools and
// classes only.

import { keepJoiningCode, parseDay } from '@minhajna/core';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData } from '../jest/app-data';
import { settingsData } from '../jest/settings-data';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { Settings } from '../src/settings/Settings';
import { TodayJoin } from '../src/today/TodayJoin';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const onJoin = jest.fn();
const onOpen = jest.fn();
afterEach(async () => {
  await closeSettingsScreen();
  onJoin.mockReset();
  onOpen.mockReset();
});

async function showCard(data: Awaited<ReturnType<typeof openTestData>>) {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(withData(data, <TodayJoin onJoin={onJoin} />));
  });
  return tree!;
}

test('Today offers to join the school only while no class has arrived', async () => {
  const empty = await showCard(await openTestData());
  const open = empty.root.findAll(
    (one) => one.props.testID === 'today-join-open' && typeof (one.props as PressableProps).onPress === 'function',
    { deep: false },
  )[0];
  await ReactTestRenderer.act(() => {
    (open.props as PressableProps).onPress?.({} as never);
  });
  expect(onJoin).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(() => empty.unmount());
  const taught = await showCard(await settingsData());
  expect(taught.root.findAll((one) => one.props.testID === 'today-join')).toEqual([]);
  await ReactTestRenderer.act(() => taught.unmount());
});

test('Settings offers a school’s update once a joining code is kept for it, and its joining before', async () => {
  const data = await settingsData();
  await data.book.record(parseDay('2026-10-15'), keepJoiningCode('s-2', '7K2M-9Q4R-X8ZT-3HN6'));
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  const shown = (id: string) => settingsRoot().findAll((one) => one.props.testID === id).length > 0;
  expect([shown('settings-school-update-s-1'), shown('settings-school-join-s-2')]).toEqual([false, false]);
  await pressSettings('settings-school-update-s-2');
  expect(onOpen).toHaveBeenLastCalledWith('schoolUpdate', 's-2');
  await pressSettings('settings-school-join-s-1');
  expect(onOpen).toHaveBeenLastCalledWith('schoolJoin', 's-1');
});
