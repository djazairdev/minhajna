// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's own start and R-Picture (#246, answers 489 and 490): the
// welcome's reader start leads, through the first PIN on a fresh install, and
// the notice, to the picture as the home, with no way back, the list's way
// back to it, and Help without the teacher's rows; the app opens there again
// once a statement is kept; the picture shows one grade at a time, in the
// profile's order, its statements and teachers counted, each cell the latest
// statement's delay and day, opening it, a misdated statement left out and
// marked, and rows grouped by school only when two are named; Settings with
// nothing set up shows reader mode's rows only. Made-up keys and statements
// only.

import { nameTeacher, parseDay } from '@minhajna/core';
import type { NavigationState } from '@react-navigation/native';
import { useWindowDimensions, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, withData } from '../jest/app-data';
import { FakeStorage } from '../jest/fake-storage';
import { KEY_A, KEY_B, keepStatement as keep, madeUpStatement as statement } from '../jest/reader-statements';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { startRoute } from '../src/navigation/start-route';
import { ReaderList } from '../src/reader/ReaderList';
import { ReaderOpen } from '../src/reader/ReaderOpen';
import { ReaderPicture } from '../src/reader/ReaderPicture';
import { Settings } from '../src/settings/Settings';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const label = (id: string) => String(settingsRoot().findByProps({ testID: id }).props.accessibilityLabel);

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('the welcome starts reader mode through the notice, with the picture as a home that has no way back', async () => {
  const data = await openTestData();
  expect(startRoute(data.book)).toBe('Welcome');
  let state: NavigationState | undefined;
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(withData(data, <AppNavigator onStateChange={(next) => (state = next)} />));
  });
  const press = async (id: string) =>
    ReactTestRenderer.act(async () => {
      (tree!.root.findByProps({ testID: id }).props as PressableProps).onPress?.({} as never);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
  await press('welcome-reader');
  expect(state?.routes.map((route) => [route.name, route.params])).toEqual([
    ['Welcome', undefined],
    ['Privacy', { reader: true }],
  ]);
  await press('privacy-accept');
  expect(state?.routes.map((route) => route.name)).toEqual(['ReaderHome']);
  expect(tree!.root.findAllByProps({ testID: 'reader-picture-empty' }).length).toBeGreaterThan(0);
  await press('reader-picture-list');
  expect(state?.routes.map((route) => route.name)).toEqual(['ReaderHome', 'ReaderList']);
  await press('reader-picture');
  expect(state?.routes.map((route) => route.name)).toEqual(['ReaderHome']);
  await press('reader-help');
  expect(state?.routes.map((route) => route.name)).toEqual(['ReaderHome', 'Help']);
  expect(
    ['help-demo', 'help-plan-error', 'help-problem'].map((id) => tree!.root.findAllByProps({ testID: id }).length > 0),
  ).toEqual([false, false, true]);
  await ReactTestRenderer.act(() => tree!.unmount());
  await keep(data, KEY_A, statement('2026-10-01', '4M1'));
  expect(startRoute(data.book)).toBe('ReaderHome');
});

test('on a fresh install, the reader start goes through the first PIN to the notice, then home', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const press = async (id: string) =>
    ReactTestRenderer.act(async () => {
      const node = tree!.root.findAll(
        (one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function',
      )[0];
      (node?.props as PressableProps).onPress?.({} as never);
      await settle();
    });
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={new FakeStorage().asSpec()} />);
    await settle();
  });
  await press('welcome-reader');
  for (const digit of '25802580') await press(`pin-${digit}`);
  expect(tree!.root.findAllByType(AppNavigator)[0]?.props.initialState).toEqual({
    index: 1,
    routes: [{ name: 'Welcome' }, { name: 'Privacy', params: { reader: true } }],
  });
  await press('privacy-accept');
  expect(tree!.root.findAllByProps({ testID: 'reader-home' }).length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() => tree!.unmount());
});

test.each(['ar', 'fr', 'en'] as const)(
  'the picture shows a grade at a time and opens a cell (%s)',
  async (language) => {
    const data = await openTestData();
    await keep(data, KEY_A, statement('2026-10-01', '4M2'));
    const latest = await keep(data, KEY_A, statement('2026-10-08', '4M2', 'arabic', '4am', 3));
    await keep(data, KEY_B, statement('2026-10-05', '4M1', 'math'));
    const first = await keep(data, KEY_B, statement('2026-10-05', '1M1', 'math', '1am'));
    await keep(data, KEY_B, statement('2026-10-30', '4M3'));
    const onOpen = jest.fn();
    const home = { onSettings: jest.fn(), onHelp: jest.fn(), onTeach: jest.fn() };
    await showSettingsScreen(<ReaderPicture onOpen={onOpen} onList={jest.fn()} home={home} />, data, language);
    const text = catalogues[language].reader;
    expect(has('reader-home')).toBe(true);
    const count = () => String(settingsRoot().findByProps({ testID: 'reader-grade-count' }).props.children);
    expect(count()).toContain(i18n.t('reader.teachers', { count: 1, lng: language }));
    await pressSettings('reader-cell-1M1-math');
    expect(onOpen).toHaveBeenLastCalledWith(first);
    await pressSettings('reader-grade-4am');
    expect(count()).toContain(i18n.t('reader.count', { count: 2, lng: language }));
    expect(count()).toContain(i18n.t('reader.teachers', { count: 2, lng: language }));
    expect(label('reader-cell-4M2-arabic')).toContain('08/10');
    expect(has('reader-cell-4M1-arabic')).toBe(false);
    expect(settingsTexts()).toEqual(expect.arrayContaining([text.picture.note, '08/10']));
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(has('reader-picture-left-out')).toBe(true);
    expect(missingKeys).toEqual([]);
    await pressSettings('reader-cell-4M2-arabic');
    expect(onOpen).toHaveBeenLastCalledWith(latest);
    for (const id of ['reader-settings', 'reader-help', 'reader-teach']) await pressSettings(id);
    expect([home.onSettings, home.onHelp, home.onTeach].map((one) => one.mock.calls.length)).toEqual([1, 1, 1]);
  },
);

test('a statement the picture leaves out is marked in the list and when opened', async () => {
  const data = await openTestData();
  const id = await keep(data, KEY_A, statement('2026-10-30', '4M3'));
  await showSettingsScreen(<ReaderList onOpen={jest.fn()} onPicture={jest.fn()} />, data);
  expect(settingsTexts().some((line) => line.includes(catalogues.ar.reader.leftOutShort))).toBe(true);
  await closeSettingsScreen();
  await showSettingsScreen(<ReaderOpen id={id} onList={jest.fn()} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.reader.leftOut);
  await closeSettingsScreen();
  await showSettingsScreen(<ReaderPicture onOpen={jest.fn()} onList={jest.fn()} />, data);
  expect(has('reader-picture-empty')).toBe(true);
  expect(settingsTexts()).toContain(i18n.t('reader.picture.leftOut', { count: 1 }));
});

test('rows are grouped by school once teachers are named with two schools', async () => {
  const data = await openTestData();
  await keep(data, KEY_A, statement('2026-10-01', '4M1'));
  await keep(data, KEY_B, statement('2026-10-01', '4M1'));
  await data.book.record(parseDay('2026-10-20'), nameTeacher(KEY_A, 'Made-up Teacher', 'Made-up School A'));
  await showSettingsScreen(<ReaderPicture onOpen={jest.fn()} onList={jest.fn()} />, data);
  expect(settingsTexts()).not.toContain('Made-up School A');
  await closeSettingsScreen();
  await data.book.record(parseDay('2026-10-20'), nameTeacher(KEY_B, 'Other Teacher', 'Made-up School B'));
  await showSettingsScreen(<ReaderPicture onOpen={jest.fn()} onList={jest.fn()} />, data);
  const schools = settingsTexts().filter((line) => line.includes('Made-up School'));
  expect(schools).toEqual([isolate('Made-up School A'), isolate('Made-up School B')]);
  expect(has('reader-home')).toBe(false);
});

test('Settings with nothing set up shows only reader mode’s rows', async () => {
  const data = await openTestData();
  await showSettingsScreen(<Settings onOpen={jest.fn()} />, data);
  const rows = settingsRoot()
    .findAll((node) => String(node.props.testID).startsWith('settings-') && node.props.onPress !== undefined)
    .map((node) => node.props.testID as string);
  expect([...new Set(rows)]).toEqual([
    'settings-received',
    'settings-security',
    'settings-backup',
    'settings-language',
    'settings-log',
    'settings-export',
    'settings-erase',
    'settings-help',
    'settings-privacy',
  ]);
});
