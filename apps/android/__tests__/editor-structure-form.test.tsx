// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The provisional structure form cannot save unchecked activity counts,
// remove a used template, or drop the weekly model on an anchor change.

import { StructureForm } from '../src/editor/StructureForm';
import { missingKeys } from '../src/text/i18n';
import { field, press, show, shown, source, type, unmount, weekly } from '../jest/editor-form';

afterEach(unmount);

test('weekly source counts need re-entry and other language names survive', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<StructureForm pack={weekly} onSave={save} onCancel={() => undefined} />);
  expect(field('structure-activity-retyped-0').props.value).toBe('');
  await press('structure-save');
  expect(save).not.toHaveBeenCalled();
  await type('structure-activity-retyped-0', '٢');
  await type('structure-activity-ar-0', 'اسم نشاط مختلق بعد التصحيح');
  await press('structure-save');
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].activities?.[0]?.name.kab).toBe('Synthetic name');
  expect(weekly.activities![0].name.ar).toBe('قراءة مختلقة');
});

test('changing the weekly count clears its second entry', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<StructureForm pack={weekly} onSave={save} onCancel={() => undefined} />);
  await type('structure-activity-retyped-0', '2');
  await type('structure-activity-count-0', '3');
  expect(field('structure-activity-retyped-0').props.value).toBe('');
  await press('structure-save');
  expect(save).not.toHaveBeenCalled();
  await type('structure-activity-retyped-0', '3');
  await press('structure-save');
  expect(save.mock.calls[0][0].activities?.[0]?.sessions).toBe(3);
});

test('changing an anchor keeps the weekly model while an item uses it', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<StructureForm pack={weekly} onSave={save} onCancel={() => undefined} />);
  await press('structure-anchor-budgets');
  expect(shown('structure-activity-count-0')).toBe(true);
  await type('structure-activity-retyped-0', '2');
  await press('structure-save');
  expect(save).not.toHaveBeenCalled();
  await press('structure-activity-remove-0');
  await press('structure-save');
  expect(save).not.toHaveBeenCalled();
  expect(shown('structure-problems')).toBe(true);
});

test('a used template cannot be silently removed', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  await show(<StructureForm pack={source} onSave={save} onCancel={() => undefined} />);
  await press('structure-template-remove-0');
  await press('structure-save');
  expect(save).not.toHaveBeenCalled();
  expect(shown('structure-problems')).toBe(true);
});

test('new templates have one stage per line and cancellation writes nothing', async () => {
  const save = jest.fn((pack: import('@minhajna/core').PlanPack) => pack);
  const cancel = jest.fn();
  await show(<StructureForm pack={source} onSave={save} onCancel={cancel} />);
  await press('structure-template-add');
  await type('structure-template-id-1', 'other');
  await type('structure-template-stages-1', 'Synthetic start\nSynthetic practice');
  await press('structure-save');
  expect(save.mock.calls[0][0].stageTemplates[1].stages).toEqual(['Synthetic start', 'Synthetic practice']);
  await press('structure-cancel');
  expect(cancel).toHaveBeenCalledTimes(1);
});

test.each(['ar', 'fr', 'en'] as const)('structure fields resolve in %s', async (language) => {
  missingKeys.length = 0;
  await show(<StructureForm pack={weekly} onSave={() => undefined} onCancel={() => undefined} />, language);
  await press('structure-save');
  expect(missingKeys).toEqual([]);
});
