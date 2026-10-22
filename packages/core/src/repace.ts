// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The draft of a re-pace (#229, PRD §4.7, R-4.7-29 to R-4.7-34, answers
// 363 to 365): the rest of the term up to the next exams, laid out by
// teaching week. Lessons flow in plan order over the plan sessions left,
// which is how the engine already proposes them, so the draft is that
// projection; tests and the days the calendar takes stay where they are and
// count as no plan session, and TD keeps its own count. When items would
// land after the exams, the draft offers rung 3's choices, ticked as the
// exam-window answer suggests, and follows the ticks. It is worked out
// afresh each time and never stored; nothing applies until the teacher
// confirms (repace-confirm.ts).

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { decisionOf, planChoices, suggestedChoices, withPlanChanges, type PlanChoice } from './exam-answers.ts';
import { nextExams, pastWindow } from './exam-window.ts';
import { courseGrade, forGrade } from './joint.ts';
import type { PackItem } from './pack.ts';
import { nextExamTerm, pace, queueOf, termCheck } from './pacing.ts';
import type { CalendarEntry, Confidence } from './reference.ts';
import { rotationCredits } from './rotation-sessions.ts';
import { sessionsBetween, type CalendarMark, type Session } from './sessions.ts';
import { current } from './state.ts';

/** An item's share of a week: its stages or its budgeted sessions, each counted from 1 to `of`. */
export interface RepaceShare {
  readonly first: number;
  readonly last: number;
  readonly of: number;
}

export type RepaceEntry =
  | {
      readonly kind: 'item';
      readonly item: PackItem;
      /** The stages it covers that week when it has several, or else its budgeted sessions. */
      readonly share: RepaceShare | null;
      /** The item merged into its session by a decision, ticked in the draft or not. */
      readonly with?: PackItem;
    }
  | { readonly kind: 'test'; readonly id: string; readonly title: string; readonly day: Day }
  | {
      readonly kind: 'taken';
      readonly day: Day;
      readonly mark: Exclude<CalendarMark, 'rotation'>;
      readonly entry: CalendarEntry | null;
    };

export interface RepaceWeek {
  /** The teaching week's first day, and the last day of it the draft reaches. */
  readonly start: Day;
  readonly end: Day;
  readonly entries: readonly RepaceEntry[];
  /** Its plan sessions. */
  readonly plan: number;
  /** For a week pack, the plan weeks its items come from, in order. */
  readonly planWeeks: readonly number[];
}

export interface RepaceDraft {
  readonly courseId: string;
  readonly term: number;
  /** The first session not yet recorded, and the day before the exams, or the term's last day. */
  readonly from: Day;
  readonly to: Day;
  /** The exam window it stops at; null when the term's end is used. */
  readonly window: { readonly from: Day; readonly to: Day; readonly confidence: Confidence } | null;
  /** Plan sessions left until then, and what the plan still needs by then, buffers included; null without terms. */
  readonly counts: { readonly gives: number; readonly needs: number } | null;
  readonly td: { readonly gives: number; readonly items: number } | null;
  readonly weeks: readonly RepaceWeek[];
  /** The items the term needs that would still land after the window, in plan order. */
  readonly after: readonly PackItem[];
  /** Rung 3's choices for the term, and those ticked, by place. */
  readonly choices: readonly PlanChoice[];
  readonly ticked: readonly number[];
  /** How far behind the current distribution the class is: in sessions, buffers included, and in plan weeks. */
  readonly behind: { readonly sessions: number; readonly weeks: number | null };
  /** In primary, the director approves the new distribution. */
  readonly primary: boolean;
}

/** The decisions a draft's ticks stand for, under `ids` or preview IDs. */
export function tickedDecisions(draft: Pick<RepaceDraft, 'courseId' | 'choices' | 'ticked'>, ids?: readonly string[]) {
  return draft.ticked.map((index, n) =>
    decisionOf(draft.choices[index] as PlanChoice, ids?.[n] ?? `draft-${index}`, draft.courseId),
  );
}

/**
 * A course's re-pace draft on `today`, with `ticked` choices or the
 * suggested ones. Null without a pack or a term, or once the exams began.
 */
export function repaceDraft(
  context: Context,
  courseId: string,
  today: Day,
  ticked?: readonly number[],
): RepaceDraft | null {
  const setup = courseSetup(context, courseId);
  const exam = nextExams(context, courseId, today);
  if (setup.pack === null || setup.packStale || (exam !== null && compareDays(exam.from, today) <= 0)) return null;
  const term = exam?.term ?? nextExamTerm(context, setup, today);
  const termDays = context.ref.year.terms.find((one) => one.number === term);
  if (term === undefined || termDays === undefined) return null;
  const to = exam === null ? termDays.to : addDays(exam.from, -1);

  const choices = planChoices(context, { courseId, term });
  const warning = pastWindow(context, courseId, today);
  const picked = (ticked ?? (warning === null ? [] : suggestedChoices(context, warning, choices, today))).filter(
    (index) => index >= 0 && index < choices.length,
  );
  const draft = { courseId, choices, ticked: [...new Set(picked)].sort((a, b) => a - b) };
  const preview = withPlanChanges(context, { decisions: tickedDecisions(draft) });
  const paced = pace(preview, courseId, today);
  if (paced === null) return null;
  const start = backlogStart(preview, courseId, today);
  const check = termCheck(preview, courseId, start, term);
  return {
    ...draft,
    term,
    ...laidOut(preview, courseId, start, to),
    to,
    window: exam === null ? null : { from: exam.from, to: exam.to, confidence: exam.confidence },
    counts: check === null ? null : { gives: check.gives, needs: check.needs },
    td: check === null || (check.td.gives === 0 && check.td.items === 0) ? null : check.td,
    after: pastWindow(preview, courseId, today)?.items.map(({ item }) => item) ?? [],
    behind: { sessions: Math.max(0, paced.expected - paced.position), weeks: paced.planWeeksBehind },
    primary: setup.schoolClass.level === 'primary',
  };
}

/** The day of the course's first session not yet recorded, a backlog day included; `today` when none is earlier. */
function backlogStart(context: Context, courseId: string, today: Day): Day {
  const first = sessionsBetween(context, context.ref.year.from, today, new Set([courseId])).find(
    (session) => session.calendar === null && current(context.state.sessions.get(session.key)) === null,
  );
  return first?.day ?? today;
}

/**
 * The sessions not yet recorded from `start` to `to`, by teaching week, and
 * the first one's day. A pair of rotating half-groups counts one plan
 * session, in the week of the session that completes it, counted over the
 * year's recorded sessions as the September check counts; that session's
 * item stands for the pair.
 */
function laidOut(context: Context, courseId: string, start: Day, to: Day): { from: Day; weeks: RepaceWeek[] } {
  const { state, calendar } = context;
  const setup = courseSetup(context, courseId);
  const school = state.schools.get(setup.schoolClass.schoolId);
  const entries = school
    ? calendar.entriesFor(school, forGrade(setup.schoolClass, courseGrade(setup.course, setup.schoolClass)))
    : [];
  const proposals = walkCourse(context, courseId, to).proposals;
  const all = sessionsBetween(context, context.ref.year.from, to, new Set([courseId]));
  const recorded = (session: Session): boolean => current(state.sessions.get(session.key)) !== null;
  const sessions = all.filter((session) => session.day >= start && !recorded(session));
  const counted = all.filter((session) => recorded(session) && queueOf(context, session) === 'main');
  let credits = rotationCredits(counted);
  const weeks: { start: Day; end: Day; entries: RepaceEntry[]; plan: number }[] = [];
  for (const session of sessions) {
    const weekStart = (school && calendar.weekOf(session.day, school)?.start) ?? null;
    if (weekStart === null) continue;
    let week = weeks.at(-1);
    if (week?.start !== weekStart) weeks.push((week = { start: weekStart, end: session.day, entries: [], plan: 0 }));
    week.end = session.day;
    const { calendar: mark } = session;
    if (mark !== null) {
      if (mark === 'rotation') continue;
      const entry = entries.find((one) => one.id === session.calendarEntry) ?? null;
      const taken = week.entries.some((one) => one.kind === 'taken' && one.day === session.day);
      if (!taken) week.entries.push({ kind: 'taken', day: session.day, mark, entry });
    } else if (session.test !== undefined) {
      const test = state.tests.get(session.test);
      if (test !== undefined) week.entries.push({ kind: 'test', id: test.id, title: test.title, day: session.day });
    } else if (queueOf(context, session) === 'main') {
      counted.push(session);
      const now = rotationCredits(counted);
      if (now === credits) continue;
      credits = now;
      week.plan += 1;
      const proposal = proposals.get(session.key);
      if (proposal == null) continue;
      const of = proposal.stages > 1 ? proposal.stages : Math.ceil(proposal.budget);
      const first = Math.min(of, proposal.stages > 1 ? proposal.from + 1 : proposal.session);
      const share = { first, last: Math.min(of, Math.max(first, proposal.stages > 1 ? proposal.to : first)), of };
      const last = week.entries.at(-1);
      if (last?.kind === 'item' && last.item.id === proposal.item.id) {
        if (last.share !== null)
          week.entries[week.entries.length - 1] = { ...last, share: { ...last.share, last: share.last } };
      } else {
        week.entries.push({
          kind: 'item',
          item: proposal.item,
          share: share.of > 1 ? share : null,
          ...(proposal.with !== undefined && { with: proposal.with.item }),
        });
      }
    }
  }
  return {
    from: sessions[0]?.day ?? start,
    weeks: weeks.map((week) => ({
      ...week,
      planWeeks: [
        ...new Set(
          week.entries.flatMap((one) => (one.kind === 'item' && one.item.week !== undefined ? [one.item.week] : [])),
        ),
      ],
    })),
  };
}
