// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing on a PC (#250, answers 507, 521 and 522): a document's «طباعة»
// and «حفظ PDF» become one «طباعة أو حفظ PDF», with its line, which opens
// the print dialog under the file's name and counts as a print, while the
// phone keeps both buttons and the document's title; the week's print
// counts no pages, saying the dialog shows them, and offers no PDF of its
// own; the council file and the mark sheet as a PDF print, with no password
// and a line that a protected file is made on the phone, the council's
// confidential line in PC words, and the sheet's CSV still kept. Every new
// text is in French and English. Made-up records.

import { setAppreciation } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text } from 'react-native';
import type { TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { withDay } from '../jest/today-day';
import { useOutputRun } from '../src/documents/output-run';
import { PrintSave } from '../src/documents/PrintSave';
import { PrintWeek } from '../src/documents/PrintWeek';
import { ExportFile } from '../src/marks/ExportFile';
import { MarksCouncil } from '../src/marks/MarksCouncil';
import face from '../src/native/NativeMinhajnaInterface';
import pdf from '../src/native/NativeMinhajnaPdf';
import text from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const pageColors = jest.spyOn(pdf, 'pageColors');
const output = text.documents.output;
const printed = jest.fn();

afterEach(async () => {
  await unmount();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const pc = () => jest.replaceProperty(Platform, 'OS', 'web');
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 600)));

function Pair() {
  const { busy, print } = useOutputRun();
  return (
    <PrintSave
      print={{
        testID: 'made-print',
        label: 'Print',
        disabled: busy,
        onPress: () => print(() => '<p>Made up</p>', 'Made-up title', false, printed, 'Made-up file.pdf'),
      }}
      save={{ testID: 'made-save', variant: 'line', label: 'Save', disabled: busy, onPress: () => undefined }}
    />
  );
}

test('a PC has one print-or-save button, under the file’s name, counted as a print', async () => {
  pc();
  await mount(await withDay(), <Pair />);
  expect(has('made-save')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([output.printOrSave, output.printOrSaveLine]));
  await press('made-print');
  expect(printHtml).toHaveBeenCalledWith('<p>Made up</p>', 'Made-up file', false);
  expect(printed).toHaveBeenCalledTimes(1);
  expect(makePdf).not.toHaveBeenCalled();
});

test('the phone keeps both buttons and prints under the document’s title', async () => {
  await mount(await withDay(), <Pair />);
  expect(has('made-save')).toBe(true);
  expect(texts()).not.toContain(output.printOrSaveLine);
  await press('made-print');
  expect(printHtml).toHaveBeenCalledWith('<p>Made up</p>', 'Made-up title', false);
});

test('the week’s print on a PC counts no pages and offers no PDF of its own', async () => {
  pc();
  face.setSetting('print-week', 'null');
  const data = await withDay();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <PrintWeek />, '2026-10-23')}</LocaleDirContext.Provider>,
    );
    await Promise.resolve();
  });
  await settle();
  const shown = tree!.root.findAllByType(Text).map((node) => (node.props as TextProps).children);
  expect(shown).toContain(text.documents.printWeek.pc.counting);
  expect(shown).toContain(output.printOrSave);
  expect(tree!.root.findAll((node) => node.props.testID === 'print-pdf')).toHaveLength(0);
  expect(pageColors).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => tree?.unmount());
});

test('the council file on a PC prints under its name, with no password and the protected line', async () => {
  pc();
  await mount(await marked(), <MarksCouncil courseId="c-1" term={1} onTerm={jest.fn()} />);
  expect(has('council-protect')).toBe(false);
  expect(has('council-save')).toBe(false);
  expect(texts()).toEqual(
    expect.arrayContaining([
      output.printOrSave,
      text.marks.export.file.protectedOnPhone,
      text.marks.council.pc.saveNote,
    ]),
  );
  expect(texts()).not.toContain(text.marks.council.saveNote);
  await press('council-print');
  const [, title] = printHtml.mock.calls[0] ?? [];
  expect(title).toMatch(/2026-2027$/u);
});

test('every new text is in French and English', () => {
  for (const other of [fr, en]) {
    expect(other.documents.output.printOrSave).not.toBe('');
    expect(other.documents.output.printOrSaveLine).not.toBe(output.printOrSaveLine);
    expect(other.documents.printWeek.pc.counting).not.toBe(text.documents.printWeek.pc.counting);
    expect(other.marks.export.file.protectedOnPhone).not.toBe(text.marks.export.file.protectedOnPhone);
    expect(other.marks.council.pc.saveNote).not.toBe(text.marks.council.pc.saveNote);
  }
});

test('the mark sheet as a PDF on a PC prints with the protected line, and its CSV is still kept', async () => {
  pc();
  const data = await marked();
  await data.book.recordAll(
    DAY,
    ['p-1', 'p-2', 'p-3'].map((pupilId) =>
      setAppreciation(
        { courseId: 'c-1', term: 1, pupilId },
        { release: '2026.1' },
        { id: 'good-1', band: 'good', text: { ar: 'Made-up appreciation' } },
      ),
    ),
  );
  await mount(data, <ExportFile courseId="c-1" term={1} onSignature={jest.fn()} />);
  expect(has('file-protect')).toBe(false);
  expect(has('file-save')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([output.printOrSave, text.marks.export.file.protectedOnPhone]));
  await press('file-print');
  const [html, title] = printHtml.mock.calls[0] ?? [];
  expect(html).toContain('<!doctype html>');
  expect(title).toMatch(/2026-2027$/u);
  expect(makePdf).not.toHaveBeenCalled();
  await press('file-format-csv');
  expect(has('file-protect')).toBe(true);
  expect(has('file-save')).toBe(true);
});
