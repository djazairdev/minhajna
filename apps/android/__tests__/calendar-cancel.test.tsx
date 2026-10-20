// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eventOf, layerOf } from '@minhajna/core';
import { calendarData } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { CalendarEntry } from '../src/calendar/Entry';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const done = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => done.mockReset());
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test('cancellation previews first, Keep does not write, and confirmation appends one withdrawal', async () => {
  const data = await calendarData();
  const before = [...data.book.entries];
  await showSettingsScreen(<CalendarEntry id="school-1" origin="local" schoolId="s-1" onCancelled={done} />, data);
  await pressSettings('calendar-cancel');
  expect(has('calendar-impact')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.cancelNotice);
  expect(data.book.entries).toEqual(before);
  await pressSettings('calendar-keep');
  expect(has('calendar-impact')).toBe(false);
  expect(data.book.entries).toEqual(before);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(done).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar.some((entry) => entry.id === 'school-1')).toBe(false);
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
  expect(data.book.entries).toHaveLength(before.length + 1);
  expect(eventOf(data.book.entries.at(-1)!)).toEqual({ kind: 'calendar.removed', id: 'school-1', layer: 'school' });
});

test('private cancellation is still private and retains every earlier version', async () => {
  const data = await calendarData();
  const before = [...data.book.entries];
  await showSettingsScreen(<CalendarEntry id="private" origin="local" schoolId="s-1" onCancelled={done} />, data);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(layerOf(eventOf(data.book.entries.at(-1)!)!)).toBe('private');
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
  expect(done).toHaveBeenCalledTimes(1);
});

test('a failed cancellation keeps the entry and allows a retry', async () => {
  const data = await calendarData();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic failure'));
  await showSettingsScreen(<CalendarEntry id="school-1" origin="local" schoolId="s-1" onCancelled={done} />, data);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(done).not.toHaveBeenCalled();
  expect(data.book.state.calendar.some((entry) => entry.id === 'school-1')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.failed);
  await pressSettings('calendar-confirm-cancel');
  expect(done).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar.some((entry) => entry.id === 'school-1')).toBe(false);
});

test.each([
  ['school-1', 'local', 's-2'],
  ['same-id', 'local', 's-1'],
  ['same-id', 'bundled', 's-1'],
  ['removed', 'local', 's-1'],
] as const)(
  'never offers a cancellation for an unavailable or reference entry (%s, %s, %s)',
  async (id, origin, schoolId) => {
    await showSettingsScreen(
      <CalendarEntry id={id} origin={origin} schoolId={schoolId} onCancelled={done} />,
      await calendarData(),
    );
    expect(has('calendar-cancel')).toBe(false);
    expect(done).not.toHaveBeenCalled();
  },
);
