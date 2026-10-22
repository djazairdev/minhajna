// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// After a reorientation (#231, Reorient, answer 391): the new class's texts
// book carries on the old class's rows, its own first row opening with
// «أُعيد تشكيل القسم يوم …», on screen and in print, from whatever month it
// is printed, on a confirmed row only; and an archived class is left out of
// what adds records: the test schedule's form and chips, sessions outside
// the timetable, the packs by grade, the pupils' moves and the plan's
// changes, whose pace card says since when it is archived. Made-up classes
// only.

import { confirmSessions, parseDay, reorient, sessionsBetween, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import ReactTestRenderer from 'react-test-renderer';
import { withData } from '../jest/app-data';
import { withReshape } from '../jest/reorient-lycee';
import { bookViewPages } from '../src/book/book-pages';
import type { DocumentData } from '../src/documents/document-data';
import { textsBookPages } from '../src/documents/texts-book-pages';
import { bookRows } from '../src/documents/texts-book-rows';
import { ClassPlan } from '../src/classes/ClassPlan';
import { TestSchedule } from '../src/exams/TestSchedule';
import { ClassPlanScreen } from '../src/navigation/PlanScreens';
import { classChoices } from '../src/extra/extra-rules';
import { planGroups } from '../src/plan/plan-rules';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const line = 'أُعيد تشكيل القسم يوم 2026/10/08';

async function reshaped(confirmFirst = true) {
  const data = await withReshape();
  const context = () => coreContext({ ...data, state: data.book.state });
  const confirm = async (courseId: string, from: string, to: string) => {
    const sessions = sessionsBetween(context(), parseDay(from), parseDay(to), new Set([courseId]));
    await data.book.recordAll(
      parseDay(to),
      confirmSessions(
        context(),
        sessions.map((session) => ({ session })),
      ),
    );
  };
  await confirm('c-k-a', '2026-10-04', '2026-10-06');
  let next = 0;
  const plan = {
    day: parseDay('2026-10-08'),
    olds: ['k-a', 'k-b'],
    classes: [
      { name: '2 ع ت 1', takes: 'k-a' },
      { name: '2 ع ت 2', takes: 'k-b' },
    ],
    pupils: new Map<string, number | null>(),
  };
  await data.book.recordAll(
    parseDay('2026-10-08'),
    reorient(context(), plan, parseDay('2026-10-08'), () => `r-${(next += 1)}`),
  );
  const course = [...data.book.state.courses.values()].find((one) => one.continues?.courseId === 'c-k-a')!;
  await confirm(course.id, confirmFirst ? '2026-10-11' : '2026-10-13', '2026-10-13');
  const document = (day: Day): DocumentData => ({ ...data, state: data.book.state, day, lang: 'ar', dir: 'rtl' });
  return { data, context, course, document };
}

test('the new class’s texts book carries on the old one, its first own row opening with the reshaping', async () => {
  const { context, course, document } = await reshaped();
  const t = i18n.getFixedT('ar');
  const last = parseDay('2026-10-13');
  const rows = bookRows(document(last), context(), course, parseDay('2026-10-01'), last, t, 'rtl');
  expect(rows.map((one) => one.day)).toEqual(['2026-10-04', '2026-10-06', '2026-10-11', '2026-10-13']);
  expect(rows.map((one) => one.lines[0]?.text === line)).toEqual([false, false, true, false]);
  const later = bookRows(document(last), context(), course, parseDay('2026-10-13'), last, t, 'rtl');
  expect(later.map((one) => one.lines[0]?.text === line)).toEqual([false]);
  const view = bookViewPages(document(last), context(), course, t, 'rtl', last).flatMap((page) => page.rows);
  expect(view.map((one) => one.lines)).toEqual(rows.map((one) => one.lines));
  const html = textsBookPages(document(last), t, false);
  expect(html.split(line)).toHaveLength(2);
});

test('an archived class takes no new test, session outside the timetable or pack', async () => {
  const { data } = await reshaped();
  const { state } = data.book;
  const archived = ['k-a', 'k-b'];
  const choices = classChoices(state, data.profile, data.year.id, (grade) => grade);
  expect(choices.length).toBeGreaterThan(0);
  expect(choices.some((one) => archived.includes(one.classId))).toBe(false);
  const groups = planGroups(state).flatMap((group) => group.classes.map((one) => one.id));
  expect(groups.some((id) => archived.includes(id))).toBe(false);
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <TestSchedule courseId="c-k-a" onCourse={jest.fn()} />, '2026-10-13')}
      </LocaleDirContext.Provider>,
    );
  });
  const ids = (id: string) => tree!.root.findAll((node) => node.props.testID === id);
  expect(ids('tests-open-add')).toHaveLength(0);
  expect(ids('tests-class-c-k-a').length).toBeGreaterThan(0);
  expect(ids('tests-class-c-k-b')).toHaveLength(0);
  await ReactTestRenderer.act(() => tree?.unmount());
});

test('on screen, the reshaping opens the first confirmed row, as in print', async () => {
  const { context, course, document } = await reshaped(false);
  const t = i18n.getFixedT('ar');
  const last = parseDay('2026-10-13');
  const view = bookViewPages(document(last), context(), course, t, 'rtl', last).flatMap((page) => page.rows);
  const marked = view.filter((one) => one.lines[0]?.text === line).map((one) => one.day);
  expect(view.some((one) => one.day === '2026-10-11' && one.awaiting)).toBe(true);
  expect(marked).toEqual(['2026-10-13']);
  const rows = bookRows(document(last), context(), course, parseDay('2026-10-01'), last, t, 'rtl');
  expect(rows.filter((one) => one.lines[0]?.text === line).map((one) => one.day)).toEqual(marked);
});

test('an archived class’s plan reads only, its pace card saying since when', async () => {
  const { data, course } = await reshaped();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <ClassPlanScreen navigation={navigation as never} route={{ params: { courseId: 'c-k-a' } } as never} />,
          '2026-10-13',
        )}
      </LocaleDirContext.Provider>,
    );
  });
  const plan = tree!.root.findByType(ClassPlan).props as Record<string, unknown>;
  expect(
    Object.keys(plan)
      .filter((key) => key.startsWith('on'))
      .sort(),
  ).toEqual(['onCourse', 'onDetails', 'onTests']);
  const texts = tree!.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => String(node.props.children));
  expect(texts).toContain('مؤرشف منذ \u206808/10\u2069 · يُقرأ ويُطبع');
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <ClassPlanScreen navigation={navigation as never} route={{ params: { courseId: course.id } } as never} />,
          '2026-10-13',
        )}
      </LocaleDirContext.Provider>,
    );
  });
  expect((tree!.root.findByType(ClassPlan).props as Record<string, unknown>).onChanges).toBeDefined();
  await ReactTestRenderer.act(() => tree?.unmount());
});
