// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class's own changes as its changes screen lists them (#225,
// Plan-changes, R-4.7-35): those in force, newest first, each with its
// kind, its day, what it does in the plan's words, and what it takes from
// the buffers or gives back to them, counted in sessions. An item a later
// release no longer has is named by its ID and said to be gone.

import {
  addedId,
  budgetInSessions,
  changesFor,
  courseSetup,
  findPackItem,
  type Context,
  type PlanChange,
  type PlanPack,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

export type ChangeLine = {
  readonly change: PlanChange;
  readonly kind: string;
  readonly text: string;
  /** Sessions taken from the buffers, or given back when negative. */
  readonly sessions: number;
};

/** The changes in force, newest first, as lines. `base` is the release itself, without the class's changes. */
export function changeLines(
  t: Translate,
  context: Context,
  courseId: string,
  base: PlanPack | undefined,
): ChangeLine[] {
  const { pack, sessionMinutes } = courseSetup(context, courseId);
  if (pack === null) return [];
  const original = (id: string) => base?.items.find((item) => item.id === id) ?? findPackItem(pack, id);
  const name = (id: string) => {
    const title = original(id)?.title;
    return (
      t('tests.quoted', { title: isolate(title ?? id) }) + (title === undefined ? ` (${t('planChanges.gone')})` : '')
    );
  };
  const count = (sessions: number) => t('planDetails.sessions', { count: sessions });
  const sessionsOf = (id: string) => {
    const item = original(id);
    return item === undefined ? 0 : budgetInSessions(base ?? pack, item, sessionMinutes);
  };
  const className = (classId: string) => isolate(context.state.classes.get(classId)?.name ?? classId);
  return changesFor(context.state.decisions, courseId)
    .reverse()
    .map((change): ChangeLine => {
      switch (change.kind) {
        case 'move': {
          const at = { item: name(change.item), before: change.before === null ? '' : name(change.before) };
          const text =
            change.align !== undefined
              ? t('planChanges.align', { ...at, class: className(change.align) })
              : change.before === null
                ? t('planChanges.moveEnd', at)
                : t('planChanges.move', at);
          return { change, kind: change.align === undefined ? 'move' : 'align', text, sessions: 0 };
        }
        case 'budget':
          return {
            change,
            kind: 'budget',
            text: t('planChanges.budget', { item: name(change.item), sessions: count(change.sessions) }),
            sessions: change.sessions - sessionsOf(change.item),
          };
        case 'split': {
          const [first, second] = change.titles.map((title) => t('tests.quoted', { title: isolate(title) }));
          return {
            change,
            kind: 'split',
            text: t('planChanges.split', { item: name(change.item), first, second }),
            sessions: 0,
          };
        }
        case 'add': {
          const at = {
            item: t('tests.quoted', { title: isolate(findPackItem(pack, addedId(change.id))?.title ?? change.title) }),
            sessions: count(change.sessions),
            before: change.before === null ? '' : name(change.before),
          };
          const text = change.before === null ? t('planChanges.addEnd', at) : t('planChanges.add', at);
          return { change, kind: 'add', text, sessions: change.sessions };
        }
        case 'skip':
          return {
            change,
            kind: 'skip',
            text: t('planChanges.skip', { item: name(change.item) }),
            sessions: -sessionsOf(change.item),
          };
        case 'join':
          return {
            change,
            kind: 'join',
            text: t('planChanges.join', { first: name(change.items[0]), second: name(change.items[1]) }),
            sessions: 0,
          };
        case 'undo':
          return { change, kind: 'undo', text: '', sessions: 0 };
      }
    });
}
