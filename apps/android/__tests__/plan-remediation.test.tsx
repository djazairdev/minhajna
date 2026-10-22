// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «قائمة المعالجة» (#230, answer 376): the class's remediation list, kept
// apart from its support list, with its own heading and empty line and no
// sessions outside the timetable; and its link from a primary class's
// plan, which a middle-school plan does not show. Made-up data only.

import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { withPrimary } from '../jest/primary-class';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { SupportQueue } from '../src/plan/SupportQueue';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'keeps the remediation list apart from the support list (%s)',
  async (language) => {
    const data = await withPrimary();
    const text = catalogues[language].supportQueue;
    await showSettingsScreen(<SupportQueue courseId="a-1" kind="remediation" onLog={jest.fn()} />, data, language);
    expect(settingsTexts()).toEqual(expect.arrayContaining([text.remediationIntro, text.remediationEmpty]));
    expect(has('support-log')).toBe(false);
    expect(settingsTexts()).not.toContain(text.page);
    await typeSettings('support-new', 'التاء المربوطة (مثال)');
    await pressSettings('support-add');
    const saved = data.book.state.supportQueues.get('a-1/remediation');
    expect(saved?.kind).toBe('remediation');
    expect(saved?.items.map((item) => item.title)).toEqual(['التاء المربوطة (مثال)']);
    expect(data.book.state.supportQueues.has('a-1')).toBe(false);
    expect(settingsTexts()).toContain(text.remediationNext);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('links the remediation list from a primary class’s plan only', async () => {
  const onRemediation = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="a-1" onRemediation={onRemediation} />, await withPrimary());
  await pressSettings('plan-remediation');
  expect(onRemediation).toHaveBeenCalledTimes(1);
  await showSettingsScreen(<ClassPlan courseId="c-1" onRemediation={jest.fn()} />, await withDay());
  expect(has('plan-remediation')).toBe(false);
});
