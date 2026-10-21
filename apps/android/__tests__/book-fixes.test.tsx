// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيحات دفتر النصوص» (#218, answer 266): a corrected session's result
// and homework, «كان» and «أصبح», its due day alone when only that moved,
// a withdrawn confirmation, an extra session's kind changed and moved to
// another month, listed in both and checked against page 08; the day and
// reason's kind, the note when the page was printed before; a class alone;
// a month without corrections that still prints; and the Documents tab's
// row and the texts book's button. Made-up records only. Thursday 15 October
// 2026 has 4م1's sessions at 08:00 and 09:00 and 4م2's at 10:00.

import { confirmSessions, parseDay, todayView, type SessionRecord } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { BookFixes } from '../src/book/BookFixes';
import { TextsBook } from '../src/book/TextsBook';
import { bookFixes } from '../src/documents/book-fixes';
import type { DocumentData } from '../src/documents/document-data';
import { DocumentsTab } from '../src/documents/DocumentsTab';
import pdf from '../src/native/NativeMinhajnaPdf';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const t = i18n.getFixedT('ar');
const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const DAY = parseDay('2026-10-15');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: parseDay('2026-10-18'),
  lang: 'ar',
  dir: 'rtl',
});

/** The three sessions confirmed on the 15th, then corrected on the 16th and 17th. */
async function withFixes(): Promise<{ data: TestData; records: SessionRecord[] }> {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = todayView(context, DAY).sessions.map((one) => one.session);
  const events = confirmSessions(
    context,
    sessions.map((session, at) => ({
      session,
      details: at === 1 ? { homework: { text: 'تمرين 4 ص 22', due: parseDay('2026-10-18') } } : {},
    })),
  );
  await data.book.recordAll(DAY, events);
  await data.book.record(DAY, {
    kind: 'print.recorded',
    print: { id: 'p-1', documents: [{ id: 'texts', from: parseDay('2026-10-01'), to: DAY }] },
  });
  const records = events.flatMap((event) => (event.kind === 'session.recorded' ? [event.record] : []));
  const [first, second, third] = records;
  if (first === undefined || second === undefined || third === undefined) throw new Error('Three sessions');
  await data.book.recordAll(parseDay('2026-10-16'), [
    {
      kind: 'session.recorded',
      record: { ...first, outcome: 'not-held', coverage: [] },
      correction: 'entry-error',
    },
    {
      kind: 'session.recorded',
      record: { ...second, homework: { text: 'تمرين 4 ص 22', due: parseDay('2026-10-20') } },
    },
  ]);
  await data.book.record(parseDay('2026-10-17'), { kind: 'session.withdrawn', session: third.session });
  return { data, records };
}

test('each change says what it was and what it is, with the day, the reason and the paper', async () => {
  const { data } = await withFixes();
  const items = bookFixes(documentData(data), t, '2026-10', null);
  expect(items.map((item) => [item.className, item.when.slice(0, 15), item.changes.map((one) => one.label)])).toEqual([
    ['4م1', 'الخميس 15/10 · ', [text.bookFixes.result]],
    ['4م1', 'الخميس 15/10 · ', [`${text.bookFixes.homework}: \u2068تمرين 4 ص 22\u2069`]],
    ['4م2', 'الخميس 15/10 · ', [text.bookFixes.result]],
  ]);
  const [notHeld, due, withdrawn] = items;
  expect(notHeld?.changes[0]?.after).toBe(text.today.notHeld);
  expect(notHeld?.foot).toBe('صُحّحت يوم 16/10/2026 · السبب: خطأ في الإدخال');
  expect(notHeld?.paper).toBe(true);
  expect(due?.changes[0]).toMatchObject({ before: 'يُسلَّم يوم 18/10/2026', after: 'يُسلَّم يوم 20/10/2026' });
  expect(due?.foot).toBe('صُحّحت يوم 16/10/2026 · دون ذكر سبب');
  expect(withdrawn?.changes[0]?.after).toBe(text.bookFixes.withdrawn);
  expect(bookFixes(documentData(data), t, '2026-10', 'k-2')).toHaveLength(1);
  expect(bookFixes(documentData(data), t, '2026-09', null)).toEqual([]);
});

test('an extra session’s kind and month change, listed in both months, against page 08', async () => {
  const data = await withDay();
  const extra = {
    id: 'x-1',
    courseId: 'c-1',
    kind: 'catch-up' as const,
    day: parseDay('2026-10-29'),
    from: '14:00',
    to: '15:00',
  };
  await data.book.record(parseDay('2026-10-29'), { kind: 'extra.logged', extra });
  await data.book.record(parseDay('2026-10-30'), {
    kind: 'print.recorded',
    print: { id: 'p-1', documents: [{ id: 'supervised', from: parseDay('2026-09-01'), to: parseDay('2026-10-30') }] },
  });
  await data.book.record(parseDay('2026-10-31'), {
    kind: 'extra.logged',
    extra: { ...extra, kind: 'support', day: parseDay('2026-11-02') },
  });
  const october = bookFixes(documentData(data), t, '2026-10', null);
  const november = bookFixes(documentData(data), t, '2026-11', null);
  expect(october).toHaveLength(1);
  const [moved] = october;
  expect(november).toEqual([{ ...moved, entryDay: '2026-11-02', when: november[0]?.when }]);
  expect([moved?.entryDay, moved?.when, november[0]?.when]).toEqual(['2026-10-29', 'الخميس 29/10', 'الإثنين 02/11']);
  expect(moved?.paper).toBe(true);
  expect(moved?.changes[0]?.before.startsWith(text.extra.kinds['catch-up'])).toBe(true);
  expect(moved?.changes[0]?.after.startsWith(text.extra.kinds.support)).toBe(true);
  expect(moved?.changes[0]?.label).toBe(text.bookFixes.extra.replace('{{kind}}', text.extra.kinds.support));
});

const cards = () =>
  tree!.root.findAll((node) => typeof node.type === 'string' && String(node.props.testID).startsWith('fixes-item-'));

async function mount(data: TestData, props: { month?: string; classId?: string } = {}) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <BookFixes {...props} />, '2026-10-18')}
      </LocaleDirContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    const node = tree!.root.findAll(
      (one) => one.props.testID === testID && typeof (one.props as PressableProps).onPress === 'function',
    )[0];
    (node?.props as PressableProps).onPress?.({} as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test('the screen shows the month’s cards, prints them struck through, and a class alone', async () => {
  const { data } = await withFixes();
  await mount(data);
  expect(cards()).toHaveLength(3);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('fixes-print');
  const [html] = printHtml.mock.calls[0];
  expect(html.match(/<td class="was" dir="auto">/g)).toHaveLength(3);
  expect(html).toContain(text.bookFixes.paper);
  expect(html).toContain('تصحيحات الأقسام كلها');
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'fixes-class' }).props as { onSelect: (value: string) => void }).onSelect('k-2');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(cards()).toHaveLength(1);
  await press('fixes-save');
  const [, made] = makePdf.mock.calls[0];
  expect(made).toBe('book-fixes-2026-10');
});

test('a month without corrections says so and still prints', async () => {
  const { data } = await withFixes();
  await mount(data, { month: '2026-09' });
  expect(tree!.root.findAllByProps({ testID: 'fixes-none' }).length).toBeGreaterThan(0);
  await press('fixes-print');
  const [html] = printHtml.mock.calls[0];
  expect(html).toContain(`<p class="none">${text.bookFixes.none}</p>`);
});

test('the Documents tab’s row opens the corrections', async () => {
  const onFixes = jest.fn();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          await withDay(),
          <DocumentsTab onOpen={() => undefined} onPrintWeek={() => undefined} onFixes={onFixes} />,
          '2026-10-18',
        )}
      </LocaleDirContext.Provider>,
    );
  });
  await press('documents-fixes');
  expect(onFixes).toHaveBeenCalled();
});

test('the texts book’s button opens its month’s corrections for its class', async () => {
  const { data } = await withFixes();
  const onFixes = jest.fn();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          data,
          <TextsBook
            courseId="c-1"
            onCourse={() => undefined}
            onDetails={() => undefined}
            onPrint={() => undefined}
            onFixes={onFixes}
          />,
          '2026-10-18',
        )}
      </LocaleDirContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await press('book-fixes');
  expect(onFixes).toHaveBeenCalledWith('2026-10', 'k-1');
});
