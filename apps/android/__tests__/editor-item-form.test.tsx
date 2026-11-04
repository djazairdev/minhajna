// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The provisional item form uses core validation and independent numbers,
// changes a copy, and never confuses a new item with one opened earlier.

import type { PressableProps } from 'react-native';
import { act } from 'react-test-renderer';
import { ItemForm } from '../src/editor/ItemForm';
import { missingKeys } from '../src/text/i18n';
import { field, press, rendered, show, shown, source, type, unmount } from '../jest/editor-form';

afterEach(unmount);

test('an existing source item needs independent re-entry before a changed copy is handed on', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  const before = JSON.stringify(source);
  await show(<ItemForm pack={source} item={source.items[0]} onSave={save} onCancel={() => undefined} />);
  expect(field('item-id').props.editable).toBe(false);
  expect(field('item-retyped-budget').props.value).toBe('');
  await type('item-title', 'عنوان مختلق بعد التصحيح');
  await press('item-save');
  expect(save).not.toHaveBeenCalled();
  expect(shown('item-problems')).toBe(true);
  await type('item-retyped-budget', '٢');
  await type('item-retyped-sourcePage', '٣');
  await press('item-save');
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].items[0].title).toBe('عنوان مختلق بعد التصحيح');
  expect(JSON.stringify(source)).toBe(before);
});

test('changing a first numeric entry clears its previous confirmation', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<ItemForm pack={source} item={source.items[0]} onSave={save} onCancel={() => undefined} />);
  await type('item-retyped-budget', '2');
  await type('item-retyped-sourcePage', '3');
  await type('item-budget', '4');
  expect(field('item-retyped-budget').props.value).toBe('');
  await press('item-save');
  expect(save).not.toHaveBeenCalled();
  await type('item-retyped-budget', '4');
  await press('item-save');
  expect(save.mock.calls[0][0].items[0].budget).toBe(4);
});

test('a new item requires its fields and supports optional and buffer flags', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<ItemForm pack={source} item={null} onSave={save} onCancel={() => undefined} />);
  await press('item-save');
  expect(save).not.toHaveBeenCalled();
  await type('item-id', 'added');
  await type('item-title', 'عنوان درس مختلق');
  await type('item-budget', '1,5');
  await type('item-retyped-budget', '١٫٥');
  await type('item-sourcePage', '5');
  await type('item-retyped-sourcePage', '5');
  await press('item-optional');
  await press('item-buffer');
  const checks = rendered().root.findAll(
    (node) => node.props.accessibilityRole === 'checkbox' && node.props.onFocus !== undefined,
    { deep: false },
  );
  expect(checks.map((node) => (node.props as PressableProps)['aria-checked'])).toEqual([true, true]);
  await press('item-save');
  expect(save.mock.calls[0][0].items[1]).toMatchObject({
    id: 'added',
    optional: true,
    buffer: true,
    budget: 1.5,
    sourcePage: 5,
  });
});

test('cancel and busy states hand on no changed source', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  const cancel = jest.fn();
  await show(<ItemForm pack={source} item={source.items[0]} onSave={save} onCancel={cancel} />);
  await type('item-title', 'Unsaved synthetic title');
  await press('item-cancel');
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  await unmount();
  await show(<ItemForm pack={source} item={source.items[0]} onSave={save} onCancel={cancel} busy />);
  expect(field('item-title').props.editable).toBe(false);
  await press('item-save');
  expect(save).not.toHaveBeenCalled();
});

test('opening another item or release resets the form and its second entries', async () => {
  await show(<ItemForm pack={source} item={source.items[0]} onSave={() => undefined} onCancel={() => undefined} />);
  await type('item-retyped-budget', '2');
  await act(() =>
    rendered().update(
      <ItemForm
        pack={{ ...source, release: '2026.2' }}
        item={source.items[0]}
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    ),
  );
  expect(field('item-retyped-budget').props.value).toBe('');
});

test.each(['ar', 'fr', 'en'] as const)(
  'all form words resolve in %s, including source-direction text',
  async (language) => {
    missingKeys.length = 0;
    await show(<ItemForm pack={source} item={null} onSave={() => undefined} onCancel={() => undefined} />, language);
    await press('item-save');
    expect(field('item-title').props.textDirection).toBe('rtl');
    expect(missingKeys).toEqual([]);
  },
);
