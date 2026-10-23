// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نقاط التقويم المستمر» (#239, answers 442 and 451): the hub's row with the
// term's cells filled; the term's components, each with its points and how many
// are done, an archived class's disabled; a component's entry out of its
// points, with no «غائب», what was recorded for it under the pupil and in the
// card TalkBack reads, and the summary's counts; the attendance proposal from
// the roll-call book put on the keypad and recorded with «التالي»; a teacher's
// column with nothing recorded; the behaviour taps beside attendance; homework
// counted only where it came back, and the notebook; primary's months, open on
// today's, or on the first outside the term; a mark of a pupil not on the list
// cleared; a mark above points since lowered retyped and then counted, the
// summary counting one lowered while it shows, and a component taken out of the
// setup out of every count (answer 452); sheets refused for a month the course
// does not keep or a component it has not; and every text found in each
// language. Made-up records only.

import {
  attendanceProposal,
  confirmSessions,
  parseDay,
  refOf,
  rollCallUnits,
  setMark,
  sessionsBetween,
  setCapture,
  takeRollCall,
} from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import {
  componentsScreen,
  context,
  control,
  DAY,
  entry,
  hubProps,
  kept,
  mount,
  press,
  rendered,
  root,
  settle,
  setup,
  texts,
  unmount,
} from '../jest/components-screen';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import ReactTestRenderer from 'react-test-renderer';
import { Marks } from '../src/marks/Marks';
import { useAppData, type AppData } from '../src/storage/AppData';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

test('the hub’s row counts the term’s cells, and the components list each with its points', async () => {
  const data = await withTest();
  const onComponents = jest.fn();
  const hub = hubProps();
  await mount(data, <Marks courseId="c-1" onComponents={onComponents} {...hub} />);
  expect(texts()).toEqual(expect.arrayContaining([text.marks.componentMarks.title, 'الخانات المملوءة: 0 من 18']));
  await press('marks-components');
  expect(onComponents).toHaveBeenCalledWith(1);
  await unmount();
  const onEntry = jest.fn();
  await mount(data, componentsScreen({ onEntry }));
  expect(texts()).toEqual(
    expect.arrayContaining([text.marks.componentMarks.note, 'المشاركة في القسم', 'على 4 · 0 من 3', 'على 3 · 0 من 3']),
  );
  expect(root().findAll((node) => node.props.testID === 'components-month')).toEqual([]);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('components-homework');
  expect(onEntry).toHaveBeenCalledWith('homework', undefined);
});

test('a component is entered out of its points, with no «غائب», beside what was recorded', async () => {
  const data = await withTest();
  const [session] = sessionsBetween(context(data), DAY, DAY, new Set(['c-1']));
  await data.book.recordAll(DAY, [setCapture(refOf(session), 'p-1', 'participation', 2)]);
  await mount(data, entry('participation'));
  expect(texts()).toEqual(expect.arrayContaining(['الفصل الأول · على 4', '/ 4', 'نقرات المشاركة: 2', '0 من 3']));
  expect(control('entry-absent')).toBeUndefined();
  await press('pad-5');
  expect(texts()).toContain('النقطة أكبر من 4، ولا تُحفظ.');
  await press('pad-erase', 'pad-3', 'pad-.5', 'entry-next');
  expect(texts()).toContain('نقرات المشاركة: 0');
  await press('entry-next', 'entry-next');
  expect(kept(data, { kind: 'component', componentId: 'participation' })).toEqual({ 'p-1': 3.5 });
  expect(texts()).toEqual(expect.arrayContaining(['النقاط: 1', 'خانات فارغة: 2']));
  expect(texts()).not.toContain(text.marks.entry.stays);
});

test('the attendance proposal comes from the roll-call book, and «اعتماد المقترح» puts it on the keypad', async () => {
  const data = await withTest();
  await data.book.record(DAY, setup(true));
  const [unit] = rollCallUnits(context(data), 'k-1', DAY, DAY);
  await data.book.record(
    DAY,
    takeRollCall(context(data), unit, { absent: [{ pupilId: 'p-1', justified: false }], late: ['p-2'] }),
  );
  const [session] = sessionsBetween(context(data), DAY, DAY, new Set(['c-1']));
  await data.book.record(DAY, setCapture(refOf(session), 'p-1', 'behaviour', 2));
  const term = context(data).ref.year.terms.find((one) => one.number === 1)!;
  const counted = attendanceProposal(context(data), 'k-1', 'p-1', term.from, term.to, 3);
  expect(counted.proposed).not.toBeNull();
  await mount(data, entry('attendance'));
  const said =
    `أنصاف الأيام: ${counted.possible} · غياب غير مبرر: 1 · غياب مبرر: 0 · تأخر: 0 · ملاحظات السلوك: 2` +
    `\nالمقترح من دفتر المناداة: ${counted.proposed}`;
  expect(texts()).toContain(said);
  const card = root().findByProps({ testID: 'entry-current' }).props as { accessibilityLabel: string };
  expect(card.accessibilityLabel).toBe(`\u2068تلميذة أولى\u2069: فارغة على 3. ${said}`);
  await press('entry-proposal', 'entry-next');
  expect(kept(data, { kind: 'component', componentId: 'attendance' })).toEqual({ 'p-1': counted.proposed });
  expect(texts().join(' ')).toContain('تأخر: 1');
  expect(accessibilityProblems(root())).toEqual([]);
});

test('without the roll-call book there is no proposal, and a column has nothing recorded', async () => {
  const data = await withTest();
  await data.book.record(DAY, setup(false));
  await mount(data, entry('attendance'));
  expect(control('entry-proposal')).toBeUndefined();
  await unmount();
  await mount(data, entry('col-1'));
  expect(texts()).toEqual(
    expect.arrayContaining([
      '\u2068عرض شفهي\u2069 · \u20684م1 · اللغة العربية\u2069',
      text.marks.componentMarks.nothing,
    ]),
  );
});

test('primary keeps its marks by the month, open on today’s', async () => {
  const data = await withTest();
  await data.book.recordAll(DAY, [
    primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'),
    course('c-p', 'k-p', 'arabic'),
    { kind: 'pupil.set', pupil: { id: 'q-1', classId: 'k-p', name: 'تلميذ أول', sex: 'm', groups: [], movements: [] } },
  ]);
  const onMonth = jest.fn();
  const onEntry = jest.fn();
  await mount(data, componentsScreen({ courseId: 'c-p', onMonth, onEntry }));
  const months = root().findByProps({ testID: 'components-month' }).props as { selected: string };
  expect(months.selected).toBe('2026-10');
  expect(texts()).toEqual(expect.arrayContaining(['سبتمبر', 'أكتوبر', 'على 3 · 0 من 1']));
  await press('components-participation');
  expect(onEntry).toHaveBeenCalledWith('participation', '2026-10');
  await unmount();
  await mount(data, entry('participation', { courseId: 'c-p', month: '2026-11' }));
  expect(texts()).toContain('نوفمبر · على 3');
  await press('pad-2', 'entry-next');
  expect(kept(data, { kind: 'component', componentId: 'participation', month: '2026-11' }, 'c-p')).toEqual({
    'q-1': 2,
  });
});

test('a month not kept or an unknown component opens nothing; an archived class’s rows are off', async () => {
  const data = await withTest();
  for (const element of [entry('participation', { month: '2026-10' }), entry('nothing')]) {
    await mount(data, element);
    expect(rendered()).toBeNull();
    await unmount();
  }
  const room = data.book.state.classes.get('k-1')!;
  await data.book.record(DAY, { kind: 'class.set', schoolClass: { ...room, archivedFrom: parseDay('2026-10-16') } });
  await mount(data, componentsScreen());
  expect(control('components-participation')?.props.disabled).toBe(true);
});

test('homework counts only the taps where it came back, and the notebook its incomplete marks', async () => {
  const data = await withTest();
  const [first, second] = sessionsBetween(context(data), DAY, DAY, new Set(['c-1']));
  const due = parseDay('2026-10-22');
  const homework = { homework: { text: 'التمرين 2 ص 21', due } };
  await data.book.recordAll(DAY, [
    ...confirmSessions(context(data), [{ session: first, details: homework }]),
    setCapture(refOf(second), 'p-1', 'homework', 1),
    setCapture(refOf(second), 'p-1', 'notebook', 1),
  ]);
  const [back] = sessionsBetween(context(data), due, due, new Set(['c-1']));
  await data.book.record(due, setCapture(refOf(back), 'p-1', 'homework', 2));
  await mount(data, entry('homework'));
  expect(texts()).toContain('الواجبات: 1 · لم يُنجز: 0 · بمساعدة الغير: 1');
  await unmount();
  await mount(data, entry('notebook'));
  expect(texts()).toContain('كراس غير مكتمل: 1');
});

test('outside the term, primary opens on its first month', async () => {
  const data = await withTest();
  await data.book.recordAll(DAY, [primaryClass('k-p', 's-1', '5ap', '5 ابتدائي أ'), course('c-p', 'k-p', 'arabic')]);
  await mount(data, componentsScreen({ courseId: 'c-p' }), '2027-01-10');
  expect((root().findByProps({ testID: 'components-month' }).props as { selected: string }).selected).toBe('2026-09');
});

test('a component mark of a pupil not on the list is said and cleared', async () => {
  const data = await withTest();
  const target = { kind: 'component', componentId: 'participation' } as const;
  await data.book.record(DAY, setMark({ courseId: 'c-1', term: 1, target, pupilId: 'p-9' }, 3, 4));
  await mount(data, entry('participation'));
  await press('entry-next', 'entry-next', 'entry-next');
  expect(texts()).toContain(text.marks.entry.notListed);
  await press('entry-clear-p-9');
  expect(kept(data, target)).toEqual({});
});

test('a mark above points since lowered must be retyped, and counts as not done', async () => {
  const data = await withTest();
  const target = { kind: 'component', componentId: 'participation' } as const;
  await data.book.record(DAY, setMark({ courseId: 'c-1', term: 1, target, pupilId: 'p-1' }, 4, 4));
  await data.book.record(DAY, setup(false, 3));
  await mount(data, componentsScreen());
  expect(texts()).toContain('على 3 · 0 من 3');
  await unmount();
  await mount(data, entry('participation'));
  expect(texts()).toEqual(expect.arrayContaining(['4', 'النقطة أكبر من 3، ولا تُحفظ.']));
  await press('entry-next');
  expect(root().findAll((node) => node.props.testID === 'entry-previous')).toEqual([]);
  await press('pad-erase', 'pad-2', 'entry-next');
  expect(kept(data, target)).toEqual({ 'p-1': 2 });
  expect(texts()).toContain('1 من 3');
});

test('the summary counts a mark put above points lowered while it shows', async () => {
  const data = await withTest();
  const target = { kind: 'component', componentId: 'participation' } as const;
  await data.book.record(DAY, setMark({ courseId: 'c-1', term: 1, target, pupilId: 'p-3' }, 4, 4));
  let app: AppData | undefined;
  const Grab = () => {
    app = useAppData();
    return null;
  };
  await mount(
    data,
    <>
      {entry('participation')}
      <Grab />
    </>,
  );
  await press('entry-next', 'entry-next', 'entry-next');
  expect(texts()).toContain('لا نقطة فوق 4');
  await ReactTestRenderer.act(async () => {
    app?.record(setup(false, 3));
    await settle();
  });
  expect(texts()).toEqual(expect.arrayContaining(['نقاط فوق 3: 1', 'النقاط: 0']));
});

test('a component taken out of the setup keeps its marks out of every count', async () => {
  const data = await withTest();
  const target = { kind: 'component', componentId: 'research' } as const;
  await data.book.record(DAY, setMark({ courseId: 'c-1', term: 1, target, pupilId: 'p-1' }, 3, 4));
  await data.book.record(DAY, setup(false));
  const hub = hubProps();
  await mount(data, <Marks courseId="c-1" onComponents={jest.fn()} {...hub} />);
  expect(texts()).toContain('الخانات المملوءة: 0 من 18');
  await unmount();
  await mount(data, componentsScreen());
  expect(control('components-research')).toBeUndefined();
  expect(kept(data, target)).toEqual({ 'p-1': 3 });
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  const data = await withTest();
  await data.book.record(DAY, setup(true));
  await mount(data, componentsScreen());
  expect(texts().filter((one) => one.includes('marks.'))).toEqual([]);
  for (const id of ['participation', 'homework', 'notebook', 'attendance', 'col-1']) {
    await unmount();
    await mount(data, entry(id));
    await press('entry-next', 'entry-next', 'entry-next');
    expect(texts().filter((one) => one.includes('marks.'))).toEqual([]);
  }
  expect(accessibilityProblems(root())).toEqual([]);
});
