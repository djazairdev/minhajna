// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «طباعة الأسبوع» prints (#215, Print-set, R-3.8-52 to R-3.8-56): the
// documents it lists, those with something new since their last print
// ticked first; each ticked document's copies for its range, as recorded,
// then its blank version when the teacher asks for one; the record the
// print leaves; and each document's line, such as «ما جدّ منذ آخر طباعة ·
// من 15 أكتوبر إلى 22 أكتوبر · 3 صفحات». A ticked document with nothing in
// its range prints only its blank version, if asked, and leaves no record.

import { formatDayWithMonth, type PrintedDocument } from '@minhajna/core';
import { DOCUMENTS, type DocumentId, type DocumentKind } from './catalogue';
import { monthLabel, type DocumentData, type Translate } from './document-data';
import { covered, PRINT_UNITS, type Covered, type PrintRange } from './print-ranges';
import { bookCount, type SetDocument } from './print-set';
import { inForce } from './timetable-pages';

/** A document the screen lists, and what is new in it since its last print. */
export interface WeekEntry {
  readonly kind: DocumentKind;
  readonly news: Covered | null;
}

/** A ticked document: its range, and its layout for a journal. */
export interface WeekChoice {
  readonly id: DocumentId;
  readonly range: PrintRange;
  readonly layout?: string;
}

/** The set as the screen prints it: its documents, the record it leaves, and each document's number of books. */
export interface WeekSet {
  readonly ids: readonly DocumentId[];
  readonly documents: readonly SetDocument[];
  readonly printed: readonly PrintedDocument[];
  readonly books: readonly number[];
}

/** The documents the set can hold, for this teacher, in the Documents tab's order. */
export function weekEntries(data: DocumentData): WeekEntry[] {
  return DOCUMENTS.filter(
    (kind) => PRINT_UNITS[kind.id] !== undefined && (kind.shown?.(data) ?? true) && !kind.empty(data),
  ).map((kind) => ({ kind, news: covered(data, data.state, kind.id, { kind: 'new' }) }));
}

/** The ticked documents' copies for their ranges, with their blank versions when `blank`. */
export function weekSet(data: DocumentData, t: Translate, choices: readonly WeekChoice[], blank: boolean): WeekSet {
  const ids: DocumentId[] = [];
  const documents: SetDocument[] = [];
  const printed: PrintedDocument[] = [];
  for (const choice of choices) {
    const kind = DOCUMENTS.find((one) => one.id === choice.id);
    if (kind === undefined) continue;
    const found = covered(data, data.state, choice.id, choice.range);
    const copies = (found?.days ?? []).map((day) => kind.pages({ ...data, day }, t, false, choice.layout));
    if (blank && kind.blankLine(t) !== null) copies.push(kind.pages(data, t, true, choice.layout));
    if (copies.length === 0) continue;
    if (found !== null) printed.push(found.printed);
    ids.push(choice.id);
    documents.push({ landscape: kind.landscape, pupils: kind.pupils, copies });
  }
  return { ids, documents, printed, books: documents.map((document) => bookCount([document])) };
}

/** Each document's pages, from each book's: its books' pages added up, in the set's order. */
export function documentPages(set: WeekSet, counts: readonly number[]): Map<DocumentId, number> {
  const pages = new Map<DocumentId, number>();
  let at = 0;
  set.ids.forEach((id, index) => {
    const books = set.books[index];
    pages.set(
      id,
      counts.slice(at, at + books).reduce((sum, count) => sum + count, 0),
    );
    at += books;
  });
  return pages;
}

/** What a range covers, said: the days, the months, or the timetable's version. */
function what(data: DocumentData, t: Translate, kind: DocumentKind, found: Covered): string {
  const unit = PRINT_UNITS[kind.id];
  const day = (one: string) => formatDayWithMonth(one as Covered['days'][number], data.lang, data.profile);
  if (unit === 'version') return inForce(t, found.printed.from);
  if (unit === 'year') return '';
  if (unit === 'month') return found.days.map((one) => monthLabel(data, one)).join(t('documents.journalFront.and'));
  const [first, last] = [found.days[0], found.days[found.days.length - 1]];
  return first === last ? day(first) : t('documents.printWeek.fromTo', { from: day(first), to: day(last) });
}

/** A document's line: its range, what it covers unless its month says it, or that nothing is new, and its pages. */
export function entryLine(
  data: DocumentData,
  t: Translate,
  kind: DocumentKind,
  range: PrintRange,
  pages: number | undefined,
): string {
  const found = covered(data, data.state, kind.id, range);
  const said =
    range.kind === 'new'
      ? t('documents.printWeek.new')
      : range.kind === 'month'
        ? monthLabel(data, `${range.month}-01` as Covered['days'][number])
        : t('documents.printWeek.fromTo', {
            from: formatDayWithMonth(range.from, data.lang, data.profile),
            to: formatDayWithMonth(range.to, data.lang, data.profile),
          });
  const parts = [
    said,
    found === null
      ? t('documents.printWeek.nothing')
      : range.kind === 'month' && PRINT_UNITS[kind.id] === 'month'
        ? ''
        : what(data, t, kind, found),
    pages === undefined || found === null ? '' : t('documents.printWeek.pages', { count: pages }),
  ];
  return parts.filter((part) => part !== '').join(' · ');
}
