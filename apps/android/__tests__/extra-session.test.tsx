// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session outside the timetable (#219, Session-extra): opened from Today
// and from a class's plan; the class, the kind, a day up to today on the
// month's grid, and times typed as on paper; the row it takes on the texts
// book's page; saved with the topic trimmed, the plan untouched, and undone
// topic and all, with the history kept; refused without a class, a kind or
// good times.
// Made-up records only.

import { current, extraSessions, extraTopic, pace } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { ExtraSession } from '../src/extra/ExtraSession';
import { addMonths, monthWeeks } from '../src/extra/extra-rules';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, element: React.ReactElement, day = '2026-10-15') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
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
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function choose(group: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: group }).props as { onSelect: (value: string) => void }).onSelect(value);
    await settle();
  });
}

async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onChangeText: (value: string) => void }).onChangeText(value);
    await settle();
  });
}

const preview = () => tree!.root.findByProps({ testID: 'extra-preview' }).props.accessibilityLabel as string;

test('Today opens it with a plus beside Help, named for TalkBack', async () => {
  const onExtra = jest.fn();
  await mount(await withDay(), <Today onHelp={jest.fn()} onExtra={onExtra} onDetails={jest.fn()} onRoll={jest.fn()} />);
  expect(control('today-extra').props.accessibilityLabel).toBe(text.extra.open);
  await press('today-extra');
  expect(onExtra).toHaveBeenCalledTimes(1);
});

test('logs a support session with the typed times, shows its row first, and leaves the plan where it was', async () => {
  const data = await withDay();
  const before = pace(coreContext({ ...data, state: data.book.state }), 'c-1', '2026-10-15' as never);
  await mount(data, <ExtraSession />);
  expect(texts()).toContain(text.extra.intro);
  await choose('extra-class', 'k-2|arabic|');
  await choose('extra-kind', 'support');
  await type('extra-from', '15:00');
  await type('extra-to', '16.30');
  await type('extra-topic', '  مراجعة الإعراب  ');
  expect(preview()).toBe(
    `${text.extra.number} 1، ${text.extra.subject} اللغة العربية، ${text.extra.type} ${text.extra.kinds.support}، ` +
      `${text.extra.day} 2026/10/15، ${text.extra.hours} ⁧15:00 – 16:30⁩`,
  );
  await press('extra-save');
  await ReactTestRenderer.act(settle);
  const [logged] = extraSessions(data.book.state);
  expect(logged).toEqual(
    expect.objectContaining({ courseId: 'c-2', kind: 'support', day: '2026-10-15', from: '15:00', to: '16:30' }),
  );
  expect(extraTopic(data.book.state, logged.id)).toBe('مراجعة الإعراب');
  expect(texts()).toContain(text.extra.saved);
  expect(tree!.root.findByProps({ testID: 'extra-from' }).props.value).toBe('');
  expect(tree!.root.findByProps({ testID: 'extra-class' }).props.selected).toBe('k-2|arabic|');
  expect(preview()).toContain(`${text.extra.number} 2`);
  expect(pace(coreContext({ ...data, state: data.book.state }), 'c-1', '2026-10-15' as never)).toEqual(before);
});

test('undo removes the session and its topic, and keeps both in the history', async () => {
  const data = await withDay();
  await mount(data, <ExtraSession courseId="c-1" />);
  await choose('extra-kind', 'review');
  await type('extra-from', '13:00');
  await type('extra-to', '14:00');
  await type('extra-topic', 'الكسور');
  await press('extra-save');
  await ReactTestRenderer.act(settle);
  const id = extraSessions(data.book.state)[0].id;
  await ReactTestRenderer.act(async () => {
    const undo = tree!.root.findAll(
      (node) => node.props.accessibilityLabel === text.extra.undo && typeof node.props.onPress === 'function',
    )[0];
    (undo.props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await ReactTestRenderer.act(settle);
  expect(extraSessions(data.book.state)).toEqual([]);
  expect(data.book.state.extras.get(id)).toHaveLength(2);
  expect(current(data.book.state.extras.get(id))).toBeNull();
  expect(extraTopic(data.book.state, id)).toBeUndefined();
});

test('refuses bad times, and asks for the class and the kind', async () => {
  const data = await withDay();
  await mount(data, <ExtraSession />);
  await press('extra-save');
  expect(texts()).toContain(text.extra.choose);
  await choose('extra-class', 'k-1|arabic|');
  await choose('extra-kind', 'supervised');
  await type('extra-from', '16:00');
  await type('extra-to', '15:00');
  await press('extra-save');
  expect(tree!.root.findByProps({ testID: 'extra-to' }).props.error).toBe(text.extra.timeWrong);
  await type('extra-to', '25:00');
  await press('extra-save');
  expect(extraSessions(data.book.state)).toEqual([]);
});

test('the month grid offers the year up to today, never a later day', async () => {
  const data = await withDay();
  await mount(data, <ExtraSession courseId="c-1" />);
  expect(control('extra-day-2026-10-15').props.accessibilityState).toEqual({ disabled: false, selected: true });
  expect(tree!.root.findByProps({ testID: 'extra-day-2026-10-16' }).props.disabled).toBe(true);
  expect(tree!.root.findByProps({ testID: 'extra-month-after' }).props.disabled).toBe(true);
  await press('extra-day-2026-10-01');
  expect(texts()).toContain('الخميس 1 أكتوبر');
  await press('extra-month-before');
  expect(texts()).toContain('سبتمبر 2026');
  expect(control('extra-day-2026-09-07')).toBeDefined();
  expect(addMonths('2026-12', 1)).toBe('2027-01');
  expect(addMonths('2027-01', -1)).toBe('2026-12');
  expect(monthWeeks('2026-10')[0].slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
});

test('a class whose week is not drawn yet gets its course when the session is saved', async () => {
  const data = await openTestData();
  await data.book.recordAll('2026-10-15' as never, [
    {
      kind: 'school.set',
      school: { id: 's-9', name: 'متوسطة مختلقة', levels: ['cem'], subjects: ['arabic'], zone: '09' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-9',
        schoolId: 's-9',
        level: 'cem',
        grade: '4am',
        name: '4م9',
        groups: [{ id: 'k-9-w', kind: 'whole', name: '4م9' }],
      },
    },
  ]);
  await mount(data, <ExtraSession />);
  expect(tree!.root.findByProps({ testID: 'extra-class' }).props.selected).toBe('k-9|arabic|');
  await choose('extra-kind', 'catch-up');
  await type('extra-from', '08:00');
  await type('extra-to', '09:00');
  await press('extra-save');
  await ReactTestRenderer.act(settle);
  const [course] = [...data.book.state.courses.values()];
  expect(course).toMatchObject({ classId: 'k-9', subject: 'arabic', year: '2026-2027', pack: null });
  expect(extraSessions(data.book.state)).toEqual([expect.objectContaining({ courseId: course?.id, kind: 'catch-up' })]);
  expect(tree!.root.findByProps({ testID: 'extra-class' }).props.selected).toBe('k-9|arabic|');
  expect(preview()).toContain(`${text.extra.number} 2`);
});

test('takes Eastern Arabic digits, numbers the row by its day and time, and waits for the first save', async () => {
  const data = await withDay();
  await mount(data, <ExtraSession courseId="c-1" />);
  await choose('extra-kind', 'support');
  await type('extra-from', '١٣:٠٠');
  await type('extra-to', '۱۴٫۰۰');
  await ReactTestRenderer.act(async () => {
    const save = (control('extra-save').props as PressableProps).onPress;
    save?.({} as never);
    save?.({} as never);
    await settle();
  });
  expect(extraSessions(data.book.state).map((one) => [one.from, one.to])).toEqual([['13:00', '14:00']]);
  expect(texts()).not.toContain(text.extra.timeWrong);
  await type('extra-from', '08:00');
  await type('extra-to', '09:00');
  expect(preview()).toContain(`${text.extra.number} 1،`);
  await type('extra-from', '17:00');
  await type('extra-to', '18:00');
  expect(preview()).toContain(`${text.extra.number} 2،`);
});

test('before the school year starts, it says so and offers nothing', async () => {
  await mount(await withDay(), <ExtraSession />, '2026-08-20');
  expect(texts()).toContain(text.extra.beforeYear);
  expect(tree!.root.findAllByProps({ testID: 'extra-save' })).toHaveLength(0);
});

test('a joint class is offered once for each level, and the session goes to that level', async () => {
  const data = await openTestData();
  await data.book.recordAll('2026-10-15' as never, [
    {
      kind: 'school.set',
      school: { id: 's-9', name: 'مدرسة مختلقة', levels: ['primary'], subjects: ['arabic'], zone: '09' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-j',
        schoolId: 's-9',
        level: 'primary',
        grade: '4ap',
        name: 'قسم مشترك',
        groups: [
          { id: 'k-j-w', kind: 'whole', name: 'قسم مشترك' },
          { id: 'k-j-4', kind: 'level', name: '4', grade: '4ap' },
          { id: 'k-j-5', kind: 'level', name: '5', grade: '5ap' },
        ],
      },
    },
  ]);
  await mount(data, <ExtraSession />);
  const offered = (tree!.root.findByProps({ testID: 'extra-class' }).props as { choices: { value: string }[] }).choices;
  expect(offered.map((one) => one.value)).toEqual(['k-j|arabic|4ap', 'k-j|arabic|5ap']);
  await choose('extra-class', 'k-j|arabic|5ap');
  await choose('extra-kind', 'review');
  await type('extra-from', '14:00');
  await type('extra-to', '15:00');
  await press('extra-save');
  await ReactTestRenderer.act(settle);
  const [course] = [...data.book.state.courses.values()];
  expect(course).toMatchObject({ classId: 'k-j', grade: '5ap' });
});

test('a class page opens it for its course, and a teacher with no class is told so', async () => {
  const onExtra = jest.fn();
  const data = await withDay();
  await mount(data, <ClassPlan courseId="c-2" onExtra={onExtra} />);
  await press('plan-extra');
  expect(onExtra).toHaveBeenCalledTimes(1);
  await mount(data, <ExtraSession courseId="c-2" />);
  expect(tree!.root.findByProps({ testID: 'extra-class' }).props.selected).toBe('k-2|arabic|');
  await mount(await openTestData(), <ExtraSession />);
  expect(texts()).toContain(text.extra.noClass);
});
