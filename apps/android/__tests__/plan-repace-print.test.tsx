// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing the re-pace draft and the director's approval (#229,
// Repace-primary, answers 367, 371 and 372): a middle-school print kept
// out of the history; a primary print recorded with its choices, the draft
// then waiting with them, the approval recorded from the print day and
// taken back by «تراجع»; editing from the printed ticks and printing
// again; and a print whose choice is no longer proposed. Made-up data
// only.

import { repaceDocument, repacePrinted } from '@minhajna/core';
import { useWindowDimensions, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { behind, behindInPrimary, repaceDay as day } from '../jest/repace-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import pdf from '../src/native/NativeMinhajnaPdf';
import { Repace } from '../src/plan/Repace';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const text = catalogues.ar.repace;
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const status = () =>
  settingsRoot().findAll((node) => node.props.testID === 'repace-status' && node.props.message !== undefined)[0]?.props
    .message as string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'a middle-school print leaves the history alone and has no director’s box (%s)',
  async (language) => {
    const data = await behind();
    const sheet = catalogues[language].repace.sheet;
    await showSettingsScreen(<Repace courseId="c-1" />, data, language);
    await pressSettings('repace-print');
    expect(printHtml).toHaveBeenCalledTimes(1);
    const [html, title, landscape] = printHtml.mock.calls[0];
    expect(title).toContain(sheet.title.split(' {{')[0]);
    expect(landscape).toBe(false);
    expect(html).toContain(`lang="${language}"`);
    expect(html).toContain(sheet.prepared);
    expect(html).not.toContain(sheet.director);
    expect(data.book.state.prints).toHaveLength(0);
    expect(has('repace-confirm')).toBe(true);
    expect(missingKeys).toEqual([]);
  },
);

test('a primary draft is printed with its choices, waits, and is approved from the print day', async () => {
  const data = await behindInPrimary();
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  expect(status()).toBe(text.statusDraft);
  await pressSettings('repace-choice-0');
  await pressSettings('repace-print');
  const [html] = printHtml.mock.calls[0];
  expect(html).toContain(text.sheet.director);
  expect(html).toContain(text.sheet.stamp);
  const printed = repacePrinted(data.book.state, 'c-1');
  expect(printed?.day).toBe(day);
  expect(printed?.choices).toHaveLength(1);
  expect(data.book.state.prints[0]?.value.documents[0]?.id).toBe(repaceDocument('c-1'));
  expect(status()?.startsWith(text.statusPrinted.split(' {{')[0])).toBe(true);
  expect(has('repace-choice-0')).toBe(false);
  expect(has('repace-print')).toBe(false);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);

  await pressSettings('repace-record');
  const [repace] = [...data.book.state.repaces.values()];
  expect(repace?.approved).toBe(day);
  expect(repace?.decisions).toHaveLength(1);
  expect(has('repace-done')).toBe(true);
  expect(has('repace-applied')).toBe(true);
  const [undo] = settingsRoot().findAll(
    (node) => node.props.accessibilityLabel === catalogues.ar.planItem.undo && typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    await (undo.props as PressableProps).onPress?.({} as never);
  });
  expect(data.book.state.repaces.size).toBe(0);
  expect(data.book.state.decisions.size).toBe(0);
  expect(has('repace-record')).toBe(true);
  expect(missingKeys).toEqual([]);
});

test('editing a printed draft brings back the ticks, and a new print replaces the old', async () => {
  const data = await behindInPrimary();
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  await pressSettings('repace-print');
  expect(repacePrinted(data.book.state, 'c-1')?.choices).toEqual([]);
  await pressSettings('repace-edit');
  expect(status()?.startsWith(text.statusEditing.split(' {{')[0])).toBe(true);
  expect(has('repace-record')).toBe(false);
  await pressSettings('repace-choice-0');
  await pressSettings('repace-print');
  expect(repacePrinted(data.book.state, 'c-1')?.choices).toHaveLength(1);
  expect(has('repace-record')).toBe(true);
  await pressSettings('repace-edit');
  const [tick] = settingsRoot().findAll(
    (node) => node.props.testID === 'repace-choice-0' && node.props.accessibilityState !== undefined,
  );
  expect(tick?.props.accessibilityState).toMatchObject({ checked: true });
  await pressSettings('repace-choice-0');
  await pressSettings('repace-print');
  expect(repacePrinted(data.book.state, 'c-1')?.choices).toEqual([]);
});

test('a print whose choice is no longer proposed asks for a new print', async () => {
  const data = await behindInPrimary();
  const documents = [{ id: repaceDocument('c-1'), from: day, to: day, choices: ['merge:gone+away'] }];
  await data.book.record(day, { kind: 'print.recorded', print: { id: 'pr-1', documents } });
  await showSettingsScreen(<Repace courseId="c-1" />, data);
  expect(status()?.startsWith(text.statusChanged.split(' {{')[0])).toBe(true);
  expect(has('repace-print')).toBe(true);
  expect(has('repace-record')).toBe(false);
  expect(settingsTexts()).toContain(text.primary);
});
