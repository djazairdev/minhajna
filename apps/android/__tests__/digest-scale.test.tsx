// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #234's screens at large text: the Digest with a make-up due and a class
// behind its plan, then with a closure's sessions apart, and «الإشعارات»
// with every switch on while Android does not let the app notify, in
// Arabic and English, with text at 100% and 200%. Every control is named
// and every text grows and wraps. Made-up data only.

import { awaitingBetween, confirmSessions, parseDay, type RecordEvent } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { calendarEntry } from '../jest/calendar-data';
import { fakeNotify } from '../jest/fake-notify';
import { behind, repaceContext, repaceDay } from '../jest/repace-data';
import { Digest } from '../src/digest/Digest';
import { Notify } from '../src/settings/Notify';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import { i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const has = (id: string) => root().findAll((node) => node.props.testID === id).length > 0;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  setNotifyPrefs({ digest: true, preview: false, saturday: false });
  fakeNotify.allowed = true;
  await i18n.changeLanguage('ar');
});

async function show(element: ReactElement, data: TestData, language: Language, day?: string): Promise<void> {
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(data, element, day)}
      </LocaleDirContext.Provider>,
    );
  });
}

/** Every control named, no text clipped or held at one size, no text missing. */
function expectScales(): void {
  expect(accessibilityProblems(root())).toEqual([]);
  for (const node of root().findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
  }
  expect(missingKeys).toEqual([]);
}

/** 4م1 behind its plan, and 4م2's first session not held with a make-up due. */
async function makeUpWeek(): Promise<TestData> {
  const data = await behind();
  const context = repaceContext(data);
  const first = awaitingBetween(context, parseDay('2026-10-11'), repaceDay).find((one) => one.courseId === 'c-2');
  if (first === undefined) throw new Error('No session of 4م2 awaits');
  await data.book.recordAll(
    repaceDay,
    confirmSessions(context, [{ session: first, choice: { outcome: 'not-held', makeUp: true } }]),
  );
  return data;
}

/** The same classes with their school closed on 15 October. */
async function closedWeek(): Promise<TestData> {
  const data = await behind();
  const storm: RecordEvent = {
    kind: 'calendar.set',
    entry: calendarEntry('storm', { layer: 'school', schoolId: 's-1', effect: 'closure' }),
  };
  await data.book.record(repaceDay, storm);
  return data;
}

const cases = (['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale })));

test.each(cases)('the Digest scales ($language, $fontScale×)', async ({ language, fontScale }) => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  const digest = (
    <Digest onBacklog={jest.fn()} onMakeUp={jest.fn()} onCatchUp={jest.fn()} onPlan={jest.fn()} onNotify={jest.fn()} />
  );
  await show(digest, await makeUpWeek(), language, '2026-10-18');
  expect(['digest-range', 'digest-catchup-c-1', 'digest-notify'].every(has)).toBe(true);
  expect(root().findAll((node) => String(node.props.testID).startsWith('digest-makeup-')).length).toBeGreaterThan(0);
  expectScales();
  await ReactTestRenderer.act(() => tree?.unmount());
  await show(digest, await closedWeek(), language, '2026-10-18');
  const lines = root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
  expect(lines.some((line) => line.includes('storm'))).toBe(true);
  expect(has('digest-class-c-1')).toBe(true);
  expectScales();
});

test.each(cases)('«الإشعارات» scales ($language, $fontScale×)', async ({ language, fontScale }) => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  setNotifyPrefs({ digest: true, preview: true, saturday: true });
  fakeNotify.allowed = false;
  await show(<Notify />, await behind(), language);
  expect(['notify-off', 'notify-allow', 'notify-quiet', 'notify-no-names'].every(has)).toBe(true);
  expectScales();
});
