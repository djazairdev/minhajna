// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CalendarView, parseDay } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsInput,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { AbReset } from '../src/calendar/AbReset';
import { CalendarEntry as Entry } from '../src/calendar/Entry';
import { CalendarForm } from '../src/calendar/Form';
import { Lunar } from '../src/calendar/Lunar';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const done = jest.fn();
const base = calendarEntry('lunar-example', { effect: 'no-school', confidence: 'expected', lunar: true });
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  done.mockReset();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'A/B and lunar editors have named controls and growing text ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await withDay();
    const before = [...data.book.entries];
    for (const element of [
      <AbReset key="ab" schoolId="s-1" onSaved={done} />,
      <Lunar key="lunar" base={base} onSaved={done} />,
    ]) {
      await showSettingsScreen(element, { ...data, calendar: [base] }, language);
      expect(accessibilityProblems(settingsRoot())).toEqual([]);
      for (const node of settingsRoot().findAllByType(Text)) {
        const props = node.props as TextProps;
        expect(props.numberOfLines).toBeUndefined();
        expect(props.allowFontScaling).not.toBe(false);
        expect(props.maxFontSizeMultiplier).toBeUndefined();
      }
      expect(missingKeys).toEqual([]);
      expect(data.book.entries).toEqual(before);
    }
  },
);

test('choosing a half day invalidates a preview, saves only that half and can be corrected to a whole day', async () => {
  const data = await withDay();
  await showSettingsScreen(<CalendarForm schoolId="s-1" onSaved={done} onAddDay={jest.fn()} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-period-afternoon');
  expect(has('calendar-save')).toBe(false);
  await pressSettings('calendar-preview');
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.affected', { count: 0 }));
  await pressSettings('calendar-save');
  const old = data.book.state.calendar[0];
  expect(old.half).toBe('afternoon');
  await showSettingsScreen(<CalendarForm schoolId="s-1" old={old} onSaved={done} onAddDay={jest.fn()} />, data);
  expect(settingsControl('calendar-period-afternoon').accessibilityState?.checked).toBe(true);
  await pressSettings('calendar-period-all');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0].id).toBe(old.id);
  expect(data.book.state.calendar[0].half).toBeUndefined();
});

test('previews the new A/B letters, saves one school reset and lets it be edited and withdrawn', async () => {
  const data = await withDay();
  const school = data.book.state.schools.get('s-1')!;
  const context = coreContext({ ...data, state: data.book.state });
  const current = context.calendar.parityOn(parseDay('2026-10-15'), school)!;
  const next = current === 'A' ? 'B' : 'A';
  const before = [...data.book.entries];
  await showSettingsScreen(<AbReset schoolId="s-1" onSaved={done} />, data);
  await pressSettings(`calendar-reset-letter-${next}`);
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  await typeSettings('calendar-source', 'ضبط تجريبي');
  await pressSettings('calendar-preview');
  expect(data.book.entries).toEqual(before);
  expect(settingsTexts()).toContain(
    i18n.t('calendarView.abEdit.week', {
      day: '11/10/2026',
      before: i18n.t(`calendarView.parity.${current}`),
      after: i18n.t(`calendarView.parity.${next}`),
    }),
  );
  await pressSettings('calendar-save');
  const old = data.book.state.calendar[0];
  expect(old).toMatchObject({ layer: 'school', schoolId: 's-1', effect: next === 'A' ? 'week-a' : 'week-b' });
  await showSettingsScreen(<AbReset schoolId="s-1" old={old} onSaved={done} />, data);
  await typeSettings('calendar-source', 'تصحيح ضبط تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(1);
  expect(data.book.state.calendar[0].id).toBe(old.id);
  await showSettingsScreen(<Entry id={old.id} origin="local" schoolId="s-1" onCancelled={done} />, data);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(data.book.state.calendar).toHaveLength(0);
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
});

test('a lunar confirmation requires an announcement source, preserves the reference and is withdrawable', async () => {
  const data = { ...(await withDay()), calendar: [base] };
  const before = JSON.stringify(data.calendar);
  await showSettingsScreen(<Lunar base={base} onSaved={done} />, data);
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  await typeSettings('calendar-source', 'إعلان رؤية تجريبي');
  await pressSettings('calendar-lunar-day-2026-10-16');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const own = data.book.state.calendar[0];
  expect(own).toMatchObject({ id: base.id, from: '2026-10-16', to: '2026-10-16', confidence: 'announced' });
  expect(own.confirmedFrom).toBeDefined();
  expect(JSON.stringify(data.calendar)).toBe(before);
  await showSettingsScreen(<Entry id={base.id} origin="local" schoolId="s-1" onCancelled={done} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.lunarEdit.local);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(data.book.state.calendar).toHaveLength(0);
  const view = new CalendarView(coreContext({ ...data, state: data.book.state }).ref, []);
  expect(view.entriesFor(data.book.state.schools.get('s-1')!)).toContain(base);
});

test('a changed reference marks a saved confirmation inactive and still permits withdrawal', async () => {
  const data = { ...(await withDay()), calendar: [base] };
  await showSettingsScreen(<Lunar base={base} onSaved={done} />, data);
  await typeSettings('calendar-source', 'إعلان رؤية تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const changed = { ...data, calendar: [{ ...base, source: 'مرجع تجريبي مصحّح' }] };
  await showSettingsScreen(<Entry id={base.id} origin="local" schoolId="s-1" onCancelled={done} />, changed);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.lunarEdit.stale);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(data.book.state.calendar).toHaveLength(0);
});

test('a failed lunar save keeps the date and source and can be retried', async () => {
  const data = { ...(await withDay()), calendar: [base] };
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic failure'));
  await showSettingsScreen(<Lunar base={base} onSaved={done} />, data);
  await typeSettings('calendar-source', 'إعلان رؤية تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(done).not.toHaveBeenCalled();
  expect(settingsInput('calendar-source').value).toBe('إعلان رؤية تجريبي');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.edit.failed);
  await pressSettings('calendar-save');
  expect(done).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(1);
});
