// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «نتيجة أخرى» (#32, Sheet, Sheet-nostage, Sheet-reason):
// the stages a session may have reached, the item after the proposed one,
// the last item taught before, and the reasons a teacher may give. Stages,
// not percentages (PRD §4.7); a reason stays private (PRD §3.3, §5.4).

import {
  compareDays,
  compareSlots,
  current,
  queueItems,
  REASONS,
  type PackItem,
  type PlanPack,
  type Proposal,
  type Reason,
  type Session,
  type SessionRef,
  type State,
} from '@minhajna/core';

/** A stage the session may have reached, and the stage count that makes covered. */
export interface StageChoice {
  readonly name: string;
  readonly reached: number;
}

/** The stages from the first one not yet covered: choosing one records every stage up to it. */
export function stageChoices(proposal: Proposal): StageChoice[] {
  return proposal.stageNames.slice(proposal.from).map((name, index) => ({
    name,
    reached: proposal.from + index + 1,
  }));
}

/** The item the plan proposes after this one in the same queue, if any. */
export function nextItem(pack: PlanPack | null, item: PackItem): PackItem | undefined {
  if (pack === null) return undefined;
  const items = queueItems(pack, item.kind === 'td' ? 'td' : 'main');
  const at = items.findIndex((candidate) => candidate.id === item.id);
  return at === -1 ? undefined : items[at + 1];
}

/** The last item taught in this course before the session, to teach again. */
export function previousItem(state: State, pack: PlanPack | null, session: Session): PackItem | undefined {
  if (pack === null) return undefined;
  const order = (a: SessionRef, b: SessionRef) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot);
  const earlier = [...state.sessions.values()]
    .flatMap((versions) => {
      const record = current(versions);
      return record !== null && record.session.courseId === session.courseId && order(record.session, session) < 0
        ? [record]
        : [];
    })
    .sort((a, b) => order(b.session, a.session));
  for (const record of earlier) {
    const taught = [...record.coverage].reverse().find((cover) => cover.op === 'taught' || cover.op === 'retaught');
    const item = taught && pack.items.find((candidate) => candidate.id === taught.item);
    if (item !== undefined) return item;
  }
  return undefined;
}

/** The reasons offered, «دون سبب» first and «سبب آخر» last, as the canvas orders them. */
export type ReasonChoice = 'none' | Reason;

export const REASON_CHOICES: readonly ReasonChoice[] = ['none', ...REASONS];
