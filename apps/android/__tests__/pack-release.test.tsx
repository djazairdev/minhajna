// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إصدار جديد للمخطط» (#322, Pack-release, answers 487 and 488): what the
// bundled 2026.2 example changes and that it comes with the app; the classes
// on 2026.1, each moved on its own; a class without changes moved at once,
// and back to its plan; a class change the split makes unclear asked first,
// a later answer cleared when an earlier one changes, a choice that no longer
// fits disabled, and the answer recorded as the class's own change; a
// layer's change asked too, and the layers section saying how each list is
// carried; staying records nothing. Made-up classes and packs only.

import {
  addLayer,
  courseDecisions,
  layerKey,
  parseDay,
  switchLayer,
  type PlanDecision,
  type PlanLayer,
} from '@minhajna/core';
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
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { PackRelease } from '../src/plan/PackRelease';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const example = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };
const onCourse = jest.fn();
const onPlan = jest.fn();
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const disabled = (id: string) => settingsControl(id).disabled === true;
const show = (data: TestData, courseId = 'c-1', language: 'ar' | 'fr' | 'en' = 'ar') =>
  showSettingsScreen(
    <PackRelease courseId={courseId} release="2026.2" onCourse={onCourse} onPlan={onPlan} />,
    data,
    language,
  );
const decide = (data: TestData, decision: PlanDecision) => data.book.record(day, { kind: 'plan.decided', decision });
const own = (data: TestData) =>
  [...courseDecisions(coreContext({ ...data, state: data.book.state }), 'c-1').values()].filter(
    (one) => one.courseId === 'c-1',
  );

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'says what the release changes, and moves a class without changes at once (%s)',
  async (language) => {
    const data = await withDay();
    await data.book.record(day, {
      kind: 'course.set',
      course: { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack: example },
    });
    await show(data, 'c-1', language);
    const text = catalogues[language].packRelease;
    expect(has('release-bundled')).toBe(true);
    expect(['page', 'title', 'split'].map((kind, index) => [kind, has(`release-change-${index}`)])).toEqual([
      ['page', true],
      ['title', true],
      ['split', true],
    ]);
    expect(has('release-change-3')).toBe(false);
    expect(settingsTexts()).toEqual(expect.arrayContaining([text.kinds.page, text.kinds.title, text.renamedNote]));
    expect(has('release-classes-c-1') && has('release-classes-c-2')).toBe(true);
    expect(has('release-question-0')).toBe(false);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('release-classes-c-2');
    expect(onCourse).toHaveBeenCalledWith('c-2');
    await pressSettings('release-move');
    expect(data.book.state.courses.get('c-1')?.pack).toEqual({ ...example, release: '2026.2' });
    expect(data.book.state.courses.get('c-2')?.pack).toEqual(example);
    expect(has('release-moved')).toBe(true);
    await pressSettings('release-back');
    expect(onPlan).toHaveBeenCalledWith('c-1');
  },
);

test('asks about changes the split makes unclear, and records each answer as the class’s own change', async () => {
  const data = await withDay();
  const made = { courseId: 'c-1', day };
  await decide(data, { ...made, id: 'b5', seq: 1, kind: 'budget', item: 'u1-5', sessions: 2 });
  await decide(data, { ...made, id: 's5', seq: 2, kind: 'split', item: 'u1-5', titles: ['Part A', 'Part B'] });
  await show(data);
  expect(has('release-question-0') && has('release-question-1')).toBe(true);
  expect(String(settingsControl('release-move').accessibilityLabel)).toBe(catalogues.ar.packRelease.answerFirst);
  expect(disabled('release-move')).toBe(true);
  await pressSettings('release-answer-0-u1-5b');
  await pressSettings('release-answer-1-u1-5a');
  expect(disabled('release-move')).toBe(false);
  await pressSettings('release-answer-0-none');
  expect(disabled('release-move')).toBe(true);
  expect(settingsControl('release-answer-1-u1-5a').accessibilityState?.checked).toBe(false);
  await pressSettings('release-answer-0-u1-5b');
  await pressSettings('release-answer-1-none');
  expect(has('release-effect')).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  await pressSettings('release-move');
  expect(data.book.state.courses.get('c-1')?.pack?.release).toBe('2026.2');
  expect(own(data).map((one) => [one.kind, 'item' in one ? one.item : null])).toEqual([['budget', 'u1-5b']]);
  expect(has('release-moved')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.packRelease.movedAnswers);
});

test("asks about a layer's change, says how each list is carried, and staying records nothing", async () => {
  const data = await withDay();
  const school: PlanLayer = {
    level: 'school',
    id: 'example-school',
    pack: example.id,
    title: 'Made-up school layer',
    by: 'Made-up author',
    made: day,
    operations: [{ kind: 'budget', item: 'u1-5', sessions: 3 }],
  };
  await data.book.record(day, addLayer(data.book.state, { layer: school }));
  await data.book.record(day, switchLayer(data.book.state, 'c-1', 'school', layerKey(school)));
  await decide(data, { courseId: 'c-1', day, id: 'k2', seq: 1, kind: 'skip', item: 'u1-2' });
  await show(data);
  const text = catalogues.ar.packRelease;
  expect(has('release-question-0')).toBe(true);
  expect(has('release-question-1')).toBe(false);
  expect(has('release-list-0') && has('release-list-1')).toBe(true);
  expect(settingsTexts()).toEqual(expect.arrayContaining([text.asIs, text.asked, text.rule]));
  const before = data.book.entries.length;
  await pressSettings('release-stay');
  expect(onPlan).toHaveBeenCalledWith('c-1');
  expect(data.book.entries.length).toBe(before);
  expect(data.book.state.courses.get('c-1')?.pack).toEqual(example);
});

test('says when no class is on an older release', async () => {
  const data = await withDay();
  await data.book.record(day, {
    kind: 'course.set',
    course: {
      id: 'c-1',
      classId: 'k-1',
      subject: 'arabic',
      year: '2026-2027',
      pack: { ...example, release: '2026.2' },
    },
  });
  await show(data);
  expect(has('release-none')).toBe(true);
  expect(has('release-move')).toBe(false);
});

test('disables a choice that does not fit the newer plan', async () => {
  const data = await withDay();
  await decide(data, { courseId: 'c-1', day, id: 'j4', seq: 1, kind: 'join', items: ['u1-4', 'u1-5'] });
  await show(data);
  expect([disabled('release-answer-0-u1-5a'), disabled('release-answer-0-u1-5b')]).toEqual([false, true]);
  expect(disabled('release-answer-0-none')).toBe(false);
});
