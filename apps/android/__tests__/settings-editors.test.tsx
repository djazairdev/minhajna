// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import type { PressableProps } from 'react-native';
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
import { Teaching } from '../src/setup/Teaching';
import { Classes } from '../src/setup/Classes';
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
  expect(settingsTexts()).toContain(catalogues.ar.settings.cardFromSchools);
});

test('editing schools cannot remove levels or subjects that existing classes use', async () => {
  const data = await settingsData();
  const state = data.book.state;
  expect(protectedChoices(state, 's-1', 'levels', [])).toEqual(['cem']);
  expect(protectedChoices(state, 's-1', 'subjects', ['french'])).toEqual(['french', 'arabic']);
  expect(protectedChoices(state, 'missing', 'subjects', ['french'])).toEqual(['french']);
  const before = [...data.book.entries];
  await showSettingsScreen(<Teaching editing onNext={onDone} />, data);
  expect(settingsRoot().findAllByProps({ testID: 'setup-steps' })).toHaveLength(0);
  expect(settingsTexts()).toContain(catalogues.ar.settings.schoolGuard);
  expect(
    settingsRoot().findAll(
      (node) => node.props.accessibilityRole === 'button' && String(node.props.testID).includes('delete'),
    ),
  ).toHaveLength(0);
  await pressSettings('setup-next');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.entries).toEqual(before);
});

test('the class editor returns to Settings, with no setup progress bar', async () => {
  await showSettingsScreen(<Classes editing onNext={onDone} onType={() => undefined} />, await settingsData());
  expect(settingsRoot().findAllByProps({ testID: 'setup-steps' })).toHaveLength(0);
  await pressSettings('classes-next');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the bell-time editor opens on the requested school', async () => {
  await showSettingsScreen(<Times schoolId="s-2" />, await settingsData());
  expect(settingsControl('times-school-s-2').accessibilityState?.checked).toBe(true);
});

test('an unused level can be corrected and a newly added empty school can be cancelled', async () => {
  const data = await settingsData();
  const school = data.book.state.schools.get('s-1')!;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'school.set',
    school: { ...school, levels: ['cem', 'primary'] },
  });
  expect(protectedChoices(data.book.state, 's-1', 'levels', ['cem'])).toEqual(['cem']);
  await showSettingsScreen(<Teaching editing onNext={onDone} />, data);
  await pressSettings('add-school');
  const remove = settingsRoot().findAll(
    (node) => node.props.accessibilityRole === 'button' && String(node.props.testID).startsWith('delete-'),
  )[0].props as PressableProps;
  expect(remove.onPress).toBeDefined();
  await ReactTestRenderer.act(() => {
    remove.onPress?.({} as never);
  });
  await pressSettings('setup-next');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(data.book.state.schools.size).toBe(2);
});
