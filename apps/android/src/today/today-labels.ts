// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a session card on Today says (#32): the plan's proposal as the book
// will take it, the lesson of a session further down the day, what a
// recorded session wrote, and the day's facts. The words state facts and
// never judge (PRD §3.1, rule 8).

import type { PlanPack, Proposal, SessionRecord, TodaySession, TodayView } from '@minhajna/core';
import type { ProposalProps } from '../components/Proposal';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** The stages this session covers, or the one it goes on with; without stages, which of the item's sessions it is. */
function stageLines(t: Translate, proposal: Proposal): string[] {
  const names = proposal.stageNames;
  if (names.length > 0) {
    const covered =
      proposal.to > proposal.from
        ? names.slice(proposal.from, proposal.to)
        : names.slice(proposal.from, proposal.from + 1);
    return covered.map((name) => `- ${name}`);
  }
  return proposal.budget > 1 ? [t('today.sessionOf', { session: proposal.session, budget: proposal.budget })] : [];
}

/** The proposal in pencil: its tag, the unit, the item, and the stages. */
export function proposalOf(t: Translate, pack: PlanPack | null, proposal: Proposal): ProposalProps {
  const unit = pack?.items.find((item) => item.id === proposal.item.unit);
  return {
    tag: t(proposal.continued ? 'today.tagContinued' : 'today.tag'),
    lines: [
      ...(unit === undefined ? [] : [{ label: t('today.unit'), text: unit.title }]),
      { label: t(proposal.continued ? 'today.continued' : 'today.topic'), text: proposal.item.title },
      ...stageLines(t, proposal).map((text) => ({ text })),
    ],
  };
}

/** A later session's lesson, with where it goes on from when it continues. */
export function lessonOf(t: Translate, item: TodaySession): { lesson: string; note?: string } {
  const { proposal } = item;
  if (proposal === null) return { lesson: t(item.packMissing ? 'today.packMissing' : 'today.noProposal') };
  if (!proposal.continued) return { lesson: proposal.item.title };
  const stage = proposal.stageNames[proposal.from];
  return {
    lesson: t('today.continuedLesson', { title: proposal.item.title }),
    ...(stage !== undefined && { note: t('today.continuedNote', { stage }) }),
  };
}

/** What a recorded session wrote: the items it taught or taught again, the one it skipped, or that it was not held. */
export function writtenOf(t: Translate, pack: PlanPack | null, record: SessionRecord, comma: string): string {
  if (record.outcome === 'not-held') return t(record.makeUp === true ? 'today.notHeldMakeUp' : 'today.notHeld');
  const title = (id: string) => pack?.items.find((item) => item.id === id)?.title ?? id;
  const titles = record.coverage.flatMap((cover) => (cover.op === 'skipped' ? [] : [title(cover.item)]));
  if (titles.length > 0) return titles.join(comma);
  const skipped = record.coverage.find((cover) => cover.op === 'skipped');
  if (skipped !== undefined) return t('today.skipped', { title: title(skipped.item) });
  return record.factual ?? record.unplanned ?? t('today.recorded');
}

/**
 * The day's facts: whether earlier sessions await confirmation, and how many
 * of today's are confirmed. On a day a holiday, a closure or an exam marks,
 * the sessions it took are not counted, and with none left the mark says it.
 */
export function dayFacts(t: Translate, view: TodayView, marked = false): string {
  const earlier =
    view.awaitingEarlier === 0 ? t('today.allConfirmed') : t('today.earlier', { count: view.awaitingEarlier });
  const sessions = marked ? view.sessions.filter((item) => item.status !== 'calendar') : view.sessions;
  const count = sessions.length;
  if (count === 0) return marked ? earlier : `${earlier} · ${t('today.none')}`;
  const confirmed = sessions.filter((item) => item.status === 'recorded').length;
  const today =
    confirmed === 0
      ? t('today.count', { sessions: t('count.sessions', { count }) })
      : t('today.confirmedOf', {
          confirmed: t('today.confirmed', { count: confirmed }),
          sessions: t('today.total', { count }),
        });
  return `${earlier} · ${today}`;
}
