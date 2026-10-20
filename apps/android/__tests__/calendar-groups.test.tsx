// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, pupilsFor, rollCallUnits, sessionsBetween } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { groupsData } from '../jest/calendar-groups-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsControl,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { Groups } from '../src/calendar/Groups';
import { CalendarEntry } from '../src/calendar/Entry';
import { Roll } from '../src/roll/Roll';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
const saved = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  saved.mockReset();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'rotation controls are named, grow and stay offline ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await groupsData();
    const before = [...data.book.entries];
    await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data, language);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(missingKeys).toEqual([]);
    expect(data.book.entries).toEqual(before);
    await pressSettings('rotation-confirm-split');
    await typeSettings('calendar-source', 'إعلان تجريبي');
    await pressSettings('calendar-preview');
    expect(has('rotation-preview')).toBe(true);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('requires group confirmation, saves the reviewed split, and writes no pupil data in the calendar', async () => {
  const data = await groupsData();
  const before = data.book.entries.length;
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  expect(data.book.entries).toHaveLength(before);
  await pressSettings('rotation-confirm-split');
  expect(has('rotation-split-ready')).toBe(true);
  const halves = data.book.state.classes.get('k-1')!.groups.filter((one) => one.kind === 'half');
  expect([...data.book.state.pupils.values()].filter((one) => one.groups.includes(halves[0].id))).toHaveLength(3);
  const afterSplit = [...data.book.entries];
  await pressSettings('calendar-preview');
  expect(data.book.entries).toEqual(afterSplit);
  await pressSettings('calendar-save');
  expect(saved).toHaveBeenCalledTimes(1);
  const entry = data.book.state.calendar[0];
  expect(entry.rotation).toEqual({ classId: 'k-1', groups: halves.map((one) => one.id) });
  expect(JSON.stringify(entry)).not.toMatch(/example-[0-9]|أمينة|pupil|absent/);
  const units = rollCallUnits(
    coreContext({ ...data, state: data.book.state }),
    'k-1',
    parseDay('2026-10-15'),
    parseDay('2026-10-15'),
  );
  expect(pupilsFor(coreContext({ ...data, state: data.book.state }), units[0]).length).toBeLessThan(5);
});

test('moving a pupil invalidates the preview until the revised split is confirmed', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('rotation-confirm-split');
  await pressSettings('calendar-preview');
  const halves = data.book.state.classes.get('k-1')!.groups.filter((one) => one.kind === 'half');
  await pressSettings(`rotation-pupil-example-0-${halves[1].id}`);
  expect(has('calendar-save')).toBe(false);
  await pressSettings('calendar-preview');
  expect(has('calendar-invalid')).toBe(true);
  await pressSettings('rotation-confirm-split');
  expect(data.book.state.pupils.get('example-0')!.groups).toContain(halves[1].id);
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(1);
});

test('editing keeps its ID and class, and cancellation leaves the reviewed roster and history', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await pressSettings('rotation-confirm-split');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const old = data.book.state.calendar[0];
  await showSettingsScreen(<Groups schoolId="s-1" old={old} onSaved={saved} />, data);
  expect(has('rotation-class')).toBe(false);
  await pressSettings('rotation-confirm-split');
  await pressSettings('rotation-order-reverse');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0].id).toBe(old.id);
  expect(data.book.state.calendar[0].rotation!.groups).toEqual([...old.rotation!.groups].reverse());
  const prior = [...data.book.entries];
  const pupils = [...data.book.state.pupils.values()];
  await showSettingsScreen(<CalendarEntry id={old.id} schoolId="s-1" origin="local" onCancelled={saved} />, data);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(data.book.state.calendar).toHaveLength(0);
  expect([...data.book.state.pupils.values()]).toEqual(pupils);
  expect(data.book.entries.slice(0, prior.length)).toEqual(prior);
});

test('choosing another class clears the draft and never activates a rule for the first class', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await pressSettings('rotation-confirm-split');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('rotation-class-k-2');
  expect(has('calendar-save')).toBe(false);
  expect(data.book.state.calendar).toHaveLength(0);
  expect(settingsTexts()).not.toContain(catalogues.ar.calendarView.groups.splitReady);
});

test('roll call asks for group review when a new pupil has not been assigned', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await pressSettings('rotation-confirm-split');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const pupil = data.book.state.pupils.get('example-0')!;
  const day = parseDay('2026-10-15');
  await data.book.record(day, { kind: 'pupil.set', pupil: { ...pupil, id: 'new-example', groups: [] } });
  const context = coreContext({ ...data, state: data.book.state });
  const session = sessionsBetween(context, day, day, new Set(['c-1']))[0];
  await showSettingsScreen(<Roll sessionKey={session.key} day={day} onDone={saved} />, data);
  expect(has('roll-groups-missing')).toBe(true);
  expect(settingsControl('roll-save').disabled).toBe(true);
});
