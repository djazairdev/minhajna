// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the lesson note screens show (#237, Note, answers 416 to 419): the
// lesson a session's note is for, the note's paragraphs as the plan proposes
// them in grey or as the teacher kept them in ink, then the teacher's own,
// and the next session from today still awaiting confirmation that has a
// lesson, which «المذكرات» opens.

import {
  addDays,
  current,
  noteFor,
  sessionsBetween,
  walkCourse,
  type Context,
  type Day,
  type LessonNote,
  type NoteDraft,
  type NoteKey,
  type Session,
  type TodaySession,
} from '@minhajna/core';
import type { Translate } from '../documents/document-data';

export const NOTE_TITLE_MAX = 80;
export const NOTE_TEXT_MAX = 2000;
const LOOK_AHEAD_DAYS = 28;

/** The plan item a session's note is for: the one proposed, or the first recorded as taught; none for free content. */
export function sessionItem(item: Pick<TodaySession, 'proposal' | 'record'>): string | null {
  if (item.record !== null) return item.record.coverage.find((one) => one.op !== 'skipped')?.item ?? null;
  return item.proposal?.item.id ?? null;
}

/** One paragraph of the note as shown: a plan paragraph, grey until kept, or the teacher's own at `own`. */
export interface NoteBlock {
  readonly key?: NoteKey;
  readonly own?: number;
  readonly title: string;
  /** The kept text, or for a grey paragraph the plan's. */
  readonly text: string;
  readonly inked: boolean;
  /** For a plan paragraph, the plan's text. */
  readonly proposed?: string;
}

/** A plan paragraph's title: the three fixed ones, a stage's name, or its number when the plan names none. */
export function planTitle(t: Translate, key: NoteKey, draft: NoteDraft): string {
  if (key === 'indicator' || key === 'objectives' || key === 'resources') return t(`notes.keys.${key}`);
  const stage = draft.proposals.find((one) => one.key === key)?.stage;
  return stage ?? t('notes.stage', { number: Number(key.slice('stage-'.length)) });
}

/** What the plan proposes for `key`: «السندات» names the textbook's pages when the item does. */
export function proposedText(t: Translate, key: NoteKey, draft: NoteDraft): string {
  if (key === 'resources' && draft.pages !== undefined) return t('notes.pages', { pages: draft.pages });
  return draft.proposals.find((one) => one.key === key)?.text ?? '';
}

/** The plan's keys in its order, for keeping a paragraph in place. */
export function planOrder(draft: NoteDraft): NoteKey[] {
  return draft.proposals.map((one) => one.key);
}

/** The note's paragraphs: the plan's in grey or ink, any kept for a key the plan dropped, then the teacher's own. */
export function noteBlocks(t: Translate, draft: NoteDraft, note: LessonNote | undefined): NoteBlock[] {
  const kept = note?.paragraphs ?? [];
  const keyed = (key: NoteKey) => kept.find((one) => one.key === key);
  const plan = planOrder(draft).map((key): NoteBlock => {
    const proposed = proposedText(t, key, draft);
    const paragraph = keyed(key);
    return { key, title: planTitle(t, key, draft), text: paragraph?.text ?? proposed, inked: !!paragraph, proposed };
  });
  const order = new Set(planOrder(draft));
  const left = kept
    .filter((one) => one.key !== undefined && !order.has(one.key))
    .map((one): NoteBlock => ({ key: one.key!, title: planTitle(t, one.key!, draft), text: one.text, inked: true }));
  const own = kept
    .filter((one) => one.key === undefined)
    .map((one, index): NoteBlock => ({ own: index, title: one.title ?? '', text: one.text, inked: true }));
  return [...plan, ...left, ...own];
}

/** Whether the note has some written text, so an earlier year's note is no longer offered. */
export function hasText(note: LessonNote | undefined): boolean {
  return note?.paragraphs.some((one) => one.text.trim() !== '') ?? false;
}

/** The next session from `from` still awaiting confirmation that has a lesson, with that lesson and its note. */
export function nextNoted(
  context: Context,
  from: Day,
): { readonly session: Session; readonly itemId: string; readonly note: LessonNote | undefined } | null {
  const { state } = context;
  const to = addDays(from, LOOK_AHEAD_DAYS);
  const walks = new Map<string, ReturnType<typeof walkCourse>>();
  for (const session of sessionsBetween(context, from, to)) {
    if (session.calendar !== null || !state.courses.has(session.courseId)) continue;
    if (current(state.sessions.get(session.key)) !== null) continue;
    const walk = walks.get(session.courseId) ?? walkCourse(context, session.courseId, to);
    walks.set(session.courseId, walk);
    const itemId = walk.proposals.get(session.key)?.item.id;
    if (itemId !== undefined) return { session, itemId, note: noteFor(state, session.courseId, itemId) };
  }
  return null;
}
