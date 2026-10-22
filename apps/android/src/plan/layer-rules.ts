// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The district and school layers as Plan-layers shows them (#226, answers
// 337 to 343): at each level, every layer taken in for the class's pack,
// the one the class has on first, each operation in the plan's words, as
// the class's own changes read, and the terms its operations touch. A
// district layer names who signed it; a school layer says its sender is
// not verified.

import {
  courseDecisions,
  courseLayers,
  courseSetup,
  findPackItem,
  LAYER_LEVELS,
  layered,
  layerChanges,
  layerKey,
  type Context,
  type LayerLevel,
  type PlanLayer,
  type PlanPack,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { changeText, type Made } from './changes-rules';

type Translate = ReturnType<typeof useText>;

export type LayerModel = {
  readonly layer: PlanLayer;
  readonly key: string;
  readonly on: boolean;
  readonly operations: readonly { readonly kind: string; readonly text: string }[];
  /** Which terms the operations touch, as a line, or null when no item they name has a term. */
  readonly terms: string | null;
  /** The key a district layer is signed with. */
  readonly signedBy?: string;
};

/**
 * One layer as a class reads it: on or not, signed with a key or not. Its
 * items are named from the class's plan with it switched on, so one it adds
 * or splits reads by its title even before it is taken in; another layer
 * under its ID, which the import refuses, is named from the plan as it is.
 * A layer not taken in gets its own copy of the decisions, so the plan
 * worked out for one file is never reused for another under the same ID.
 */
export function layerModel(
  t: Translate,
  context: Context,
  courseId: string,
  base: PlanPack | undefined,
  layer: PlanLayer,
  options: { readonly on: boolean; readonly signedBy?: string },
): LayerModel {
  const { pack, sessionMinutes } = courseSetup(context, courseId);
  const { on, known } = courseLayers(context.state, courseId);
  const own = courseDecisions(context.state, courseId);
  const decisions = known.includes(layer) ? own : new Map(own);
  const clash = known.some((one) => one !== layer && layerKey(one) === layerKey(layer));
  const withIt = {
    on: [...on.filter((one) => one.level !== layer.level), layer].sort(
      (a, b) => LAYER_LEVELS.indexOf(a.level) - LAYER_LEVELS.indexOf(b.level),
    ),
    known: known.includes(layer) ? known : [...known, layer],
  };
  const plan =
    base === undefined || clash ? (pack ?? base) : layered(base, decisions, courseId, sessionMinutes, withIt);
  const changes = layerChanges(layer, courseId).filter((one): one is Made => one.kind !== 'undo');
  const termOf = (id: string) => (base?.items.find((item) => item.id === id) ?? findPackItem(plan, id))?.term;
  const named = changes.flatMap((one) =>
    one.kind === 'join' ? [...one.items] : one.kind === 'add' ? (one.before === null ? [] : [one.before]) : [one.item],
  );
  const terms = [...new Set(named.map(termOf).filter((term) => term !== undefined))].sort((a, b) => a - b);
  return {
    layer,
    key: layerKey(layer),
    on: options.on,
    operations: plan === undefined ? [] : changes.map(changeText(t, context, plan, base)),
    terms: termsLine(t, terms),
    ...(options.signedBy !== undefined && { signedBy: options.signedBy }),
  };
}

/** A course's layers at each level, the one it has on first. */
export function layerModels(
  t: Translate,
  context: Context,
  courseId: string,
  base: PlanPack | undefined,
): Record<LayerLevel, LayerModel[]> {
  const models: Record<LayerLevel, LayerModel[]> = { district: [], school: [] };
  const { on, known } = courseLayers(context.state, courseId);
  for (const { layer, signed } of context.state.layers) {
    if (!known.includes(layer)) continue;
    const options = { on: on.includes(layer), ...(signed !== undefined && { signedBy: signed.key }) };
    models[layer.level].push(layerModel(t, context, courseId, base, layer, options));
  }
  for (const level of ['district', 'school'] as const) models[level].sort((a, b) => Number(b.on) - Number(a.on));
  return models;
}

function termsLine(t: Translate, terms: readonly number[]): string | null {
  const name = (term: number) => t(`classPlan.term${term as 1 | 2 | 3}`);
  if (terms.length === 0 || terms.some((term) => term < 1 || term > 3)) return null;
  if (terms.length === 1) return t('planLayers.termOne', { term: name(terms[0]) });
  if (terms.length === 2) return t('planLayers.termTwo', { first: name(terms[0]), second: name(terms[1]) });
  return t('planLayers.termAll');
}

/** The layers a class has on, as a line under the plan's link to them. */
export function layersLine(t: Translate, context: Context, courseId: string): string {
  const { on } = courseLayers(context.state, courseId);
  if (on.length === 0) return t('planLayers.noneOn');
  const names = on.map((layer) => t(`planLayers.level.${layer.level}`));
  return names.length === 1
    ? t('planLayers.onOne', { layer: names[0] })
    : t('planLayers.onTwo', { first: names[0], second: names[1] });
}
