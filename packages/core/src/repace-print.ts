// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed re-pace draft (#229, Repace-primary, R-4.7-30, answers 367,
// 371 and 372). In primary, the draft is printed for the director with the
// choices ticked on it, and the print history keeps them. The draft counts
// as printed by its newest print recorded after the one the class's last
// re-pace was approved from, or, after a re-pace with none, made from its
// day on. The approval records exactly the choices printed. A choice is
// known by its kind and its items, so a tick follows it when the list
// changes.

import { compareDays, type Day } from './day.ts';
import type { PlanChoice } from './exam-answers.ts';
import type { RepaceDraft } from './repace.ts';
import { repacesOf } from './repace-records.ts';
import type { State } from './state.ts';

/** A choice's key: its kind and its items, such as `merge:l3+l4`. */
export function choiceKey(choice: PlanChoice): string {
  const items = choice.kind === 'leave-out' ? [choice.item] : choice.items;
  return `${choice.kind}:${items.map((item) => item.id).join('+')}`;
}

/** The name a class's printed draft has in the print history. */
export function repaceDocument(courseId: string): string {
  return `repace:${courseId}`;
}

/** A printed draft: its print's ID, the day it was sent to print and the keys of the choices ticked on it. */
export interface RepacePrint {
  readonly id: string;
  readonly day: Day;
  readonly choices: readonly string[];
}

/** The class's newest printed draft since its last re-pace; null when none. */
export function repacePrinted(state: State, courseId: string): RepacePrint | null {
  const last = repacesOf(state, courseId).at(-1);
  const approved = last?.print === undefined ? -1 : state.prints.findIndex((one) => one.value.id === last.print);
  const name = repaceDocument(courseId);
  let found: RepacePrint | null = null;
  for (const [index, version] of state.prints.entries()) {
    if (last !== undefined && (approved >= 0 ? index <= approved : compareDays(version.day, last.on) < 0)) continue;
    for (const one of version.value.documents) {
      if (one.id === name) found = { id: version.value.id, day: version.day, choices: one.choices ?? [] };
    }
  }
  return found;
}

/** The places of the printed choices in the draft's, or null when one of them is no longer proposed. */
export function printedTicks(draft: Pick<RepaceDraft, 'choices'>, print: RepacePrint): number[] | null {
  const keys = draft.choices.map(choiceKey);
  const ticks = print.choices.map((key) => keys.indexOf(key));
  return ticks.some((index) => index < 0) ? null : ticks;
}
