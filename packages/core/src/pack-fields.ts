// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a plan pack's fields (PRD §4.2): its time anchor, its items, and
// a week pack's weekly model (#230, Week-slot-primary, R-4.6-06, R-4.7-04,
// answer 374): the activity types its weeks hold, in the order of the week,
// each with its code, its name in the app's languages and its sessions a
// week. An item names its activity by code, and a pack with a model refuses
// a code outside it; a pack without one keeps activities as free codes.

import type { PackItem, TimeAnchor } from './pack.ts';
import { isFields, Reader } from './read.ts';
import type { LocalizedText } from './reference.ts';
import { CODE, readName } from './reference-fields.ts';

/** The closed list of item kinds (PRD §4.2). */
export const ITEM_KINDS = [
  'diagnostic',
  /** A sequence or unit: it groups the items that follow and is never taught itself. */
  'unit',
  /** A lesson or learning resource. */
  'lesson',
  'launch-situation',
  'integration',
  'launch-situation-solution',
  'assessment-remediation',
  'project',
  'term-assessment',
  'td',
] as const;

/** An item's ID, as a pack or a class's own list writes it. */
export const ITEM_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** The pack's time anchor. */
export function readAnchor(reader: Reader, value: unknown): TimeAnchor | undefined {
  if (!isFields(value)) {
    reader.fail('anchor', value === undefined ? 'required' : 'invalid');
    return undefined;
  }
  const kind = reader.oneOf(value, 'kind', 'anchor', ['weeks', 'budgets', 'hybrid'] as const);
  if (kind === undefined) return undefined;
  if (kind === 'weeks') return { kind };
  const unit = reader.oneOf(value, 'unit', 'anchor', ['hours', 'sessions'] as const);
  return unit === undefined ? undefined : { kind, unit };
}

/** One item, or undefined when it cannot be read. */
export function readItem(reader: Reader, value: unknown, path: string): PackItem | undefined {
  if (!isFields(value)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const id = reader.requiredText(value, 'id', path, ITEM_ID);
  const kind = reader.oneOf(value, 'kind', path, ITEM_KINDS);
  const title = reader.requiredText(value, 'title', path);
  if (kind === undefined) return undefined;
  const unit = reader.text(value, 'unit', path, ITEM_ID);
  const term = reader.number(value, 'term', path, true);
  const week = reader.number(value, 'week', path, true);
  const budget = reader.number(value, 'budget', path, false);
  const activity = reader.text(value, 'activity', path);
  const optional = reader.flag(value, 'optional', path);
  const buffer = reader.flag(value, 'buffer', path);
  const stages = reader.text(value, 'stages', path, ITEM_ID);
  const pages = reader.text(value, 'pages', path);
  const sourcePage = reader.number(value, 'sourcePage', path, true);
  return {
    id,
    kind,
    title,
    ...(unit !== undefined && { unit }),
    ...(term !== undefined && { term }),
    ...(week !== undefined && { week }),
    ...(budget !== undefined && { budget }),
    ...(activity !== undefined && { activity }),
    ...(optional !== undefined && { optional }),
    ...(buffer !== undefined && { buffer }),
    ...(stages !== undefined && { stages }),
    ...(pages !== undefined && { pages }),
    ...(sourcePage !== undefined && { sourcePage }),
  };
}

/** One activity type of a week pack's weekly model, such as reading, three sessions a week. */
export interface PackActivity {
  readonly code: string;
  readonly name: LocalizedText;
  readonly sessions: number;
}

/** The weekly model of a week pack, if it has one; an item naming an activity outside it is refused. */
export function readActivities(
  reader: Reader,
  value: unknown,
  anchor: TimeAnchor | undefined,
  items: readonly PackItem[],
): PackActivity[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || (anchor !== undefined && anchor.kind !== 'weeks')) {
    reader.fail('activities', 'invalid');
    return undefined;
  }
  const model: PackActivity[] = [];
  value.forEach((raw: unknown, index) => {
    const path = `activities[${index}]`;
    if (!isFields(raw)) return reader.fail(path, 'invalid');
    const code = reader.requiredText(raw, 'code', path, CODE);
    const name = readName(reader, raw, path);
    const sessions = reader.requiredNumber(raw, 'sessions', path, true);
    if (model.some((other) => other.code === code)) return reader.fail(`${path}.code`, 'duplicate');
    if (code !== '' && name !== undefined && sessions !== undefined) model.push({ code, name, sessions });
  });
  items.forEach((item, index) => {
    if (item.activity !== undefined && !model.some((one) => one.code === item.activity)) {
      reader.fail(`items[${index}].activity`, 'unknown-reference');
    }
  });
  return model;
}
