// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's Pupil and Pupil-year screens (#217): a pupil's
// figures in half-days, a middle-school morning of two roll calls missed
// once, the one-tap toggle correcting both roll calls with «administration»
// and flipping back with «entry-error» (answers 254 and 259), a second tap
// ignored until the record has the first, late arrivals, the change log
// newest first (answer 259), the roll calls to correct, and the school
// year's months ending in June. The teacher has 4م1, with 45 made-up pupils,
// on Thursdays from 11 October 2026, with two sessions that morning.

import { DEFAULT_COUNTING, correctPupil, current, parseDay, rollCallUnits, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { PupilPage, type PupilPageProps } from '../src/rollbook/PupilPage';
import { coreContext } from '../src/storage/core-context';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const DAY = '2026-10-15';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, props: Partial<PupilPageProps> = {}, day = DAY) {
  const all = {
    courseId: 'c-1',
    pupilId: 'p-3',
    month: '',
    onMonth: jest.fn(),
    onClassYear: jest.fn(),
    onCorrect: jest.fn(),
    onMove: jest.fn(),
    onExport: jest.fn(),
    onErased: jest.fn(),
    ...props,
  };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <PupilPage {...all} />, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
  return all;
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

const toggle = (value: 'justified' | 'unjustified') =>
  (
    tree!.root.findByProps({ testID: `pupil-justify-${DAY}-morning` }).props as {
      onSelect: (choice: string) => void;
    }
  ).onSelect(value);

const rollCall = (slot: number, absent: string[], late: string[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(slot),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: DAY as Day,
    half: 'morning' as const,
    absent: absent.map((pupilId) => ({ pupilId, justified: false })),
    late,
  },
});

const marks = (data: TestData, slot: number) => {
  const versions = data.book.state.rollCalls.get(unitKey(slot)) ?? [];
  return { versions: versions.length, absent: current(versions)?.absent, reason: versions.at(-1)?.reason };
};

test('gives the month in half-days, a morning of two roll calls missed once, and the log', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [rollCall(1, ['p-3'], []), rollCall(2, ['p-3'], ['p-4'])]);
  await mount(data);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4م1 · رقم 3',
      'أكتوبر',
      'السنة الدراسية',
      '1',
      '0',
      '0%',
      'بأنصاف الأيام، في حصص اللغة العربية وحدها.',
      'الخميس 15 أكتوبر',
      '\u206708:00 – 09:00\u2069، \u206709:00 – 10:00\u2069 · صباحاً',
      'لا تأخر في هذه المدة.',
      '\u206615/10/2026\u2069 · سُجّل غياب 15 أكتوبر',
    ]),
  );
  expect(texts().filter((line) => line.includes('سُجّل غياب'))).toHaveLength(1);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('the toggle corrects every roll call of the half-day, once, and flips back as an entry error', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [rollCall(1, ['p-3'], []), rollCall(2, ['p-3'], [])]);
  await mount(data);
  await ReactTestRenderer.act(async () => {
    toggle('justified');
    toggle('justified');
    await settle();
  });
  await ReactTestRenderer.act(async () => {
    await settle();
  });
  for (const slot of [1, 2]) {
    expect(marks(data, slot)).toEqual({
      versions: 2,
      absent: [{ pupilId: 'p-3', justified: true }],
      reason: 'administration',
    });
  }
  expect(texts()).toContain('\u206615/10/2026\u2069 · 15 أكتوبر: من غياب غير مبرر إلى غياب مبرر · تصحيح من الإدارة');
  await ReactTestRenderer.act(async () => {
    toggle('unjustified');
    await settle();
  });
  await ReactTestRenderer.act(async () => {
    await settle();
  });
  expect(marks(data, 1)).toEqual({
    versions: 3,
    absent: [{ pupilId: 'p-3', justified: false }],
    reason: 'entry-error',
  });
  const log = texts().filter((line) => line.startsWith('\u2066'));
  expect(log[0]).toContain('من غياب مبرر إلى غياب غير مبرر · خطأ في التسجيل');
  expect(log.at(-1)).toContain('سُجّل غياب');
});

test('lists late arrivals and the roll calls to correct, and opens the pupil moves', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [rollCall(1, [], ['p-3']), rollCall(2, [], [])]);
  const props = await mount(data);
  expect(texts()).toEqual(
    expect.arrayContaining(['لا غياب في هذه المدة.', '\u206708:00 – 09:00\u2069 · لا يُحسب غياباً']),
  );
  await press('pupil-correct');
  expect(texts()).toEqual(
    expect.arrayContaining(['\u206708:00 – 09:00\u2069 · تأخر', '\u206709:00 – 10:00\u2069 · حضور']),
  );
  await press(`pupil-correct-${unitKey(1)}`);
  expect(props.onCorrect).toHaveBeenCalledWith(expect.objectContaining({ key: unitKey(1), day: DAY }));
  await press('pupil-move');
  expect(props.onMove).toHaveBeenCalledTimes(1);
});

test('the school year gives each month to June and the year, and links the class summary', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [rollCall(1, ['p-3'], []), rollCall(2, [], [])]);
  const props = await mount(data, { month: 'year' });
  expect(tree!.root.findAllByProps({ testID: 'pupil-year-2027-06' })).not.toEqual([]);
  expect(tree!.root.findAllByProps({ testID: 'pupil-year-2027-07' })).toEqual([]);
  expect(
    (tree!.root.findByProps({ testID: 'pupil-year-year' }).props as { accessibilityLabel: string }).accessibilityLabel,
  ).toBe('السنة، الحضور الممكن 1، الغياب 1، الحضور الفعلي 0، النسبة 0%');
  await press('pupil-class-year');
  expect(props.onClassYear).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a roll call justified, unjustified and justified again on one day keeps each change in the log', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, [], []), rollCall(2, ['p-3'], [])]);
  await mount(data);
  for (const value of ['justified', 'unjustified', 'justified'] as const) {
    await ReactTestRenderer.act(async () => {
      toggle(value);
      await settle();
    });
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  }
  expect(marks(data, 2).versions).toBe(4);
  expect(texts().filter((line) => line.includes('إلى'))).toHaveLength(3);
});

test('before the school year the page still shows its head and says there is nothing yet', async () => {
  await mount(await withPupils(), {}, '2026-08-30');
  expect(texts()).toEqual(
    expect.arrayContaining(['4م1 · رقم 3', 'لا غياب في هذه المدة.', 'لا شيء مسجّل في هذه المدة.']),
  );
});

test('late arrivals before the counting start are left out, as the counts leave them out', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [
    rollCall(1, [], ['p-3']),
    { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: parseDay('2026-10-16') } },
  ]);
  await mount(data);
  expect(texts()).toContain('لا تأخر في هذه المدة.');
});

test('the correction sheet leaves out roll calls taken before the pupil joined', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, [], []), rollCall(2, ['p-3'], [])]);
  const pupil = data.book.state.pupils.get('p-4')!;
  await data.book.record(parseDay(DAY), {
    kind: 'pupil.set',
    pupil: { ...pupil, movements: [{ day: parseDay('2026-10-16'), kind: 'in', reason: 'transfer' }] },
  });
  await mount(data, { pupilId: 'p-4' });
  await press('pupil-correct');
  expect(control(`pupil-correct-${unitKey(1)}`)).toBeUndefined();
  expect(texts()).toContain('لا مناداة مسجّلة في هذه المدة.');
});

test('a change on a roll call the pupil has since left keeps the line that recorded the mark', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, [], []), rollCall(2, ['p-3'], [])]);
  const pupil = data.book.state.pupils.get('p-3')!;
  await data.book.record(parseDay('2026-10-16'), {
    kind: 'pupil.set',
    pupil: { ...pupil, movements: [{ day: parseDay('2026-10-14'), kind: 'out', reason: 'transfer', confirmed: true }] },
  });
  const context = coreContext({ ...data, state: data.book.state });
  const unit = rollCallUnits(context, 'k-1', parseDay(DAY), parseDay(DAY))[1];
  await data.book.record(parseDay('2026-10-16'), correctPupil(context, unit, 'p-3', 'present', 'entry-error'));
  await mount(data, {}, '2026-10-18');
  const log = texts().filter((line) => line.startsWith('\u2066'));
  expect(log).toHaveLength(2);
  expect(log[0]).toContain('إلى حضور');
  expect(log[1]).toContain('سُجّل غياب 15 أكتوبر');
});
