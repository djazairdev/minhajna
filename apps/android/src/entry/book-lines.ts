// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a session's row in the texts book says (#34, Entry; PRD §3.8): the
// unit, the item, the stages covered, content from outside the plan, a test
// given, the homework with its due day, and the factual line. The printed
// page comes with the documents; this is the row as the book will take it.
// The homework's own words are isolated, so a French line keeps its order
// inside an Arabic one.

import { findPackItem, stageNames, type PlanPack, type SessionRecord } from '@minhajna/core';
import type { useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

export interface BookLine {
  readonly label?: string;
  readonly text: string;
}

/** A clock time as the book writes it by hand: «08سا» or «09سا45» in Arabic, 08h or 08h45 in French. */
export function bookClock(time: string, t: Translate): string {
  const [hours = '', minutes = '00'] = time.split(':');
  return t(minutes === '00' ? 'documents.textsBook.hour' : 'documents.textsBook.hourMinutes', { hours, minutes });
}

/** A session's time as the book writes it by hand, in the reading direction; none without a time. */
export function bookSpan(
  t: Translate,
  time: { readonly from: string; readonly to: string } | null,
  dir: 'rtl' | 'ltr',
) {
  return time === null ? null : span(bookClock(time.from, t), bookClock(time.to, t), dir);
}

export function bookLines(
  t: Translate,
  pack: PlanPack | null,
  record: SessionRecord,
  dayName: (day: SessionRecord['session']['day']) => string,
): BookLine[] {
  if (record.outcome === 'not-held') return [{ text: t('today.notHeld') }];
  const lines: BookLine[] = [];
  const units = new Set<string>();
  for (const cover of record.coverage) {
    const item = findPackItem(pack, cover.item);
    const title = item?.title ?? cover.item;
    const unit = item?.unit === undefined ? undefined : pack?.items.find((candidate) => candidate.id === item.unit);
    if (unit !== undefined && !units.has(unit.id)) {
      units.add(unit.id);
      lines.push({ label: t('today.unit'), text: unit.title });
    }
    if (cover.op === 'skipped') {
      lines.push({ text: t('today.skipped', { title }) });
    } else if (cover.op === 'retaught') {
      lines.push({ label: t('entry.retaught'), text: title });
    } else {
      lines.push({ label: t(cover.from > 0 ? 'today.continued' : 'today.topic'), text: title });
      const names = pack !== null && item !== undefined ? stageNames(pack, item) : [];
      for (const name of names.slice(cover.from, cover.to)) lines.push({ text: `- ${name}` });
    }
  }
  if (record.unplanned !== undefined) lines.push({ text: record.unplanned });
  if (record.test !== undefined) lines.push({ text: t('entry.bookTest') });
  if (record.homework !== undefined) {
    lines.push({
      label: t('entry.homework'),
      text: t('entry.bookHomework', { text: isolate(record.homework.text), day: dayName(record.homework.due) }),
    });
  }
  if (record.factual !== undefined) lines.push({ text: record.factual });
  return lines;
}
