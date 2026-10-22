// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's half-group pair (#231, L-Today, R-4.7-15, answer 387): a
// half-group's session shows each half's turn at its item, its own first,
// with the other half's day and week letter, the whole class's session, no
// session near, or that it has had it, and a line that the item is done for
// the class once every half has had it; each half is named by its number,
// and as the focus card «تمّت للفوج 1» records it. A whole-class session has
// no pair. Made-up data only.

import { parseDay, type TimetableEntry } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { withHalves } from '../jest/halves-class';
import { i18n, type Language } from '../src/text/i18n';
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

async function render(data: TestData, day = '2026-10-15', language: Language = 'ar') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        {withData(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, day)}
      </LocaleDirContext.Provider>,
    );
  });
}

const byId = (id: string) => root().findAll((node) => node.props.testID === id);
const texts = (id: string) =>
  byId(id)[0]
    ?.findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join('')) ?? [];

async function press(id: string) {
  const [control] = root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function');
  await ReactTestRenderer.act(() => {
    (control?.props as PressableProps).onPress?.({} as never);
  });
}

const whole = 'today-c-1/2026-10-15/m1/k-1-w';
const first = 'today-c-1/2026-10-15/m2/k-1-a';
const second = 'today-c-1/2026-10-18/m1/k-1-b';

test('shows the pair on a half’s card, and none on the whole class’s', async () => {
  await render(await withHalves());
  expect(byId(`${whole}-pair`)).toHaveLength(0);
  expect(texts(`${first}-pair`)).toEqual([
    'الفوج 1',
    'اليوم، الأسبوع ب',
    'الفوج 2',
    'الأحد 18 أكتوبر، الأسبوع أ',
    'يُعدّ العنصر منجزاً للقسم حين يمرّ به الفوجان.',
  ]);
  expect(byId(`${first}-pair-0`)[0]?.props.accessibilityLabel).toBe('الفوج 1، هذه الحصة: اليوم، الأسبوع ب');
  expect(byId(`${first}-pair-1`)[0]?.props.accessibilityLabel).toBe('الفوج 2: الأحد 18 أكتوبر، الأسبوع أ');
});

test('says when the other half’s session came first and awaits confirmation, with no letter every week', async () => {
  await render(await withHalves('2026-10-11', 'every'));
  expect(texts(`${first}-pair`)[1]).toBe('اليوم');
  expect(texts(`${first}-pair`)[3]).toBe('الأحد 11 أكتوبر، تنتظر التأكيد');
});

test('records the half with «تمّت للفوج 1», and the other half then says it has had it', async () => {
  const data = await withHalves();
  await render(data);
  expect(texts(`${whole}-confirm`)).toContain('تمّت كما هو مقترح');
  await press(`${whole}-confirm`);
  expect(texts(`${first}-confirm`)).toContain('تمّت للفوج 1');
  await press(`${first}-confirm`);
  expect(byId(`${first}-pair`)).toHaveLength(0);
  await render(data, '2026-10-18');
  expect(texts(`${second}-confirm`)).toContain('تمّت للفوج 2');
  expect(texts(`${second}-pair`).slice(0, 4)).toEqual(['الفوج 2', 'اليوم، الأسبوع أ', 'الفوج 1', 'أُنجز']);
});

test('says the pair in English and French, naming each half by its number', async () => {
  await render(await withHalves(), '2026-10-15', 'en');
  await press(`${whole}-confirm`);
  expect(texts(`${first}-confirm`)).toContain('Done with group 1');
  expect(texts(`${first}-pair`)).toEqual([
    'Group 1',
    'Today, Week B',
    'Group 2',
    'Sunday 18 October, Week A',
    'The item is done for the class once both groups have had it.',
  ]);
  await render(await withHalves(), '2026-10-15', 'fr');
  expect(texts(`${first}-pair`)[2]).toBe('Groupe 2');
});

test('says when neither the other half nor the whole class has a session near', async () => {
  const data = await withHalves();
  const [timetable] = data.book.state.timetables;
  const entries = timetable.version.entries.filter((entry) => entry.id !== 'e-2b' && entry.id !== 'e-1');
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'timetable.set',
    version: { ...timetable.version, id: 'v-2', from: parseDay('2026-10-16'), entries },
  });
  await render(data);
  expect(texts(`${first}-pair`)[3]).toBe('لا حصة له في الأسابيع القادمة');
});

test('shows every half, and says the item waits for all of them, with three halves', async () => {
  const data = await withHalves();
  const [timetable] = data.book.state.timetables;
  const third: TimetableEntry = { ...timetable.version.entries.find((entry) => entry.id === 'e-2b')!, id: 'e-2c' };
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        ...data.book.state.classes.get('k-1')!,
        groups: [...data.book.state.classes.get('k-1')!.groups, { id: 'k-1-c', kind: 'half', name: 'الفوج 3' }],
      },
    },
    {
      kind: 'timetable.set',
      version: {
        ...timetable.version,
        entries: [...timetable.version.entries, { ...third, groupId: 'k-1-c', slot: { half: 'morning', index: 2 } }],
      },
    },
  ]);
  await render(data);
  const shown = texts(`${first}-pair`);
  expect(shown.filter((text) => text.startsWith('الفوج'))).toEqual(['الفوج 1', 'الفوج 2', 'الفوج 3']);
  expect(shown.at(-1)).toBe('يُعدّ العنصر منجزاً للقسم حين تمرّ به الأفواج كلها.');
});
