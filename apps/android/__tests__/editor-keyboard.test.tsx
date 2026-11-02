// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A browser checkbox needs Space as well as Enter. Holding Space must not
// toggle repeatedly, and the disabled form must not accept a change.

import { act } from 'react-test-renderer';
import { Platform, type PressableProps } from 'react-native';
import { ItemForm } from '../src/editor/ItemForm';
import { rendered, show, source, unmount } from '../jest/editor-form';

type Key = { key: string; repeat: boolean; preventDefault: () => void; stopPropagation: () => void };
const control = () => {
  const node = rendered()
    .root.findAll((one) => one.props.testID === 'item-optional' && one.props.onKeyDown !== undefined)
    .at(0);
  if (node === undefined) throw new Error('The PC checkbox must have its keyboard handler');
  return node.props as PressableProps & { onKeyDown: (event: Key) => void };
};

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

test('Space toggles once, repeat and disabled input do not toggle', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await show(<ItemForm pack={source} item={source.items[0]} onSave={() => undefined} onCancel={() => undefined} />);
  const event = { key: ' ', repeat: false, preventDefault: jest.fn(), stopPropagation: jest.fn() };
  await act(() => control().onKeyDown(event));
  expect(control()['aria-checked']).toBe(true);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  await act(() => control().onKeyDown({ ...event, repeat: true }));
  expect(control()['aria-checked']).toBe(true);
  await unmount();
  await show(
    <ItemForm pack={source} item={source.items[0]} onSave={() => undefined} onCancel={() => undefined} busy />,
  );
  await act(() => control().onKeyDown(event));
  expect(control()['aria-checked']).toBe(false);
});
