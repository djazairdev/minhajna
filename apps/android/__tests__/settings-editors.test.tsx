// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import { pickSchool, serveReference } from '../jest/directory-list';
import { settingsData } from '../jest/settings-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { Card } from '../src/setup/Card';
import { SettingsSchools } from '../src/settings/SettingsSchools';
import { protectedChoices } from '../src/settings/school-guards';
import { Times } from '../src/times/Times';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onDone = jest.fn();
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  onDone.mockReset();
});

test('the card editor saves without continuing setup, and keeps history append-only', async () => {
  const data = await settingsData();
  await data.book.record(parseDay('2026-10-15'), { kind: 'setup.finished' });
  const before = [...data.book.entries];
  await showSettingsScreen(<Card editing onNext={onDone} onSignature={jest.fn()} />, data);
  expect(settingsRoot().findAllByProps({ testID: 'setup-steps' })).toHaveLength(0);
  expect(settingsRoot().findAllByProps({ testID: 'card-later' })).toHaveLength(0);
  await typeSettings('card-name', 'أستاذة مختلقة');
  await pressSettings('card-next');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.personal?.name).toBe('أستاذة مختلقة');
  expect(data.book.state.setupFinished).toBe(true);
  expect(data.book.entries.slice(0, before.length)).toEqual(before);
  await typeSettings('card-name', ' ');
  await pressSettings('card-next');
  expect(onDone).toHaveBeenCalledTimes(2);
  expect(data.book.state.personal?.name).toBeUndefined();
  const done = settingsRoot().find((node) => node.props.testID === 'card-next' && !!node.props.onPress);
  expect(done.findAllByProps({ testID: 'icon-chevron' })).toHaveLength(0);
});

test('the schools page keeps the levels and subjects existing classes use, and offers no delete for them', async () => {
  serveReference();
  const data = await settingsData();
  const state = data.book.state;
  expect(protectedChoices(state, 's-1', 'levels', [])).toEqual(['cem']);
  expect(protectedChoices(state, 's-1', 'subjects', ['french'])).toEqual(['french', 'arabic']);
  expect(protectedChoices(state, 'missing', 'subjects', ['french'])).toEqual(['french']);
  const before = [...data.book.entries];
  await showSettingsScreen(<SettingsSchools onDone={onDone} />, data);
  expect(settingsRoot().findAllByProps({ testID: 'setup-steps' })).toHaveLength(0);
  expect(settingsTexts()).toContain(catalogues.ar.settings.schoolGuard);
  expect(settingsTexts()).toContain('متوسطة الأمل (مثال)');
  expect(
    settingsRoot().findAll(
      (node) => node.props.accessibilityRole === 'button' && String(node.props.testID).includes('delete'),
    ),
  ).toHaveLength(0);
  await pressSettings('setup-next');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.entries).toEqual(before);
  await pressSettings('change-s-2');
  await pickSchool(settingsRoot, { level: 'cem', option: 'math', wilaya: '07', commune: '0701', school: 'cem-07-1' });
  await pressSettings('school-save');
  expect(data.book.state.schools.get('s-2')).toMatchObject({
    code: 'cem-07-1',
    name: 'متوسطة الواحة',
    levels: ['cem'],
    subjects: ['math', 'arabic'],
    zone: '07',
  });
  const count = data.book.entries.length;
  await pressSettings('change-s-2');
  expect(settingsControl('choice-option').accessibilityLabel).toMatch(/: /u);
  expect(String(settingsControl('choice-option').accessibilityLabel)).toContain(
    data.profile.subjects.find((subject) => subject.code === 'math')?.name.ar,
  );
  await pressSettings('school-save');
  expect(data.book.state.schools.get('s-2')?.subjects).toEqual(['math', 'arabic']);
  expect(data.book.entries.length).toBe(count);
});

test('the bell-time editor opens on the requested school', async () => {
  await showSettingsScreen(<Times schoolId="s-2" />, await settingsData());
  expect(settingsControl('times-school-s-2').accessibilityState?.checked).toBe(true);
});

test('adds a school from the selects, leaves nothing when cancelled, and removes an unused one', async () => {
  serveReference();
  const data = await settingsData();
  await showSettingsScreen(<SettingsSchools onDone={onDone} />, data);
  const count = data.book.state.schools.size;
  await pressSettings('add-school');
  await pressSettings('school-cancel');
  expect(data.book.state.schools.size).toBe(count);
  await pressSettings('add-school');
  expect(settingsControl('school-save').accessibilityState?.disabled).toBe(true);
  await pickSchool(settingsRoot, {
    level: 'primary',
    option: 'french',
    wilaya: '16',
    commune: '1601',
    school: 'pri-16-1',
  });
  await pressSettings('school-save');
  const added = [...data.book.state.schools.values()].find((school) => school.code === 'pri-16-1');
  expect(added).toMatchObject({ name: 'ابتدائية الأمل', levels: ['primary'], subjects: ['french'], zone: '16' });
  await pressSettings(`delete-${added!.id}`);
  expect(data.book.state.schools.size).toBe(count);
});
