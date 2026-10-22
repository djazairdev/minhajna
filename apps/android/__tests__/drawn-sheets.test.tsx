// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature on the sheets printed from their own screens (#236,
// answers 412 to 414): the September check, «سؤال المفتش» and the re-pace
// draft. While it is in use, each screen offers «بتوقيعي المرسوم», chosen
// first, with the note on where it goes and «إعدادات التوقيع», or
// «فارغة»; the sheet carries it in the teacher's box alone, never in the
// inspector's or the director's. Without it, nothing is offered and the box
// stays blank. Made-up data only.

import { parseDay } from '@minhajna/core';
import type React from 'react';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { behind, behindInPrimary } from '../jest/repace-data';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { withStale } from '../jest/stale-pack';
import { withDay } from '../jest/today-day';
import pdf from '../src/native/NativeMinhajnaPdf';
import { Repace } from '../src/plan/Repace';
import { SeptCheck } from '../src/plan/SeptCheck';
import { StaleQuestion } from '../src/plan/StaleQuestion';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const text = catalogues.ar;
const MARK = '<svg class="drawn"';

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  jest.clearAllMocks();
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

type Sheet = {
  readonly name: string;
  readonly data: () => Promise<TestData>;
  readonly screen: (onSignature: () => void) => React.ReactElement;
  readonly id: string;
  readonly print: string;
  /** Where the mark goes: right after the teacher's box's label. */
  readonly teacher: string;
};

const SHEETS: readonly Sheet[] = [
  {
    name: 'the September check',
    data: withDay,
    screen: (onSignature) => <SeptCheck courseId="c-1" onSignature={onSignature} />,
    id: 'sept-signature',
    print: 'sept-print',
    teacher: `<div class="sign">${text.septCheck.teacherSign}`,
  },
  {
    name: '«سؤال المفتش»',
    data: () => withStale(),
    screen: (onSignature) => <StaleQuestion courseId="a-1" onSignature={onSignature} />,
    id: 'stale-question-signature',
    print: 'stale-question-print',
    teacher: `<div class="sign">${text.septCheck.teacherSign}`,
  },
  {
    name: 'the re-pace draft',
    data: behind,
    screen: (onSignature) => <Repace courseId="c-1" onSignature={onSignature} />,
    id: 'repace-signature',
    print: 'repace-print',
    teacher: `<p class="prepared">${text.repace.sheet.prepared}`,
  },
];

/** The signature drawn, and in use unless `on` is false. */
async function signed(data: TestData, on = true): Promise<TestData> {
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'teacher.personal.set',
    personal: { signature: { width: 600, height: 200, path: 'M 10 20 L 300 150' }, signatureOn: on },
  });
  return data;
}

const choice = (id: string) =>
  settingsRoot().findAll((node) => node.props.testID === id && typeof node.props.onSelect === 'function');
const note = (id: string) =>
  settingsRoot()
    .findAll((node) => node.props.testID === `${id}-note`)
    .map((node) => node.props.children as unknown);

async function printed(testID: string): Promise<string> {
  printHtml.mockClear();
  await pressSettings(testID);
  return printHtml.mock.calls[0]?.[0] ?? '';
}

test.each(SHEETS)('$name carries it in the teacher’s box, or not with «فارغة»', async (sheet) => {
  const onSignature = jest.fn();
  await showSettingsScreen(sheet.screen(onSignature), await signed(await sheet.data()));
  expect(choice(sheet.id)[0]?.props).toMatchObject({ selected: 'drawn' });
  expect(note(sheet.id)).toContain(text.documents.output.drawnNoteBox);
  const html = await printed(sheet.print);
  expect(html.split(MARK)).toHaveLength(2);
  expect(html).toContain(`${sheet.teacher}${MARK}`);
  await ReactTestRenderer.act(() => (choice(sheet.id)[0].props.onSelect as (value: string) => void)('blank'));
  expect(note(sheet.id)).toEqual([]);
  expect(await printed(sheet.print)).not.toContain(MARK);
  await pressSettings(`${sheet.id}-settings`);
  expect(onSignature).toHaveBeenCalledTimes(1);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
});

test.each(SHEETS)('$name offers nothing and keeps the box blank while it is not in use', async (sheet) => {
  await showSettingsScreen(sheet.screen(jest.fn()), await signed(await sheet.data(), false));
  expect(choice(sheet.id)).toHaveLength(0);
  expect(await printed(sheet.print)).not.toContain(MARK);
});

test('a primary re-pace draft never carries it in the director’s box', async () => {
  await showSettingsScreen(<Repace courseId="c-1" />, await signed(await behindInPrimary()));
  const html = await printed('repace-print');
  expect(html.split(MARK)).toHaveLength(2);
  const director = html.slice(html.indexOf(text.repace.sheet.director));
  expect(director).toContain(text.repace.sheet.stamp);
  expect(director).not.toContain(MARK);
});
