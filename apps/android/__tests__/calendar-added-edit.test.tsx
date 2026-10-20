// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { calendarEntry } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsInput,
  settingsRoot,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { AddSessions } from '../src/extra/AddSessions';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});
const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;

test.each(['make-up', 'support', 'revision'] as const)(
  'edits an existing %s day without an own-entry clash, waits and keeps its ID',
  async (adds) => {
    const data = await withDay();
    const entry = calendarEntry('own-day', {
      layer: 'school',
      schoolId: 's-1',
      from: parseDay('2026-10-16'),
      to: parseDay('2026-10-16'),
      effect: 'adds-sessions',
      adds,
      follows: 4,
      takes: ['c-1/m1/k-1-w/every'],
    });
    await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry });
    const before = [...data.book.entries];
    let finish = () => undefined as void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const original = data.book.record.bind(data.book);
    const write = jest.spyOn(data.book, 'record').mockImplementation(async (day, event) => {
      await pending;
      return original(day, event);
    });
    const onDone = jest.fn();
    await showSettingsScreen(<AddSessions entryId={entry.id} schoolId="s-1" onDone={onDone} />, data);
    expect(settingsRoot().findAll((node) => node.props.testID === 'add-clash')).toEqual([]);
    expect(settingsInput('add-source').value).toBe(entry.source);
    await typeSettings('add-source', 'تصحيح تجريبي');
    await ReactTestRenderer.act(() => {
      void settingsControl('add-save').onPress?.({} as never);
      void settingsControl('add-save').onPress?.({} as never);
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(settingsControl('add-save').disabled).toBe(true);
    await ReactTestRenderer.act(async () => {
      finish();
      await pending;
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(data.book.state.calendar).toEqual([{ ...entry, source: 'تصحيح تجريبي' }]);
    expect(data.book.entries.slice(0, before.length)).toEqual(before);
  },
);

test('opens the added-day editor through the calendar and returns to the same saved entry after an edit', async () => {
  const data = await withDay();
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await pressSettings('settings-calendar');
  await pressSettings('calendar-add');
  await pressSettings('calendar-kind-added-day');
  await pressSettings('calendar-add-sessions');
  expect(header().route.name).toBe('AddSessions');
  await pressSettings('add-follows-4');
  await pressSettings('add-save');
  expect(header().route.name).toBe('CalendarEntry');
  const id = data.book.state.calendar[0].id;
  expect(header().route.params).toEqual({ id, origin: 'local', schoolId: 's-1' });
  await pressSettings('calendar-edit');
  expect(header().route.name).toBe('CalendarEdit');
  await typeSettings('add-source', 'إعلان تعويض تجريبي مصحّح');
  await pressSettings('add-save');
  expect(header().route.name).toBe('CalendarEntry');
  expect(data.book.state.calendar).toHaveLength(1);
  expect(data.book.state.calendar[0].id).toBe(id);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(header().route.name).toBe('Calendar');
});
