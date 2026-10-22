// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مدة الحفظ» (#235, Settings-retention, answer 428): the drawn defaults
// chosen, the month each year's pupil data would be offered, each choice
// kept privately the moment it changes and the offers moving with it, the
// log with no choice, nothing erased, the Settings row's line, and French
// left to right. Made-up records only.

import { eventOf, parseDay } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { mount, press, root, texts, unmount } from '../jest/note-screens';
import { withDay } from '../jest/today-day';
import { Retention, retentionLine } from '../src/settings/Retention';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  missingKeys.length = 0;
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const checked = (testID: string) =>
  root().findAll((node) => node.props.testID === testID && typeof node.type !== 'string')[0]?.props.selected as
    boolean | undefined;

test('shows the drawn defaults, and when this year’s pupil data would be offered for erasing', async () => {
  await mount(await withDay(), <Retention />);
  expect(checked('retention-lessons-choice-kept')).toBe(true);
  expect(checked('retention-pupils-choice-after-next-year')).toBe(true);
  expect(checked('retention-notes-choice-kept')).toBe(true);
  expect(texts()).toEqual(
    expect.arrayContaining(['بيانات 2026-2027: يُعرض مسحها في جويلية 2028', 'الأصل: يبقى ما دامت السجلات التي يصفها']),
  );
  expect(root().findAllByProps({ testID: 'retention-log-choice' })).toHaveLength(0);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('keeps each choice privately at once, the offers move with it, and nothing is erased', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'session.noted', note: { sessionKey: 'c-1/2026-10-15/m1/k-1-w', note: 'ملاحظة (مثال)' } },
  ]);
  const before = data.book.entries.length;
  await mount(data, <Retention />);
  await press('retention-pupils-choice-after-its-year');
  await press('retention-lessons-choice-after-three-years');
  await press('retention-lessons-choice-after-three-years');
  await press('retention-notes-choice-with-pupils');
  const set = data.book.entries.slice(before).map((entry) => [entry.layer, eventOf(entry)?.kind]);
  expect(set).toEqual([
    ['private', 'retention.set'],
    ['private', 'retention.set'],
    ['private', 'retention.set'],
  ]);
  expect(data.book.state.retention).toEqual({
    lessons: 'after-three-years',
    pupils: 'after-its-year',
    notes: 'with-pupils',
  });
  expect(texts()).toEqual(
    expect.arrayContaining([
      'بيانات 2026-2027: يُعرض مسحها في جويلية 2027',
      'سجلات حصص 2026-2027: يُعرض مسحها في جويلية 2030',
    ]),
  );
  expect(data.book.entries.some((entry) => entry.kind === 'erasure')).toBe(false);
  expect(retentionLine(i18n.t.bind(i18n), data.book.state)).toBe(
    'سجلات الحصص يُعرض مسحها بعد 3 سنوات · بيانات التلاميذ يُعرض مسحها بعد نهاية سنتها',
  );
});

test('reads left to right in French, with the Settings row’s default line', async () => {
  await i18n.changeLanguage('fr');
  const data = await withDay();
  await mount(data, <Retention />, 'ltr');
  expect(texts()).toContain('Données de 2026-2027 : effacement proposé en juillet 2028');
  expect(retentionLine(i18n.t.bind(i18n), data.book.state)).toBe(
    'Séances gardées jusqu’à suppression · Élèves : effacement proposé après l’année suivante',
  );
  expect(missingKeys).toEqual([]);
});
