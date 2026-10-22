// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary session on Today in a week pack (#230, P-Today, answer 375):
// the proposal's tag names the plan week, and an activity of the weekly
// model says which of the week's sessions of it this is, on the proposal
// and on a later session's lesson. Made-up data only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, '2026-10-15')}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );

test.each(['ar', 'fr', 'en'] as Language[])('names the plan week and the activity’s session (%s)', async (language) => {
  missingKeys.length = 0;
  await i18n.changeLanguage(language);
  await render(await withPrimary(), language === 'ar' ? 'rtl' : 'ltr');
  const today = catalogues[language].today;
  const week = today.tagWeek.replace('{{week}}', '1');
  const reading = language === 'ar' ? 'قراءة' : language === 'fr' ? 'Lecture' : 'Reading';
  const line = today.activityLine.replace('{{activity}}', reading).replace('{{session}}', '1').replace('{{of}}', '1');
  const texts = shown();
  expect(texts).toContain(week);
  expect(texts).toContain(line);
  expect(accessibilityProblems(root())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('names the activity on a later session’s lesson', async () => {
  const data = await withPrimary();
  const [version] = data.book.state.timetables;
  const entries = version.version.entries.map((entry) =>
    entry.id === 'e-2' ? { ...entry, activity: 'writing' } : entry,
  );
  await data.book.record(parseDay('2026-10-15'), { kind: 'timetable.set', version: { ...version.version, entries } });
  await render(data);
  const today = catalogues.ar.today;
  const line = today.activityLine.replace('{{activity}}', 'كتابة').replace('{{session}}', '1').replace('{{of}}', '1');
  const lesson = today.activityLesson.replace('{{activity}}', line).replace('{{title}}', '\u2068كتابة 1 (مثال)\u2069');
  expect(shown()).toContain(lesson);
});
