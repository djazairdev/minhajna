// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «خيارات الاستدراك» (#228, answers 349 to 352): the class's pace, then the
// options in order; the pack's merge confirmed alone, undone at once or
// taken back from the decisions; and the plan's link while the class is
// behind. Made-up data only.

import { awaitingBetween, confirmSessions, parseDay, saveFreeList, type CatchUp as Options } from '@minhajna/core';
import { useWindowDimensions, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { coreContext } from '../src/storage/core-context';
import { ClassPlan } from '../src/classes/ClassPlan';
import { CatchUp } from '../src/plan/CatchUp';
import { buffersLine, tdLine } from '../src/plan/catch-up-rules';
import { catalogues, i18n, missingKeys, useText } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

/** The demo day with c-1's sessions not held, so the class is behind its plan. */
async function behind(): Promise<TestData> {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = awaitingBetween(context, parseDay('2026-10-11'), day).filter((one) => one.courseId === 'c-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return data;
}
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)('lists the options in order, applying none (%s)', async (language) => {
  const data = await behind();
  const entries = data.book.entries.length;
  const onAdd = jest.fn();
  await showSettingsScreen(<CatchUp courseId="c-1" onAdd={onAdd} />, data, language);
  const text = catalogues[language].catchUp;
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([text.intro, text.compress, text.buffers, text.choices, text.add, text.never]),
  );
  for (const rung of [1, 2, 3, 4]) expect(has(`catchup-rung-${rung}`)).toBe(true);
  expect(has('catchup-rung-5')).toBe(false);
  expect(has('catchup-confirm-0')).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  expect(data.book.entries.length).toBe(entries);
  await pressSettings('catchup-add');
  expect(onAdd).toHaveBeenCalledTimes(1);
});

test('confirms the pack’s merge alone, undoes it, and takes it back from the decisions', async () => {
  const data = await behind();
  await showSettingsScreen(<CatchUp courseId="c-1" />, data);
  await pressSettings('catchup-confirm-0');
  const [made] = [...data.book.state.decisions.values()];
  expect(made).toMatchObject({ courseId: 'c-1', kind: 'merge', items: ['u1-4', 'u1-5'] });
  expect(has('catchup-done')).toBe(true);
  expect(has('catchup-confirm-0')).toBe(false);
  const [undo] = settingsRoot().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.planItem.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await (undo.props as PressableProps).onPress?.({} as never);
  });
  expect(data.book.state.decisions.size).toBe(0);
  await pressSettings('catchup-confirm-0');
  const [again] = [...data.book.state.decisions.values()];
  await pressSettings(`exam-decision-${again.id}`);
  expect(data.book.state.decisions.size).toBe(0);
});

test('the plan links to the options while the class is behind, and a class without a plan has none', async () => {
  const data = await behind();
  const onCatchUp = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="c-1" onCatchUp={onCatchUp} />, data);
  await pressSettings('plan-catchup');
  expect(onCatchUp).toHaveBeenCalledTimes(1);
  await showSettingsScreen(<ClassPlan courseId="c-2" onCatchUp={onCatchUp} />, data);
  expect(has('plan-catchup')).toBe(false);
  await showSettingsScreen(<CatchUp courseId="c-2" />, data);
  expect(settingsTexts()).toContain(catalogues.ar.catchUp.noPlan);
});

test('words every zero case of the buffers and TD as facts', () => {
  const t = ((key: string, params?: Record<string, unknown>) =>
    `${key}${params === undefined ? '' : ` ${JSON.stringify(params)}`}`) as unknown as ReturnType<typeof useText>;
  const base: Options = {
    term: 1,
    bufferUsed: 2,
    bufferLeft: 1,
    delay: 0,
    hasBuffers: true,
    own: false,
    td: null,
    choices: [],
    repace: false,
  };
  const key = (options: Partial<Options>) => buffersLine(t, { ...base, ...options }).split(' ')[0];
  expect(key({})).toBe('catchUp.buffersLine');
  expect(key({ bufferLeft: 0, delay: 3 })).toBe('catchUp.buffersAllUsed');
  expect(key({ bufferUsed: 0 })).toBe('catchUp.buffersUnused');
  expect(key({ bufferUsed: 0, bufferLeft: 0 })).toBe('catchUp.buffersSpent');
  expect(key({ hasBuffers: false, bufferUsed: 0, bufferLeft: 0 })).toBe('catchUp.noBuffers');
  expect(key({ term: null })).toBe('catchUp.noExams');
  expect(key({ own: true })).toBe('catchUp.ownBuffers');
  expect(tdLine(t, { gives: 2, items: 0 })).toBe('catchUp.tdDone');
  expect(tdLine(t, { gives: 0, items: 2 }).split(' ')[0]).toBe('catchUp.tdNone');
  expect(tdLine(t, { gives: 2, items: 1 }).split(' ')[0]).toBe('catchUp.td');
});

test('records one decision for a double press', async () => {
  const data = await behind();
  await showSettingsScreen(<CatchUp courseId="c-1" />, data);
  const press = settingsRoot().findAll(
    (node) => node.props.testID === 'catchup-confirm-0' && typeof node.props.onPress === 'function',
  )[0].props as PressableProps;
  await ReactTestRenderer.act(async () => {
    await press.onPress?.({} as never);
    await press.onPress?.({} as never);
  });
  expect(data.book.state.decisions.size).toBe(1);
});

test('an own list says it has no buffers and no proposals', async () => {
  const data = await withDay();
  const list = {
    courseId: 'c-2',
    started: parseDay('2026-10-11'),
    items: [{ id: 'l1', kind: 'lesson' as const, title: 'درس (مثال)', sessions: 1 }],
  };
  await data.book.record(parseDay('2026-10-11'), saveFreeList(data.book.state.courses, list));
  await showSettingsScreen(<CatchUp courseId="c-2" />, data);
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([catalogues.ar.catchUp.ownBuffers, catalogues.ar.catchUp.ownChoices]),
  );
});
