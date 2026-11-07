// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A clash between two schools (#232, answer 400): Today says which sessions
// meet, and which moved. The teacher no longer keeps a clash or moves a
// session on Week-slot: the timetable comes from the school (answer 808).
// Made-up schools and classes only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { withClash } from '../jest/clash-schools';
import { catalogues, i18n } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const iso = (value: string) => `\u2068${value}\u2069`;
const m1 = { half: 'morning', index: 1 } as const;
const text = catalogues.ar;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

async function render(data: TestData, element: React.ReactElement, on = '2026-10-15') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, on)}</LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));

test('Today says which sessions meet, and that a moved one moved', async () => {
  const data = await withClash();
  await render(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />);
  const sameAs = (name: string, school: string) => i18n.t('today.sameTime', { class: iso(name), school: iso(school) });
  expect(shown()).toEqual(
    expect.arrayContaining([sameAs('5 ابتدائي أ', 'مدرسة الرياض'), sameAs('3 ابتدائي أ', 'مدرسة الفتح')]),
  );
  await ReactTestRenderer.act(() => tree?.unmount());
  const day = parseDay('2026-10-15');
  await data.book.record(day, {
    kind: 'move.set',
    move: { id: 'mv-1', courseId: 'f-3', groupId: 'k-3-w', day, from: m1, to: { half: 'afternoon', index: 2 } },
  });
  await render(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />);
  expect(shown().some((line) => line.startsWith(text.today.sameTime.split('{{')[0] ?? ''))).toBe(false);
  expect(shown().some((line) => line.startsWith(text.today.movedFrom.split('{{')[0] ?? ''))).toBe(true);
});
