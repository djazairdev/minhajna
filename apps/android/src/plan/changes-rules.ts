// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class's own changes as its changes screen lists them (#225,
// Plan-changes, R-4.7-35): newest first, each with its kind, its day, what
// it does in the plan's words, and what it takes from the buffers or gives
// back to them, counted by the core after the changes before it. Changes
// taken back stay in the list, marked so and counting nothing. An item a
// later release no longer has is named by its ID and said to be gone.

import {
  addedId,
  changeEffects,
  type Context,
  courseDecisions,
  courseSetup,
  findPackItem,
  isChange,
  type PlanChange,
  type PlanPack,
  recordedId,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;
export type Made = Exclude<PlanChange, { readonly kind: 'undo' }>;

export type ChangeLine = {
  readonly change: Made;
  /** Taken back: it stays listed, and counts nothing. */
  readonly undone: boolean;
  readonly kind: string;
  readonly text: string;
  /** Sessions taken from the buffers, or given back when negative. */
  readonly sessions: number;
};

/**
 * What a change does, in the plan's words, as its kind and a line: an item
 * is named as `base` has it, the release without the class's changes and
 * layers, or as the layered plan has or had it.
 */
export function changeText(
  t: Translate,
  context: Context,
  pack: PlanPack,
  base: PlanPack | undefined,
): (change: Made) => { readonly kind: string; readonly text: string } {
  const original = (id: string) => base?.items.find((item) => item.id === id) ?? findPackItem(pack, id);
  const name = (id: string) => {
    const title = original(id)?.title;
    const item = t('tests.quoted', { title: isolate(title ?? id) });
    return title === undefined ? t('planChanges.goneItem', { item }) : item;
  };
  const count = (sessions: number) => t('planDetails.sessions', { count: sessions });
  const className = (classId: string) => isolate(context.state.classes.get(classId)?.name ?? classId);
  return (change) => {
    switch (change.kind) {
      case 'move': {
        const at = { item: name(change.item), before: change.before === null ? '' : name(change.before) };
        if (change.align !== undefined)
          return { kind: 'align', text: t('planChanges.align', { ...at, class: className(change.align) }) };
        return { kind: 'move', text: t(change.before === null ? 'planChanges.moveEnd' : 'planChanges.move', at) };
      }
      case 'budget':
        return {
          kind: 'budget',
          text: t('planChanges.budget', { item: name(change.item), sessions: count(change.sessions) }),
        };
      case 'split': {
        const [first, second] = change.titles.map((title) => t('tests.quoted', { title: isolate(title) }));
        return { kind: 'split', text: t('planChanges.split', { item: name(change.item), first, second }) };
      }
      case 'add': {
        const at = {
          item: t('tests.quoted', { title: isolate(findPackItem(pack, addedId(change.id))?.title ?? change.title) }),
          sessions: count(change.sessions),
          before: change.before === null ? '' : name(change.before),
        };
        return { kind: 'add', text: t(change.before === null ? 'planChanges.addEnd' : 'planChanges.add', at) };
      }
      case 'skip':
        return { kind: 'skip', text: t('planChanges.skip', { item: name(change.item) }) };
      case 'join':
        return {
          kind: 'join',
          text: t('planChanges.join', { first: name(change.items[0]), second: name(change.items[1]) }),
        };
    }
  };
}

/** The class's changes, newest first, as lines. `base` is the release itself, without the class's changes. */
export function changeLines(
  t: Translate,
  context: Context,
  courseId: string,
  base: PlanPack | undefined,
): ChangeLine[] {
  const { pack } = courseSetup(context, courseId);
  if (pack === null) return [];
  const effects = changeEffects(context, courseId);
  const line = changeText(t, context, pack, base);
  const made = [...courseDecisions(context, courseId).values()]
    .filter((one): one is PlanChange => isChange(one) && one.courseId === courseId && one.id === recordedId(one.id))
    .sort((a, b) => b.seq - a.seq || b.id.localeCompare(a.id));
  const undone = new Set(made.flatMap((one) => (one.kind === 'undo' ? [one.change] : [])));
  return made
    .filter((one): one is Made => one.kind !== 'undo')
    .map((change): ChangeLine => {
      const gone = undone.has(change.id);
      return { ...line(change), change, undone: gone, sessions: gone ? 0 : (effects.get(change.id) ?? 0) };
    });
}
