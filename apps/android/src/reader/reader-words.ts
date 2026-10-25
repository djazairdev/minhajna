// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of reader mode (#246, R-Open, answer 489): a teacher by the name
// the reader gave their key, or as unnamed with the key's first characters;
// whether a statement is the first under its key, or from the teacher who
// sent an earlier one; whether its pack release is the newest this app has;
// and the fields a reader reads, headed by the statement's day, its teacher
// and its class.

import {
  firstUnderKey,
  newerRelease,
  type CountryProfile,
  type PlanPack,
  type ProgressStatement,
  type Received,
  type TeacherName,
} from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { frontDate } from '../documents/front-tables';
import { statementClass, statementLines, type StatementLine } from '../sharing/statement-lines';
import { isolate } from '../week/grid-labels';

/** The teacher who signs with a key: the name and school the reader gave, or unnamed with the fingerprint's start. */
export function teacherLabel(
  t: Translate,
  names: ReadonlyMap<string, TeacherName>,
  spki: string,
  fingerprint: string | null,
): string {
  const named = names.get(spki);
  if (named !== undefined) {
    return [named.name, ...(named.school === undefined ? [] : [named.school])].map(isolate).join(' · ');
  }
  return t('reader.unnamed', { key: isolate(fingerprint === null ? '…' : fingerprint.slice(0, 8)) });
}

/** Whether a statement is the first kept under its key, or from the teacher who sent an earlier one. */
export function senderLine(t: Translate, list: readonly Received[], one: Pick<Received, 'id' | 'spki'>): string {
  const first = firstUnderKey(list, one.spki);
  return first === undefined || first.id === one.id
    ? t('reader.first')
    : t('reader.same', { day: frontDate(first.statement.day) });
}

/** Whether the statement's pack release is the newest this app has; null for a list, or a pack it lacks. */
export function packNote(t: Translate, packs: readonly PlanPack[], statement: ProgressStatement): string | null {
  const { pack } = statement;
  if (pack.release === 'own' || !packs.some((one) => one.id === pack.id)) return null;
  const newer = newerRelease(packs, pack);
  return newer === null ? t('reader.newest') : t('reader.newer', { release: isolate(newer.release) });
}

/** The statement's fields, after its day, teacher and class, with the pack's edition noted. */
export function readerLines(
  t: Translate,
  profile: CountryProfile,
  packs: readonly PlanPack[],
  statement: ProgressStatement,
  teacher: string,
): StatementLine[] {
  const note = packNote(t, packs, statement);
  return [
    { id: 'day', label: t('reader.day'), lines: [frontDate(statement.day)] },
    { id: 'teacher', label: t('reader.teacher'), lines: [teacher] },
    { id: 'class', label: t('reader.class'), lines: [statementClass(profile, statement)] },
    ...statementLines(t, profile, statement).map((line) =>
      line.id === 'pack' && note !== null ? { ...line, lines: [...line.lines, note] } : line,
    ),
  ];
}
