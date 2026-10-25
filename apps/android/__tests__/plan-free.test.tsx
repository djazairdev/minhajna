// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list without a pack (#227, answer 346): typed item by item,
// units grouping the items after them, reordered, edited and removed by
// selection, saved whole, then followed by the class's plan with its own
// badge and no pack details, changes or layers. Made-up data only.

import { awaitingBetween, confirmSessions, parseDay, type FreeList } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { PlanFree } from '../src/plan/PlanFree';
import { EMPTY_DRAFT, draftNeeds, draftTyped, itemOf, shifted } from '../src/plan/free-rules';
import { PlanItem } from '../src/plan/PlanItem';
import { Plans } from '../src/settings/Plans';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, useText } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const rows = () => [
  ...new Set(
    settingsRoot()
      .findAll((node) => /^free-item-/.test(String(node.props.testID)))
      .map((node) => String(node.props.testID).slice('free-item-'.length)),
  ),
];
const saved = (data: TestData) => data.book.state.lists.get('c-2');

async function add(title: string, kind?: string, more = 0, stages?: string): Promise<void> {
  await typeSettings('free-title', title);
  if (kind !== undefined) await pressSettings(`free-kind-${kind}`);
  for (let n = 0; n < more; n += 1) await pressSettings('free-sessions-increase');
  if (stages !== undefined) await typeSettings('free-stages', stages);
  await pressSettings('free-add');
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

test.each(['ar', 'fr', 'en'] as const)('types a list item by item and saves it whole (%s)', async (language) => {
  const data = await withDay();
  const onDirty = jest.fn();
  await showSettingsScreen(<PlanFree courseId="c-2" onDirty={onDirty} />, data, language);
  const text = catalogues[language].planFree;
  expect(settingsControl('free-add').disabled).toBe(true);
  expect(settingsControl('free-save').disabled).toBe(true);
  await add('الوحدة الأولى (مثال)', 'unit');
  await add('درس أول (مثال)', 'lesson', 1, 'قراءة\n\nشرح');
  await add('درس ثانٍ (مثال)');
  expect(rows()).toHaveLength(3);
  expect(settingsTexts()).toContain(text.intro);
  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  await pressSettings('free-save');
  const list = saved(data);
  expect(list?.items.map(({ kind, title, sessions, stages }) => ({ kind, title, sessions, stages }))).toEqual([
    { kind: 'unit', title: 'الوحدة الأولى (مثال)', sessions: undefined, stages: undefined },
    { kind: 'lesson', title: 'درس أول (مثال)', sessions: 2, stages: ['قراءة', 'شرح'] },
    { kind: 'lesson', title: 'درس ثانٍ (مثال)', sessions: 1, stages: undefined },
  ]);
  expect(list?.started).toBe('2026-10-15');
  expect(has('free-saved')).toBe(true);
  expect(onDirty).toHaveBeenLastCalledWith(false);
  expect(settingsControl('free-save').disabled).toBe(true);
});

test('moves, edits and removes the selected items, and records only on saving', async () => {
  const data = await withDay();
  await showSettingsScreen(<PlanFree courseId="c-2" />, data);
  await add('أ (مثال)');
  await add('ب (مثال)');
  await add('ج (مثال)');
  const [a, b, c] = rows();
  await pressSettings(`free-item-${c}`);
  expect(settingsControl(`free-item-${c}`).accessibilityState?.checked).toBe(true);
  await pressSettings('free-earlier');
  expect(rows()).toEqual([a, c, b]);
  await pressSettings('free-edit');
  expect(has('free-actions')).toBe(false);
  await typeSettings('free-title', 'ج معدّل (مثال)');
  await pressSettings('free-add');
  await pressSettings(`free-item-${a}`);
  await pressSettings('free-remove');
  expect(rows()).toEqual([c, b]);
  expect(saved(data)).toBeUndefined();
  await pressSettings('free-save');
  expect(saved(data)?.items.map((item) => item.title)).toEqual(['ج معدّل (مثال)', 'ب (مثال)']);
  expect(saved(data)?.removed).toBeUndefined();
});

test('says what an item still needs, and refuses a class on a pack', async () => {
  const data = await withDay();
  await showSettingsScreen(<PlanFree courseId="c-2" />, data);
  await typeSettings('free-title', 'درس (مثال)');
  await typeSettings('free-stages', Array.from({ length: 13 }, (_, n) => `مرحلة ${n}`).join('\n'));
  expect(settingsControl('free-add').disabled).toBe(true);
  expect(has('free-needs')).toBe(true);
  await showSettingsScreen(<PlanFree courseId="c-1" />, data);
  expect(settingsTexts()).toContain(catalogues.ar.planFree.hasPack);
  expect(has('free-form')).toBe(false);
});

test('the plan follows the saved list, with its own badge and no pack links', async () => {
  const data = await withDay();
  const onEditList = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="c-2" onEditList={onEditList} onChanges={jest.fn()} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.plan.noPack);
  await pressSettings('plan-edit-list');
  expect(onEditList).toHaveBeenCalledTimes(1);
  await showSettingsScreen(<PlanFree courseId="c-2" />, data);
  await add('درس أول (مثال)');
  await add('درس ثانٍ (مثال)');
  await pressSettings('free-save');
  const [first] = saved(data)!.items;
  await showSettingsScreen(
    <ClassPlan courseId="c-2" onEditList={onEditList} onChanges={jest.fn()} onLayers={jest.fn()} />,
    data,
  );
  expect(has('plan-own')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.plan.status.own);
  expect(has('plan-changes') || has('plan-layers') || has('plan-details')).toBe(false);
  expect(has(`plan-${first.id}`)).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  await showSettingsScreen(
    <PlanItem courseId="c-2" itemId={first.id} onChanges={jest.fn()} onReport={jest.fn()} onEditList={onEditList} />,
    data,
  );
  expect(has('item-list')).toBe(true);
  expect(has('item-move') || has('item-report') || has('item-changes')).toBe(false);
});

test('moves a split selection a place, stopping at either end, and reads titles as they are kept', () => {
  const item = (id: string) => ({ id, kind: 'lesson' as const, title: id, sessions: 1 });
  const list: FreeList = { courseId: 'c-2', started: parseDay('2026-10-15'), items: ['a', 'b', 'c', 'd'].map(item) };
  const ids = (one: FreeList) => one.items.map((each) => each.id).join('');
  expect(ids(shifted(list, new Set(['a', 'c']), -1))).toBe('acbd');
  expect(ids(shifted(list, new Set(['b', 'd']), 1))).toBe('acbd');
  expect(ids(shifted(list, new Set(['a', 'b']), 1))).toBe('cabd');
  expect(shifted(list, new Set(['a', 'b']), -1)).toBe(list);
  expect(shifted(list, new Set(['d']), 1)).toBe(list);
  const draft = { ...EMPTY_DRAFT, title: '\u200fدرس (مثال)' };
  expect(itemOf(draft, 'x')?.title).toBe('درس (مثال)');
  const t = ((key: string) => key) as unknown as ReturnType<typeof useText>;
  expect(draftNeeds(t, draft)).toBeNull();
  expect(draftTyped(EMPTY_DRAFT)).toBe(false);
  expect(draftTyped({ ...EMPTY_DRAFT, stages: 'مرحلة' })).toBe(true);
});

test('asks before leaving typing not added, and drops the edit of an item removed', async () => {
  const data = await withDay();
  const onDirty = jest.fn();
  await showSettingsScreen(<PlanFree courseId="c-2" onDirty={onDirty} />, data);
  await typeSettings('free-title', 'درس (مثال)');
  expect(onDirty).toHaveBeenLastCalledWith(true);
  await pressSettings('free-add');
  const [only] = rows();
  await pressSettings(`free-item-${only}`);
  await pressSettings('free-edit');
  expect(has('free-cancel')).toBe(true);
  await pressSettings(`free-item-${only}`);
  await pressSettings('free-remove');
  expect(has('free-cancel')).toBe(false);
  expect(rows()).toEqual([]);
});

test('keeps the title of a removed item a session was recorded under, and shows the list in Settings', async () => {
  const data = await withDay();
  await showSettingsScreen(<PlanFree courseId="c-2" />, data);
  await add('درس أول (مثال)');
  await add('درس ثانٍ (مثال)');
  await pressSettings('free-save');
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = awaitingBetween(context, day, day).filter((session) => session.courseId === 'c-2');
  expect(sessions).toHaveLength(1);
  await data.book.recordAll(day, confirmSessions(context, [{ session: sessions[0] }]));
  await showSettingsScreen(<PlanFree courseId="c-2" />, data);
  const [first, second] = rows();
  await pressSettings(`free-item-${first}`);
  await pressSettings(`free-item-${second}`);
  await pressSettings('free-remove');
  await pressSettings('free-save');
  expect(saved(data)?.items).toEqual([]);
  expect(saved(data)?.removed).toEqual([{ id: first, kind: 'lesson', title: 'درس أول (مثال)' }]);
  await showSettingsScreen(<Plans onChoose={jest.fn()} onRelease={jest.fn()} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.plan.status.own);
});
