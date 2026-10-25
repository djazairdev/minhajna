// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's merge for the teaching council (#246, R-Merge, answer 492):
// the picture opens a grade's merge; each class's latest statement for the
// chosen subject shows in the school's order, its last resource placed on its
// unit in the app's pack, or shown as sent with why when it cannot be placed;
// it prints on landscape pages, one table whose heads repeat on each page,
// saves as a PDF and records nothing, and waits for an unnamed teacher's
// fingerprint. Made-up keys and statements only.

import type { ProgressStatement } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData, type TestData } from '../jest/app-data';
import { settle } from '../jest/components-screen';
import { KEY_A, KEY_B, keepStatement, madeUpStatement } from '../jest/reader-statements';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import pdf from '../src/native/NativeMinhajnaPdf';
import signature from '../src/native/NativeMinhajnaSignature';
import { mergeHtml } from '../src/reader/merge-page';
import type { MergeWords } from '../src/reader/merge-words';
import { ReaderMerge } from '../src/reader/ReaderMerge';
import { ReaderPicture } from '../src/reader/ReaderPicture';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const savePdf = jest.spyOn(pdf, 'savePdf');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const label = (id: string) => String(settingsRoot().findByProps({ testID: id }).props.accessibilityLabel);
const show = (...args: Parameters<typeof showSettingsScreen>) =>
  ReactTestRenderer.act(async () => {
    await showSettingsScreen(...args);
    await settle();
  });
const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((done, [key, value]) => done.replace(`{{${key}}}`, String(value)), text);

/** A statement whose last resource is `item` of the made-up 4AM Arabic pack. */
function withResource(day: string, section: string, item: string, status: 'done' | 'started', behind = 0) {
  const value = madeUpStatement(day, section, 'arabic', '4am', behind);
  return { ...value, lastResource: { id: item, title: `sent ${item}`, status } } satisfies ProgressStatement;
}

/** 4M2 and 4M1 in Arabic under two keys, a later 4M1 statement, and 4M1 in maths. */
async function school(data: TestData) {
  const ids = {
    second: await keepStatement(data, KEY_A, withResource('2026-10-08', '4M2', 'u2-3', 'done', 2)),
    old: await keepStatement(data, KEY_B, withResource('2026-10-01', '4M1', 'u1-2', 'done')),
    first: await keepStatement(data, KEY_B, withResource('2026-10-07', '4M1', 'u1-5', 'started')),
    maths: await keepStatement(data, KEY_B, madeUpStatement('2026-10-07', '4M1', 'math')),
  };
  return ids;
}

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('the picture opens its grade’s merge', async () => {
  const data = await openTestData();
  await school(data);
  const onMerge = jest.fn();
  await show(<ReaderPicture onOpen={jest.fn()} onList={jest.fn()} onMerge={onMerge} />, data);
  await pressSettings('reader-merge');
  expect(onMerge).toHaveBeenCalledWith('4am');
});

test.each(['ar', 'fr', 'en'] as const)(
  'the merge places each class on its unit in order, prints and keeps nothing (%s)',
  async (language) => {
    const data = await openTestData();
    const ids = await school(data);
    const before = data.book.entries.length;
    const onOpen = jest.fn();
    await show(<ReaderMerge grade="4am" onOpen={onOpen} />, data, language);
    const merge = catalogues[language].reader.merge;
    const rows = settingsRoot().findAll((node) => String(node.props.testID).startsWith('merge-row-'));
    expect([...new Set(rows.map((node) => node.props.testID as string))]).toEqual([
      `merge-row-${ids.first}`,
      `merge-row-${ids.second}`,
    ]);
    expect(label(`merge-row-${ids.first}`)).toContain(fill(merge.place, { at: 5, of: 7 }));
    expect(label(`merge-row-${ids.second}`)).toContain(fill(merge.place, { at: 3, of: 7 }));
    const units = data.packs.find((one) => one.id === 'dz.cem.4am.arabic.example' && one.release === '2026.1')!.items;
    expect(label(`merge-row-${ids.second}`)).toContain(units.filter((one) => one.kind === 'unit')[1].title);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings(`merge-row-${ids.second}`);
    expect(onOpen).toHaveBeenCalledWith(ids.second);
    await pressSettings('merge-print');
    const [html, , landscape] = printHtml.mock.calls[0];
    expect([landscape, html.includes('4M1'), html.includes('4M2'), html.split('class="done"').length - 1]).toEqual([
      true,
      true,
      true,
      7,
    ]);
    await pressSettings('merge-pdf');
    const [made, name] = savePdf.mock.calls[0];
    expect([made, name.startsWith(`${merge.title} `), name.endsWith('.pdf')]).toEqual(['merge', true, true]);
    expect(data.book.entries).toHaveLength(before);
  },
);

test('another subject, and each reason a resource is not placed', async () => {
  const data = await openTestData();
  const ids = await school(data);
  const own = withResource('2026-10-08', '4M3', 'u1-2', 'done');
  const ownId = await keepStatement(data, KEY_A, { ...own, pack: { id: own.pack.id, release: 'own' } });
  const missing = await keepStatement(data, KEY_A, {
    ...withResource('2026-10-08', '4M4', 'u1-2', 'done'),
    pack: { id: 'dz.cem.4am.arabic.made-up', release: '2026.1' },
  });
  const later = withResource('2026-10-08', '4M5', 'u1-2', 'done');
  const older = await keepStatement(data, KEY_A, { ...later, pack: { id: later.pack.id, release: '2027.1' } });
  const noItem = await keepStatement(data, KEY_A, withResource('2026-10-08', '4M6', 'made-up-item', 'done'));
  await show(<ReaderMerge grade="4am" onOpen={jest.fn()} />, data);
  const { merge } = catalogues.ar.reader;
  expect(label(`merge-row-${ownId}`)).toContain(merge.miss.own);
  expect(label(`merge-row-${missing}`)).toContain(merge.miss.noPack);
  expect(label(`merge-row-${older}`)).toContain(merge.miss.older);
  expect(label(`merge-row-${noItem}`)).toContain(merge.miss.noItem);
  await pressSettings('merge-subject-math');
  expect(has(`merge-row-${ids.maths}`)).toBe(true);
  expect(has(`merge-row-${ids.first}`)).toBe(false);
  await show(<ReaderMerge grade="1am" onOpen={jest.fn()} />, data);
  expect(has('reader-merge-empty')).toBe(true);
});

test('print and PDF wait while an unnamed teacher’s fingerprint is worked out', async () => {
  const data = await openTestData();
  await keepStatement(data, KEY_A, withResource('2026-10-08', '4M2', 'u2-3', 'done'));
  const pending = jest.spyOn(signature, 'keyFingerprint').mockReturnValueOnce(new Promise<string>(() => undefined));
  await show(<ReaderMerge grade="4am" onOpen={jest.fn()} />, data);
  const disabled = (testID: string) => settingsRoot().findByProps({ testID }).props.disabled as boolean;
  expect([disabled('merge-print'), disabled('merge-pdf')]).toEqual([true, true]);
  pending.mockRestore();
});

test('the printed merge is one table, its heads repeated on each page, rows under their schools', () => {
  const row = (index: number): MergeWords => ({
    id: `r-${index}`,
    school: index < 6 ? 'School A' : 'School B',
    section: `4M${index}`,
    teacher: 'T',
    day: '08/10/2026',
    unit: 'U',
    resource: 'R',
    place: 'P',
    track: { of: 4, at: 1, done: false },
    delay: 'D',
    notHeld: 'N',
  });
  const t = i18n.getFixedT('en');
  const sheet = {
    title: 'Merge',
    scope: 'S',
    today: '25/10/2026',
    rows: [...Array(11).keys()].map(row),
    grouped: true,
  };
  const html = mergeHtml(t, sheet, 'en', 'ltr');
  expect(html.split('<table class="merge">').length - 1).toBe(1);
  expect(html).toContain('.merge thead{display:table-header-group}');
  expect(html).toContain('.track .now{background:linear-gradient(to right,');
  expect(html.split('class="school"').length - 1).toBe(2);
  expect(html.split(catalogues.en.reader.merge.signature).length - 1).toBe(1);
});
