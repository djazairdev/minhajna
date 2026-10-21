// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { addDays, canonicalJson, parseDay, validLunarConfirmation } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CalendarEntry } from '../src/calendar/Entry';
import { Lunar } from '../src/calendar/Lunar';
import { UpdateChangeList } from '../src/calendar/UpdateChangeList';
import { schoolEntries } from '../src/calendar/view';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { sessionTime } from '../src/times/times-rules';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const ramadan = calendarEntry('ramadan', {
  from: parseDay('2027-02-08'),
  to: parseDay('2027-03-08'),
  times: 'ramadan',
  confidence: 'expected',
  lunar: true,
  hours: { confidence: 'announced', lengths: [{ level: 'cem', minutes: 40 }] },
});
const withRamadan = async () => ({ ...(await withDay()), calendar: [ramadan] });
const label = (id: string) =>
  String((settingsRoot().find((node) => node.props.testID === id).props as { label: string }).label);
const text = (id: string) =>
  settingsRoot()
    .find((node) => node.props.testID === id)
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string)
    .join(' ');

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  "Ramadan's entry shows how sure its times and first day are, and each level's length (%s)",
  async (language) => {
    const onLunar = jest.fn();
    await showSettingsScreen(
      <CalendarEntry id="ramadan" origin="bundled" schoolId="s-1" onLunar={onLunar} />,
      await withRamadan(),
      language,
    );
    const own = catalogues[language];
    expect(label('ramadan-times')).toContain(own.settings.confidence.announced);
    expect(label('ramadan-first')).toContain(own.settings.confidence.expected);
    expect(text('ramadan-length-cem')).toContain('40');
    expect(text('ramadan-length-cem')).toContain(own.settings.myLevel);
    expect(text('ramadan-length-primary')).toContain(own.calendarView.ramadanHours.none);
    expect(label('calendar-lunar')).toBe(own.calendarView.lunarEdit.ramadan.open);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('calendar-lunar');
    expect(onLunar).toHaveBeenCalledTimes(1);
  },
);

test("the sighting screen speaks of Ramadan's first day", async () => {
  await showSettingsScreen(<Lunar base={ramadan} onSaved={jest.fn()} />, await withRamadan());
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.lunarEdit.ramadan.notice);
  expect(settingsTexts()).not.toContain(catalogues.ar.calendarView.lunarEdit.notice);
});

test("sessions take the announced length from Ramadan's confirmed first day, and keep their place", async () => {
  const data = await withRamadan();
  const school = data.book.state.schools.get('s-1')!;
  const slot = { half: 'morning', index: 1 } as const;
  const at = (day: string) => {
    const time = sessionTime({ ...data, state: data.book.state }, school, slot, parseDay(day));
    return time && [time.from, time.to, time.by];
  };
  expect(at('2027-02-08')).toEqual(['08:00', '08:40', 'ramadan-rule']);
  const entry = {
    ...ramadan,
    from: parseDay('2027-02-09'),
    to: addDays(ramadan.to, 1),
    source: 'إعلان رؤية تجريبي',
    confidence: 'announced' as const,
    confirmedFrom: canonicalJson(ramadan),
  };
  expect(validLunarConfirmation(entry, ramadan)).toBe(true);
  await data.book.record(parseDay('2027-02-07'), { kind: 'calendar.set', entry });
  expect(at('2027-02-08')).toEqual(['08:00', '09:00', 'template']);
  expect(at('2027-02-09')).toEqual(['08:00', '08:40', 'ramadan-rule']);
});

test("an update's change list names the Ramadan lengths it announces, and only when they change", async () => {
  const before = calendarEntry('ramadan', {
    ...ramadan,
    hours: { confidence: 'projected', lengths: [{ level: 'cem', minutes: 45 }] },
  });
  await showSettingsScreen(
    <UpdateChangeList mine={[{ kind: 'changed', entry: ramadan, before }]} others={0} />,
    await withRamadan(),
    'en',
  );
  expect(text('update-hours-ramadan')).toContain('40');
  expect(text('update-hours-ramadan')).toContain(catalogues.en.settings.confidence.announced);
  await showSettingsScreen(
    <UpdateChangeList mine={[{ kind: 'changed', entry: ramadan, before: ramadan }]} others={0} />,
    await withRamadan(),
    'en',
  );
  expect(settingsRoot().findAll((node) => node.props.testID === 'update-hours-ramadan')).toEqual([]);
});

test('the Calendar shows Ramadan ending on the eve of Eid al-Fitr, as its times do', async () => {
  const eid = calendarEntry('eid', {
    from: parseDay('2027-03-10'),
    to: parseDay('2027-03-11'),
    effect: 'no-school',
    confidence: 'expected',
    lunar: true,
  });
  const data = { ...(await withDay()), calendar: [ramadan, eid] };
  const row = schoolEntries({ ...data, state: data.book.state, updatedIds: [] }, 's-1').find(
    (one) => one.entry.id === 'ramadan',
  );
  expect(row?.entry.to).toBe(parseDay('2027-03-09'));
  const school = data.book.state.schools.get('s-1')!;
  const time = sessionTime(
    { ...data, state: data.book.state },
    school,
    { half: 'morning', index: 1 },
    parseDay('2027-03-09'),
  );
  expect(time?.by).toBe('ramadan-rule');
});

test("a confirmed Ramadan whose end moved to Eid's eve is still a valid confirmation on its entry", async () => {
  const eid = calendarEntry('eid', {
    from: parseDay('2027-03-09'),
    to: parseDay('2027-03-10'),
    effect: 'no-school',
    confidence: 'expected',
    lunar: true,
  });
  const data = { ...(await withDay()), calendar: [ramadan, eid] };
  const entry = {
    ...ramadan,
    from: parseDay('2027-02-09'),
    to: addDays(ramadan.to, 1),
    source: 'إعلان رؤية تجريبي',
    confidence: 'announced' as const,
    confirmedFrom: canonicalJson(ramadan),
  };
  await data.book.record(parseDay('2027-02-07'), { kind: 'calendar.set', entry });
  await showSettingsScreen(<CalendarEntry id="ramadan" origin="local" schoolId="s-1" />, data);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.lunarEdit.local);
  expect(settingsTexts()).not.toContain(catalogues.ar.calendarView.lunarEdit.stale);
});
