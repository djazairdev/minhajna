// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class council in the calendar (#224, answer 334): one class, a term and
// a time on one day, named in each language, taking no session; the
// journal writes it once held, or in grey while still to come. Made-up data.

import { parseDay, type CalendarEntry } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { Council } from '../src/calendar/Council';
import { CalendarForm } from '../src/calendar/Form';
import { CalendarEntry as Entry } from '../src/calendar/Entry';
import { journalFrontPages } from '../src/documents/journal-front-pages';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const done = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const council = (fields: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id: 'council',
  layer: 'school',
  schoolId: 's-1',
  from: parseDay('2026-10-14'),
  to: parseDay('2026-10-14'),
  effect: 'marker',
  council: { classId: 'k-2', term: 1, at: '14:00' },
  name: { ar: 'مجلس القسم 4م2 للفصل الأول' },
  source: 'إعلان المدير',
  confidence: 'announced',
  ...fields,
});
const journal = (data: TestData) =>
  journalFrontPages(
    {
      state: data.book.state,
      profile: data.profile,
      year: data.year,
      calendar: data.calendar,
      calendarRelease: data.calendarRelease,
      packs: data.packs,
      bells: data.bells,
      day: parseDay('2026-10-15'),
      lang: 'ar',
      dir: 'rtl',
    },
    i18n.getFixedT('ar'),
    false,
  );

beforeEach(() => {
  done.mockReset();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'the council editor has named controls in every language (%s)',
  async (language) => {
    const data = await withDay();
    await showSettingsScreen(<Council schoolId="s-1" onSaved={done} />, data, language);
    expect(has('council-class-k-2')).toBe(true);
    expect(has('council-term-3')).toBe(true);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('the calendar form offers a council, which opens its own editor', async () => {
  const onAddCouncil = jest.fn();
  await showSettingsScreen(
    <CalendarForm schoolId="s-1" onSaved={done} onAddDay={jest.fn()} onAddCouncil={onAddCouncil} />,
    await withDay(),
  );
  await pressSettings('calendar-kind-council');
  await pressSettings('calendar-add-council');
  expect(onAddCouncil).toHaveBeenCalledWith('s-1');
});

test('a council saves its class, term and time, named in each language, and takes no session', async () => {
  const data = await withDay();
  await showSettingsScreen(<Council schoolId="s-1" onSaved={done} />, data);
  await pressSettings('council-class-k-2');
  await pressSettings('council-term-2');
  await typeSettings('council-at', '25.00');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.council.badTime);
  expect(has('calendar-save')).toBe(false);
  await typeSettings('council-at', '١٤.٣٠');
  await pressSettings('calendar-preview');
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.affected', { count: 0 }));
  await pressSettings('calendar-save');
  const saved = data.book.state.calendar[0];
  expect(saved.council).toEqual({ classId: 'k-2', term: 2, at: '14:30' });
  expect(saved.effect).toBe('marker');
  expect(saved.from).toBe(saved.to);
  expect(saved.name.ar).toBe('مجلس القسم 4م2 للفصل الثاني');
  expect(saved.name.en).toBe('Class council 4م2, second term');
  expect(saved.name.fr).toBe('Conseil de classe 4م2, deuxième trimestre');
  expect(done).toHaveBeenCalledWith(saved);
});

test('the term follows the chosen day until the teacher picks one', async () => {
  const data = await withDay();
  await showSettingsScreen(<Council schoolId="s-1" onSaved={done} />, data);
  for (let month = 0; month < 3; month += 1) await pressSettings('extra-month-after');
  await pressSettings('extra-day-2027-01-10');
  await typeSettings('council-at', '14:00');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0]?.council?.term).toBe(2);
  await closeSettingsScreen();
  await showSettingsScreen(<Council schoolId="s-1" onSaved={done} />, data);
  await pressSettings('council-term-3');
  await pressSettings('extra-day-2026-10-20');
  await typeSettings('council-at', '14:00');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[1]?.council?.term).toBe(3);
});

test('moving a held council to another day forgets that it was held; the class stays', async () => {
  const data = await withDay();
  const old = council({ council: { classId: 'k-2', term: 1, at: '14:00', held: true } });
  await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry: old });
  await showSettingsScreen(<Council schoolId="s-1" old={old} onSaved={done} />, data);
  expect(has('council-class-k-1')).toBe(false);
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0].council?.held).toBe(true);
  await closeSettingsScreen();
  const kept = data.book.state.calendar[0];
  await showSettingsScreen(<Council schoolId="s-1" old={kept} onSaved={done} />, data);
  await pressSettings('extra-day-2026-10-21');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0].from).toBe('2026-10-21');
  expect(data.book.state.calendar[0].council).toEqual({ classId: 'k-2', term: 1, at: '14:00' });
});

test('the entry page gives the class, the term and the time, and whether it was held', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry: council() });
  await showSettingsScreen(<Entry id="council" origin="local" schoolId="s-1" onCancelled={done} />, data);
  expect(settingsTexts()).toContain('4م2 · الفصل الأول · 14سا');
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.council.notHeld);
  expect(settingsTexts()).not.toContain(catalogues.ar.calendarView.periods.all);
});

test('the journal writes a council once held, in grey while to come, and not when it passed unconfirmed', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'calendar.set', entry: council() },
    {
      kind: 'calendar.set',
      entry: council({
        id: 'later',
        from: parseDay('2026-12-15'),
        to: parseDay('2026-12-15'),
        name: { ar: 'مجلس قادم' },
      }),
    },
  ]);
  expect(journal(data)).not.toContain('مجلس القسم 4م2 للفصل الأول');
  expect(journal(data)).toMatch(/<tr class="later"><td class="d"><bdi>15\/12\/2026<\/bdi><\/td><td>مجلس قادم/);
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'calendar.set',
    entry: council({ council: { classId: 'k-2', term: 1, at: '14:00', held: true } }),
  });
  expect(journal(data)).toMatch(/<tr><td class="d"><bdi>14\/10\/2026<\/bdi><\/td><td>مجلس القسم 4م2 للفصل الأول/);
});

test('on its own day, a council prints in grey until held, then in black', async () => {
  const data = await withDay();
  const today = { from: parseDay('2026-10-15'), to: parseDay('2026-10-15') };
  await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry: council(today) });
  expect(journal(data)).toMatch(/<tr class="later"><td class="d"><bdi>15\/10\/2026<\/bdi><\/td><td>مجلس القسم/);
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'calendar.set',
    entry: council({ ...today, council: { classId: 'k-2', term: 1, at: '14:00', held: true } }),
  });
  expect(journal(data)).toMatch(/<tr><td class="d"><bdi>15\/10\/2026<\/bdi><\/td><td>مجلس القسم/);
});
