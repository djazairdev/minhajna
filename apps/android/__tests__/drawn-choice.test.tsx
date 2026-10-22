// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «خانة التوقيع» on the output screens (#236, answers 412 and 413): while the
// drawn signature is in use, a document's output, «طباعة الأسبوع» and the
// roll-call print offer «بتوقيعي المرسوم», chosen first, or «فارغة» for that
// output only, with «إعدادات التوقيع» and a note saying where it goes, on
// what is confirmed only for the books that sign only that; the pages carry
// it or not as chosen, and a blank version never does. Without it, nothing
// is offered and the line about signing by hand stays. Made-up records only.

import { confirmSessions, parseDay, sessionsBetween } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type React from 'react';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import { documentKind } from '../src/documents/catalogue';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import type { Translate } from '../src/documents/document-data';
import { PrintWeek } from '../src/documents/PrintWeek';
import { drawnNote } from '../src/documents/SignatureChoice';
import face from '../src/native/NativeMinhajnaInterface';
import pdf from '../src/native/NativeMinhajnaPdf';
import { RollPrint } from '../src/rollbook/RollPrint';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const t = i18n.t.bind(i18n) as Translate;
const DAY = parseDay('2026-10-15');
const MARK = '<svg class="drawn"';
const printHtml = jest.spyOn(pdf, 'printHtml');
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => face.setSetting('print-week', 'null'));

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 4م1 and its pupils, that Thursday confirmed, and the signature drawn and in use unless `on` is false. */
async function signed(on = true): Promise<TestData> {
  const data = await withPupils();
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = sessionsBetween(context, DAY, DAY);
  await data.book.recordAll(DAY, [
    ...confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
    {
      kind: 'teacher.personal.set',
      personal: { signature: { width: 600, height: 200, path: 'M 10 20 L 300 150' }, signatureOn: on },
    },
  ]);
  return data;
}

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, '2026-10-18')}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const found = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID);

/** The choice's control, which only shows while the signature is in use. */
const choice = (testID: string) =>
  found(testID).filter((node) => typeof (node.props as { onSelect?: unknown }).onSelect === 'function');

const pressable = (testID: string) =>
  found(testID).find((node) => typeof (node.props as PressableProps).onPress === 'function');

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (pressable(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function select(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (choice(testID)[0].props as { onSelect: (value: string) => void }).onSelect(value);
    await settle();
  });
}

/** The pages last sent to print, after pressing `testID`. */
async function printed(testID: string): Promise<string> {
  printHtml.mockClear();
  await press(testID);
  return printHtml.mock.calls[0]?.[0] ?? '';
}

const message = (testID: string) => (found(testID)[0]?.props as { message?: string }).message;
const text = (testID: string) => JSON.stringify(found(testID)[0]?.props.children);

test('the note says «what is confirmed» only for a document that signs only that', () => {
  expect(drawnNote(t, ['texts'])).toBe(t('documents.output.drawnNote'));
  expect(drawnNote(t, ['timetable', 'journal'])).toBe(t('documents.output.drawnNote'));
  expect(drawnNote(t, ['timetable', 'roll'])).toBe(t('documents.output.drawnNoteBox'));
});

test('a document’s output offers it first, and «فارغة» or a blank version prints the box blank', async () => {
  const kind = documentKind('timetable');
  if (kind === undefined) throw new Error('No timetable');
  const onSignature = jest.fn();
  await mount(await signed(), <DocumentOutput kind={kind} day={DAY} onSignature={onSignature} />);
  expect(choice('output-signature')[0]?.props).toMatchObject({ selected: 'drawn' });
  expect(message('output-signature-line')).toBe(t('documents.output.drawnNoteBox'));
  expect(await printed('output-print')).toContain(MARK);
  await select('output-signature', 'blank');
  expect(message('output-signature-line')).toBe(kind.signatureLine(t));
  expect(await printed('output-print')).not.toContain(MARK);
  await select('output-signature', 'drawn');
  await select('output-version', 'blank');
  expect(message('output-signature-line')).toBe(kind.signatureLine(t));
  expect(await printed('output-print')).not.toContain(MARK);
  await press('output-signature-settings');
  expect(onSignature).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('without it in use, a document’s output offers nothing and keeps its line', async () => {
  const kind = documentKind('timetable');
  if (kind === undefined) throw new Error('No timetable');
  await mount(await signed(false), <DocumentOutput kind={kind} day={DAY} onSignature={jest.fn()} />);
  expect(choice('output-signature')).toHaveLength(0);
  expect(message('output-signature-line')).toBe(kind.signatureLine(t));
  expect(await printed('output-print')).not.toContain(MARK);
});

test('«طباعة الأسبوع» signs the chosen documents, or none with «فارغة»', async () => {
  const onSignature = jest.fn();
  await mount(await signed(), <PrintWeek onSignature={onSignature} />);
  expect(choice('print-signature')[0]?.props).toMatchObject({ selected: 'drawn' });
  expect(text('print-signature-line')).toContain(t('documents.output.drawnNote'));
  expect(await printed('print-print')).toContain(MARK);
  await select('print-signature', 'blank');
  expect(text('print-signature-line')).toContain(t('documents.printWeek.signatureLine'));
  expect(await printed('print-print')).not.toContain(MARK);
  await press('print-signature-settings');
  expect(onSignature).toHaveBeenCalledTimes(1);
});

test('without it in use, «طباعة الأسبوع» offers nothing and keeps its line', async () => {
  await mount(await signed(false), <PrintWeek />);
  expect(choice('print-signature')).toHaveLength(0);
  expect(text('print-signature-line')).toContain(t('documents.printWeek.signatureLine'));
});

test('the roll-call print signs the spread and the summary as chosen, not blank or the front pages', async () => {
  const onSignature = jest.fn();
  await mount(await signed(), <RollPrint courseId="c-1" onSignature={onSignature} />);
  expect(choice('roll-print-signature')[0]?.props).toMatchObject({ selected: 'drawn' });
  expect(text('roll-print-signature-line')).toContain(t('documents.output.drawnNoteBox'));
  expect(await printed('roll-print-print')).toContain(MARK);
  await select('roll-print-what', 'year');
  expect(await printed('roll-print-print')).toContain(MARK);
  await select('roll-print-version', 'blank');
  expect(text('roll-print-signature-line')).toContain(t('rollPrint.signatureNote'));
  expect(await printed('roll-print-print')).not.toContain(MARK);
  await select('roll-print-version', 'recorded');
  await select('roll-print-signature', 'blank');
  expect(await printed('roll-print-print')).not.toContain(MARK);
  await press('roll-print-signature-settings');
  expect(onSignature).toHaveBeenCalledTimes(1);
  await select('roll-print-what', 'front');
  expect(choice('roll-print-signature')).toHaveLength(0);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
