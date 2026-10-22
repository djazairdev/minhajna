// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Prints and saved PDFs in the activity log (#235, answer 426): a document's
// output records its name, the period its file is named after, print or PDF
// and whether it was blank, once Android's print screen opens or the file is
// saved; a save the teacher cancels, or a print that fails, records nothing;
// the texts book's corrections do the same; and nothing names a file, a
// pupil or where the page went. Made-up records only.

import { eventOf, type RecordEvent } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import type { TestData } from '../jest/app-data';
import { mount, press, root, unmount } from '../jest/note-screens';
import { withDay } from '../jest/today-day';
import { BookFixes } from '../src/book/BookFixes';
import { documentKind } from '../src/documents/catalogue';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const outputs = (data: TestData) =>
  data.book.entries.flatMap((entry) => {
    const event: RecordEvent | null = eventOf(entry);
    return event?.kind === 'output.recorded' ? [{ ...event.output, id: 'x' }] : [];
  });

const choose = async (testID: string, value: string) => {
  await ReactTestRenderer.act(() => {
    (root().findByProps({ testID }).props as { onSelect: (one: string) => void }).onSelect(value);
  });
};

test('a print and a saved PDF of a document each go into the log, with its period and version', async () => {
  const data = await withDay();
  await mount(data, <DocumentOutput kind={documentKind('texts')!} />);
  await press('output-print');
  await press('output-save');
  await choose('output-version', 'blank');
  await press('output-save');
  await settle();
  expect(outputs(data)).toEqual([
    { id: 'x', document: 'texts', period: '2026-10', how: 'print', blank: false },
    { id: 'x', document: 'texts', period: '2026-10', how: 'pdf', blank: false },
    { id: 'x', document: 'texts', period: '2026-10', how: 'pdf', blank: true },
  ]);
  expect(JSON.stringify(outputs(data))).not.toMatch(/\.pdf/);
});

test('a cancelled save and a failed print record nothing', async () => {
  const data = await withDay();
  await mount(data, <DocumentOutput kind={documentKind('journal')!} />);
  savePdf.mockResolvedValueOnce(false);
  await press('output-save');
  printHtml.mockRejectedValueOnce(new Error('E_PDF'));
  await press('output-print');
  await settle();
  expect(outputs(data)).toEqual([]);
});

test('the texts book’s corrections for the director go into the log by their month', async () => {
  const data = await withDay();
  await mount(data, <BookFixes month="2026-10" />);
  await press('fixes-print');
  await settle();
  expect(outputs(data)).toEqual([{ id: 'x', document: 'book-fixes', period: '2026-10', how: 'print', blank: false }]);
});
