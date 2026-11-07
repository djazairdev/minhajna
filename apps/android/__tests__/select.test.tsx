// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The select input (answers 802 and 804): the field names its label and the
// chosen option once, opens a sheet whose rows tick the chosen one, closes on
// a choice or unchanged, searches a long list as the wilaya search does, and
// is disabled with no options. Made-up options only.

import { LocaleDirContext } from '@react-navigation/native';
import { Modal, Text, TextInput } from 'react-native';
import type { ModalProps, PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Select, SEARCH_FROM } from '../src/components/Select';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
const onChange = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
  onChange.mockReset();
});

const options = (count: number) =>
  Array.from({ length: count }, (_, at) => ({ value: `o${at}`, label: at === 3 ? 'مدرسةُ الأمَل' : `خيار ${at}` }));

async function render(count: number, value: string | null = null, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <Select testID="pick" label="اختيار تجريبي" options={options(count)} value={value} onChange={onChange} />
      </LocaleDirContext.Provider>,
    );
  });
}

const node = (id: string) => tree.root.find((one) => one.props.testID === id && one.props.onPress !== undefined);
const press = (id: string) =>
  ReactTestRenderer.act(() => {
    (node(id).props as PressableProps).onPress?.({} as never);
  });
const isOpen = () => (tree.root.findByType(Modal).props as ModalProps).visible === true;
const rows = () =>
  tree.root
    .findAll((one) => typeof one.props.testID === 'string' && /^pick-o\d+$/u.test(one.props.testID), { deep: false })
    .map((one) => String(one.props.testID).slice('pick-'.length));

test('names the label and the choice once, ticks it, and closes on a choice or unchanged', async () => {
  await render(3, 'o1');
  expect(node('pick').props.accessibilityLabel).toBe('اختيار تجريبي: خيار 1');
  const label = tree.root.findAllByType(Text).find((one) => one.props.children === 'اختيار تجريبي');
  expect(label?.props.importantForAccessibility).toBe('no');
  await press('pick');
  expect(isOpen()).toBe(true);
  expect(rows()).toEqual(['o0', 'o1', 'o2']);
  expect(node('pick-o1').props.selected).toBe(true);
  expect(tree.root.findAll((one) => one.props.testID === 'pick/search')).toHaveLength(0);
  await press('sheet-close');
  expect(isOpen()).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  await press('pick');
  await press('pick-o2');
  expect(isOpen()).toBe(false);
  expect(onChange).toHaveBeenCalledWith('o2');
});

test('searches a long list without diacritics or letter variants, and a new search starts empty', async () => {
  await render(SEARCH_FROM + 1);
  await press('pick');
  const search = () => tree.root.find((one) => one.props.testID === 'pick/search').findByType(TextInput);
  await ReactTestRenderer.act(() => {
    (search().props as TextInputProps).onChangeText?.('مدرسه الامل');
  });
  expect(rows()).toEqual(['o3']);
  await ReactTestRenderer.act(() => {
    (search().props as TextInputProps).onChangeText?.('لا شيء');
  });
  expect(rows()).toEqual([]);
  expect(tree.root.findAllByType(Text).map((one) => one.props.children as unknown)).toContain(text.select.none);
  await press('sheet-close');
  await press('pick');
  expect(rows()).toHaveLength(SEARCH_FROM + 1);
});

test('is disabled with no options', async () => {
  await render(0);
  expect(node('pick').props.accessibilityState).toMatchObject({ disabled: true });
});

test.each(['rtl', 'ltr'] as const)('names every control and keeps 48 dp targets (%s)', async (direction) => {
  await render(SEARCH_FROM + 1, 'o2', direction);
  expect(accessibilityProblems(tree.root)).toEqual([]);
  await press('pick');
  expect(accessibilityProblems(tree.root)).toEqual([]);
});
