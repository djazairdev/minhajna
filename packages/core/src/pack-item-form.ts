// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curator's item form (#613, PRD section 4.3). Numeric source fields
// are entered twice, independently; opening an existing item never fills
// the second entry. Both writings must be positive numbers and agree.
// Arabic and Latin digits, and decimal commas, are accepted. Text stays
// the source's wording. Existing IDs stay fixed; migration is separate.
// The pack reader remains the authority for item kinds and references. An
// unset flag is left out, so an edit adds nothing a comparison would show.

import { readItem } from './pack-fields.ts';
import type { PackItem, PlanPack } from './pack.ts';
import { isFields, Reader, type ParseProblem, type ParseResult } from './read.ts';

export const ITEM_NUMBERS = ['term', 'week', 'budget', 'sourcePage'] as const;
export type ItemNumber = (typeof ITEM_NUMBERS)[number];
export type ItemNumbers = Readonly<Record<ItemNumber, string>>;
export interface PackItemForm extends ItemNumbers {
  readonly id: string;
  readonly kind: PackItem['kind'];
  readonly title: string;
  readonly unit: string;
  readonly activity: string;
  readonly stages: string;
  readonly pages: string;
  readonly optional: boolean;
  readonly buffer: boolean;
  readonly retyped: ItemNumbers;
}

function numberWriting(text: string, integer: boolean): string | null {
  const latin = text
    .trim()
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, (one) =>
      String(one.charCodeAt(0) - (one.charCodeAt(0) <= 0x0669 ? 0x0660 : 0x06f0)),
    );
  if (!(integer ? /^\d+$/u : /^\d+(?:[.,\u066b]\d+)?$/u).test(latin)) return null;
  const [whole = '', decimal = ''] = latin.replace(/[,\u066b]/gu, '.').split('.');
  const fraction = decimal.replace(/0+$/u, '');
  return whole.replace(/^0+(?=\d)/u, '') + (fraction === '' ? '' : `.${fraction}`);
}

/** A positive source number; unsafe integer magnitudes and non-finite values are refused. */
export function sourceNumber(text: string, integer: boolean): number | null {
  const written = numberWriting(text, integer);
  if (written === null) return null;
  const value = Number(written);
  return Number.isFinite(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER &&
    (!integer || Number.isSafeInteger(value))
    ? value
    : null;
}

/** Fills only the first entry from a source item; a new item starts blank. */
export function packItemForm(item: PackItem | null): PackItemForm {
  const number = (key: ItemNumber) => (item?.[key] === undefined ? '' : String(item[key]));
  return {
    id: item?.id ?? '',
    kind: item?.kind ?? 'lesson',
    title: item?.title ?? '',
    unit: item?.unit ?? '',
    activity: item?.activity ?? '',
    stages: item?.stages ?? '',
    pages: item?.pages ?? '',
    optional: item?.optional ?? false,
    buffer: item?.buffer ?? false,
    term: number('term'),
    week: number('week'),
    budget: number('budget'),
    sourcePage: number('sourcePage'),
    retyped: { term: '', week: '', budget: '', sourcePage: '' },
  };
}

function numbersOf(raw: Record<string, unknown>, reader: Reader): Partial<Record<ItemNumber, number>> {
  const found: Partial<Record<ItemNumber, number>> = {};
  const retyped = isFields(raw.retyped) ? raw.retyped : {};
  for (const key of ITEM_NUMBERS) {
    const first = raw[key];
    const second = retyped[key];
    if (typeof first !== 'string') {
      reader.fail(key, 'invalid');
      continue;
    }
    if (first.trim() === '') {
      if (key === 'sourcePage') reader.fail(key, 'required');
      if (typeof second !== 'string' || second.trim() !== '') reader.fail(`retyped.${key}`, 'invalid');
      continue;
    }
    const integer = key !== 'budget';
    const value = sourceNumber(first, integer);
    if (value === null) reader.fail(key, 'invalid');
    else found[key] = value;
    if (typeof second !== 'string' || second.trim() === '') reader.fail(`retyped.${key}`, 'required');
    else if (
      value === null ||
      sourceNumber(second, integer) === null ||
      numberWriting(first, integer) !== numberWriting(second, integer)
    )
      reader.fail(`retyped.${key}`, 'invalid');
  }
  return found;
}

/** Reads one form against its pack, with field paths a screen can label. */
export function readPackItemForm(pack: PlanPack, value: unknown, keptId: string | null = null): ParseResult<PackItem> {
  if (!isFields(value)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  const reader = new Reader();
  const numbers = numbersOf(value, reader);
  const flag = (key: string) => (value[key] === false ? {} : { [key]: value[key] });
  const optionalText = (key: string) =>
    value[key] === '' ? {} : { [key]: typeof value[key] === 'string' ? value[key].trim() : value[key] };
  const item = readItem(
    reader,
    {
      id: typeof value.id === 'string' ? value.id.trim() : value.id,
      kind: value.kind,
      title: typeof value.title === 'string' ? value.title.trim() : value.title,
      ...flag('optional'),
      ...flag('buffer'),
      ...numbers,
      ...optionalText('unit'),
      ...optionalText('activity'),
      ...optionalText('stages'),
      ...optionalText('pages'),
    },
    '',
  );
  if (item !== undefined) {
    if (keptId !== null && item.id !== keptId) reader.fail('id', 'invalid');
    const was = pack.items.find((one) => one.id === keptId);
    if (keptId !== null && was === undefined) reader.fail('id', 'invalid');
    const group = (kind: PackItem['kind']) => (kind === 'unit' || kind === 'td' ? kind : 'main');
    if (was !== undefined && group(was.kind) !== group(item.kind)) reader.fail('kind', 'invalid');
    if (pack.items.some((one) => one.id === item.id && one.id !== keptId)) reader.fail('id', 'duplicate');
    if (item.unit !== undefined && !pack.items.some((one) => one.id === item.unit && one.kind === 'unit'))
      reader.fail('unit', 'unknown-reference');
    if (item.stages !== undefined && !pack.stageTemplates.some((one) => one.id === item.stages))
      reader.fail('stages', 'unknown-reference');
    if (
      pack.activities !== undefined &&
      item.activity !== undefined &&
      !pack.activities.some((one) => one.code === item.activity)
    )
      reader.fail('activity', 'unknown-reference');
    if (item.kind !== 'unit') {
      if (pack.anchor.kind === 'weeks' && item.week === undefined) reader.fail('week', 'required');
      if (pack.anchor.kind !== 'weeks' && item.budget === undefined) reader.fail('budget', 'required');
    }
  }
  const problems: ParseProblem[] = reader.problems.filter(
    (one, at, all) => all.findIndex((other) => other.path === one.path && other.problem === one.problem) === at,
  );
  return item === undefined || problems.length > 0 ? { ok: false, problems } : { ok: true, value: item };
}
