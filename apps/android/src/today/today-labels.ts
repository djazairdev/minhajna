// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a session card on Today says (#32): the plan's proposal as the book
// will take it, the lesson of a session further down the day, what a
// recorded session wrote, and the day's facts; with an item merged into
// the session by the teacher's decision, both (#221). In a week pack, the
// plan week, and for an activity of the weekly model, which of the week's
// sessions of it this is (#230, answer 375). A day outside the country's
// working days that the timetable fills, such as a Saturday, says so (#231,
// answer 387). The words state facts and never judge (PRD §3.1, rule 8).

import {
  findPackItem,
  weekday,
  type CountryProfile,
  type Day,
  type PlanPack,
  type Proposal,
  type SessionRecord,
  type TodaySession,
  type TodayView,
} from '@minhajna/core';
import type { ProposalProps } from '../components/Proposal';
import { localized } from '../setup/names';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

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

/** «قراءة، الحصة 1 من 3», for an activity of the pack's weekly model; null otherwise. */
export function activityLine(t: Translate, pack: PlanPack | null, proposal: Proposal): string | null {
  const place = proposal.planWeek?.activity;
  const activity = place && pack?.activities?.find((one) => one.code === place.code);
  if (place === undefined || activity === undefined) return null;
  return t('today.activityLine', { activity: localized(activity.name), session: place.session, of: place.of });
}

/** The proposal in pencil: its tag with the plan week, the unit, the activity, the item, and the stages. */
export function proposalOf(t: Translate, pack: PlanPack | null, proposal: Proposal): ProposalProps {
  const unit = pack?.items.find((item) => item.id === proposal.item.unit);
  const week = proposal.planWeek?.week;
  const tag =
    week === undefined
      ? t(proposal.continued ? 'today.tagContinued' : 'today.tag')
      : t(proposal.continued ? 'today.tagWeekContinued' : 'today.tagWeek', { week });
  const activity = activityLine(t, pack, proposal);
  return {
    tag,
    lines: [
      ...(unit === undefined ? [] : [{ label: t('today.unit'), text: unit.title }]),
      ...(activity === null ? [] : [{ text: activity }]),
      { label: t(proposal.continued ? 'today.continued' : 'today.topic'), text: proposal.item.title },
      ...(proposal.with === undefined ? [] : [{ label: t('today.merged'), text: proposal.with.item.title }]),
      ...stageLines(t, proposal).map((text) => ({ text })),
    ],
  };
}

/** A later session's lesson, after its activity, with where it goes on from when it continues. */
export function lessonOf(
  t: Translate,
  item: TodaySession,
  pack: PlanPack | null = null,
): { lesson: string; note?: string } {
  const { proposal } = item;
  if (proposal === null) {
    const why = item.packMissing
      ? 'today.packMissing'
      : pack?.status === 'stale'
        ? 'today.packStale'
        : 'today.noProposal';
    return { lesson: t(why) };
  }
  const named =
    proposal.with === undefined
      ? proposal.item.title
      : t('today.mergedLesson', { title: isolate(proposal.item.title), with: isolate(proposal.with.item.title) });
  const activity = activityLine(t, pack, proposal);
  const title = activity === null ? named : t('today.activityLesson', { activity, title: isolate(named) });
  if (!proposal.continued) return { lesson: title };
  const stage = proposal.stageNames[proposal.from];
  return {
    lesson: t('today.continuedLesson', { title }),
    ...(stage !== undefined && { note: t('today.continuedNote', { stage }) }),
  };
}

/** What a recorded session wrote: the items it taught or taught again, the one it skipped, or that it was not held. */
export function writtenOf(t: Translate, pack: PlanPack | null, record: SessionRecord, comma: string): string {
  if (record.outcome === 'not-held') return t(record.makeUp === true ? 'today.notHeldMakeUp' : 'today.notHeld');
  const title = (id: string) => findPackItem(pack, id)?.title ?? id;
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

/** `special`, with «السبت يوم دراسة في استعمال الزمن الساري» on a day off the week that the timetable fills. */
export function withOffDay(
  t: Translate,
  country: CountryProfile,
  view: TodayView,
  day: Day,
  special: string | null,
): string | null {
  const off =
    !country.workingDays.includes(weekday(day)) &&
    view.sessions.some((item) => item.status !== 'calendar' && item.session.added === undefined);
  if (!off) return special;
  return [special, t('today.offDay', { day: t(`week.days.${weekday(day)}`) })]
    .filter((one) => one !== null)
    .join(' · ');
}
