// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules of a class's own list on screen (#227, Plan-free, answer 346):
// the item being typed, read into an item or the reason it is not one yet;
// stages typed one per line; the selected items moved a step together; and
// the list's count of items and sessions, which units do not add to.

import {
  FREE_STAGE_MAX,
  FREE_STAGES_MAX,
  FREE_TITLE_MAX,
  freeItemFits,
  isOneLine,
  type FreeItem,
  type FreeList,
  type ItemKind,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { plain } from './error-report';

type Translate = ReturnType<typeof useText>;

export type FreeDraft = {
  readonly title: string;
  readonly kind: ItemKind;
  readonly sessions: number;
  readonly stages: string;
};

export const EMPTY_DRAFT: FreeDraft = { title: '', kind: 'lesson', sessions: 1, stages: '' };

/** A title as it is kept: no bidi or control character, on one line. */
export const titleOf = (text: string): string =>
  plain(text)
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

/** The stages as typed, one per line, without blank lines. */
export function stagesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => plain(line).replace(/\t+/g, ' ').trim())
    .filter((line) => line !== '');
}

/** The item a draft makes, under the ID given, or null while it breaks a rule. */
export function itemOf(draft: FreeDraft, id: string): FreeItem | null {
  const title = titleOf(draft.title);
  const stages = stagesOf(draft.stages);
  const item: FreeItem =
    draft.kind === 'unit'
      ? { id, kind: 'unit', title }
      : { id, kind: draft.kind, title, sessions: draft.sessions, ...(stages.length > 0 && { stages }) };
  return freeItemFits(item) ? item : null;
}

/** What a draft still needs before it can be added, or null when it can. */
export function draftNeeds(t: Translate, draft: FreeDraft): string | null {
  const title = titleOf(draft.title);
  if (title === '') return t('planFree.needs.title');
  if (!isOneLine(title, FREE_TITLE_MAX)) return t('planFree.needs.titleLong', { count: FREE_TITLE_MAX });
  if (draft.kind === 'unit') return null;
  const stages = stagesOf(draft.stages);
  if (stages.length > FREE_STAGES_MAX) return t('planFree.needs.stages', { count: FREE_STAGES_MAX });
  if (stages.some((stage) => !isOneLine(stage, FREE_STAGE_MAX))) {
    return t('planFree.needs.stageLong', { count: FREE_STAGE_MAX });
  }
  return null;
}

/** Whether the form holds typing not yet added to the list. */
export const draftTyped = (draft: FreeDraft): boolean =>
  draft.title.trim() !== '' || draft.stages.trim() !== '' || draft.kind !== EMPTY_DRAFT.kind || draft.sessions !== 1;

/** The draft an item fills the form with, to edit it. */
export function draftOf(item: FreeItem): FreeDraft {
  return { title: item.title, kind: item.kind, sessions: item.sessions ?? 1, stages: (item.stages ?? []).join('\n') };
}

/** The list with the selected items moved one place earlier or later, together, keeping their order. */
export function shifted(list: FreeList, selected: ReadonlySet<string>, step: -1 | 1): FreeList {
  const items = [...list.items];
  const order = step < 0 ? items.map((_, at) => at) : items.map((_, at) => items.length - 1 - at);
  for (const at of order) {
    const to = at + step;
    const here = items[at];
    const there = items[to];
    if (here === undefined || there === undefined || !selected.has(here.id) || selected.has(there.id)) continue;
    items[to] = here;
    items[at] = there;
  }
  return items.every((item, at) => item === list.items[at]) ? list : { ...list, items };
}

/** How many items the list holds and the sessions they take; units are neither. */
export function listLine(t: Translate, list: FreeList): string {
  const items = list.items.filter((item) => item.kind !== 'unit');
  const sessions = items.reduce((sum, item) => sum + (item.sessions ?? 0), 0);
  return t('planFree.count', {
    items: t('planFree.items', { count: items.length }),
    sessions: t('planDetails.sessions', { count: sessions }),
  });
}
