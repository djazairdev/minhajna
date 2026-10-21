// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes on the class plan (#225, R-4.7-36, R-4.7-37, answers 286
// and 292 to 294): the drift warning before a common test, where each class
// would be and how far apart; aligning a class that is behind, after a
// question, as one change in its layer, which leaves the gap as it is;
// dismissing the warning on this phone, said aloud; every control named in
// each language and direction. 4م1 has two sessions a week and 4م2 one, on
// the same made-up pack.

import { awaitingBetween, changesFor, confirmSessions, parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Alert, Text, type AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const today = '2026-10-22';

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

/** Both classes on the example pack, with a common test on 12 November, 4م1 taught on 15 October. */
async function parallel(): Promise<TestData> {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const test = (id: string, courseId: string, groupId: string, index: number) => ({
    kind: 'test.set' as const,
    test: {
      id,
      courseId,
      day: parseDay('2026-11-12'),
      slot: { half: 'morning' as const, index },
      groupId,
      title: 'الفرض المشترك',
      common: true,
    },
  });
  await data.book.recordAll(day, [
    {
      kind: 'course.set',
      course: {
        id: 'c-2',
        classId: 'k-2',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
      },
    },
    test('t-1', 'c-1', 'k-1-w', 1),
    test('t-2', 'c-2', 'k-2-w', 3),
  ]);
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = awaitingBetween(context, parseDay('2026-10-11'), day).filter((one) => one.courseId === 'c-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
  return data;
}

async function show(data: TestData, courseId: string, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <ClassPlan courseId={courseId} />, today)}
      </LocaleDirContext.Provider>,
    );
  });
}
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string')
        .join(''),
    );
const press = (id: string) =>
  ReactTestRenderer.act(() =>
    (
      root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0]?.props
        .onPress as () => void
    )(),
  );

const ar = (name: string) => `\u2068${name}\u2069`;
const lines = {
  drift: `${ar('4م1')} و${ar('4م2')} متباعدان بـ3 حصص قبل «${ar('الفرض المشترك')}»، الخميس 12 نوفمبر.`,
  where: `بحسب التوزيع الحالي، يكون ${ar('4م2')} عند «${ar('فهم المنطوق 1 (مثال)')}»، و${ar('4م1')} عند «${ar('الظاهرة اللغوية 1 (مثال)')}».`,
  align: `مواءمة ${ar('4م2')} مع ${ar('4م1')}`,
};
const confirm = async (alert: jest.SpyInstance<void, Parameters<typeof Alert.alert>>) => {
  const buttons: readonly AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await ReactTestRenderer.act(() => {
    buttons.at(-1)?.onPress?.();
  });
};

test('warns on both classes before their common test, how far apart and where each would be', async () => {
  const data = await parallel();
  await show(data, 'c-1');
  expect(shown()).toEqual(expect.arrayContaining([text.classPlan.driftBadge, lines.drift, lines.where, lines.align]));
  expect(shown().filter((one) => one === lines.align)).toHaveLength(1);
  expect(accessibilityProblems(root())).toEqual([]);
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(data, 'c-2');
  expect(shown()).toEqual(
    expect.arrayContaining([
      `${ar('4م2')} و${ar('4م1')} متباعدان بـ3 حصص قبل «${ar('الفرض المشترك')}»، الخميس 12 نوفمبر.`,
      lines.where,
      lines.align,
    ]),
  );
});

test('aligns the class behind after a question, as one change in its layer', async () => {
  const data = await parallel();
  const alert = jest.spyOn(Alert, 'alert');
  await show(data, 'c-1');
  await press('plan-drift-align');
  expect(alert).toHaveBeenCalledTimes(1);
  expect(changesFor(data.book.state.decisions, 'c-2')).toEqual([]);
  await confirm(alert);
  await ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(changesFor(data.book.state.decisions, 'c-2')).toEqual([
    expect.objectContaining({ kind: 'move', align: 'k-1', item: 'u1-1', before: 'd1' }),
  ]);
  expect(changesFor(data.book.state.decisions, 'c-1')).toEqual([]);
  expect(shown()).toContain(lines.drift);
  expect(root().findAll((node) => node.props.testID === 'plan-drift-align')).toHaveLength(0);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  await show(await parallel(), 'c-1', direction);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(shown()).toContain(catalogues[language].classPlan.driftDismiss);
});

test('dismissing hides the warning on this phone until the gap grows', async () => {
  const data = await parallel();
  await show(data, 'c-1');
  await press('plan-drift-dismiss');
  expect(root().findAll((node) => node.props.testID === 'plan-drift')).toHaveLength(0);
  expect(shown()).toContain(text.classPlan.driftHidden);
  expect(root().findByProps({ testID: 'plan-drift-hidden' }).props.accessibilityLiveRegion).toBe('polite');
  expect(shown()).toContain(lines.align);
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(data, 'c-1');
  expect(root().findAll((node) => node.props.testID === 'plan-drift')).toHaveLength(0);
  expect(shown()).not.toContain(text.classPlan.driftHidden);
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(data, 'c-2');
  expect(root().findAll((node) => node.props.testID === 'plan-drift').length).toBeGreaterThan(0);
});
