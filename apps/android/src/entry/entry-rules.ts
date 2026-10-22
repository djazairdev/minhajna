// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «تفاصيل الحصة» (#34, Entry): what the form starts from,
// the confirmation it makes, the days homework may be due, and the record
// the texts book will take. The preview is the core's own confirmation,
// worked out without recording, so it shows exactly what «تأكيد الحصة»
// writes. Nothing is recorded until then (PRD §2.3); the session is its date
// and slot, never a clock time (PRD §3.3). A «معالجة» or «دعم» session
// confirmed for the first time takes its list's paired item, as on Today's
// card (answers 376 to 378): finished when held as proposed, left open when
// another lesson took its place.

import {
  addDays,
  compareDays,
  confirmSessions,
  findSessionType,
  listOfType,
  sessionsBetween,
  type Context,
  type CountryProfile,
  type Day,
  type Proposal,
  type Session,
  type SessionConfirmation,
  type SessionRecord,
  type SupportItem,
} from '@minhajna/core';
import { choiceOf, type Lesson } from './lesson-rules';

/** What the teacher has entered so far. */
export interface EntryDraft {
  readonly lesson: Lesson;
  readonly sessionType: string;
  /** The stage count covered, for a lesson with stages. */
  readonly reached: number;
  /** Null until «إضافة محتوى من خارج المخطط». */
  readonly unplanned: string | null;
  readonly homework: string;
  readonly due: Day | null;
  readonly test: boolean;
  readonly factual: string;
  readonly note: string;
}

/** The profile's session type for a test given in the session. */
export const TEST_TYPE = 'test';

export function startDraft(session: Session, proposal: Proposal | null, due: Day | null): EntryDraft {
  return {
    lesson: { kind: 'proposed' },
    sessionType: session.sessionType,
    reached: proposal === null ? 0 : proposal.to,
    unplanned: null,
    homework: '',
    due,
    test: false,
    factual: '',
    note: '',
  };
}

/** Whether the stages can be chosen: the proposal kept, with stages, in the queue of the session's type. */
export function stagesShown(profile: CountryProfile, session: Session, proposal: Proposal | null, draft: EntryDraft) {
  return (
    draft.lesson.kind === 'proposed' &&
    proposal !== null &&
    proposal.stageNames.length > 0 &&
    findSessionType(profile, draft.sessionType).queue === findSessionType(profile, session.sessionType).queue
  );
}

/** The confirmation the form makes. */
export function confirmationOf(
  profile: CountryProfile,
  session: Session,
  proposal: Proposal | null,
  draft: EntryDraft,
  listItem: SupportItem | null = null,
): SessionConfirmation {
  const sameList = listItem !== null && listOfType(draft.sessionType) === listOfType(session.sessionType);
  const partial = stagesShown(profile, session, proposal, draft) && draft.reached !== proposal?.to;
  const homework = draft.homework.trim();
  const unplanned = draft.unplanned?.trim() ?? '';
  const factual = draft.factual.trim();
  const note = draft.note.trim();
  return {
    session,
    ...(draft.lesson.kind !== 'proposed' && { choice: choiceOf(draft.lesson) }),
    ...(partial && { choice: { outcome: 'partial', reached: draft.reached } }),
    details: {
      ...(draft.sessionType !== session.sessionType && { sessionType: draft.sessionType }),
      ...(homework !== '' && draft.due !== null && { homework: { text: homework, due: draft.due } }),
      ...(draft.test && { test: TEST_TYPE }),
      ...(unplanned !== '' && { unplanned }),
      ...(factual !== '' && { factual }),
      ...(sameList && { listItem: { id: listItem.id, finished: draft.lesson.kind === 'proposed' } }),
    },
    ...(note !== '' && { privateNote: note }),
  };
}

/** The record «تأكيد الحصة» would write, worked out without recording it. */
export function previewOf(context: Context, confirmation: SessionConfirmation): SessionRecord | null {
  const event = confirmSessions(context, [confirmation]).find((one) => one.kind === 'session.recorded');
  return event?.kind === 'session.recorded' ? event.record : null;
}

/** The days the class next has this subject, for homework's due date, looking four weeks ahead. */
export function dueDays(context: Context, session: Session): Day[] {
  const days = sessionsBetween(context, addDays(session.day, 1), addDays(session.day, 28), new Set([session.courseId]))
    .filter((other) => other.calendar === null && other.groupId === session.groupId)
    .map((other) => other.day);
  return [...new Set(days)].sort(compareDays);
}
