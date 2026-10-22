// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إعادة توزيع بقية الفصل» (#229, answers 363 to 370): rung 5 opening the
// draft while it is offered; the draft's counts, changes and weeks; a tick
// that the confirmation records as its own decision; «تراجع» taking all of
// it back; the decisions list taking back the re-pace alone; and primary
// waiting for the director. Made-up data only.

import { awaitingBetween, confirmSessions, parseDay, repaceDraft, type Day } from '@minhajna/core';
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
import { CatchUp } from '../src/plan/CatchUp';
import { Repace } from '../src/plan/Repace';
import { entryWords, weekDates } from '../src/plan/repace-rules';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, useText } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const contextOf = (data: TestData) => coreContext({ ...data, state: data.book.state });
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** The demo day with c-1's sessions not held, so items would land after the exams. */
async function behind(): Promise<TestData> {
  const data = await withDay();
  const sessions = awaitingBetween(contextOf(data), parseDay('2026-10-11'), day).filter(
    (one) => one.courseId === 'c-1',
  );
  await data.book.recordAll(
    day,
    confirmSessions(
      contextOf(data),
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return data;
}

async function pressUndo(): Promise<void> {
  const [undo] = settingsRoot().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.planItem.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await (undo.props as PressableProps).onPress?.({} as never);
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

test.each(['ar', 'fr', 'en'] as const)('rung 5 opens the draft, laid out by week (%s)', async (language) => {
  const data = await behind();
  const onRepace = jest.fn();
  await showSettingsScreen(<CatchUp courseId="c-1" onRepace={onRepace} />, data, language);
  expect(has('catchup-rung-5')).toBe(true);
  await pressSettings('catchup-repace');
  expect(onRepace).toHaveBeenCalledTimes(1);

  await showSettingsScreen(<Repace courseId="c-1" />, data, language);
  const text = catalogues[language].repace;
  const draft = repaceDraft(contextOf(data), 'c-1', day);
  expect(draft).not.toBeNull();
  expect(settingsTexts()).toEqual(expect.arrayContaining([text.changed, text.fixed, text.confirm]));
  for (const week of draft?.weeks ?? []) expect(has(`repace-week-${week.start}`)).toBe(true);
  const [row] = settingsRoot().findAll((node) => node.props.testID === `repace-week-${draft?.weeks[0]?.start}`);
  expect(String(row?.props.accessibilityLabel).includes('،')).toBe(language === 'ar');
  expect(has('repace-end')).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('confirms a ticked choice with the draft, and «تراجع» takes all of it back', async () => {
  const data = await behind();
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  expect(repaceDraft(contextOf(data), 'c-1', day)?.ticked).toEqual([]);
  await pressSettings('repace-choice-0');
  await pressSettings('repace-confirm');
  const [repace] = [...data.book.state.repaces.values()];
  expect(repace?.decisions).toHaveLength(1);
  expect(data.book.state.decisions.has(repace?.decisions[0] ?? '')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.repace.confirmed);
  expect(has('repace-confirm')).toBe(false);
  expect(has('repace-choice-0')).toBe(false);
  expect(has('repace-applied')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.repace.notOffered);
  await pressUndo();
  expect(data.book.state.repaces.size).toBe(0);
  expect(data.book.state.decisions.size).toBe(0);
  const [tick] = settingsRoot().findAll(
    (node) => node.props.testID === 'repace-choice-0' && node.props.accessibilityState !== undefined,
  );
  expect(tick?.props.accessibilityState).toMatchObject({ checked: false });
});

test('the decisions list takes back the re-pace alone, and «تراجع» brings it back', async () => {
  const data = await behind();
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  await pressSettings('repace-choice-0');
  await pressSettings('repace-confirm');
  const [repace] = [...data.book.state.repaces.values()];
  await showSettingsScreen(<CatchUp courseId="c-1" />, data);
  await pressSettings(`exam-decision-${repace?.id ?? ''}`);
  expect(data.book.state.repaces.size).toBe(0);
  expect(data.book.state.decisions.size).toBe(1);
  await pressUndo();
  expect(data.book.state.repaces.get(repace?.id ?? '')).toEqual(repace);
});

test('waits for the director in primary, and is not offered to a class on its plan', async () => {
  const data = await behind();
  const primary = { id: 'k-1', schoolId: 's-1', level: 'primary', grade: '4am', name: '4م1' } as const;
  await data.book.record(day, {
    kind: 'class.set',
    schoolClass: { ...primary, groups: [{ id: 'k-1-w', kind: 'whole', name: '4م1' }] },
  });
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  expect(has('repace-primary')).toBe(true);
  expect(has('repace-confirm')).toBe(false);

  const onPlan = await withDay();
  await showSettingsScreen(<CatchUp courseId="c-1" onRepace={jest.fn()} />, onPlan);
  expect(has('catchup-repace')).toBe(false);
  expect(has('catchup-rung-5')).toBe(false);
});

test('words a week’s dates and an item’s stages', () => {
  const t = ((key: string, params?: Record<string, unknown>) =>
    `${key}${params === undefined ? '' : ` ${JSON.stringify(params)}`}`) as unknown as ReturnType<typeof useText>;
  const months = [...Array(12).keys()].map((n) => ({ ar: `m${n + 1}`, fr: `m${n + 1}`, en: `m${n + 1}` }));
  const week = (start: string, end: string) => ({ start: start as Day, end: end as Day });
  expect(weekDates(week('2026-10-25', '2026-10-29'), 'ar', { months })).toBe('25 – 29 m10');
  expect(weekDates(week('2026-10-29', '2026-11-02'), 'ar', { months })).toBe('29 m10 – 2 m11');
  const item = { id: 'l1', kind: 'lesson', title: 'L' } as const;
  const words = entryWords(t, { kind: 'item', item, share: { first: 2, last: 4, of: 4 } }, 'ar', { months });
  expect(words).toContain('repace.shareRange');
  expect(words).toContain('"last":4');
});
