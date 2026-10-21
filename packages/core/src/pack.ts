// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A plan pack holds one official plan as data (PRD §4.2). Packs travel as
// files, from the data repository or from a colleague's phone, so every pack
// is read as untrusted: it is checked against the format, and fields outside
// the format are dropped (PRD §5.9).

import { hasBidiControl, isFields, LANGUAGE, Reader, RELEASE, type ParseResult } from './read.ts';
import type { Queue } from './reference.ts';

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

export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * The statuses a pack shows (PRD §4.2). `example` marks made-up packs used in
 * tests and in the demo class: they are never published as reference data.
 */
export const PACK_STATUSES = ['official', 'in-force', 'latest-found', 'stale', 'community', 'example'] as const;

export type PackStatus = (typeof PACK_STATUSES)[number];

/** How much of the plan's text a pack may hold, until counsel clears the text (PRD §1.3). */
export const LICENCE_MODES = ['link-only', 'structure-only', 'full-text'] as const;

export type LicenceMode = (typeof LICENCE_MODES)[number];

export type BudgetUnit = 'hours' | 'sessions';

/** How a pack ties its items to time. It varies by subject, not only by level (PRD §4.2). */
export type TimeAnchor =
  | { readonly kind: 'weeks' }
  | { readonly kind: 'budgets'; readonly unit: BudgetUnit }
  | { readonly kind: 'hybrid'; readonly unit: BudgetUnit };

export interface PackItem {
  readonly id: string;
  readonly kind: ItemKind;
  /** The plan's own wording. */
  readonly title: string;
  /** The unit or sequence the item belongs to. */
  readonly unit?: string;
  readonly term?: number;
  /** With a weeks anchor, the plan week. With a hybrid anchor, the week target. */
  readonly week?: number;
  /** In the anchor's unit. With a weeks anchor, in sessions, and 1 if not set. */
  readonly budget?: number;
  /** For primary activity slots, such as reading (PRD §4.6). */
  readonly activity?: string;
  readonly optional?: boolean;
  /** A buffer the plan builds in, such as the diagnostic week (PRD §4.2). */
  readonly buffer?: boolean;
  /** The ID of the item's stage template. */
  readonly stages?: string;
  /** Textbook pages. */
  readonly pages?: string;
  /** The page of the source document the item comes from. */
  readonly sourcePage?: number;
}

export interface StageTemplate {
  readonly id: string;
  /** The stages, as the official material prints them. */
  readonly stages: readonly string[];
}

export interface Provenance {
  /** The issuer as printed. */
  readonly issuer: string;
  readonly edition: string;
  /** Where the source file was found. */
  readonly foundAt?: string;
}

export interface PlanPack {
  readonly format: 1;
  /** Such as `dz.cem.3am.math.igen-2022` (PRD §4.2). */
  readonly id: string;
  /** Such as `2026.1`. */
  readonly release: string;
  readonly status: PackStatus;
  readonly licence: LicenceMode;
  /** The subject's language, which the documents use. */
  readonly language: string;
  readonly anchor: TimeAnchor;
  readonly provenance: Provenance;
  readonly stageTemplates: readonly StageTemplate[];
  readonly items: readonly PackItem[];
  /** Merges the plan proposes, each a list of item IDs. Only ever proposals to the teacher. */
  readonly merges: readonly (readonly string[])[];
  /** Never in a file: the items a class's changes made and it took back, kept for their titles (#225). */
  readonly retired?: readonly PackItem[];
  /** Never in a file: the skips and joins of the layers the class has on (#226). */
  readonly fromLayers?: { readonly skips: readonly string[]; readonly joins: readonly (readonly [string, string])[] };
}

export const PACK_ID = /^[a-z]{2}(\.[a-z0-9-]+){4,5}$/;
const ITEM_ID = /^[A-Za-z0-9._-]{1,64}$/;

function readAnchor(reader: Reader, value: unknown): TimeAnchor | undefined {
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

function readItem(reader: Reader, value: unknown, path: string): PackItem | undefined {
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

/** Reads a plan pack from parsed JSON, keeping only the format's fields. */
export function parsePlanPack(input: unknown): ParseResult<PlanPack> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');

  const id = reader.requiredText(input, 'id', '', PACK_ID);
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const status = reader.oneOf(input, 'status', '', PACK_STATUSES);
  const licence = reader.oneOf(input, 'licence', '', LICENCE_MODES);
  const language = reader.requiredText(input, 'language', '', LANGUAGE);
  const anchor = readAnchor(reader, input['anchor']);

  let provenance: Provenance = { issuer: '', edition: '' };
  const rawProvenance = input['provenance'];
  if (isFields(rawProvenance)) {
    const foundAt = reader.text(rawProvenance, 'foundAt', 'provenance');
    provenance = {
      issuer: reader.requiredText(rawProvenance, 'issuer', 'provenance'),
      edition: reader.requiredText(rawProvenance, 'edition', 'provenance'),
      ...(foundAt !== undefined && { foundAt }),
    };
  } else {
    reader.fail('provenance', rawProvenance === undefined ? 'required' : 'invalid');
  }

  const stageTemplates: StageTemplate[] = [];
  const rawTemplates = input['stageTemplates'] ?? [];
  if (Array.isArray(rawTemplates)) {
    rawTemplates.forEach((raw: unknown, index) => {
      const path = `stageTemplates[${index}]`;
      if (!isFields(raw)) return reader.fail(path, 'invalid');
      const templateId = reader.requiredText(raw, 'id', path, ITEM_ID);
      const stages = raw['stages'];
      if (
        !Array.isArray(stages) ||
        stages.length === 0 ||
        !stages.every((s) => typeof s === 'string' && s.trim() !== '' && !hasBidiControl(s))
      ) {
        return reader.fail(`${path}.stages`, 'invalid');
      }
      if (stageTemplates.some((t) => t.id === templateId)) return reader.fail(`${path}.id`, 'duplicate');
      stageTemplates.push({ id: templateId, stages: stages as string[] });
    });
  } else {
    reader.fail('stageTemplates', 'invalid');
  }

  const items: PackItem[] = [];
  const rawItems = input['items'];
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    rawItems.forEach((raw: unknown, index) => {
      const path = `items[${index}]`;
      const item = readItem(reader, raw, path);
      if (item === undefined) return;
      if (items.some((other) => other.id === item.id)) return reader.fail(`${path}.id`, 'duplicate');
      if (item.unit !== undefined && !items.some((other) => other.id === item.unit && other.kind === 'unit')) {
        reader.fail(`${path}.unit`, 'unknown-reference');
      }
      if (item.stages !== undefined && !stageTemplates.some((t) => t.id === item.stages)) {
        reader.fail(`${path}.stages`, 'unknown-reference');
      }
      if (anchor !== undefined && item.kind !== 'unit') {
        if (anchor.kind === 'weeks' && item.week === undefined) reader.fail(`${path}.week`, 'required');
        if (anchor.kind !== 'weeks' && item.budget === undefined) reader.fail(`${path}.budget`, 'required');
      }
      items.push(item);
    });
  } else {
    reader.fail('items', rawItems === undefined ? 'required' : 'invalid');
  }

  const merges: string[][] = [];
  const rawMerges = input['merges'] ?? [];
  if (Array.isArray(rawMerges)) {
    rawMerges.forEach((raw: unknown, index) => {
      const path = `merges[${index}]`;
      const known = (id: unknown): boolean => items.some((item) => item.id === id && item.kind !== 'unit');
      if (!Array.isArray(raw) || raw.length < 2 || new Set(raw).size !== raw.length)
        return reader.fail(path, 'invalid');
      if (!raw.every(known)) return reader.fail(path, 'unknown-reference');
      merges.push(raw as string[]);
    });
  } else {
    reader.fail('merges', 'invalid');
  }

  if (reader.problems.length > 0 || status === undefined || licence === undefined || anchor === undefined) {
    return { ok: false, problems: reader.problems };
  }
  return {
    ok: true,
    value: { format: 1, id, release, status, licence, language, anchor, provenance, stageTemplates, items, merges },
  };
}

/** The item's stages, or none when it has no template and runs as "in progress / done". */
export function stageNames(pack: PlanPack, item: PackItem): readonly string[] {
  if (item.stages === undefined) return [];
  return pack.stageTemplates.find((template) => template.id === item.stages)?.stages ?? [];
}

/** How many steps complete the item: its stages, or 1 for an item without a template. */
export function stageCount(pack: PlanPack, item: PackItem): number {
  return Math.max(1, stageNames(pack, item).length);
}

/**
 * The item's budget in sessions. Time is counted in sessions, not hours
 * (PRD §4.7). Hour budgets are turned into sessions with the class's session
 * length, and no item takes less than one session.
 */
export function budgetInSessions(pack: PlanPack, item: PackItem, sessionMinutes: number): number {
  const budget = item.budget ?? 1;
  if (pack.anchor.kind !== 'weeks' && pack.anchor.unit === 'hours') {
    return Math.max(1, Math.round((budget * 60) / sessionMinutes));
  }
  return Math.max(1, Math.round(budget));
}

/** The items a queue proposes, in the plan's order (PRD §4.7). */
export function queueItems(pack: PlanPack, queue: Queue): readonly PackItem[] {
  switch (queue) {
    case 'main':
      return pack.items.filter((item) => item.kind !== 'unit' && item.kind !== 'td');
    case 'td':
      return pack.items.filter((item) => item.kind === 'td');
    case 'none':
      return [];
  }
}
