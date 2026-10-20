// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { confirmSessions, parseDay, todayView } from '@minhajna/core';
import { settingsData } from '../jest/settings-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { Plans } from '../src/settings/Plans';
import { Packs } from '../src/plan/Packs';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n } from '../src/text/i18n';
import { accessibilityProblems } from '../jest/accessibility';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onChoose = jest.fn();
const onDone = jest.fn();
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  onChoose.mockReset();
  onDone.mockReset();
});

test('shows each school’s real pins and missing releases, not the newest installed pack', async () => {
  const data = await settingsData();
  await showSettingsScreen(<Plans onChoose={onChoose} />, data);
  expect(settingsTexts()).toContain('متوسطة الأمل (مثال)');
  expect(settingsTexts()).toContain(catalogues.ar.plan.status.example);
  expect(settingsTexts().some((text) => text.includes('2025.9'))).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  await pressSettings('settings-choose-k-other-arabic-4am');
  expect(onChoose).toHaveBeenCalledWith('4am', 'arabic', 's-2', 'k-other');
});

test('a school-specific plan page does not include the other school’s classes', async () => {
  await showSettingsScreen(<Plans schoolId="s-2" onChoose={onChoose} />, await settingsData());
  expect(settingsTexts()).not.toContain('متوسطة النجاح');
  expect(settingsRoot().findAllByProps({ testID: 'settings-plans-s-1' })).toHaveLength(0);
});

test('pinning a pack in one school changes neither the other school’s pin nor recorded sessions', async () => {
  const data = await settingsData();
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  const session = todayView(context, day).sessions[0].session;
  await data.book.recordAll(day, confirmSessions(context, [{ session }]));
  const records = new Map(data.book.state.sessions);
  const otherPin = data.book.state.courses.get('c-other')?.pack;
  const history = [...data.book.entries];
  await showSettingsScreen(<Packs grade="4am" subject="arabic" schoolId="s-1" onDone={onDone} />, data);
  expect(settingsTexts()).not.toContain('4م3 (مثال)');
  await pressSettings('pack-none');
  await pressSettings('pack-pin');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.courses.get('c-1')?.pack).toBeNull();
  expect(data.book.state.courses.get('c-other')?.pack).toEqual(otherPin);
  expect(data.book.state.sessions).toEqual(records);
  expect(data.book.entries.slice(0, history.length)).toEqual(history);
});

test('«تغيير» on one class pins that class only, leaving a sibling on its release', async () => {
  const data = await settingsData();
  const example = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'course.set', course: { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack: example } },
  ]);
  await showSettingsScreen(<Packs grade="4am" subject="arabic" schoolId="s-1" classId="k-1" onDone={onDone} />, data);
  expect(settingsRoot().findByProps({ testID: 'pack-classes' }).props.selected).toEqual(['k-1']);
  await pressSettings('pack-none');
  await pressSettings('pack-pin');
  expect(data.book.state.courses.get('c-1')?.pack).toBeNull();
  expect(data.book.state.courses.get('c-2')?.pack).toEqual(example);
});

test('a class on a missing release keeps it unless another is chosen', async () => {
  const data = await settingsData();
  const history = data.book.entries.length;
  await showSettingsScreen(
    <Packs grade="4am" subject="arabic" schoolId="s-2" classId="k-other" onDone={onDone} />,
    data,
  );
  expect(settingsRoot().findByProps({ testID: 'pack-current' }).props.selected).toBe(true);
  expect(settingsTexts().some((text) => text.includes('2025.9'))).toBe(true);
  await pressSettings('pack-pin');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.courses.get('c-other')?.pack).toEqual({ id: 'dz.cem.4am.arabic.example', release: '2025.9' });
  expect(data.book.entries).toHaveLength(history);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
});

test("setup's chooser for several classes on different pins offers the latest, not one class's old release", async () => {
  const data = await settingsData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'course.set',
      course: {
        id: 'c-1',
        classId: 'k-1',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.cem.4am.arabic.example', release: '2025.9' },
      },
    },
  ]);
  await showSettingsScreen(<Packs grade="4am" subject="arabic" schoolId="s-1" onDone={onDone} />, data);
  expect(settingsRoot().findAllByProps({ testID: 'pack-current' })).toHaveLength(0);
  expect(settingsRoot().findByProps({ testID: 'pack-dz.cem.4am.arabic.example' }).props.selected).toBe(true);
});
