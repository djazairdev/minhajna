// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الوثائق» (#212): the list with what each document covers now, and a
// document's output: printed or saved as recorded or blank, «داخلي · سري»
// said and on the pages of a document with pupils, a cancelled save saying
// nothing, a failure said, a document this version does not make showing
// nothing, and the month's absences totalled in half-days. Made-up pupils only.

import { parseDay, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData, withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { documentKind, fileName, type DocumentKind } from '../src/documents/catalogue';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import { DocumentsTab } from '../src/documents/DocumentsTab';
import pdf from '../src/native/NativeMinhajnaPdf';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
const onOpen = jest.fn();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
  await i18n.changeLanguage('ar');
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function choose(value: 'recorded' | 'blank') {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'output-version' }).props as { onSelect: (value: string) => void }).onSelect(
      value,
    );
    await settle();
  });
}

/** 4م1's 45 made-up pupils, with p-3 absent and p-4 late on the first session of the made-up Thursday. */
async function withMarks() {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'roll-call.taken',
      rollCall: {
        unit: unitKey(1),
        classId: 'k-1',
        groupId: 'k-1-w',
        day: '2026-10-15' as Day,
        half: 'morning',
        absent: [{ pupilId: 'p-3', justified: false }],
        late: ['p-4'],
      },
    },
  ]);
  return data;
}

const kind = (id: string) => documentKind(id)!;

test('lists each document with what it covers now, and opens it', async () => {
  await mount(await withPupils(), <DocumentsTab onOpen={onOpen} onPrintWeek={() => undefined} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.navigation.documents,
      text.documents.journal,
      text.documents.rollBook,
      text.documents.list.more,
    ]),
  );
  expect(texts().some((line) => Object.values(text.week.days).some((name) => line.includes(name)))).toBe(true);
  await press('documents-roll');
  expect(onOpen).toHaveBeenCalledWith('roll');
});

test('prints the roll-call month as recorded, landscape, marked confidential', async () => {
  await mount(await withMarks(), <DocumentOutput kind={kind('roll')} />);
  expect(tree!.root.findAllByProps({ testID: 'output-confidential' }).length).toBeGreaterThan(0);
  expect(texts()).toContain(text.documents.output.signature);
  await press('output-print');
  expect(printHtml).toHaveBeenCalledTimes(1);
  const [html, title, landscape] = printHtml.mock.calls[0];
  expect([title, landscape]).toEqual([text.documents.rollBook, true]);
  expect(html.split(text.documents.confidential).length - 1).toBeGreaterThanOrEqual(2);
  expect(html).toContain(`>${text.documents.marks.unjustified}<`);
  expect(html).toContain(`>${text.documents.marks.late}<`);
  expect(tree!.root.findAllByProps({ testID: 'output-said' })).toHaveLength(0);
});

test('the month totals half-days: two sessions missed in one morning count once', async () => {
  const data = await withMarks();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'roll-call.taken',
      rollCall: {
        unit: unitKey(2),
        classId: 'k-1',
        groupId: 'k-1-w',
        day: '2026-10-15' as Day,
        half: 'morning',
        absent: [{ pupilId: 'p-3', justified: false }],
        late: [],
      },
    },
  ]);
  await mount(data, <DocumentOutput kind={kind('roll')} />);
  await press('output-print');
  const [html] = printHtml.mock.calls[0];
  const row = html.split('<tr>').find((one) => one.includes('>3</td>')) ?? '';
  expect(row.split(`>${text.documents.marks.unjustified}<`)).toHaveLength(3);
  expect(row).toMatch(/<td>1<\/td><td>0<\/td><\/tr>$/);
});

test('a class with no course is in neither the count nor the roll-call book', async () => {
  const data = await withMarks();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-3',
        schoolId: 's-1',
        level: 'cem',
        grade: '4am',
        name: 'قسم بلا مادة',
        groups: [{ id: 'k-3-w', kind: 'whole', name: 'قسم بلا مادة' }],
      },
    },
  ]);
  await mount(data, <DocumentsTab onOpen={onOpen} onPrintWeek={() => undefined} />);
  expect(texts().some((line) => line.startsWith(`${text.documents.list.classes_two} ·`))).toBe(true);
  await mount(data, <DocumentOutput kind={kind('roll')} />);
  await press('output-print');
  const [html] = printHtml.mock.calls[0];
  expect(html.match(/<section class="page"[^>]*>/g)).toHaveLength(2);
  expect(html).not.toContain('قسم بلا مادة');
});

test('the blank version keeps the names and leaves the marks for the pen', async () => {
  await mount(await withMarks(), <DocumentOutput kind={kind('roll')} />);
  await choose('blank');
  expect(tree!.root.findByProps({ testID: 'output-version' }).props.selected).toBe('blank');
  await press('output-print');
  const [html] = printHtml.mock.calls[0];
  expect(html.match(/<tr><td>\d+<\/td>/g)).toHaveLength(45);
  expect(html).not.toContain(`>${text.documents.marks.unjustified}<`);
  expect(html).not.toContain(`>${text.documents.marks.late}<`);
});

test('saves the journal as a PDF where the teacher picks, and says so', async () => {
  const data = await withPupils();
  await mount(data, <DocumentOutput kind={kind('journal')} />);
  expect(tree!.root.findAllByProps({ testID: 'output-confidential' })).toHaveLength(0);
  await press('output-save');
  const [html, name, landscape] = makePdf.mock.calls[0];
  expect([name, landscape]).toEqual(['document-journal', false]);
  expect(html).not.toContain(text.documents.confidential);
  expect(savePdf).toHaveBeenCalledWith('document-journal', `${text.documents.journal} 2026-10-15.pdf`);
  expect(texts()).toContain(text.documents.output.saved);
});

test('a double tap starts one save, and the blank roll-call month is named after the month', async () => {
  await mount(await withPupils(), <DocumentOutput kind={kind('roll')} />);
  await choose('blank');
  await ReactTestRenderer.act(async () => {
    const save = (control('output-save').props as PressableProps).onPress;
    save?.({} as never);
    save?.({} as never);
    await settle();
  });
  expect(makePdf).toHaveBeenCalledTimes(1);
  expect(savePdf).toHaveBeenCalledWith(
    'document-roll',
    `${text.documents.rollBook} 2026-10 - ${text.documents.output.blank}.pdf`,
  );
});

test('a roll-call book with no class taught says so, and prints nothing', async () => {
  await mount(await openTestData(), <DocumentOutput kind={kind('roll')} />);
  expect(texts()).toContain(text.documents.output.noClasses);
  expect(control('output-print').props.disabled).toBe(true);
  expect(control('output-save').props.disabled).toBe(true);
  await mount(await openTestData(), <DocumentOutput kind={kind('journal')} />);
  expect(tree!.root.findAllByProps({ testID: 'output-empty' })).toHaveLength(0);
});

test('a cancelled save says nothing, and a failure is said', async () => {
  await mount(await withPupils(), <DocumentOutput kind={kind('journal')} />);
  savePdf.mockResolvedValueOnce(false);
  await press('output-save');
  expect(tree!.root.findAllByProps({ testID: 'output-said' })).toHaveLength(0);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  printHtml.mockRejectedValueOnce(new Error('E_PDF'));
  await press('output-print');
  expect(warn).toHaveBeenCalled();
  expect(texts()).toContain(text.documents.output.failed);
  expect(control('output-print').props.disabled).toBeFalsy();
});

test('a file name has no character a file picker refuses, and an unknown document is none', () => {
  const slashed: DocumentKind = { ...kind('journal'), title: () => 'a/b:c*d?' };
  expect(fileName(slashed, { day: '2026-10-15' } as never, (() => '') as never, false)).toBe('a-b-c-d- 2026-10-15.pdf');
  expect(documentKind('grades')).toBeUndefined();
});
