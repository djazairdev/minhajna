// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary slot's types on Week-slot (#230, Week-slot-primary, answer 374):
// a slot keeps its activity type when saved again, the activity comes from
// the weekly model of the subject's pack with «بلا نوع» first, it stays
// while another type is tried, «معالجة» and «دعم» drop it on saving and
// say they are outside the plan, a subject with no plan has no types, one
// whose plan has no model says so, and a slot with bell times shows them.
// Made-up data only.

import { parseDay, withSlotTime, type TimetableVersion } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { WeekDraw } from '../src/week/WeekDraw';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const text = catalogues.ar.week;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <WeekDraw onDone={jest.fn()} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const control = (id: string): ReactTestInstance =>
  root().find((node) => node.props.testID === id && typeof node.props.onPress === 'function');
const exists = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
const checked = (id: string): unknown =>
  root().findAll((node) => node.props.testID === id && node.props.accessibilityState !== undefined)[0]?.props
    .accessibilityState;

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function open(cell: string) {
  await press('pen-details');
  await press(`draw-${cell}`);
}

async function saved(data: TestData) {
  await press('week-save');
  await settle();
  return data.book.state.timetables.at(-1)!.version;
}

const entryAt = (version: TimetableVersion) =>
  version.entries.find((entry) => entry.weekday === 4 && entry.slot.half === 'morning' && entry.slot.index === 1);

test('keeps a slot’s activity type when it is saved again', async () => {
  const data = await withPrimary();
  await render(data);
  await open('4-m1');
  expect(checked('slot-0-type-lesson')).toMatchObject({ checked: true });
  expect(checked('slot-0-activity-reading')).toMatchObject({ checked: true });
  expect(shown()).toEqual(expect.arrayContaining([text.activity, text.activityHint]));
  await press('slot-save');
  expect(entryAt(await saved(data))).toMatchObject({ sessionType: 'lesson', activity: 'reading' });
});

test('changes the activity from the weekly model, or takes it off', async () => {
  const data = await withPrimary();
  await render(data);
  await open('4-m1');
  await press('slot-0-activity-writing');
  await press('slot-save');
  expect(entryAt(await saved(data))?.activity).toBe('writing');
  await open('4-m1');
  await press('slot-0-activity-');
  await press('slot-save');
  expect(entryAt(await saved(data))).not.toHaveProperty('activity');
});

test('«معالجة» drops the activity and says it is outside the main plan', async () => {
  const data = await withPrimary();
  await render(data);
  await open('4-m1');
  await press('slot-0-type-remediation');
  expect(exists('slot-0-activity')).toBe(false);
  expect(shown()).toContain(text.outsidePlan);
  await press('slot-save');
  const entry = entryAt(await saved(data));
  expect(entry).toMatchObject({ sessionType: 'remediation' });
  expect(entry).not.toHaveProperty('activity');
});

test('a subject with no plan, or whose plan has no weekly model, offers no activity', async () => {
  const data = await withPrimary();
  await render(data);
  await open('4-a1');
  expect(exists('slot-0-activity')).toBe(false);
  expect(shown()).not.toContain(text.noModel);
  expect(exists('slot-0-time')).toBe(false);
});

test('a subject whose plan has no weekly model says so', async () => {
  const data = await withPrimary();
  const maths = data.book.state.courses.get('m-1')!;
  const pack = { id: 'dz.cem.1am.math.example', release: '2026.1' };
  await data.book.record(parseDay('2026-10-15'), { kind: 'course.set', course: { ...maths, pack } });
  await render(data);
  await open('4-a1');
  expect(exists('slot-0-activity')).toBe(false);
  expect(shown()).toContain(text.noModel);
});

test('keeps the activity while another session type is tried, and drops it on saving outside the plan', async () => {
  const data = await withPrimary();
  await render(data);
  await open('4-m1');
  await press('slot-0-type-support');
  expect(exists('slot-0-activity')).toBe(false);
  await press('slot-0-type-lesson');
  expect(checked('slot-0-activity-reading')).toMatchObject({ checked: true });
  await press('slot-0-type-support');
  await press('slot-save');
  const entry = entryAt(await saved(data));
  expect(entry).toMatchObject({ sessionType: 'support' });
  expect(entry).not.toHaveProperty('activity');
});

test('shows the slot’s times from the school’s bells, with their minutes', async () => {
  const data = await withPrimary();
  const school = data.book.state.schools.get('s-1')!;
  const timed = withSlotTime(school, 'usual', { half: 'morning', index: 1 }, { from: '08:00', to: '09:00' });
  await data.book.record(parseDay('2026-10-15'), { kind: 'school.set', school: timed });
  await render(data);
  await open('4-m1');
  const [line] = root().findAll((node) => node.props.testID === 'slot-0-time' && node.type === Text);
  const words = [line?.props.children as unknown].flat().join('');
  expect(words).toContain('08:00 – 09:00');
  expect(words).toContain('60');
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every type of a primary slot, 48 dp each (%s, %s)', async (language, direction) => {
  missingKeys.length = 0;
  await i18n.changeLanguage(language);
  await render(await withPrimary(), direction);
  await open('4-m1');
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].week.sessionType);
  expect(missingKeys).toEqual([]);
});
