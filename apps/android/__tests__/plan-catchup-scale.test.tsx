// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The catch-up screens together (#228): «خيارات الاستدراك» for a class
// behind, «إضافة حصة» for each kind with «موعد آخر» open, and «قائمة الدعم»
// with a scheduled session, in Arabic and English, with text at 100% and
// 200%. Every control is named and every text grows and wraps. Made-up data
// only.

import { addCatchUp, awaitingBetween, confirmSessions, parseDay, saveSupportQueue, type Slot } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CatchUp } from '../src/plan/CatchUp';
import { CatchUpAdd } from '../src/plan/CatchUpAdd';
import { SupportQueue } from '../src/plan/SupportQueue';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const slot: Slot = { half: 'morning', index: 4 };
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** The demo day with c-1 behind its plan, its support list and a support session scheduled. */
async function behind(): Promise<TestData> {
  const data = await withDay();
  const contextOf = () => coreContext({ ...data, state: data.book.state });
  const sessions = awaitingBetween(contextOf(), parseDay('2026-10-11'), day).filter((one) => one.courseId === 'c-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      contextOf(),
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  const items = [{ id: 's1', title: 'تمارين الكسور (مثال)' }];
  await data.book.record(day, saveSupportQueue(data.book.state, { courseId: 'c-1', items }));
  await data.book.record(day, addCatchUp(contextOf(), { id: 'u-1', courseId: 'c-1', day, slot, kind: 'support' }, day));
  return data;
}

/** Every control named, no text clipped or held at one size, no text missing. */
function expectScales(): void {
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  for (const node of settingsRoot().findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
  }
  expect(missingKeys).toEqual([]);
}

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each((['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'the options, both kinds of added session and the support list scale ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    missingKeys.length = 0;
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await behind();
    await showSettingsScreen(<CatchUp courseId="c-1" onAdd={jest.fn()} onSupport={jest.fn()} />, data, language);
    for (const rung of [1, 2, 3, 4]) expect(has(`catchup-rung-${rung}`)).toBe(true);
    expectScales();
    for (const kind of ['catch-up', 'support'] as const) {
      await showSettingsScreen(<CatchUpAdd courseId="c-1" kind={kind} onDone={jest.fn()} />, data, language);
      const text = catalogues[language].catchUpAdd;
      expect(settingsTexts().includes(text.supportPage)).toBe(kind === 'support');
      expect(settingsTexts().includes(text.step)).toBe(kind === 'catch-up');
      await pressSettings('catchup-add-other');
      expect(has('extra-month')).toBe(true);
      expectScales();
    }
    await showSettingsScreen(
      <SupportQueue courseId="c-1" onSchedule={jest.fn()} onLogScheduled={jest.fn()} />,
      data,
      language,
    );
    expect(has('support-log-u-1')).toBe(true);
    expect(has('support-cancel-u-1')).toBe(true);
    expectScales();
  },
);
