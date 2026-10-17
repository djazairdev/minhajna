// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pupils who join or leave (#40, Pupil-move): a pupil joining at the end of
// the list from their day, the registration number checked, a pupil leaving
// who stays on the roll call with a note until the director confirms, the
// confirmation, numbers kept as on paper, the link from the roll call, and
// every text in each language. Made-up pupils only.

import { current, pendingDeparture } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { PupilMove } from '../src/moves/PupilMove';
import { Roll } from '../src/roll/Roll';
import { keepMarks } from '../src/roll/roll-rules';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();
const onMove = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
  onMove.mockReset();
  keepMarks(`session:${key(1)}`, null);
});

async function mount(data: TestData, element: React.ReactElement, today = '2026-10-15') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, today)}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const pressables = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressables(id)[0]?.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const type = async (id: string, value: string) => {
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
  });
};
const disabled = (id: string) =>
  (root().findAll((node) => node.props.testID === id)[0]?.props as { disabled?: boolean }).disabled;
const move = (data: TestData, today?: string) => mount(data, <PupilMove classId="k-1" onDone={onDone} />, today);
const roll = (data: TestData) =>
  mount(data, <Roll sessionKey={key(1)} day={'2026-10-15' as never} onDone={jest.fn()} onMove={onMove} />);

test('adds a pupil who joins at the end of the list, called from their day', async () => {
  const data = await withPupils();
  await move(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      '4م1 · 45 تلميذاً',
      'يُضاف آخر القائمة برقم \u206646\u2069، كما في دفتر المناداة الورقي، ويُحسب حضوره من هذا التاريخ.',
    ]),
  );
  expect(disabled('move-save')).toBe(true);
  await type('move-name', 'بلحاج أنيس');
  await press('move-sex-m');
  await type('move-registration', '2209180544');
  await press('move-day-2026-10-15');
  await press('move-reason-transfer');
  expect(accessibilityProblems(root())).toEqual([]);
  await press('move-save');
  const joined = [...data.book.state.pupils.values()].at(-1);
  expect(joined).toMatchObject({
    classId: 'k-1',
    name: 'بلحاج أنيس',
    sex: 'm',
    registration: '2209180544',
    movements: [{ day: '2026-10-15', kind: 'in', reason: 'transfer' }],
  });
  expect(onDone).toHaveBeenCalledTimes(1);
  await roll(data);
  expect(figure()).toBe(`46 ${text.roll.present}`);
});

test('checks the registration number: digits only, and not one already listed', async () => {
  const data = await withPupils();
  await data.book.record('2026-10-15' as never, {
    kind: 'pupil.set',
    pupil: { ...data.book.state.pupils.get('p-1')!, registration: '111' },
  });
  await move(data);
  await type('move-name', 'بلحاج أنيس');
  await press('move-sex-f');
  await press('move-day-2026-10-15');
  await press('move-reason-other');
  await type('move-registration', '22-09');
  expect(shown()).toContain(text.move.registrationError);
  expect(disabled('move-save')).toBe(true);
  await type('move-registration', '111');
  expect(shown()).toContain(text.move.registrationTaken);
  expect(disabled('move-save')).toBe(true);
  await type('move-registration', '');
  expect(disabled('move-save')).toBe(false);
});

test('keeps a pupil who left on the roll call with a note until the director confirms', async () => {
  const data = await withPupils();
  await move(data);
  await press('move-mode-leave');
  await press('move-pupil');
  await press('move-pupil-p-2');
  await press('move-day-2026-10-15');
  await press('move-reason-transfer');
  await press('move-save');
  const pupil = () => data.book.state.pupils.get('p-2')!;
  expect(pendingDeparture(pupil())).toEqual({ day: '2026-10-15', kind: 'out', reason: 'transfer' });

  await roll(data);
  expect(figure()).toBe(`45 ${text.roll.present}`);
  expect(shown()).toContain('غادر في 15 أكتوبر · ينتظر تأكيد المدير');

  await move(data);
  await press('move-mode-leave');
  expect(shown()).toEqual(expect.arrayContaining([text.move.pending, 'غادر في 15 أكتوبر · تحويل إلى مؤسسة أخرى']));
  expect(accessibilityProblems(root())).toEqual([]);
  await press('move-confirm-p-2');
  expect(pendingDeparture(pupil())).toBeNull();
  expect(pupil().movements).toEqual([{ day: '2026-10-15', kind: 'out', reason: 'transfer', confirmed: true }]);
  expect(shown()).not.toContain(text.move.pending);

  await roll(data);
  expect(figure()).toBe(`44 ${text.roll.present}`);
  const numbered = (number: number) => root().findAll((node) => node.props.testID === `roll-${number}`).length;
  expect([numbered(1), numbered(2), numbered(3)]).toEqual([1, 0, 1]);
  expect(current(data.book.state.rollCalls.get(`session:${key(1)}`))).toBeNull();
});

test('opens from the roll call', async () => {
  await roll(await withPupils());
  await press('roll-move');
  expect(onMove).toHaveBeenCalledWith('k-1');
});

test.each(['en', 'fr'] satisfies Language[])('has every move text in %s', (language) => {
  const keys = (section: object): string[] =>
    Object.entries(section as Record<string, unknown>).flatMap(([name, value]) =>
      typeof value === 'object' && value !== null ? keys(value).map((one) => `${name}.${one}`) : [name],
    );
  expect(keys(catalogues[language].move).sort()).toEqual(keys(text.move).sort());
});

function figure() {
  return root().findAll((node) => node.props.testID === 'roll-stats-present')[0]?.props.accessibilityLabel as string;
}
