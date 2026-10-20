// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { withDay } from '../jest/today-day';
import ReactTestRenderer from 'react-test-renderer';
import { Button } from '../src/components/Button';
import { useAppData } from '../src/storage/AppData';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { accessibilityProblems } from '../jest/accessibility';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { Language } from '../src/settings/Language';
import { catalogues, currentLanguage, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onDone = jest.fn();
beforeEach(() => {
  onDone.mockReset();
  missingKeys.length = 0;
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each(['ar', 'fr', 'en'] as const)(
  'offers translated language names and a subject-language assurance (%s)',
  async (language) => {
    await showSettingsScreen(<Language onDone={onDone} />, await withDay(), language);
    for (const code of ['ar', 'fr', 'en'] as const) {
      expect(settingsControl(`settings-language-${code}`).accessibilityState?.checked).toBe(code === language);
    }
    expect(settingsTexts()).toContain(catalogues[language].settings.languageDocuments);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('previews without changing the phone or records; only Save changes direction', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  const set = jest.spyOn(NativeInterface, 'setLanguage');
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(<Language onDone={onDone} />, data);
  await pressSettings('settings-language-fr');
  expect(currentLanguage()).toBe('ar');
  expect(set).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain('Aujourd’hui · Confirmer la séance · Classes');
  expect(settingsControl('settings-language-fr').accessibilityState?.checked).toBe(true);
  await pressSettings('settings-language-save');
  expect(set).toHaveBeenCalledWith('fr');
  expect(restart).toHaveBeenCalledTimes(1);
  expect(onDone).not.toHaveBeenCalled();
  expect(data.book.entries).toEqual(before);
});

test('applies a same-direction change at once and returns to Settings', async () => {
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(<Language onDone={onDone} />, await withDay(), 'fr');
  await pressSettings('settings-language-en');
  await pressSettings('settings-language-save');
  expect(currentLanguage()).toBe('en');
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(restart).not.toHaveBeenCalled();
});

test('shows a save failure, keeps the old interface and lets the teacher try again', async () => {
  const set = jest.spyOn(NativeInterface, 'setLanguage').mockImplementation(() => {
    throw new Error('Synthetic failure');
  });
  await showSettingsScreen(<Language onDone={onDone} />, await withDay());
  await pressSettings('settings-language-fr');
  await pressSettings('settings-language-save');
  expect(settingsTexts()).toContain(catalogues.ar.settings.failed);
  expect(currentLanguage()).toBe('ar');
  expect(onDone).not.toHaveBeenCalled();
  set.mockRestore();
  await pressSettings('settings-language-save');
  expect(NativeInterface.language()).toBe('fr');
});

/** A synthetic edit that starts a queued write without any pupil data. */
function PendingEdit() {
  const { record } = useAppData();
  return (
    <Button
      testID="synthetic-edit"
      label="Synthetic edit"
      onPress={() => record({ kind: 'teacher.personal.set', personal: { name: 'أستاذة مختلقة' } })}
    />
  );
}

test('waits for a pending record write before changing direction', async () => {
  const data = await withDay();
  let finish = () => undefined as void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = data.book.record.bind(data.book);
  jest.spyOn(data.book, 'record').mockImplementation(async (day, event) => {
    await pending;
    return original(day, event);
  });
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(
    <>
      <PendingEdit />
      <Language onDone={onDone} />
    </>,
    data,
  );
  await pressSettings('settings-language-fr');
  await pressSettings('synthetic-edit');
  await ReactTestRenderer.act(() => {
    void settingsControl('settings-language-save').onPress?.({} as never);
    void settingsControl('settings-language-save').onPress?.({} as never);
  });
  expect(restart).not.toHaveBeenCalled();
  expect(settingsControl('settings-language-save').disabled).toBe(true);
  await ReactTestRenderer.act(async () => {
    finish();
    await pending;
  });
  expect(data.book.state.personal?.name).toBe('أستاذة مختلقة');
  expect(restart).toHaveBeenCalledTimes(1);
});

test('a write that failed before Save does not block the language change', async () => {
  const data = await withDay();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(data.book, 'record').mockRejectedValue(new Error('Synthetic write failure'));
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(
    <>
      <PendingEdit />
      <Language onDone={onDone} />
    </>,
    data,
  );
  await pressSettings('synthetic-edit');
  await pressSettings('settings-language-fr');
  await pressSettings('settings-language-save');
  expect(restart).toHaveBeenCalledTimes(1);
  expect(settingsTexts()).not.toContain(catalogues.ar.settings.failed);
});

test('leaving the language screen while a write is pending cancels the language change, not the write', async () => {
  const data = await withDay();
  let finish = () => undefined as void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = data.book.record.bind(data.book);
  jest.spyOn(data.book, 'record').mockImplementation(async (day, event) => {
    await pending;
    return original(day, event);
  });
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(
    <>
      <PendingEdit />
      <Language onDone={onDone} />
    </>,
    data,
  );
  await pressSettings('settings-language-fr');
  await pressSettings('synthetic-edit');
  await ReactTestRenderer.act(() => {
    void settingsControl('settings-language-save').onPress?.({} as never);
  });
  await closeSettingsScreen();
  await ReactTestRenderer.act(async () => {
    finish();
    await pending;
  });
  expect(restart).not.toHaveBeenCalled();
  expect(data.book.state.personal?.name).toBe('أستاذة مختلقة');
});

/** Two queued synthetic edits prove a later success cannot hide a failure that happened during Save. */
function PendingPair() {
  const { record } = useAppData();
  return (
    <Button
      testID="synthetic-pair"
      label="Synthetic edits"
      onPress={() => {
        record({ kind: 'teacher.personal.set', personal: { name: 'اسم مختلق' } });
        record({ kind: 'teacher.set', card: { rank: 'رتبة مختلقة' } });
      }}
    />
  );
}

test('a later queued success cannot hide an earlier failure while language Save waits', async () => {
  const data = await withDay();
  let finish = () => undefined as void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = data.book.record.bind(data.book);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest
    .spyOn(data.book, 'record')
    .mockImplementationOnce(async () => {
      await pending;
      throw new Error('Synthetic first-write failure');
    })
    .mockImplementation(original);
  const restart = jest.spyOn(NativeInterface, 'restart');
  await showSettingsScreen(
    <>
      <PendingPair />
      <Language onDone={onDone} />
    </>,
    data,
  );
  await pressSettings('settings-language-fr');
  await pressSettings('synthetic-pair');
  await ReactTestRenderer.act(() => {
    void settingsControl('settings-language-save').onPress?.({} as never);
  });
  await ReactTestRenderer.act(async () => {
    finish();
    await pending;
  });
  expect(data.book.state.teacher?.rank).toBe('رتبة مختلقة');
  expect(restart).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain(catalogues.ar.settings.failed);
});
