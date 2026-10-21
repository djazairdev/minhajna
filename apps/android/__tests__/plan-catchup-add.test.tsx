// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة حصة» (#228, answers 353 to 357): a free time saved once as a
// catch-up session; the make-up due it names by default; another time
// refused where the teacher teaches; a school without bell times; and the
// options listing the session not yet recorded, cancelled and undone, but
// not brought back once another session has its time; and slots of two
// schools meeting by their bell times.
// Made-up data only.

import { addCatchUp, confirmSessions, makeUpsDue, parseDay, sessionsBetween } from '@minhajna/core';
import { useWindowDimensions, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CatchUp } from '../src/plan/CatchUp';
import { CatchUpAdd } from '../src/plan/CatchUpAdd';
import { meetsByBells } from '../src/plan/catch-up-add-rules';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const contextOf = (data: TestData) => coreContext({ ...data, state: data.book.state });
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** The demo day with 4م1's first session not held and marked to be made up. */
async function owed(): Promise<TestData> {
  const data = await withDay();
  const context = contextOf(data);
  const [first] = sessionsBetween(context, day, day);
  await data.book.recordAll(
    day,
    confirmSessions(context, [{ session: first, choice: { outcome: 'not-held', makeUp: true } }]),
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

test.each(['ar', 'fr', 'en'] as const)('adds the first free time once, as a plan session (%s)', async (language) => {
  const data = await withDay();
  const onDone = jest.fn();
  await showSettingsScreen(<CatchUpAdd courseId="c-1" onDone={onDone} onExtra={jest.fn()} />, data, language);
  const text = catalogues[language].catchUpAdd;
  expect(settingsTexts()).toEqual(expect.arrayContaining([text.agreed, text.free, text.extra]));
  expect(has('catchup-add-free-0')).toBe(true);
  expect(has('catchup-add-link')).toBe(false);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  const save = settingsControl('catchup-add-save');
  await ReactTestRenderer.act(async () => {
    await save.onPress?.({} as never);
    await save.onPress?.({} as never);
  });
  const added = [...data.book.state.catchUps.values()];
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ courseId: 'c-1', groupId: 'k-1-w', sessionType: 'lesson' });
  expect(added[0]).not.toHaveProperty('replaces');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('makes up the session due by default, and the options cancel it and undo that', async () => {
  const data = await owed();
  const [due] = makeUpsDue(contextOf(data), 'c-1');
  await showSettingsScreen(<CatchUpAdd courseId="c-1" onDone={jest.fn()} />, data);
  expect(settingsControl('catchup-add-link')).toMatchObject({ accessibilityState: { checked: true } });
  await pressSettings('catchup-add-save');
  const [added] = [...data.book.state.catchUps.values()];
  expect(added?.replaces).toBe(due?.key);
  expect(makeUpsDue(contextOf(data), 'c-1')).toEqual([]);

  await showSettingsScreen(<CatchUp courseId="c-1" />, data);
  expect(has('catchup-dues')).toBe(false);
  await pressSettings(`catchup-cancel-${added.id}`);
  expect(data.book.state.catchUps.size).toBe(0);
  expect(has('catchup-dues')).toBe(true);
  await pressUndo();
  expect(data.book.state.catchUps.get(added.id)).toEqual(added);
});

test('brings a cancelled catch-up back only while its time is free', async () => {
  const data = await withDay();
  const slot = { half: 'morning', index: 4 } as const;
  const event = addCatchUp(contextOf(data), { id: 'u-1', courseId: 'c-1', day: parseDay('2026-10-18'), slot }, day);
  await data.book.record(day, event);
  await showSettingsScreen(<CatchUp courseId="c-1" />, data);
  if (event.kind !== 'catchup.set') throw new Error('A catch-up session is set');
  await data.book.record(day, { ...event, catchUp: { ...event.catchUp, id: 'u-2' } });
  await pressSettings('catchup-cancel-u-1');
  await pressUndo();
  expect(has('catchup-not-restored')).toBe(true);
  expect([...data.book.state.catchUps.keys()]).toEqual(['u-2']);
});

test('refuses another time where the teacher teaches, naming the class', async () => {
  const data = await withDay();
  await showSettingsScreen(<CatchUpAdd courseId="c-2" onDone={jest.fn()} />, data);
  await pressSettings('catchup-add-other');
  await pressSettings('catchup-add-slot-m1');
  expect(has('catchup-add-clash')).toBe(true);
  expect(settingsTexts().join(' ')).toContain('4م1');
  expect(settingsControl('catchup-add-save')).toMatchObject({ accessibilityState: { disabled: true } });
  await pressSettings('catchup-add-save');
  expect(data.book.state.catchUps.size).toBe(0);
});

test('a school without bell times offers no time and opens its times', async () => {
  const data = await withDay();
  const onTimes = jest.fn();
  const untimed = { ...data, bells: { ...data.bells, templates: [] } };
  await showSettingsScreen(<CatchUpAdd courseId="c-1" onDone={jest.fn()} onTimes={onTimes} />, untimed);
  expect(has('catchup-add-no-times')).toBe(true);
  expect(has('catchup-add-free-0')).toBe(false);
  await pressSettings('catchup-add-times');
  expect(onTimes).toHaveBeenCalledWith('s-1');
});

test('slots of two schools meet by their bell times, and of one school by their number', async () => {
  const data = await withDay();
  const meets = meetsByBells({ ...data, state: data.book.state });
  const time = (index: number, from: string, to: string) => ({ half: 'morning', index, from, to }) as const;
  const base = { name: 'مدرسة (مثال)', levels: ['cem'], subjects: ['arabic'], zone: '16' };
  const a = { ...base, id: 'a', bells: { usual: [time(1, '08:00', '09:00'), time(2, '09:00', '10:00')] } };
  const b = { ...base, id: 'b', bells: { usual: [time(1, '09:30', '10:30')] } };
  const m = (index: number) => ({ half: 'morning', index }) as const;
  expect(meets(day, { school: a, slot: m(2) }, { school: b, slot: m(1) })).toBe(true);
  expect(meets(day, { school: a, slot: m(1) }, { school: b, slot: m(1) })).toBe(false);
  expect(meets(day, { school: a, slot: m(1) }, { school: a, slot: m(1) })).toBe(true);
});
