// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «تصحيح الحصة» (#34, Entry-fix): the form starts from what
// was recorded, a correction gives a choice only when the lesson or the
// stages change, so the outcome and stages already recorded stay otherwise,
// a detail cleared is taken out of the new version, and the changes are
// listed as the activity log will show them, by day, never by hour (PRD
// §3.1, rule 4; §5.5).

import {
  courseSetup,
  findPackItem,
  proposalAt,
  type Context,
  type CorrectionReason,
  type Day,
  type PackItem,
  type PlanPack,
  type Proposal,
  type Session,
  type SessionConfirmation,
  type SessionRecord,
  type TodaySession,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { bookLines } from './book-lines';
import { startDraft, type EntryDraft } from './entry-rules';
import type { Lesson } from './lesson-rules';

type Translate = ReturnType<typeof useText>;

/** The lesson a record took, as the form shows it. */
function lessonOf(pack: PlanPack | null, record: SessionRecord): Lesson {
  const find = (id: string): PackItem | undefined => findPackItem(pack, id);
  const [first] = record.coverage;
  if (record.outcome === 'changed') {
    const item = first && find(first.item);
    return item === undefined ? { kind: 'unplanned' } : { kind: 'item', item, taught: false };
  }
  if (record.outcome === 'retaught' && first !== undefined) {
    const item = find(first.item);
    if (item !== undefined) return { kind: 'item', item, taught: true };
  }
  return { kind: 'proposed' };
}

/** The form, filled with what was recorded and the session's private note. */
export function draftOf(
  pack: PlanPack | null,
  record: SessionRecord,
  proposal: Proposal | null,
  note: string | undefined,
  due: Day | null,
): EntryDraft {
  const cover = record.coverage.find((one) => one.op === 'taught' && one.item === proposal?.item.id);
  return {
    lesson: lessonOf(pack, record),
    sessionType: record.sessionType,
    reached: cover?.op === 'taught' ? cover.to : (proposal?.to ?? 0),
    unplanned: record.unplanned ?? null,
    homework: record.homework?.text ?? '',
    due: record.homework?.due ?? due,
    test: record.test !== undefined,
    factual: record.factual ?? '',
    note: note ?? '',
  };
}

/** The correction: a choice only when the lesson or stages change, and every detail cleared taken out. */
export function correctionOf(
  confirmation: SessionConfirmation,
  record: SessionRecord,
  start: EntryDraft,
  draft: EntryDraft,
  reason: CorrectionReason | null,
  reasonText: string,
): SessionConfirmation {
  const lessonChanged =
    JSON.stringify({ ...draft.lesson }) !== JSON.stringify({ ...start.lesson }) || draft.reached !== start.reached;
  const details = confirmation.details ?? {};
  const cleared = (name: 'homework' | 'test' | 'unplanned' | 'factual') =>
    record[name] !== undefined && details[name] === undefined ? { [name]: null } : {};
  const { choice, ...rest } = confirmation;
  const text = reason === 'other' ? reasonText.trim() : '';
  return {
    ...rest,
    ...(lessonChanged && choice !== undefined && { choice }),
    ...(lessonChanged && choice === undefined && { choice: { outcome: 'done' } }),
    details: {
      ...details,
      ...cleared('homework'),
      ...cleared('test'),
      ...cleared('unplanned'),
      ...cleared('factual'),
    },
    ...(reason !== null && { correction: reason }),
    ...(text !== '' && { reason: text }),
  };
}

/** A change as the activity log shows it: what it was, and what it becomes. */
export interface FixChange {
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

export function fixChanges(
  t: Translate,
  pack: PlanPack | null,
  before: SessionRecord,
  after: SessionRecord,
  dayName: (day: Day) => string,
): FixChange[] {
  const lesson = (record: SessionRecord) =>
    bookLines(t, pack, { ...record, homework: undefined, test: undefined, factual: undefined }, dayName)
      .map((line) => (line.label === undefined ? line.text : `${line.label}: ${line.text}`))
      .join('، ');
  const homework = (record: SessionRecord) =>
    record.homework === undefined
      ? t('fix.none')
      : t('entry.bookHomework', { text: record.homework.text, day: dayName(record.homework.due) });
  const fields: [string, (record: SessionRecord) => string][] = [
    [t('fix.lesson'), lesson],
    [t('entry.homework'), homework],
    [t('entry.test'), (record) => (record.test === undefined ? t('fix.no') : t('fix.yes'))],
    [t('entry.factual'), (record) => record.factual ?? t('fix.none')],
  ];
  return fields.flatMap(([field, read]) => {
    const was = read(before);
    const becomes = read(after);
    return was === becomes ? [] : [{ field, before: was, after: becomes }];
  });
}

/** Whether a recorded session can be corrected here: its own day's session, from the timetable. */
export function correctable(session: Session, record: SessionRecord | null): record is SessionRecord {
  return record !== null && session.scheduled;
}

/** What the entry starts from: the proposal, the record being corrected if any, and the form. */
export interface EntryStart {
  readonly proposal: Proposal | null;
  readonly record: SessionRecord | null;
  readonly draft: EntryDraft;
}

/** A session awaiting confirmation starts from its proposal; a recorded one from its record. */
export function startOf(
  context: Context,
  item: TodaySession,
  note: string | undefined,
  due: Day | null,
): EntryStart | null {
  if (item.status === 'awaiting') {
    return { proposal: item.proposal, record: null, draft: startDraft(item.session, item.proposal, due) };
  }
  if (item.status !== 'recorded' || !correctable(item.session, item.record)) return null;
  const pack = courseSetup(context, item.session.courseId).pack;
  const proposal = proposalAt(context, item.session);
  return { proposal, record: item.record, draft: draftOf(pack, item.record, proposal, note, due) };
}
