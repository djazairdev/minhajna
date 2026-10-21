// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Scheduled support sessions (#228, answers 361 and 362): «دعم أو تدارك»
// on «إضافة حصة» taking a free time with no make-up; the queue listing it
// with the item it would take, logged or cancelled with «تراجع»; the form
// filled in from it, which ends it; and Today's reminder. Made-up data only.

import {
  addCatchUp,
  extraSessions,
  parseDay,
  saveSupportQueue,
  scheduledSupport,
  sessionsBetween,
} from '@minhajna/core';
import { useWindowDimensions, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ExtraSession } from '../src/extra/ExtraSession';
import { CatchUpAdd } from '../src/plan/CatchUpAdd';
import { SupportQueue } from '../src/plan/SupportQueue';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { SupportToday } from '../src/today/SupportToday';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const slot = { half: 'morning', index: 4 } as const;
const contextOf = (data: TestData) => coreContext({ ...data, state: data.book.state });
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** The demo day with 4م1's support list and a support session scheduled at its fourth slot. */
async function scheduled(): Promise<TestData> {
  const data = await withDay();
  const items = [{ id: 's1', title: 'أ (مثال)' }];
  await data.book.record(day, saveSupportQueue(data.book.state, { courseId: 'c-1', items }));
  const input = { id: 'u-1', courseId: 'c-1', day, slot, kind: 'support' as const };
  await data.book.record(day, addCatchUp(contextOf(data), input, day));
  return data;
}

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)('schedules a support session in a free time (%s)', async (language) => {
  const data = await withDay();
  const onDone = jest.fn();
  await showSettingsScreen(<CatchUpAdd courseId="c-1" kind="support" onDone={onDone} />, data, language);
  const text = catalogues[language].catchUpAdd;
  expect(settingsTexts()).toEqual(expect.arrayContaining([text.supportPage]));
  expect(has('catchup-add-link')).toBe(false);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  await pressSettings('catchup-add-save');
  const [added] = [...data.book.state.catchUps.values()];
  expect(added).toMatchObject({ courseId: 'c-1', kind: 'support' });
  expect(added).not.toHaveProperty('replaces');
  const context = contextOf(data);
  expect(sessionsBetween(context, added.day, added.day).some((one) => one.catchUp !== undefined)).toBe(false);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('the queue lists it with its item, logs it from its day, and cancels it with an undo', async () => {
  const data = await scheduled();
  const onLogScheduled = jest.fn();
  await showSettingsScreen(<SupportQueue courseId="c-1" onLogScheduled={onLogScheduled} />, data);
  expect(settingsTexts().join(' ')).toContain('أ (مثال)');
  await pressSettings('support-log-u-1');
  expect(onLogScheduled).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
  await pressSettings('support-cancel-u-1');
  expect(data.book.state.catchUps.size).toBe(0);
  const [undo] = settingsRoot().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.planItem.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await (undo.props as PressableProps).onPress?.({} as never);
  });
  expect(data.book.state.catchUps.get('u-1')).toMatchObject({ kind: 'support' });
});

test('the form opens filled in from it, and logging it ends it', async () => {
  const data = await scheduled();
  await showSettingsScreen(
    <ExtraSession courseId="c-1" scheduled={{ id: 'u-1', day, from: '11:00', to: '12:00' }} />,
    data,
  );
  await pressSettings('extra-save');
  const [logged] = extraSessions(data.book.state);
  expect(logged).toMatchObject({ kind: 'support', day, from: '11:00', to: '12:00', scheduled: 'u-1', item: 's1' });
  expect(scheduledSupport(data.book.state, 'c-1')).toEqual([]);
});

test('Today reminds the day’s scheduled support session and opens its form', async () => {
  const data = await scheduled();
  const onLog = jest.fn();
  await showSettingsScreen(<SupportToday day={day} onLog={onLog} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.supportQueue.badge);
  await pressSettings('today-support-log-u-1');
  expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1' }));
  await showSettingsScreen(<SupportToday day={parseDay('2026-10-18')} onLog={onLog} />, data);
  expect(has('today-support-u-1')).toBe(false);
});
