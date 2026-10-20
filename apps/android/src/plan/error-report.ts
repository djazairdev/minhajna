// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A plan-error report as it leaves the phone (#225, Plan-error, R-4.3-01 to
// R-4.3-03): the pack and item IDs, the release, the kind of error, the
// teacher's note and, only if they choose credit, the name they type. Its
// text is shown as is before Android's share sheet sends it where the
// teacher picks (answers 287, 290). The app adds no class, school, pupil
// or record, the teacher card's name is never filled in for them, and the
// screen asks them not to write pupils' names in the note. Bidi controls
// are taken out of what they type; the IDs and release stay plain ASCII,
// so a curator can copy them, and only the note and name are isolated.

import type { PackItem, PlanPack } from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { shownId } from './item-rules';

type Translate = ReturnType<typeof useText>;

export const ERROR_KINDS = ['title', 'page', 'duration', 'order', 'other'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

/** The longest note and credit name a report takes. */
export const NOTE_LIMIT = 1000;
export const NAME_LIMIT = 80;

export type ErrorReport = {
  readonly pack: PlanPack;
  readonly item: PackItem;
  readonly kind: ErrorKind;
  readonly note: string;
  /** The name to credit, or undefined when the teacher does not want credit. */
  readonly name: string | undefined;
};

/** The text without bidi controls or line and paragraph separators, which could make the report read otherwise. */
export function plain(text: string): string {
  return [...text]
    .filter((char) => {
      const point = char.codePointAt(0)!;
      return !(
        point === 0x061c ||
        point === 0x200e ||
        point === 0x200f ||
        (point >= 0x2028 && point <= 0x202e) ||
        (point >= 0x2066 && point <= 0x2069)
      );
    })
    .join('');
}

/** Whether the report can be shared: a note, and a name when credit is asked for. */
export function ready(report: ErrorReport): boolean {
  return report.note.trim() !== '' && (report.name === undefined || report.name.trim() !== '');
}

/** The report's lines, in the teacher's language, exactly as they are shared. */
export function reportLines(t: Translate, report: ErrorReport): string[] {
  const { id, part } = shownId(report.item);
  const item = `${report.pack.id} · ${id}`;
  const name = report.name?.trim();
  return [
    t('planError.title'),
    t('planError.lineItem', { item: part === undefined ? item : t('planError.partOf', { item, part }) }),
    t('planError.lineRelease', { release: report.pack.release }),
    t('planError.lineKind', { kind: t(`planError.kinds.${report.kind}`) }),
    t('planError.lineNote', { note: isolate(report.note.trim()) }),
    t('planError.lineName', { name: name === undefined ? t('planError.noName') : isolate(name) }),
  ];
}
