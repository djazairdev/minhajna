// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarData, calendarEntry } from '../jest/calendar-data';
import { openTestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { Calendar } from '../src/calendar/Calendar';
import { CalendarEntry } from '../src/calendar/Entry';
import { calendarStyles } from '../src/calendar/styles';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const onEntry = jest.fn();
const visible = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  missingKeys.length = 0;
  onEntry.mockReset();
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'names controls and dates without truncation ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await calendarData();
    const before = [...data.book.entries];
    await showSettingsScreen(<Calendar onEntry={onEntry} />, data, language);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(settingsTexts()).toContain(data.calendar[0].name[language]);
    expect(missingKeys).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    const day = settingsRoot()
      .findAllByType(View)
      .find((node) => node.props.testID === 'calendar-day-2026-10-15')!;
    expect(day.props.accessibilityLabel).toContain('15/10/2026');
    expect(day.props.accessibilityLabel).toContain(catalogues[language].navigation.today);
    expect(day.props.accessibilityLabel).not.toMatch(/[٠-٩]/);
    expect(StyleSheet.flatten(day.props.style as StyleProp<ViewStyle>)?.borderWidth).toBe(2);
    expect(data.book.entries).toEqual(before);
  },
);

test('filters layers and schools without altering records or leaking another school’s entries', async () => {
  const data = await calendarData();
  const before = [...data.book.entries];
  await showSettingsScreen(<Calendar onEntry={onEntry} />, data);
  expect(visible('calendar-entry-local-school-1')).toBe(true);
  expect(visible('calendar-entry-local-school-2')).toBe(false);
  await pressSettings('calendar-layer-teacher');
  expect(settingsControl('calendar-layer-teacher').accessibilityState?.checked).toBe(true);
  expect(visible('calendar-entry-local-private')).toBe(true);
  expect(visible('calendar-entry-local-school-1')).toBe(false);
  await pressSettings('calendar-layer-zone');
  expect(visible('calendar-entry-bundled-zone-16')).toBe(true);
  await pressSettings('calendar-school-s-2');
  expect(visible('calendar-entry-bundled-zone-16')).toBe(false);
  expect(visible('calendar-entry-bundled-zone-31')).toBe(true);
  await pressSettings('calendar-layer-school');
  await pressSettings('calendar-entry-local-school-2');
  expect(onEntry).toHaveBeenLastCalledWith('school-2', 'local', 's-2');
  expect(data.book.entries).toEqual(before);
});

test('bounds month navigation to the actual school year and shows cross-month entries', async () => {
  const data = await calendarData();
  await showSettingsScreen(<Calendar onEntry={onEntry} />, data);
  await pressSettings('calendar-before');
  expect(settingsControl('calendar-before').accessibilityState?.disabled).toBe(true);
  await pressSettings('calendar-after');
  await pressSettings('calendar-after');
  expect(visible('calendar-entry-bundled-span')).toBe(true);
  for (let month = 11; month < 19; month += 1) await pressSettings('calendar-after');
  expect(settingsControl('calendar-after').accessibilityState?.disabled).toBe(true);
  expect(settingsTexts().join(' ')).toContain('2027');
});

test('shows empty and no-school states honestly', async () => {
  await showSettingsScreen(<Calendar onEntry={onEntry} />, await calendarData());
  await pressSettings('calendar-after');
  await pressSettings('calendar-after');
  expect(visible('calendar-empty')).toBe(true);
  await showSettingsScreen(<Calendar onEntry={onEntry} />, await openTestData());
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.noSchool);
  expect(visible('calendar-before')).toBe(false);
});

test.each(['ar', 'fr', 'en'] as const)(
  'reads sources, confidence and real origin without claiming verification (%s)',
  async (language) => {
    const data = await calendarData();
    const before = [...data.book.entries];
    await showSettingsScreen(<CalendarEntry id="same-id" origin="bundled" schoolId="s-1" />, data, language);
    expect(settingsTexts()).toContain(catalogues[language].settings.confidence.projected);
    expect(settingsTexts()).toContain(i18n.t('settings.source', { source: data.calendar[0].source }));
    expect(settingsTexts()).toContain(catalogues[language].calendarView.origin.bundled);
    await showSettingsScreen(<CalendarEntry id="private" origin="local" schoolId="s-1" />, data, language);
    expect(settingsTexts()).toContain(catalogues[language].calendarView.private);
    expect(settingsTexts()).toContain(catalogues[language].calendarView.origin.local);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    expect(data.book.entries).toEqual(before);
  },
);

test.each(['removed', 'school-2', 'missing'])('does not open a removed or out-of-scope entry: %s', async (id) => {
  await showSettingsScreen(<CalendarEntry id={id} origin="local" schoolId="s-1" />, await calendarData());
  expect(settingsTexts()).toEqual([catalogues.ar.calendarView.missing]);
});

test('shows A/B resets and added-day details without offering edit controls', async () => {
  const data = await calendarData();
  const entry = calendarEntry('reset', {
    layer: 'school',
    schoolId: 's-1',
    effect: 'week-a',
    from: parseDay('2026-10-11'),
  });
  await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry });
  const before = [...data.book.entries];
  await showSettingsScreen(<Calendar onEntry={onEntry} />, data);
  const labels = settingsRoot()
    .findAllByType(View)
    .map((node) => node.props.accessibilityLabel as unknown);
  expect(labels).toContain(i18n.t('calendarView.weekLetter', { from: '11/10/2026', letter: 'أ' }));
  await pressSettings('calendar-school-s-2');
  expect(
    settingsRoot()
      .findAllByType(View)
      .map((node) => node.props.accessibilityLabel as unknown),
  ).toContain(i18n.t('calendarView.weekLetter', { from: '11/10/2026', letter: 'ب' }));
  await showSettingsScreen(<CalendarEntry id="reset" origin="local" schoolId="s-1" />, data);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.effect['week-a']);
  expect(settingsRoot().findAll((node) => typeof node.props.onPress === 'function')).toEqual([]);
  expect(data.book.entries).toEqual(before);
  expect(calendarStyles.cell.minHeight).toBe(48);
});

test('shows existing make-up, support and revision details with their chosen weekday', async () => {
  const data = await calendarData();
  for (const adds of ['make-up', 'support', 'revision'] as const) {
    const entry = calendarEntry(`added-${adds}`, {
      layer: 'school',
      schoolId: 's-1',
      effect: 'adds-sessions',
      adds,
      follows: 4,
    });
    await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry });
    const before = [...data.book.entries];
    await showSettingsScreen(<CalendarEntry id={entry.id} origin="local" schoolId="s-1" />, data);
    expect(settingsTexts()).toContain(catalogues.ar.calendarView.adds[adds]);
    expect(settingsTexts()).toContain(i18n.t('calendarView.follows', { day: catalogues.ar.week.days[4] }));
    expect(data.book.entries).toEqual(before);
  }
});
