// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سؤال المفتش» about a stale pack (#230, Plan-stale, answer 384): opened
// from the plan; the sheet with the school, the teacher, the class, the pack
// and its release, the reason or a line saying there is none, and the
// question; printed and saved as an A4 portrait page with no confidential
// mark; and nothing for a class whose pack is not stale. Made-up data only.

import { parseDay, type PlanPack } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withPrimary } from '../jest/primary-class';
import type { TestData } from '../jest/app-data';
import {
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  closeSettingsScreen,
} from '../jest/settings-screen';
import { staleReason, withStale } from '../jest/stale-pack';
import { ClassPlan } from '../src/classes/ClassPlan';
import pdf from '../src/native/NativeMinhajnaPdf';
import { StaleQuestion } from '../src/plan/StaleQuestion';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const printHtml = jest.spyOn(pdf, 'printHtml');
const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const isolated = (text: string) => `\u2068${text}\u2069`;

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  jest.clearAllMocks();
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('opens from the plan of a class on a stale pack', async () => {
  const onAsk = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="a-1" onAsk={onAsk} />, await withStale());
  await pressSettings('plan-stale-ask');
  expect(onAsk).toHaveBeenCalledTimes(1);
});

test.each(['ar', 'fr', 'en'] as Language[])(
  'shows the sheet with the pack, its reason and the question (%s)',
  async (language) => {
    await showSettingsScreen(<StaleQuestion courseId="a-1" />, await withStale(), language);
    const text = catalogues[language];
    expect(settingsTexts()).toEqual(
      expect.arrayContaining([
        text.staleQuestion.title,
        text.staleQuestion.classes_one.replace('{{classes}}', isolated('5 ابتدائي أ')),
        text.plan.status.stale,
        staleReason[language],
        text.staleQuestion.question,
        text.staleQuestion.inspectorSign,
        text.staleQuestion.privacy,
      ]),
    );
    expect(settingsTexts().some((line) => line.includes(isolated('2022.1')))).toBe(true);
    expect(settingsTexts().join('\n')).not.toContain(text.classPlan.stale.check);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('says the pack gives no reason, and has nothing for a pack that is not stale', async () => {
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, await withStale(false));
  expect(settingsTexts()).toContain(catalogues.ar.staleQuestion.noReason);
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, await withPrimary());
  expect(has('stale-question-none')).toBe(true);
  expect(has('stale-question-sheet')).toBe(false);
});

test('prints and saves an A4 portrait page with the reason and no confidential mark', async () => {
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, await withStale());
  await pressSettings('stale-question-print');
  await settle();
  const [html, title, landscape] = printHtml.mock.calls[0] ?? [];
  expect([title, landscape]).toEqual([catalogues.ar.staleQuestion.title, false]);
  expect(html).toContain('size:A4 portrait');
  expect(html).toContain(staleReason.ar);
  expect(html).toContain(catalogues.ar.staleQuestion.question);
  expect(html).not.toContain(catalogues.ar.documents.confidential);
  await pressSettings('stale-question-save');
  await settle();
  expect(makePdf).toHaveBeenCalledWith(expect.any(String), 'stale-question', false);
  expect(savePdf).toHaveBeenCalledWith('stale-question', expect.stringMatching(/^سؤال المفتش [\d-]+\.pdf$/));
  expect(settingsTexts()).toContain(catalogues.ar.documents.output.saved);
});

test('names every class of the teacher’s at the school on the same release', async () => {
  const data = await withStale();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'p-2',
        schoolId: 's-1',
        level: 'primary',
        grade: '5ap',
        name: '5 ابتدائي ب',
        groups: [{ id: 'p-2-w', kind: 'whole', name: '5 ابتدائي ب' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'b-1',
        classId: 'p-2',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.primary.5ap.arabic.example', release: '2022.1' },
      },
    },
  ]);
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, data);
  const both = `${isolated('5 ابتدائي أ')}${catalogues.ar.septCheck.and}${isolated('5 ابتدائي ب')}`;
  expect(settingsTexts()).toContain(catalogues.ar.staleQuestion.classes_two.replace('{{classes}}', both));
});

/** The stale release found at `place`. */
const foundAt = (data: TestData, place: string): TestData => ({
  ...data,
  packs: data.packs.map((pack): PlanPack =>
    pack.release === '2022.1' ? { ...pack, provenance: { ...pack.provenance, foundAt: place } } : pack,
  ),
});

test('says where the pack’s file was found, when the pack says', async () => {
  const line = (place: string) => catalogues.ar.staleQuestion.foundAt.replace('{{place}}', isolated(place));
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, foundAt(await withStale(), 'مكتبة المدرسة (مثال)'));
  expect(settingsTexts()).toContain(line('مكتبة المدرسة (مثال)'));
  await showSettingsScreen(<StaleQuestion courseId="a-1" />, foundAt(await withStale(), '  '));
  expect(settingsTexts().some((one) => one.startsWith(line('').slice(0, 8)))).toBe(false);
});
