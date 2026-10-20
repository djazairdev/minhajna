// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import { calendarEntry } from '../jest/calendar-data';
import { closeSettingsScreen, settingsRoot, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { Today } from '../src/today/Today';
import { i18n } from '../src/text/i18n';
import { closureChoices } from '../src/extra/closure-choices';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
afterEach(closeSettingsScreen);

test('Today labels the closed half and keeps the other half available, never saying the whole day is closed', async () => {
  const data = await withDay();
  const version = data.book.state.timetables.at(-1)!.version;
  const day = parseDay('2026-10-15');
  await data.book.recordAll(day, [
    {
      kind: 'timetable.set',
      version: {
        ...version,
        entries: [
          ...version.entries,
          { ...version.entries[0], id: 'afternoon', slot: { half: 'afternoon', index: 1 } },
        ],
      },
    },
    {
      kind: 'calendar.set',
      entry: calendarEntry('morning-only', { layer: 'school', schoolId: 's-1', effect: 'closure', half: 'morning' }),
    },
  ]);
  const before = [...data.book.entries];
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data);
  expect(settingsTexts()).toContain(i18n.t('calendarView.periods.morning'));
  expect(settingsTexts()).not.toContain(i18n.t('daymark.closure'));
  expect(settingsTexts()).toContain(i18n.t('daymark.lost', { count: 3 }));
  expect(
    settingsRoot().findAll((node) => node.props.testID === 'today-c-1/2026-10-15/a1/k-1-w').length,
  ).toBeGreaterThan(0);
  expect(data.book.entries).toEqual(before);
});

test('the make-up editor distinguishes two closures on the same date by their half', async () => {
  const data = await withDay();
  const choices = closureChoices(i18n.t.bind(i18n), data.profile, [
    calendarEntry('am', { half: 'morning' }),
    calendarEntry('pm', { half: 'afternoon' }),
  ]);
  expect(choices[0].label).toContain(i18n.t('calendarView.periods.morning'));
  expect(choices[1].label).toContain(i18n.t('calendarView.periods.afternoon'));
  expect(choices[0].label).not.toBe(choices[1].label);
});
