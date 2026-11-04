// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The same editor also changes anchors, lesson-stage templates and a
// week pack's activity model (#613). Every activity count is re-entered;
// no opening or anchor change silently confirms or removes that model.
// Source-language names outside the interface's three languages survive.
// Items' budgets keep their numbers under a new unit, so changing the unit
// while items hold budgets needs the curator's word that they were rechecked.

import { editPackStructure } from './pack-edit.ts';
import { sourceNumber } from './pack-item-form.ts';
import type { PlanPack } from './pack.ts';
import { isFields, type ParseProblem, type ParseResult } from './read.ts';
import type { LocalizedText } from './reference.ts';

export interface PackStructureForm {
  readonly kind: PlanPack['anchor']['kind'];
  readonly unit: 'hours' | 'sessions';
  readonly budgetsRechecked: boolean;
  readonly templates: readonly { readonly id: string; readonly stages: string }[];
  readonly activities: readonly {
    readonly code: string;
    readonly name: LocalizedText;
    readonly sessions: string;
    readonly retyped: string;
  }[];
}

/** Whether a form gives the pack's budgets a new unit while its items hold any. */
export function budgetUnitChanged(pack: PlanPack, form: Pick<PackStructureForm, 'kind' | 'unit'>): boolean {
  if (form.kind === 'weeks' || !pack.items.some((item) => item.budget !== undefined)) return false;
  return pack.anchor.kind === 'weeks' || pack.anchor.unit !== form.unit;
}

/** Starts with source values and blank second entries, with no reference object shared. */
export function packStructureForm(pack: PlanPack): PackStructureForm {
  return {
    kind: pack.anchor.kind,
    unit: pack.anchor.kind === 'weeks' ? 'sessions' : pack.anchor.unit,
    budgetsRechecked: false,
    templates: pack.stageTemplates.map((one) => ({ id: one.id, stages: one.stages.join('\n') })),
    activities: (pack.activities ?? []).map((one) => ({
      code: one.code,
      name: { ...one.name },
      sessions: String(one.sessions),
      retyped: '',
    })),
  };
}

/** Reads a structure form and validates all item references through the pack reader. */
export function readPackStructureForm(pack: PlanPack, raw: unknown): ParseResult<PlanPack> {
  const invalid = (path: string): ParseResult<PlanPack> => ({ ok: false, problems: [{ path, problem: 'invalid' }] });
  if (
    !isFields(raw) ||
    !['weeks', 'budgets', 'hybrid'].includes(raw.kind as string) ||
    !['hours', 'sessions'].includes(raw.unit as string)
  )
    return invalid('anchor');
  if (!Array.isArray(raw.templates)) return invalid('stageTemplates');
  if (!Array.isArray(raw.activities)) return invalid('activities');
  const stageTemplates = [];
  for (const one of raw.templates) {
    if (!isFields(one) || typeof one.id !== 'string' || typeof one.stages !== 'string')
      return invalid('stageTemplates');
    stageTemplates.push({
      id: one.id.trim(),
      stages: one.stages
        .split(/\r?\n/u)
        .map((word) => word.trim())
        .filter((word) => word !== ''),
    });
  }
  const problems: ParseProblem[] = [];
  const activities = [];
  for (const [at, one] of raw.activities.entries()) {
    if (!isFields(one) || typeof one.code !== 'string' || !isFields(one.name)) return invalid('activities');
    const sessions = typeof one.sessions === 'string' ? sourceNumber(one.sessions, true) : null;
    const repeated = typeof one.retyped === 'string' ? sourceNumber(one.retyped, true) : null;
    if (sessions === null) problems.push({ path: `activities[${at}].sessions`, problem: 'invalid' });
    if (repeated === null || repeated !== sessions)
      problems.push({ path: `activities[${at}].retyped`, problem: 'invalid' });
    activities.push({ code: one.code.trim(), name: one.name as LocalizedText, sessions: sessions ?? 0 });
  }
  const form = { kind: raw.kind as PackStructureForm['kind'], unit: raw.unit as PackStructureForm['unit'] };
  if (budgetUnitChanged(pack, form) && raw.budgetsRechecked !== true)
    problems.push({ path: 'budgetsRechecked', problem: 'required' });
  if (problems.length > 0) return { ok: false, problems };
  return editPackStructure(pack, {
    anchor:
      raw.kind === 'weeks'
        ? { kind: 'weeks' }
        : { kind: raw.kind as 'budgets' | 'hybrid', unit: raw.unit as 'hours' | 'sessions' },
    stageTemplates,
    activities: activities.length === 0 ? null : activities,
  });
}
