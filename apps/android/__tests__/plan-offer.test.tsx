// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Offering a class's own list for review (#227, answer 347): exactly what
// goes, shown before the share sheet opens; the credit, no name or a name
// typed; the offer recorded only once shared, and shown in the list's
// history. Made-up data only.

import { parseDay, readListOffer, saveFreeList, type FreeList } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { PlanFree } from '../src/plan/PlanFree';
import { PlanOffer } from '../src/plan/PlanOffer';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const list: FreeList = {
  courseId: 'c-2',
  started: parseDay('2026-09-21'),
  items: [
    { id: 'u1', kind: 'unit', title: 'الوحدة الأولى (مثال)' },
    { id: 'l1', kind: 'lesson', title: 'درس أول (مثال)', sessions: 2, stages: ['قراءة', 'شرح'] },
  ],
};

async function withList(): Promise<TestData> {
  const data = await withDay();
  await data.book.record(day, saveFreeList(data.book.state.courses, list));
  return data;
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

test.each(['ar', 'fr', 'en'] as const)('shows what goes, shares it, then records the offer (%s)', async (language) => {
  const data = await withList();
  await showSettingsScreen(<PlanOffer courseId="c-2" />, data, language);
  const text = catalogues[language].planOffer;
  expect(settingsTexts()).toEqual(expect.arrayContaining([text.intro, text.never, text.creditNone, text.source]));
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  await pressSettings('offer-share');
  expect(NativeInput.shareText).toHaveBeenCalledTimes(1);
  const [name, file] = jest.mocked(NativeInput.shareText).mock.calls[0];
  expect(name).toBe('minhajna-list-2026-10-15.json');
  const read = readListOffer(file, data.profile);
  expect(read).toMatchObject({ credit: null, subject: 'arabic', year: '2026-2027', items: list.items });
  for (const absent of ['c-2', 'k-2', '4م2', 'started']) expect(file.includes(absent)).toBe(false);
  expect(data.book.state.lists.get('c-2')?.offered).toBe('2026-10-15');
  expect(has('offer-sent')).toBe(true);
});

test('shares once for a double tap', async () => {
  const data = await withList();
  let open = () => undefined as void;
  jest.mocked(NativeInput.shareText).mockReturnValueOnce(new Promise<void>((resolve) => (open = resolve)));
  await showSettingsScreen(<PlanOffer courseId="c-2" />, data);
  const press = settingsControl('offer-share').onPress;
  await ReactTestRenderer.act(async () => {
    press?.({} as never);
    press?.({} as never);
    open();
    await Promise.resolve();
  });
  expect(NativeInput.shareText).toHaveBeenCalledTimes(1);
  expect(data.book.state.lists.get('c-2')?.offered).toBe('2026-10-15');
});

test('credits a typed name only once it is typed', async () => {
  const data = await withList();
  await showSettingsScreen(<PlanOffer courseId="c-2" />, data);
  await pressSettings('offer-credit-name');
  expect(settingsControl('offer-share').disabled).toBe(true);
  expect(has('offer-needs')).toBe(true);
  await typeSettings('offer-name', 'س. ب. (مثال)');
  await pressSettings('offer-share');
  const [, file] = jest.mocked(NativeInput.shareText).mock.calls[0];
  expect(readListOffer(file, data.profile)).toMatchObject({ credit: 'س. ب. (مثال)' });
});

test('records nothing when the share sheet does not open, and offers nothing without a list', async () => {
  const data = await withList();
  jest.mocked(NativeInput.shareText).mockRejectedValueOnce(new Error('no app'));
  await showSettingsScreen(<PlanOffer courseId="c-2" />, data);
  await pressSettings('offer-share');
  expect(has('offer-failed')).toBe(true);
  expect(data.book.state.lists.get('c-2')?.offered).toBeUndefined();
  await showSettingsScreen(<PlanOffer courseId="c-1" />, data);
  expect(has('offer-none')).toBe(true);
});

test('the list shows its history, and offers itself only once saved', async () => {
  const data = await withList();
  await showSettingsScreen(<PlanOffer courseId="c-2" />, data);
  await pressSettings('offer-share');
  const onOffer = jest.fn();
  await showSettingsScreen(<PlanFree courseId="c-2" onOffer={onOffer} />, data);
  const history = catalogues.ar.planFree;
  expect(settingsTexts()).toEqual(
    expect.arrayContaining([
      history.offered.replace('{{day}}', '15/10/2026'),
      history.started.replace('{{day}}', '21/09/2026'),
    ]),
  );
  await pressSettings('free-offer');
  expect(onOffer).toHaveBeenCalledTimes(1);
  await typeSettings('free-title', 'درس ثانٍ (مثال)');
  await pressSettings('free-add');
  expect(has('free-offer')).toBe(false);
  await pressSettings('free-save');
  expect(data.book.state.lists.get('c-2')).toMatchObject({ started: '2026-09-21', offered: '2026-10-15' });
});
