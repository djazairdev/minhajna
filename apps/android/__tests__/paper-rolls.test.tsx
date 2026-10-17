// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إدخال مناداة من الورقة» in Today's backlog (#38): the earlier sessions
// whose roll call is not recorded, in order, each opening its roll call;
// none once recorded, for a session not held or for a class with no list;
// and every control named.
// Made-up pupils only.

import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Roll } from '../src/roll/Roll';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onRoll = jest.fn();
const sunday = '2026-10-18';

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onRoll.mockReset();
});

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, sunday)}</LocaleDirContext.Provider>,
    );
  });
}

const today = (data: TestData) => mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={onRoll} />);
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
const pressable = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressable(id)[0]?.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const listed = () =>
  root()
    .findAll(
      (node) =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('paper-session:') &&
        typeof (node.props as PressableProps).onPress === 'function',
    )
    .map((node) => node.props.testID as string)
    .filter((id, index, all) => all.indexOf(id) === index);

test("lists the backlog's earlier sessions without a roll call, and opens the one chosen", async () => {
  await today(await withPupils());
  expect(shown()).toEqual(expect.arrayContaining([text.roll.paper, text.roll.paperSub]));
  await press('backlog-paper');
  expect(listed()).toEqual([`paper-${unitKey(1)}`, `paper-${unitKey(2)}`]);
  expect(shown()).toEqual(expect.arrayContaining(['الخميس 15 أكتوبر', '⁧08:00 – 09:00⁩ · 4م1']));
  expect(accessibilityProblems(root())).toEqual([]);
  await press(`paper-${unitKey(2)}`);
  expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ key: key(2) }));
});

test('leaves out a roll call already recorded, a session not held and a class with no list', async () => {
  const data = await withPupils();
  await mount(data, <Roll sessionKey={key(1)} day={'2026-10-15' as never} onDone={jest.fn()} />);
  await press('roll-save');
  await today(data);
  await press(`backlog-${key(2)}`);
  await press(`backlog-${key(2)}-other`);
  await press('outcome-not-held');
  await press('backlog-paper');
  expect(listed()).toEqual([]);
});

test('says when no earlier session waits for its roll call', async () => {
  const data = await withPupils();
  for (const slot of [1, 2]) {
    await mount(data, <Roll sessionKey={key(slot)} day={'2026-10-15' as never} onDone={jest.fn()} />);
    await press('roll-save');
  }
  await today(data);
  await press('backlog-paper');
  expect(listed()).toEqual([]);
  expect(shown()).toContain(text.roll.paperNone);
});

test.each(['en', 'fr'] satisfies Language[])('has the paper entry texts in %s', (language) => {
  const roll = catalogues[language].roll as Record<string, unknown>;
  expect([roll.paper, roll.paperSub, roll.paperNone].every((one) => typeof one === 'string')).toBe(true);
});
