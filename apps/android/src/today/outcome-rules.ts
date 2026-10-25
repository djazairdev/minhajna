// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «نتيجة أخرى» (#32, #33, Sheet, Sheet-nostage,
// Sheet-reason): the stages a session may have reached, the item after the
// proposed one, the last item taught before, the reasons a teacher may give,
// and where what is left goes on, by its day. Stages, not percentages
// (PRD §4.7); a reason stays private (PRD §3.3, §5.4). An item taught on an
// older release is read as the class's release has it now (#322).

import {
  compareDays,
  findSessionType,
  compareSlots,
  current,
  queueItems,
  REASONS,
  weekday,
  type CarryTo,
  type CountryProfile,
  type Day,
  type PackItem,
  type PlanPack,
  type Proposal,
  type Reason,
  type Session,
  type SessionRef,
  type State,
  followId,
  type Migration,
  courseSetup,
  type Context,
} from '@minhajna/core';
import { localized } from '../setup/names';
import type { Language, useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

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

/** The last item taught in this course before the session, to teach again, as the class's release has it now. */
export function previousItem(
  state: State,
  pack: PlanPack | null,
  session: Session,
  migration: Migration = [],
): PackItem | undefined {
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
    const ids = taught === undefined ? [] : followId(migration, taught.item).reverse();
    const item = ids.flatMap((id) => pack.items.filter((candidate) => candidate.id === id))[0];
    if (item !== undefined) return item;
  }
  return undefined;
}

/** The last item taught in the session's course before it, in the course's plan now. */
export function previousOf(context: Context, session: Session): PackItem | undefined {
  const setup = courseSetup(context, session.courseId);
  return previousItem(context.state, setup.pack, session, setup.migration);
}

/** The reasons offered, «دون سبب» first and «سبب آخر» last, as the canvas orders them. */
export type ReasonChoice = 'none' | Reason;

export const REASON_CHOICES: readonly ReasonChoice[] = ['none', ...REASONS];

/** A day as the sheet names it, such as «الإثنين 09/11». */
export function shortDay(t: Translate, day: Day): string {
  return `${t(`week.days.${weekday(day)}`)} ${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** Where what is left goes on, in words: «حصة الإثنين 09/11», and «، لا في فرض الأحد 08/11» when it passes one over. */
export interface CarryWords {
  readonly at: string;
  readonly not: string;
  readonly day: string;
}

export function carryWords(
  t: Translate,
  profile: CountryProfile,
  language: Language,
  { next, passed }: CarryTo,
): CarryWords | null {
  if (next === null) return null;
  const day = shortDay(t, next.day);
  const td = findSessionType(profile, next.sessionType).queue === 'td';
  const name = passed && localized(findSessionType(profile, passed.sessionType).name);
  return {
    day,
    at: t(td ? 'outcome.atTd' : 'outcome.at', { day }),
    not: passed
      ? t('outcome.notIn', {
          type: language === 'ar' ? name : name?.toLocaleLowerCase(language),
          day: shortDay(t, passed.day),
        })
      : '',
  };
}
