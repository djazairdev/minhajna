// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «طباعة الأسبوع» prints (#215, R-3.8-52 to R-3.8-56): the documents
// it lists, each with what is new since its last print, and nothing new once
// the whole set is printed, until the next session and the next month, a
// month printed part-way offered again; each ticked document's copies for
// its range, its blank version after them when asked, a document with
// nothing in its range printing only its blank version and leaving no
// record; each document's pages from its books'; each document's line; and
// the choices kept on this phone, a damaged field giving way to the
// default. The teacher has 4م1 and 4م2 on Thursdays from 11 October 2026.
// Made-up records only.

import { parseDay } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import type { DocumentId } from '../src/documents/catalogue';
import type { DocumentData, Translate } from '../src/documents/document-data';
import { loadPrintSettings, PRINT_DEFAULTS, savePrintSettings } from '../src/documents/print-settings';
import { documentPages, entryLine, weekEntries, weekSet } from '../src/documents/print-week';
import face from '../src/native/NativeMinhajnaInterface';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

const d = parseDay;
const t = i18n.t.bind(i18n) as Translate;
const words = text.documents.printWeek;

const documentData = (data: TestData, day = '2026-10-23'): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  packs: data.packs,
  bells: data.bells,
  day: d(day),
  lang: 'ar',
  dir: 'rtl',
});

const ALL: DocumentId[] = ['journal', 'journal-front', 'timetable', 'roll', 'texts', 'supervised', 'homework'];

const kindOf = (data: DocumentData, id: string) => weekEntries(data).find((entry) => entry.kind.id === id)!.kind;

test('lists the documents the set can hold, each with what is new, and nothing new once all are printed', async () => {
  const data = await withDay();
  const entries = weekEntries(documentData(data));
  expect(entries.map((entry) => entry.kind.id)).toEqual(ALL);
  expect(entries.every((entry) => entry.news !== null)).toBe(true);
  const set = weekSet(
    documentData(data),
    t,
    ALL.map((id) => ({ id, range: { kind: 'new' } }) as const),
    false,
  );
  await data.book.record(d('2026-10-23'), { kind: 'print.recorded', print: { id: 'p-1', documents: set.printed } });
  expect(weekEntries(documentData(data)).filter((entry) => entry.news !== null)).toEqual([]);
  expect(weekEntries(documentData(data, '2026-11-05')).map((entry) => entry.news?.days ?? null)).toEqual([
    ['2026-11-05'],
    null,
    null,
    ['2026-10-01', '2026-11-01'],
    ['2026-10-01', '2026-11-01'],
    null,
    null,
  ]);
});

test('each ticked document is copied for each day of its range, then its blank version when asked', async () => {
  const data = documentData(await withDay());
  const choices = [
    { id: 'journal', range: { kind: 'new' } },
    { id: 'roll', range: { kind: 'month', month: '2026-10' } },
  ] as const;
  const set = weekSet(data, t, choices, false);
  expect(set.ids).toEqual(['journal', 'roll']);
  expect(set.documents.map((document) => [document.copies.length, document.landscape, document.pupils])).toEqual([
    [2, false, false],
    [1, false, true],
  ]);
  expect(set.printed).toEqual([
    { id: 'journal', from: '2026-09-21', to: '2026-10-23' },
    { id: 'roll', from: '2026-10-01', to: '2026-10-31' },
  ]);
  expect(set.books).toEqual([1, 2]);
  const blank = weekSet(data, t, choices, true);
  expect(blank.documents.map((document) => document.copies.length)).toEqual([3, 2]);
  expect(blank.printed).toEqual(set.printed);
});

test('a ticked document with nothing in its range prints its blank version only, and leaves no record', async () => {
  const data = documentData(await withDay());
  const choices = [{ id: 'journal', range: { kind: 'days', from: d('2026-10-16'), to: d('2026-10-21') } }] as const;
  expect(weekSet(data, t, choices, false)).toEqual({ ids: [], documents: [], printed: [], books: [] });
  const blank = weekSet(data, t, choices, true);
  expect([blank.ids, blank.printed, blank.documents[0].copies.length]).toEqual([['journal'], [], 1]);
  expect(weekSet(data, t, [{ id: 'strip', range: { kind: 'new' } }], true).ids).toEqual([]);
});

test("each document's pages are its books' pages added up", async () => {
  const data = documentData(await withDay());
  const set = weekSet(
    data,
    t,
    (['journal', 'timetable', 'roll'] as const).map((id) => ({ id, range: { kind: 'new' } }) as const),
    false,
  );
  expect(set.books).toEqual([1, 1, 2]);
  expect([...documentPages(set, [5, 1, 3, 4])]).toEqual([
    ['journal', 5],
    ['timetable', 1],
    ['roll', 7],
  ]);
});

test("each document's line says its range, what it covers or that nothing is new, and its pages", async () => {
  const data = documentData(await withDay());
  expect(entryLine(data, t, kindOf(data, 'journal'), { kind: 'new' }, 3)).toBe(
    `${words.new} · من 15 أكتوبر 2026 إلى 22 أكتوبر 2026 · 3 صفحات`,
  );
  expect(entryLine(data, t, kindOf(data, 'roll'), { kind: 'new' }, undefined)).toBe(
    `${words.new} · سبتمبر 2026${text.documents.journalFront.and}أكتوبر 2026`,
  );
  expect(entryLine(data, t, kindOf(data, 'timetable'), { kind: 'new' }, 1)).toBe(
    `${words.new} · ساري من الأحد 11/10/2026 · صفحة واحدة`,
  );
  expect(entryLine(data, t, kindOf(data, 'supervised'), { kind: 'new' }, 2)).toBe(`${words.new} · صفحتان`);
  expect(
    entryLine(data, t, kindOf(data, 'journal'), { kind: 'days', from: d('2026-10-16'), to: d('2026-10-21') }, 4),
  ).toBe(`من 16 أكتوبر 2026 إلى 21 أكتوبر 2026 · ${words.nothing}`);
  expect(entryLine(data, t, kindOf(data, 'journal'), { kind: 'month', month: '2026-11' }, undefined)).toBe(
    'نوفمبر 2026 · من 5 نوفمبر 2026 إلى 26 نوفمبر 2026',
  );
});

test('the choices stay on this phone, the defaults first, a damaged field giving way to its default', () => {
  expect(loadPrintSettings()).toEqual(PRINT_DEFAULTS);
  const kept = { twoSided: false, binding: false, blank: true, layouts: { journal: 'class' } };
  savePrintSettings(kept);
  expect(loadPrintSettings()).toEqual(kept);
  face.setSetting('print-week', JSON.stringify({ twoSided: 'no', blank: true, layouts: { journal: 3, roll: 'x' } }));
  expect(loadPrintSettings()).toEqual({ ...PRINT_DEFAULTS, blank: true, layouts: { roll: 'x' } });
  face.setSetting('print-week', '{damaged');
  expect(loadPrintSettings()).toEqual(PRINT_DEFAULTS);
  face.setSetting('print-week', '[]');
  expect(loadPrintSettings()).toEqual({ ...PRINT_DEFAULTS, layouts: {} });
});
