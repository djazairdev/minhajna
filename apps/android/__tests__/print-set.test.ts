// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One PDF for the print shop (#215, Print-set, R-3.8-51 to R-3.8-56): a
// document read back with its books; the binding margin on the spine's
// side; a set's books gathered across days, its styles scoped, its own page
// and its named one, the counting pass's marks, blank pages before a book
// that would start on a sheet's back, mirrored margins, the counts read
// from the marks' colours, and the pages, sheets and cost. Made-up records
// only.

import { parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import type { DocumentData } from '../src/documents/document-data';
import { journalPages } from '../src/documents/journal-pages';
import { printDocument, printedParts } from '../src/documents/print-html';
import {
  blankBefore,
  bookCount,
  countsFromColors,
  printSetHtml,
  printSummary,
  setLandscape,
  type SetDocument,
  type SetLayout,
} from '../src/documents/print-set';
import { homeworkPages } from '../src/documents/homework-pages';
import { rollSpreadPages } from '../src/documents/roll-spread-pages';
import { rollYearPages } from '../src/documents/roll-year-pages';
import { supervisedPages } from '../src/documents/supervised-pages';
import { textsBookPages } from '../src/documents/texts-book-pages';
import { timetablePages } from '../src/documents/timetable-pages';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

const t = i18n.getFixedT('ar');

const documentData = (data: TestData, day = '2026-10-15'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: parseDay(day),
  lang: 'ar',
  dir: 'rtl',
});

const layout: SetLayout = { lang: 'ar', dir: 'rtl', title: 'طباعة الأسبوع', twoSided: false, binding: true };

const page = (content: string, books?: string[], landscape = false, dir: 'rtl' | 'ltr' = 'rtl') =>
  printDocument({ lang: 'ar', dir, title: 'test', landscape, css: '.x{color:#000}', pages: [content], books });

const sections = (html: string) => [...html.matchAll(/<section class="([^"]*)"[^>]*>/g)].map((one) => one[1]);

test('a document reads back with its language, styles and each page’s book, and nothing else does', () => {
  const html = printDocument({
    lang: 'fr',
    dir: 'ltr',
    title: 'test',
    landscape: false,
    css: 'h1{font-size:12pt}',
    pages: ['<h1>A</h1>', '<h1>B</h1>', '<h1>C</h1>'],
    books: ['k-1', 'k-1', ''],
    confidential: 'داخلي · سري',
  });
  const parts = printedParts(html);
  expect(parts).toMatchObject({ lang: 'fr', dir: 'ltr', css: 'h1{font-size:12pt}' });
  expect(parts.pages.map((one) => one.book)).toEqual(['k-1', 'k-1', '']);
  expect(parts.pages[2].content).toContain('<h1>C</h1>');
  expect(html).toContain('<section class="page"><table class="frame">');
  expect(() => printedParts('<html><body></body></html>')).toThrow('Not a printed document');
  expect(() => printedParts(html.replace('<section class="page">', '<section class="page"><p>'))).not.toThrow();
  expect(() => printedParts(html.replace('</body>', '<p>stray</p></body>'))).toThrow('Not a printed document');
});

test('the binding margin falls on the spine’s side: the right in Arabic, the left in French, none on a landscape page', () => {
  expect(page('A')).toContain('@page{size:A4 portrait;margin:12mm 18mm 12mm 12mm}');
  expect(page('A', undefined, false, 'ltr')).toContain('@page{size:A4 portrait;margin:12mm 12mm 12mm 18mm}');
  expect(page('A', undefined, true)).toContain('@page{size:A4 landscape;margin:12mm 15mm}');
});

test('gathers a document’s pages book by book across its days, with each book’s first page marked when counting', async () => {
  const data = await withDay();
  const days = ['2026-10-15', '2026-10-22'].map((day) => journalPages(documentData(data, day), t, false, 'per-class'));
  expect(days[0]).toContain('data-book="k-1"');
  const journal: SetDocument = { landscape: false, pupils: false, copies: days };
  const perDay = days.map((one) => printedParts(one).pages.map((item) => item.book));
  const books = [...new Set(perDay.flat())];
  expect(bookCount([journal])).toBe(books.length);
  const counting = printSetHtml([journal], layout);
  const marked = sections(counting).filter((one) => one.endsWith(' set-u'));
  expect(marked).toHaveLength(books.length);
  const order = [...counting.matchAll(/<small>[^<]*\u2068(4م\d)\u2069<\/small>/g)].map((one) => one[1]);
  expect(order).toEqual(['4م1', '4م1', '4م2', '4م2']);
  expect(counting).toContain('section.set-u::before{content:"";position:absolute');
  expect(
    printSetHtml(
      [journal],
      layout,
      books.map(() => 1),
    ),
  ).not.toContain('set-u');
});

test('a day with no session in a journal kept for each class is left out, and a document of such days alone is kept', async () => {
  const data = await withDay();
  const day = (on: string) => journalPages(documentData(data, on), t, false, 'per-class');
  expect(printedParts(day('2026-10-18')).pages.map((one) => one.book)).toEqual(['']);
  const week: SetDocument = {
    landscape: false,
    pupils: false,
    copies: [day('2026-10-15'), day('2026-10-18'), day('2026-10-22')],
  };
  expect(bookCount([week])).toBe(2);
  const html = printSetHtml([week], layout, [2, 2]);
  expect(html).not.toContain(text.documents.empty);
  const quiet: SetDocument = { landscape: false, pupils: false, copies: [day('2026-10-18'), day('2026-10-19')] };
  expect(bookCount([quiet])).toBe(1);
  expect(printSetHtml([quiet], layout, [2])).toContain(text.documents.empty);
});

test('the frame’s foot follows the page’s content, so it stays at the foot where it does not repeat', () => {
  const html = printDocument({
    lang: 'ar',
    dir: 'rtl',
    title: 'test',
    landscape: true,
    css: '',
    pages: ['X'],
    confidential: 'سري',
  });
  expect(html).toContain('<tbody><tr><td>X</td></tr></tbody><tfoot><tr><td class="mark">سري</td></tr></tfoot>');
});

test('each class’s pages name its book, and a document kept as one names none', async () => {
  const data = documentData(await withDay());
  const books = (html: string) => printedParts(html).pages.map((one) => one.book);
  expect(books(rollSpreadPages(data, t, false))).toEqual(['k-1', 'k-1', 'k-2', 'k-2']);
  expect(books(rollYearPages(data, t, true))).toEqual(['k-1', 'k-2']);
  expect(books(textsBookPages(data, t, false))).toEqual(['k-1', 'k-2']);
  expect(books(homeworkPages(data, t, true))).toEqual(['k-1', 'k-2']);
  expect(books(supervisedPages(data, t, true))).toEqual(['k-1', 'k-2']);
  expect(books(journalPages(data, t, false, 'per-class'))).toEqual(['k-1', 'k-2']);
  expect(books(journalPages(data, t, false, 'combined'))).toEqual(['']);
  expect(books(timetablePages(data, t, false))).toEqual(['']);
});

test('scopes each document’s styles to its pages, adding no weight, and shares a scope between copies', async () => {
  const data = documentData(await withDay());
  const roll: SetDocument = {
    landscape: true,
    pupils: true,
    copies: [rollYearPages(data, t, false), rollYearPages(data, t, true)],
  };
  const timetable: SetDocument = { landscape: false, pupils: false, copies: [timetablePages(data, t, false)] };
  const html = printSetHtml([timetable, roll], layout);
  expect(html).toContain(':where(.d1) table.year{border-collapse:collapse;width:100%');
  expect(html).toContain(':where(.d1) table.year th,:where(.d1) table.year td{border:0.4pt solid #000');
  expect(html).toContain(':where(.d0) h1{font-family:Ruqaa,Naskh;font-size:20pt');
  const own = /<\/style><style>(.*?)<\/style><\/head>/s.exec(html)?.[1] ?? '';
  const selectors = own.split('}').flatMap((rule) => (rule === '' ? [] : rule.split('{')[0].split(',')));
  expect(selectors.length).toBeGreaterThan(20);
  expect(selectors.filter((one) => !one.startsWith(':where(.d'))).toEqual([]);
  expect(new Set(sections(html).map((one) => one.split(' ')[2]))).toEqual(new Set(['d0', 'd1']));
  expect(html).toContain('<section class="page set-l d1" lang="ar" dir="rtl">');
  expect(() =>
    printSetHtml(
      [{ landscape: false, pupils: false, copies: [page('A').replace('.x{color:#000}', '@media print{.x{}}')] }],
      layout,
    ),
  ).toThrow('A style the print set cannot scope');
});

test('the roll-call spread binds into a set, its shading scoped to its pages', async () => {
  const data = documentData(await withDay());
  const spread: SetDocument = { landscape: false, pupils: true, copies: [rollSpreadPages(data, t, false)] };
  const html = printSetHtml([spread], layout, [2, 2]);
  expect(html).toContain(':where(.d0) .none{background-image:radial-gradient(circle,#000 0.22mm,transparent 0.28mm)');
  expect(html).toContain(':where(.d0) table.book th,:where(.d0) table.book td{border:0.5pt solid #000');
  expect(sections(html).filter((one) => one.split(' ').includes('d0'))).toHaveLength(4);
});

test('the set’s own page takes the orientation of the documents with pupils’ data, and names the other', async () => {
  const data = documentData(await withDay());
  const roll: SetDocument = { landscape: true, pupils: true, copies: [rollYearPages(data, t, false)] };
  const timetable: SetDocument = { landscape: false, pupils: false, copies: [timetablePages(data, t, false)] };
  const front: SetDocument = { landscape: false, pupils: true, copies: [page('A')] };
  expect(setLandscape([timetable, roll])).toBe(true);
  expect(setLandscape([timetable, roll, front])).toBe(false);
  expect(setLandscape([timetable])).toBe(false);
  const landscape = printSetHtml([timetable, roll], layout);
  expect(landscape).toContain('@page {size:A4 landscape;margin:12mm 15mm}');
  expect(landscape).toContain('@page p{size:A4 portrait;');
  expect(landscape).toContain('section.set-p{page:p}:where(section.set-p) table.frame>tfoot{display:table-row-group}');
  const portrait = printSetHtml([timetable, roll, front], layout);
  expect(portrait).toContain('@page {size:A4 portrait;');
  expect(portrait).toContain('@page l{size:A4 landscape;margin:12mm 15mm}');
  expect(portrait).toContain('section.set-l{page:l}:where(section.set-l) table.frame>tfoot{display:table-row-group}');
});

test('margins: the spine’s side on one side, mirrored on both, even without binding, and never changed when counting', () => {
  const one: SetDocument = { landscape: false, pupils: false, copies: [page('A')] };
  const counts = [1];
  expect(printSetHtml([one], layout, counts)).toContain('@page {size:A4 portrait;margin:12mm 18mm 12mm 12mm}');
  expect(printSetHtml([one], { ...layout, dir: 'ltr' }, counts)).toContain('margin:12mm 12mm 12mm 18mm}');
  const both = printSetHtml([one], { ...layout, twoSided: true }, counts);
  expect(both).toContain('@page :left{margin:12mm 18mm 12mm 12mm}@page :right{margin:12mm 12mm 12mm 18mm}');
  const none = printSetHtml([one], { ...layout, twoSided: true, binding: false }, counts);
  expect(none).toContain('@page {size:A4 portrait;margin:12mm 15mm 12mm 15mm}');
  expect(none).not.toContain(':left');
  expect(printSetHtml([one], { ...layout, twoSided: true })).toContain(
    '@page {size:A4 portrait;margin:12mm 15mm 12mm 15mm}',
  );
});

test('on both sides, a blank page goes before each book that would start on a sheet’s back', () => {
  expect(blankBefore([1, 2, 2, 3, 1, 1, 1, 1], true)).toEqual([false, true, false, false, true, true, true, true]);
  expect(blankBefore([1, 2, 2, 3], false)).toEqual([false, false, false, false]);
  const books = ['A', 'B', 'C'].map((name) => ({ landscape: false, pupils: false, copies: [page(name)] }));
  const html = printSetHtml(books, { ...layout, twoSided: true }, [1, 2, 1]);
  expect(sections(html)).toEqual(['page set-p d0', 'page', 'page set-p d0', 'page set-p d0']);
  expect(() => printSetHtml(books, layout, [1, 2])).toThrow('A count for each book');
});

test('reads each book’s pages from the marks’ colours, and refuses a reading that does not add up', () => {
  const mark = [0xff0000, 0x00ff00];
  const plain = [0xffffff, 0x000000];
  expect(countsFromColors([...mark, ...plain, ...mark, ...mark, ...plain, ...plain], 3)).toEqual([2, 1, 3]);
  expect(countsFromColors([...mark, ...plain], 2)).toBeNull();
  expect(countsFromColors([...plain, ...mark], 1)).toBeNull();
  expect(countsFromColors([0xff0000, 0xff0000], 1)).toBeNull();
  expect(countsFromColors([0xff0000], 1)).toBeNull();
  expect(countsFromColors([0xf01010, 0x10f010], 1)).toEqual([1]);
});

test('the pages, the sheets they take and about what they cost, on one side and on both', () => {
  expect(printSummary([1, 2, 2, 3, 1, 1, 1, 1], true)).toEqual({ pages: 12, sheets: 9, price: 60 });
  expect(printSummary([1, 2, 2, 3, 1, 1, 1, 1], false)).toEqual({ pages: 12, sheets: 12, price: 60 });
  expect(printSummary([], true)).toEqual({ pages: 0, sheets: 0, price: 0 });
});
