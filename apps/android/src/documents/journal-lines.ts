// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session's lines in the CEM and lycée daily journal (#216, Journal,
// R-3.8-13): the sequence it belongs to, the domain when the session is not
// a plain lesson, the resources it covered, «تابع» for one carried on with
// the stages it covered (R-4.7-13), content outside the plan, how the
// session went, and the remarks: a test, the homework and the factual line.
// Words in the pack's or the teacher's language are isolated, so a French
// title keeps its order in an Arabic line. A session awaiting confirmation
// shows what confirming it would record, and says it awaits confirmation
// instead of how it went (R-3.1-05).

import { stageNames, type PlanPack, type Proposal, type Session, type SessionRecord } from '@minhajna/core';
import type { BookLine } from '../entry/book-lines';
import { isolate } from '../week/grid-labels';
import type { Translate } from './document-data';

export interface JournalNames {
  /** A session type's name, such as «أعمال موجهة». */
  readonly type: (code: string) => string;
  /** A due day as the book writes it. */
  readonly day: (day: SessionRecord['session']['day']) => string;
}

/** What confirming a session as proposed would record. */
export function proposedRecord(session: Session, proposal: Proposal | null): SessionRecord {
  return {
    session: {
      key: session.key,
      courseId: session.courseId,
      groupId: session.groupId,
      day: session.day,
      slot: session.slot,
    },
    outcome: 'done',
    sessionType: session.sessionType,
    coverage: proposal === null ? [] : [{ op: 'taught', item: proposal.item.id, from: proposal.from, to: proposal.to }],
  };
}

/** The lines of a session in the journal, from its record or from what confirming it would record. */
export function journalLines(
  t: Translate,
  names: JournalNames,
  pack: PlanPack | null,
  record: SessionRecord,
  awaiting: boolean,
): BookLine[] {
  const how = (text: string): BookLine => ({ label: t('documents.journalLines.how'), text });
  if (!awaiting && record.outcome === 'not-held') return [how(t('documents.journalLines.outcomes.not-held'))];
  const label = (key: 'sequence' | 'domain' | 'resource' | 'remarks' | 'and') => t(`documents.journalLines.${key}`);
  const sequences: BookLine[] = [];
  const lines: BookLine[] = [];
  if (record.sessionType !== 'lesson') lines.push({ label: label('domain'), text: names.type(record.sessionType) });
  for (const cover of record.coverage) {
    const item = pack?.items.find((candidate) => candidate.id === cover.item);
    const title = isolate(item?.title ?? cover.item);
    const unit = item?.unit === undefined ? undefined : pack?.items.find((candidate) => candidate.id === item.unit);
    if (unit !== undefined && !sequences.some((line) => line.text === isolate(unit.title))) {
      sequences.push({ label: label('sequence'), text: isolate(unit.title) });
    }
    if (cover.op === 'skipped') {
      lines.push({ label: label('resource'), text: t('today.skipped', { title }) });
    } else if (cover.op === 'retaught') {
      lines.push({ label: label('resource'), text: t('documents.journalLines.retaught', { title }) });
    } else if (cover.from === 0) {
      lines.push({ label: label('resource'), text: title });
    } else {
      lines.push({ label: label('resource'), text: t('documents.journalLines.continued', { title }) });
      const stages = pack !== null && item !== undefined ? stageNames(pack, item) : [];
      for (const name of stages.slice(cover.from, cover.to)) lines.push({ text: `- ${isolate(name)}` });
    }
  }
  if (record.unplanned !== undefined) {
    lines.push({ label: label('resource'), text: isolate(record.unplanned) });
  }
  lines.push(
    how(awaiting ? t('documents.journalLines.awaiting') : t(`documents.journalLines.outcomes.${record.outcome}`)),
  );
  const remarks = [
    record.test === undefined ? null : t('entry.bookTest'),
    record.homework === undefined
      ? null
      : t('entry.bookHomework', { text: isolate(record.homework.text), day: names.day(record.homework.due) }),
    record.factual === undefined ? null : isolate(record.factual),
  ].filter((remark): remark is string => remark !== null);
  if (!awaiting && remarks.length > 0) {
    lines.push({ label: label('remarks'), text: remarks.join(label('and')) });
  }
  return [...sequences, ...lines];
}
