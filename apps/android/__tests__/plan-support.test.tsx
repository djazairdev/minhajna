// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «قائمة الدعم» (#228, answers 359 and 360): items typed, moved and
// deleted with «تراجع», each saved at once; a support session logged from
// the extra-session form taking the first item it has not finished, or
// leaving it first when unticked; and the queue's links from the plan and
// the catch-up options; finished items listed under «أُنجز» with the
// counts; and titles kept on one plain line. Made-up data only.

import { extraSessions, logExtra, nextSupportItem, parseDay, saveSupportQueue } from '@minhajna/core';
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
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { ExtraSession } from '../src/extra/ExtraSession';
import { CatchUp } from '../src/plan/CatchUp';
import { SupportQueue } from '../src/plan/SupportQueue';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const titles = (data: TestData) => data.book.state.supportQueues.get('c-1')?.items.map((item) => item.title) ?? [];
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

async function choose(group: string, value: string): Promise<void> {
  await ReactTestRenderer.act(async () => {
    const [node] = settingsRoot().findAll(
      (one) => one.props.testID === group && typeof one.props.onSelect === 'function',
    );
    (node.props as { onSelect: (value: string) => void }).onSelect(value);
    await Promise.resolve();
  });
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

test.each(['ar', 'fr', 'en'] as const)('types, moves and deletes items, each saved at once (%s)', async (language) => {
  const data = await withDay();
  await showSettingsScreen(<SupportQueue courseId="c-1" onLog={jest.fn()} />, data, language);
  expect(settingsTexts()).toContain(catalogues[language].supportQueue.empty);
  for (const title of ['أ (مثال)', 'ب (مثال)']) {
    await typeSettings('support-new', title);
    await pressSettings('support-add');
  }
  expect(titles(data)).toEqual(['أ (مثال)', 'ب (مثال)']);
  const [, second] = data.book.state.supportQueues.get('c-1')!.items;
  await pressSettings(`support-item-${second.id}`);
  await pressSettings('support-up');
  expect(titles(data)).toEqual(['ب (مثال)', 'أ (مثال)']);
  await pressSettings('support-delete');
  expect(titles(data)).toEqual(['أ (مثال)']);
  const [undo] = settingsRoot().findAll(
    (node) =>
      node.props.accessibilityLabel === catalogues[language].planItem.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await (undo.props as PressableProps).onPress?.({} as never);
  });
  expect(titles(data)).toEqual(['ب (مثال)', 'أ (مثال)']);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('refuses an empty or long title', async () => {
  const data = await withDay();
  await showSettingsScreen(<SupportQueue courseId="c-1" />, data);
  await pressSettings('support-add');
  expect(settingsTexts()).toContain(catalogues.ar.supportQueue.missing);
  await typeSettings('support-new', 'x'.repeat(121));
  await pressSettings('support-add');
  expect(titles(data)).toEqual([]);
});

test('a logged support session takes the first item it has not finished', async () => {
  const data = await withDay();
  const items = [
    { id: 's1', title: 'أ (مثال)' },
    { id: 's2', title: 'ب (مثال)' },
  ];
  await data.book.record(data.year.from, saveSupportQueue(data.book.state, { courseId: 'c-1', items }));
  const onQueue = jest.fn();
  await showSettingsScreen(<ExtraSession courseId="c-1" onQueue={onQueue} />, data);
  await choose('extra-kind', 'review');
  expect(has('extra-support')).toBe(false);
  await choose('extra-kind', 'support');
  expect(settingsTexts().join(' ')).toContain('أ (مثال)');
  await pressSettings('extra-support-finished');
  await typeSettings('extra-from', '15:00');
  await typeSettings('extra-to', '16:00');
  await pressSettings('extra-save');
  const [first] = extraSessions(data.book.state);
  expect(first).toMatchObject({ item: 's1' });
  expect(first).not.toHaveProperty('finished');
  expect(nextSupportItem(data.book.state, 'c-1')?.id).toBe('s1');
  await pressSettings('extra-support-queue');
  expect(onQueue).toHaveBeenCalledWith('c-1');
});

test('the plan and the catch-up options open the queue', async () => {
  const data = await withDay();
  const onSupport = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="c-1" onSupport={onSupport} />, data);
  await pressSettings('plan-support');
  await showSettingsScreen(<CatchUp courseId="c-1" onSupport={onSupport} />, data);
  await pressSettings('catchup-support');
  expect(onSupport).toHaveBeenCalledTimes(2);
});

test('lists the items left first, then the finished ones, with the counts, moving within each group', async () => {
  const data = await withDay();
  const items = ['s1', 's2', 's3'].map((id) => ({ id, title: `${id} (مثال)` }));
  await data.book.record(data.year.from, saveSupportQueue(data.book.state, { courseId: 'c-1', items }));
  const context = coreContext({ ...data, state: data.book.state });
  const extra = { id: 'x1', courseId: 'c-1', kind: 'support', day: day, from: '14:00', to: '15:00' } as const;
  await data.book.recordAll(day, logExtra(context, { ...extra, item: 's2', finished: true }, day));
  await showSettingsScreen(<SupportQueue courseId="c-1" />, data);
  const order = settingsRoot()
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('support-item-'))
    .map((node) => node.props.testID as string);
  expect([...new Set(order)]).toEqual(['support-item-s1', 'support-item-s3', 'support-item-s2']);
  expect(settingsTexts()).toEqual(expect.arrayContaining([catalogues.ar.supportQueue.done]));
  expect(settingsTexts().join(' ')).toContain('أُنجز 1، يبقى 2');
  await pressSettings('support-item-s3');
  await pressSettings('support-up');
  expect(data.book.state.supportQueues.get('c-1')?.items.map((item) => item.id)).toEqual(['s3', 's2', 's1']);
});

test('keeps a typed title on one plain line', async () => {
  const data = await withDay();
  await showSettingsScreen(<SupportQueue courseId="c-1" />, data);
  await typeSettings('support-new', 'سطر\nثان\u202e\u000bثالث');
  await pressSettings('support-add');
  expect(titles(data)).toEqual(['سطر ثان ثالث']);
});
