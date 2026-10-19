// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «طباعة الأسبوع» (#215, R-3.8-51 to R-3.8-56): the Documents tab's first
// row and what is new; the documents with something new ticked, each
// line with its pages once counted; the pages, sheets and cost, with a
// blank page before a book that would start on a sheet's back; the
// signature and template shown and disabled; «طباعة» and the PDF, each
// leaving its record, a cancelled save none; a journal's range and layout,
// a range ticking its document; the choices kept on this phone, two quick
// changes both, the sides and margins counting nothing again; the school
// year in the formats notice; and printing still working when the pages
// cannot be counted. The web engine's counting pass is faked: each
// book takes three pages. The teacher has 4م1 and 4م2 on Thursdays from
// 11 October 2026. Made-up records only.

import { parseDay as d } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import ReactTestRenderer from 'react-test-renderer';
import type { PressableProps, TextProps } from 'react-native';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { DocumentsTab } from '../src/documents/DocumentsTab';
import { journalLayouts } from '../src/documents/journal-pages';
import { COUNT_DELAY } from '../src/documents/print-count';
import { loadPrintSettings } from '../src/documents/print-settings';
import { PrintWeek } from '../src/documents/PrintWeek';
import type { Translate } from '../src/documents/document-data';
import face from '../src/native/NativeMinhajnaInterface';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const t = i18n.t.bind(i18n) as Translate;
const words = text.documents.printWeek;
const DAY = '2026-10-23';
const IDS = ['journal', 'journal-front', 'timetable', 'roll', 'texts', 'supervised', 'homework'];
const BOOK = [0xff0000, 0x00ff00, 0xffffff, 0xffffff, 0xffffff, 0xffffff];

const pageColors = jest.spyOn(pdf, 'pageColors');
const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  face.setSetting('print-week', 'null');
  pageColors.mockImplementation((html: string) => Promise.resolve((html.match(/ set-u"/g) ?? []).flatMap(() => BOOK)));
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, DAY)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const counted = () =>
  ReactTestRenderer.act(async () => {
    await settle(COUNT_DELAY + 20);
  });

const node = (testID: string) => tree!.root.findAll((one) => one.props.testID === testID)[0];

const control = (testID: string) =>
  tree!.root.findAll(
    (one) => one.props.testID === testID && typeof (one.props as PressableProps).onPress === 'function',
  )[0];

const said = (testID: string) =>
  [(node(testID).props as TextProps).children as unknown]
    .flat()
    .filter((part) => typeof part === 'string')
    .join('');

const checked = (id: string) => (control(`print-${id}`).props as PressableProps).accessibilityState?.checked === true;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function select(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onSelect: (value: string) => void }).onSelect(value);
    await settle();
  });
}

const summary = (pages: number, sheets: number, two = true) =>
  [
    t('documents.printWeek.pages', { count: pages }),
    t(two ? 'documents.printWeek.sheetsTwo' : 'documents.printWeek.sheets', { count: sheets }),
    t('documents.printWeek.price', { price: pages * 5 }),
  ].join(' · ');

test('the Documents tab opens it from its first row, with how many documents have something new', async () => {
  const data = await withDay();
  const open = jest.fn();
  await mount(data, <DocumentsTab onOpen={() => undefined} onPrintWeek={open} />);
  const row = control('documents-print-week').props as { accessibilityLabel?: string };
  expect(JSON.stringify(row)).toContain(t('documents.printWeek.tabNew', { count: 7 }));
  await press('documents-print-week');
  expect(open).toHaveBeenCalledTimes(1);
});

test('ticks what is new, counts its pages once, and says what the set costs', async () => {
  await mount(await withDay(), <PrintWeek />);
  expect(IDS.every(checked)).toBe(true);
  expect(said('print-summary')).toBe(words.counting);
  await counted();
  expect(pageColors).toHaveBeenCalledTimes(1);
  expect(said('print-summary')).toBe(summary(33, 22));
  expect(said('print-journal-line')).toBe(`${words.new} · من 15 أكتوبر 2026 إلى 22 أكتوبر 2026 · 3 صفحات`);
  expect(said('print-roll-line')).toContain('· 6 صفحات');
  expect(tree!.root.findAllByProps({ testID: 'print-confidential' }).length).toBeGreaterThan(0);
  expect(node('print-signature').props).toMatchObject({ selected: 'blank', disabled: true });
  expect(node('print-template').props).toMatchObject({ disabled: true });
  const year = (one: ReactTestRenderer.ReactTestInstance) =>
    typeof one.props.message === 'string' && one.props.message.includes('\u20682026-2027\u2069');
  expect(tree!.root.findAll(year).length).toBeGreaterThan(0);
});

test('prints on both sides with a blank page where a book would start on a back, and leaves its record', async () => {
  const data = await withDay();
  await mount(data, <PrintWeek />);
  await counted();
  await press('print-print');
  const [html, title] = printHtml.mock.calls[0];
  expect(title).toBe(words.name);
  expect(html.split('<section class="page"></section>')).toHaveLength(11);
  expect(html).not.toContain(' set-u"');
  expect(data.book.state.prints).toHaveLength(1);
  expect(data.book.state.prints[0].value.documents.map((one) => one.id)).toEqual(IDS);
  await mount(data, <DocumentsTab onOpen={() => undefined} onPrintWeek={() => undefined} />);
  expect(JSON.stringify(control('documents-print-week').props)).toContain(words.tabNone);
  await mount(data, <PrintWeek />);
  expect(IDS.some(checked)).toBe(false);
  expect(said('print-summary')).toBe(words.none);
  expect(control('print-print').props.disabled).toBe(true);
});

test('one PDF for the print shop; a cancelled save says nothing and leaves no record', async () => {
  const data = await withDay();
  await mount(data, <PrintWeek />);
  await counted();
  savePdf.mockResolvedValueOnce(false);
  await press('print-pdf');
  expect(makePdf.mock.calls[0].slice(1)).toEqual(['print-week', true]);
  expect(savePdf).toHaveBeenCalledWith('print-week', `${words.name} ${DAY}.pdf`);
  expect(data.book.state.prints).toHaveLength(0);
  expect(tree!.root.findAllByProps({ testID: 'print-said' })).toHaveLength(0);
  await press('print-pdf');
  expect(data.book.state.prints).toHaveLength(1);
  expect(tree!.root.findAllByProps({ testID: 'print-said' }).length).toBeGreaterThan(0);
});

test('only the ticked documents print, and a double tap prints once', async () => {
  const data = await withDay();
  await mount(data, <PrintWeek />);
  for (const id of IDS.filter((one) => one !== 'journal')) await press(`print-${id}`);
  expect(tree!.root.findAllByProps({ testID: 'print-confidential' })).toHaveLength(0);
  await counted();
  expect(said('print-summary')).toBe(summary(3, 2));
  await ReactTestRenderer.act(async () => {
    const print = (control('print-print').props as PressableProps).onPress;
    print?.({} as never);
    print?.({} as never);
    await settle();
  });
  expect(printHtml).toHaveBeenCalledTimes(1);
  expect(data.book.state.prints[0].value.documents).toEqual([{ id: 'journal', from: '2026-09-21', to: DAY }]);
});

test("a journal's range: a month, the next one, two dates, and its layout kept on this phone", async () => {
  await mount(await withDay(), <PrintWeek />);
  await press('print-journal-range');
  expect(node('print-range').props.visible).toBe(true);
  await select('print-range-kind', 'month');
  expect(said('print-journal-line')).toBe('أكتوبر 2026 · من 15 أكتوبر 2026 إلى 22 أكتوبر 2026');
  await press('print-month-after');
  expect(said('print-journal-line')).toBe('نوفمبر 2026 · من 5 نوفمبر 2026 إلى 26 نوفمبر 2026');
  await select('print-range-kind', 'days');
  expect(said('print-journal-line')).toBe('من 17 أكتوبر 2026 إلى 23 أكتوبر 2026 · 22 أكتوبر 2026');
  await press('print-from-before');
  expect(said('print-journal-line')).toContain('من 16 أكتوبر 2026');
  const other = journalLayouts(t)[1].value;
  await select('print-layout', other);
  expect(loadPrintSettings().layouts).toEqual({ journal: other });
  expect(control('print-roll-range')).toBeDefined();
  expect(control('print-timetable-range')).toBeUndefined();
});

test("the sides, binding and blank copy stay on this phone; a blank copy joins its document's books", async () => {
  const data = await withDay();
  await mount(data, <PrintWeek />);
  await select('print-sides', 'one');
  await ReactTestRenderer.act(async () => {
    (node('print-binding').props as { onValueChange: (value: boolean) => void }).onValueChange(false);
    (node('print-blank').props as { onValueChange: (value: boolean) => void }).onValueChange(true);
    await settle();
  });
  expect(loadPrintSettings()).toMatchObject({ twoSided: false, binding: false, blank: true });
  await counted();
  expect(said('print-summary')).toBe(summary(33, 33, false));
  await mount(data, <PrintWeek />);
  expect(node('print-sides').props.selected).toBe('one');
  expect(node('print-binding').props.value).toBe(false);
  expect(node('print-blank').props.value).toBe(true);
  await press('print-print');
  await press('print-blank');
  await counted();
  await press('print-print');
  const [withBlank, without] = printHtml.mock.calls.map(([html]) => html.split('<section class="page set-').length);
  expect(withBlank - without).toBeGreaterThanOrEqual(IDS.length);
  expect(printHtml.mock.calls[0][0]).not.toContain('<section class="page"></section>');
});

test('switching the sides or the binding margins counts nothing again', async () => {
  await mount(await withDay(), <PrintWeek />);
  await counted();
  await select('print-sides', 'one');
  await press('print-binding');
  await counted();
  expect(pageColors).toHaveBeenCalledTimes(1);
  expect(said('print-summary')).toBe(summary(33, 33, false));
});

test('choosing a range for a document not ticked ticks it', async () => {
  const data = await withDay();
  await data.book.record(d(DAY), {
    kind: 'print.recorded',
    print: { id: 'p-1', documents: [{ id: 'roll', from: d('2026-09-21'), to: d(DAY) }] },
  });
  await mount(data, <PrintWeek />);
  expect(checked('roll')).toBe(false);
  await press('print-roll-range');
  await select('print-range-kind', 'month');
  expect(checked('roll')).toBe(true);
  expect(said('print-roll-line')).toBe('أكتوبر 2026');
});

test('when the pages cannot be counted it says so, and still prints, with no blank page between books', async () => {
  pageColors.mockRejectedValue(new Error('no web engine'));
  const data = await withDay();
  await mount(data, <PrintWeek />);
  await counted();
  expect(said('print-summary')).toBe(words.countFailed);
  await press('print-print');
  const [html] = printHtml.mock.calls[0];
  expect(html).not.toContain(' set-u"');
  expect(html).not.toContain('<section class="page"></section>');
  expect(data.book.state.prints).toHaveLength(1);
  expect(tree!.root.findAllByProps({ testID: 'print-said' })).toHaveLength(0);
});
