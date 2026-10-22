// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class on a stale pack (#230, Plan-stale, answer 382): the plan says it
// proposes nothing, with the pack's reason and no pace; «استعماله بحذر»
// shows the pack as printed; «كتابة العناصر», once confirmed, leaves the
// pack for the class's own list; Today says why nothing is proposed; and the
// class list and the plan's changes say the plan is stale. Made-up packs and
// data only.

import { parseDay, type PlanPack } from '@minhajna/core';
import { Alert, useWindowDimensions, type AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import {
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  closeSettingsScreen,
} from '../jest/settings-screen';
import { classRows, paceLine } from '../src/classes/class-rules';
import { ClassPlan } from '../src/classes/ClassPlan';
import { PlanChanges } from '../src/plan/PlanChanges';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const reason = {
  ar: 'غيّر قرار لاحق ساعات المادة (مثال)',
  fr: 'Une décision a changé les heures (exemple)',
  en: 'A decision changed the hours (example)',
};
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** 5 ابتدائي أ with its Arabic pinned to a stale release of the example pack. */
async function withStale(): Promise<TestData> {
  const data = await withPrimary();
  const example = data.packs.find((one) => one.id === 'dz.primary.5ap.arabic.example');
  if (example === undefined) throw new Error('No example pack');
  const stale: PlanPack = { ...example, release: '2022.1', status: 'stale', staleReason: reason };
  const arabic = data.book.state.courses.get('a-1');
  if (arabic !== undefined)
    await data.book.record(day, {
      kind: 'course.set',
      course: { ...arabic, pack: { id: stale.id, release: '2022.1' } },
    });
  return { ...data, packs: [...data.packs, stale] };
}

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as Language[])('says a stale pack proposes nothing, and why (%s)', async (language) => {
  await showSettingsScreen(<ClassPlan courseId="a-1" onEditList={jest.fn()} />, await withStale(), language);
  const text = catalogues[language].classPlan.stale;
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      text.title,
      text.reason.replace('{{reason}}', `\u2068${reason[language]}\u2069`),
      text.ways,
    ]),
  );
  expect(has('plan-pace')).toBe(false);
  expect(has('plan-week-1')).toBe(false);
  await pressSettings('plan-stale-care');
  expect(has('plan-stale-note')).toBe(true);
  expect(has('plan-week-1')).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('«كتابة العناصر», once confirmed, leaves the stale pack for the class’s own list', async () => {
  const data = await withStale();
  const onEditList = jest.fn();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await showSettingsScreen(<ClassPlan courseId="a-1" onEditList={onEditList} />, data);
  await pressSettings('plan-stale-write');
  expect(alert).toHaveBeenCalledWith(
    catalogues.ar.classPlan.stale.write,
    catalogues.ar.classPlan.stale.writeAsk,
    expect.any(Array),
  );
  const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
  expect(buttons.map((button) => button.text)).toEqual([
    catalogues.ar.classPlan.stale.cancel,
    catalogues.ar.classPlan.stale.writeConfirm,
  ]);
  expect(data.book.state.courses.get('a-1')?.pack).not.toBeNull();
  await ReactTestRenderer.act(() => {
    buttons[1]?.onPress?.();
  });
  expect(data.book.state.courses.get('a-1')?.pack).toBeNull();
  expect(onEditList).toHaveBeenCalledTimes(1);
});

test('Today says why nothing is proposed, and the class list says the plan is stale', async () => {
  const data = await withStale();
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data);
  expect(settingsTexts()).toContain(catalogues.ar.today.packStale);
  const rows = classRows(coreContext({ ...data, state: data.book.state }), day);
  expect(rows.find((row) => row.course.id === 'a-1')?.stale).toBe(true);
  const t = i18n.t.bind(i18n) as unknown as Parameters<typeof paceLine>[0];
  expect(paceLine(t, { pace: null, check: null, stale: true })).toBe(catalogues.ar.classes.stale);
  expect(paceLine(t, { pace: null, check: null })).toBe(catalogues.ar.classes.noPack);
});

test('the plan’s changes say the plan is stale, not that there is no pack', async () => {
  await showSettingsScreen(<PlanChanges courseId="a-1" />, await withStale());
  expect(settingsTexts()).toContain(catalogues.ar.classes.stale);
  expect(settingsTexts()).not.toContain(catalogues.ar.classes.noPack);
});
