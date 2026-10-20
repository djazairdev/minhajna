// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { groupsData } from '../jest/calendar-groups-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { Groups } from '../src/calendar/Groups';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const saved = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
beforeEach(() => {
  saved.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test('an interrupted split keeps its saved prefix, never activates a rule and retries only missing changes', async () => {
  const data = await groupsData();
  const before = data.book.entries.length;
  const original = data.book.record.bind(data.book);
  let count = 0;
  jest
    .spyOn(data.book, 'record')
    .mockImplementation((day, event) =>
      ++count === 3 ? Promise.reject(new Error('Synthetic write failure')) : original(day, event),
    );
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('rotation-confirm-split');
  expect(data.book.entries.length - before).toBe(2);
  expect(data.book.state.calendar).toHaveLength(0);
  expect(has('rotation-split-ready')).toBe(false);
  await pressSettings('calendar-preview');
  expect(has('calendar-save')).toBe(false);
  await pressSettings('rotation-confirm-split');
  expect(data.book.entries.length - before).toBe(6);
  expect(has('rotation-split-ready')).toBe(true);
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(1);
});

test('failed rule saving keeps the reviewed split and preview for a safe retry', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await pressSettings('rotation-confirm-split');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  jest.spyOn(data.book, 'record').mockRejectedValueOnce(new Error('Synthetic write failure'));
  await pressSettings('calendar-save');
  expect(saved).not.toHaveBeenCalled();
  expect(data.book.state.calendar).toHaveLength(0);
  expect(has('rotation-split-ready')).toBe(true);
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.failed'));
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(1);
  expect(saved).toHaveBeenCalledTimes(1);
});

test('double taps cannot duplicate a split, and leaving never activates a calendar rule', async () => {
  const data = await groupsData();
  let release = () => undefined as void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = data.book.recordAll.bind(data.book);
  const write = jest.spyOn(data.book, 'recordAll').mockImplementation(async (day, events) => {
    await pending;
    return original(day, events);
  });
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await ReactTestRenderer.act(() => {
    void settingsControl('rotation-confirm-split').onPress?.({} as never);
    void settingsControl('rotation-confirm-split').onPress?.({} as never);
  });
  expect(settingsControl('rotation-confirm-split').disabled).toBe(true);
  await closeSettingsScreen();
  await ReactTestRenderer.act(async () => {
    release();
    await pending;
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(data.book.state.calendar).toHaveLength(0);
  expect(saved).not.toHaveBeenCalled();
});

test('a rule preview becomes stale if another reviewed split changes durable data', async () => {
  const data = await groupsData();
  await showSettingsScreen(<Groups schoolId="s-1" onSaved={saved} />, data);
  await pressSettings('rotation-confirm-split');
  await typeSettings('calendar-source', 'إعلان تجريبي');
  await pressSettings('calendar-preview');
  const pupil = data.book.state.pupils.get('example-0')!;
  const other = data.book.state.classes.get('k-1')!.groups.filter((one) => one.kind === 'half')[1].id;
  await data.book.record(data.book.entries.at(-1)!.day, { kind: 'pupil.set', pupil: { ...pupil, groups: [other] } });
  await pressSettings('calendar-save');
  expect(data.book.state.calendar).toHaveLength(0);
  expect(saved).not.toHaveBeenCalled();
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.changed'));
});
