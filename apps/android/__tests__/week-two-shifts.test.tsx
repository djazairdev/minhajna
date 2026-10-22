// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الدوامان» on Week-draw for a primary teacher (#230, Week-draw-primary,
// answer 385): the class and its room, «في الأسبوع أ، يدرس قسمي», the other
// class in the room by name, kept on the version and dropped with the double
// shift, this week and next week by letter, the facts, and the links to the
// calendar's week letter and the roll-call rules; no «هذا الأسبوع» in a
// holiday week or before the first week. A secondary teacher keeps the plain
// choice. Made-up data only.

import { addDays, parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, TextInput, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { withPupils as secondary } from '../jest/roll-class';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { WeekDraw } from '../src/week/WeekDraw';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onLetter = jest.fn();
const onRules = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, language: Language = 'ar', day = '2026-10-15') {
  missingKeys.length = 0;
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(data, <WeekDraw onDone={jest.fn()} onLetter={onLetter} onRules={onRules} />, day)}
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
const label = (id: string) =>
  String(root().find((node) => node.props.testID === id && node.props.accessible === true).props.accessibilityLabel);
const isolated = (text: string) => `\u2068${text}\u2069`;

async function press(id: string) {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
}

async function type(value: string) {
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === 'shift-shared')
        .findByType(TextInput).props as TextInputProps
    ).onChangeText?.(value);
  });
}

async function saved(data: TestData) {
  await press('week-save');
  await settle();
  return data.book.state.timetables.at(-1)!.version;
}

/** The primary class with every session in room 3. */
async function inRoom(): Promise<TestData> {
  const data = await withPrimary();
  const [timetable] = data.book.state.timetables;
  const entries = timetable.version.entries.map((entry) => ({ ...entry, room: '3' }));
  await data.book.record(timetable.from, { kind: 'timetable.set', version: { ...timetable.version, entries } });
  return data;
}

test.each(['ar', 'fr', 'en'] as Language[])('shows «الدوامان» for a primary teacher (%s)', async (language) => {
  await render(await inRoom(), language);
  expect(exists('shift-card')).toBe(false);
  await press('option-doubleShift');
  const text = catalogues[language].week;
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.shiftTitle,
      text.shiftRoom.replace('{{classes}}', isolated('5 ابتدائي أ')).replace('{{room}}', isolated('3')),
      text.shiftExplain,
      text.shiftMine,
      `• ${text.shiftSame}`,
      `• ${text.shiftLetter}`,
    ]),
  );
  const rows = [label('shift-week-A'), label('shift-week-B')];
  expect(rows.filter((row) => row.includes(text.thisWeek))).toHaveLength(1);
  expect(rows.filter((row) => row.includes(text.nextWeek))).toHaveLength(1);
  expect(rows[0]).toContain(`${catalogues[language].today.band.morning}: ${text.mine}`);
  expect(rows[1]).toContain(`${catalogues[language].today.band.afternoon}: ${text.mine}`);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('keeps the other class in the room by name, and drops it with the double shift', async () => {
  const data = await inRoom();
  await render(data);
  const text = catalogues.ar.week;
  await press('option-doubleShift');
  await press('shift-afternoon');
  await type('2 ابتدائي ب');
  expect(shown()).toContain(
    text.shiftOtherRoom.replace('{{room}}', isolated('3')).replace('{{name}}', isolated('2 ابتدائي ب')),
  );
  expect(label('shift-week-A')).toContain(`${catalogues.ar.today.band.morning}: ${isolated('2 ابتدائي ب')}`);
  expect((await saved(data)).options).toEqual({ doubleShift: 'afternoon', sharedWith: '2 ابتدائي ب' });
  await type(' 2 ابتدائي ب ');
  await ReactTestRenderer.act(() => {
    (
      root()
        .find((node) => node.props.testID === 'shift-shared')
        .findByType(TextInput).props as TextInputProps
    ).onBlur?.({} as Parameters<NonNullable<TextInputProps['onBlur']>>[0]);
  });
  expect((await saved(data)).options).toEqual({ doubleShift: 'afternoon', sharedWith: '2 ابتدائي ب' });
  await type('  ');
  expect((await saved(data)).options).toEqual({ doubleShift: 'afternoon' });
  await type('2 ابتدائي ب');
  await press('option-doubleShift');
  expect((await saved(data)).options).toEqual({});
});

test('opens the calendar’s week letter and the roll-call rules', async () => {
  await render(await withPrimary());
  await press('option-doubleShift');
  await press('shift-letter');
  expect(onLetter).toHaveBeenCalledWith('s-1');
  await press('shift-rules');
  expect(onRules).toHaveBeenCalledTimes(1);
});

test('keeps the plain choice for a secondary teacher', async () => {
  await render(await secondary());
  await press('option-doubleShift');
  expect(exists('shift-card')).toBe(false);
  expect(shown()).toContain(catalogues.ar.week.shiftA);
});

test('says no «هذا الأسبوع» in a holiday week, nor before the year’s first week', async () => {
  const data = await withPrimary();
  const context = coreContext({ ...data, state: data.book.state });
  const school = data.book.state.schools.get('s-1')!;
  let day = parseDay('2026-10-15');
  while (context.calendar.weekOf(day, school) !== null) day = addDays(day, 1);
  expect(context.calendar.parityOn(day, school)).not.toBeNull();
  const text = catalogues.ar.week;
  const rows = () => [label('shift-week-A'), label('shift-week-B')];
  await render(data, 'ar', day);
  await press('option-doubleShift');
  expect(rows().filter((row) => row.includes(text.thisWeek))).toHaveLength(0);
  expect(rows().filter((row) => row.includes(text.nextWeek))).toHaveLength(1);
  await ReactTestRenderer.act(() => tree?.unmount());
  await render(await withPrimary(), 'ar', '2026-08-01');
  await press('option-doubleShift');
  expect(rows().some((row) => row.includes(text.thisWeek) || row.includes(text.nextWeek))).toBe(false);
  expect(rows()[0]).toContain(text.weekA);
});
