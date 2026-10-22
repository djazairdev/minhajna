// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التوزيعات» (#237, Dist, answers 416, 421 to 424): one class and subject's
// distributions, the first with a plan, a choice when there are more; the
// annual tab by sequence, the monthly one by week of the month stepped to,
// starting on today's, and the termly one by term; the button opening the
// output in the tab shown; a screen with no plan saying where they come from;
// the first with a plan when the one given has gone; the Documents row opening
// the screen; and the output starting on the layout given. Made-up records
// only.

import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { openTestData } from '../jest/app-data';
import { mount, press, root, texts, unmount } from '../jest/note-screens';
import { withDay } from '../jest/today-day';
import { documentKind } from '../src/documents/catalogue';
import { DocumentOutput } from '../src/documents/DocumentOutput';
import { Dist } from '../src/distributions/Dist';
import { DocumentsTabScreen } from '../src/navigation/DocumentScreens';
import { shownMonth, yearMonths } from '../src/distributions/dist-table';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const onPrint = jest.fn();

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
  jest.clearAllMocks();
});

const row = (id: string) => String(root().findByProps({ testID: `dist-row-${id}` }).props.accessibilityLabel);

const select = async (testID: string, value: string) => {
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID }).props as { onSelect: (one: string) => void }).onSelect(value);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

test('shows the annual one for the class with a plan, by sequence with its months and sessions', async () => {
  await mount(await withDay(), <Dist onPrint={onPrint} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'التوزيعات · \u20684م1\u2069',
      'اللغة العربية',
      'السنة الدراسية \u20682026-2027\u2069، من مخطط القسم مكيّفاً مع استعمال زمنه والرزنامة.',
      'المقطع',
      'الفترة',
      'الحصص',
    ]),
  );
  expect(root().findAllByProps({ testID: 'dist-course' })).toHaveLength(0);
  expect(row('u1')).toBe('المقطع: المقطع 1 (مثال)، الفترة: من أكتوبر إلى نوفمبر، الحصص: 8');
  expect(row('u2')).toBe('المقطع: المقطع 2 (مثال)، الفترة: من نوفمبر إلى جانفي، الحصص: 8');
  expect(accessibilityProblems(root())).toEqual([]);
  await press('dist-print');
  expect(onPrint).toHaveBeenCalledWith('year', '2026-10-15');
});

test('steps through the months from today’s, and prints the month shown', async () => {
  await mount(await withDay(), <Dist onPrint={onPrint} />);
  await select('dist-tabs', 'month');
  expect(texts()).toEqual(expect.arrayContaining(['أكتوبر 2026', 'الأسبوع', 'الموارد']));
  expect(row('2026-10-11')).toBe('الأسبوع: 15 أكتوبر 2026، الموارد: تقويم تشخيصي (مثال)، الحصص: 2');
  await press('dist-month-after');
  expect(texts()).toContain('نوفمبر 2026');
  await press('dist-print');
  expect(onPrint).toHaveBeenCalledWith('month', '2026-11-01');
  for (let step = 0; step < 7; step += 1) await press('dist-month-after');
  expect(texts()).toEqual(expect.arrayContaining(['جوان 2027', 'لا حصة من المخطط في هذه الفترة.']));
});

test('shows the termly one by term, with its sequences', async () => {
  await mount(await withDay(), <Dist onPrint={onPrint} />);
  await select('dist-tabs', 'term');
  expect(texts()).toContain('التوزيع الذي يطلبه دفتر النصوص لكل فصل.');
  expect(row('1')).toBe(
    'الفصل: الفصل الأول\nتقويم تشخيصي (مثال)\nالمقطع 1 (مثال)\nالمقطع 2 (مثال)، ' +
      'الفترة: من سبتمبر إلى ديسمبر، الحصص: 16',
  );
  await press('dist-print');
  expect(onPrint).toHaveBeenCalledWith('term', '2026-10-15');
});

test('chooses between the classes with a plan, opening on the one given', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'course.set',
    course: {
      id: 'c-2',
      classId: 'k-2',
      subject: 'arabic',
      year: '2026-2027',
      pack: { id: 'dz.cem.4am.arabic.example', release: '2026.1' },
    },
  });
  await mount(data, <Dist courseId="c-2" onPrint={onPrint} />);
  expect(texts()).toContain('التوزيعات · \u20684م2\u2069');
  await select('dist-course', 'c-1');
  expect(texts()).toContain('التوزيعات · \u20684م1\u2069');
  expect(accessibilityProblems(root())).toEqual([]);
});

test('says where the distributions come from with no plan, and reads left to right in English', async () => {
  await mount(await openTestData(), <Dist onPrint={onPrint} />);
  expect(texts()).toContain('لا قسم له مخطط في هذه السنة بعد. تأتي التوزيعات من مخطط القسم مكيّفاً مع استعمال زمنه.');
  expect(root().findAllByProps({ testID: 'dist-print' })).toHaveLength(0);
  await unmount();
  await i18n.changeLanguage('en');
  await mount(await withDay(), <Dist onPrint={onPrint} />, 'ltr');
  expect(texts()).toEqual(expect.arrayContaining(['Distributions · \u20684م1\u2069', 'Sequence', 'Annual']));
});

test('keeps the months within the school year, and the output starts on the layout given', async () => {
  const data = await withDay();
  const months = yearMonths(data);
  expect(months[0]).toBe(data.year.from);
  expect(months.at(-1)).toBe(`${data.year.to.slice(0, 7)}-01`);
  expect(shownMonth(data, parseDay('2026-10-15'))).toBe('2026-10-01');
  expect(shownMonth(data, parseDay('2026-08-01'))).toBe(data.year.from);
  expect(shownMonth(data, parseDay('2027-08-01'))).toBe(months.at(-1));
  await mount(data, <DocumentOutput kind={documentKind('distributions')!} layout="term" />);
  expect(root().findByProps({ testID: 'output-layout' }).props.selected).toBe('term');
  expect(root().findByProps({ testID: 'output-layout' }).props.label).toBe('التوزيع');
  await mount(data, <DocumentOutput kind={documentKind('distributions')!} layout="unknown" />);
  expect(root().findByProps({ testID: 'output-layout' }).props.selected).toBe('year');
});

test('opens on the first class with a plan when the one given has gone, and from the Documents row', async () => {
  await mount(await withDay(), <Dist courseId="c-gone" onPrint={onPrint} />);
  expect(texts()).toContain('التوزيعات · \u20684م1\u2069');
  const navigate = jest.fn();
  const props = { navigation: { navigate }, route: { key: 'Documents', name: 'Documents' } } as unknown as Parameters<
    typeof DocumentsTabScreen
  >[0];
  await mount(await withDay(), <DocumentsTabScreen {...props} />);
  await press('documents-distributions');
  expect(navigate).toHaveBeenCalledWith('Dist');
});
