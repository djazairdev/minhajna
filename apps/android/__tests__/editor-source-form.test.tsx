// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A copied release starts clean: no migration from the release it copies, and
// no way to change the timing of items it already holds. A plan with no items
// chooses its timing here. Every source is made up.

import type { PlanPack } from '@minhajna/core';
import { press, show, shown, source, type, unmount } from '../jest/editor-form';
import { SourceForm } from '../src/editor/SourceForm';

afterEach(unmount);

const copied: PlanPack = {
  ...source,
  migration: { from: '2025.1', entries: [{ kind: 'remove', item: 'gone' }] },
};

test('a copied release loses its migration, keeps its items and takes the new release', async () => {
  const keep = jest.fn((pack: PlanPack) => pack);
  await show(<SourceForm pack={null} initial={copied} country="dz" onKeep={keep} onCancel={() => undefined} />);
  await type('source-release', '2026.2');
  await press('source-keep');
  const next = keep.mock.calls[0][0];
  expect(next.release).toBe('2026.2');
  expect(next.items).toEqual(source.items);
  expect(next.anchor).toEqual(source.anchor);
  expect('migration' in next).toBe(false);
  expect(copied.migration?.from).toBe('2025.1');
});

test('only a plan with no items chooses its anchor here', async () => {
  const props = { country: 'dz', onKeep: () => undefined, onCancel: () => undefined };
  await show(<SourceForm pack={null} initial={copied} {...props} />);
  expect(shown('source-anchor')).toBe(false);
  await unmount();
  await show(<SourceForm pack={null} initial={{ ...source, items: [] }} {...props} />);
  expect(shown('source-anchor')).toBe(true);
  await unmount();
  await show(<SourceForm pack={null} {...props} />);
  expect(shown('source-anchor')).toBe(true);
  await unmount();
  await show(<SourceForm pack={source} {...props} />);
  expect(shown('source-anchor')).toBe(false);
});
