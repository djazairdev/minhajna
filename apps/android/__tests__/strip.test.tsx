// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A strip of a day's entries to paste into the paper texts book (#214,
// Print-strip, R-3.8-15): each class and subject's confirmed sessions of the
// day at the book's column widths, inside cut marks, each piece saying the
// page and the rule it goes after, or the first rule of the next page when
// the day runs on to it; nothing to print on a day with nothing confirmed;
// no blank version; and the texts book offering the strip of the page's
// last confirmed day. Made-up records only.

import { confirmSessions, parseDay, sessionsBetween, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { documentKind } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import { stripPages } from '../src/documents/strip-pages';
import { BOOK_COLUMNS } from '../src/documents/texts-book-html';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const t = i18n.getFixedT('ar');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const documentData = (data: TestData, day: string): DocumentData => ({
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

const entries = (html: string) => html.match(/<tr class="entry">/g)?.length ?? 0;
const pieces = (html: string) => [...html.matchAll(/<p class="cut"[^>]*>✂ ([^<]*)<\/p>/g)].map((match) => match[1]);

/** 4م1's two Arabic sessions confirmed on each Thursday given, the first with `unplanned` when given. */
async function confirmed(days: readonly string[], unplanned?: string): Promise<TestData> {
  const data = await withDay();
  for (const day of days) {
    const context = coreContext({ ...data, state: data.book.state });
    const sessions = sessionsBetween(context, parseDay(day), parseDay(day), new Set(['c-1']));
    await data.book.recordAll(
      parseDay(day),
      confirmSessions(
        context,
        sessions.map((session, index) => ({
          session,
          ...(index === 0 && unplanned !== undefined && { details: { unplanned } }),
        })),
      ),
    );
  }
  return data;
}

test("prints a day's entries at the book's columns, inside cut marks, from the page's first rule", async () => {
  const html = stripPages(documentData(await confirmed(['2026-10-15']), '2026-10-15'), t);
  expect(pieces(html)).toEqual(['⁨4م1⁩ · اللغة العربية · الصفحة 1 · من السطر 1']);
  expect(entries(html)).toBe(2);
  expect(html).toContain(BOOK_COLUMNS);
  expect(html).toContain('<span class="m tl"></span>');
  expect(html).not.toMatch(/<script|https?:/);
});

test('a later day goes after the rule the entries before it end on', async () => {
  const data = await confirmed(['2026-10-15', '2026-10-22']);
  const [label] = pieces(stripPages(documentData(data, '2026-10-22'), t));
  expect(label).toBe('⁨4م1⁩ · اللغة العربية · الصفحة 1 · يلي السطر 2');
  expect(entries(stripPages(documentData(data, '2026-10-22'), t))).toBe(2);
});

test('a day that runs on to the next page gives a piece for each page', async () => {
  const long = Array.from({ length: 300 }, () => 'كلمة').join(' ');
  const html = stripPages(documentData(await confirmed(['2026-10-15'], long), '2026-10-15'), t);
  expect(pieces(html)).toEqual([
    '⁨4م1⁩ · اللغة العربية · الصفحة 1 · من السطر 1',
    '⁨4م1⁩ · اللغة العربية · الصفحة 2 · من السطر 1',
  ]);
});

test('a day with nothing confirmed has nothing to print, and the strip has no blank version', async () => {
  const data = await confirmed(['2026-10-15']);
  const kind = documentKind('strip');
  if (kind === undefined) throw new Error('No strip');
  expect(kind.empty(documentData(data, '2026-10-22'))).toBe(true);
  expect(kind.empty(documentData(data, '2026-10-15'))).toBe(false);
  expect(kind.blankLine(t)).toBeNull();
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, (<DocumentOutput kind={kind} day={'2026-10-15' as Day} />) as React.ReactElement, '2026-10-22')}
      </LocaleDirContext.Provider>,
    );
  });
  expect(tree!.root.findAll((node) => node.props.testID === 'output-version')).toHaveLength(0);
  expect(tree!.root.findAll((node) => node.props.testID === 'output-empty')).toHaveLength(0);
});
