// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each line of «سجل النشاط» in words (#235, Log, answer 425): the book, the
// class, the session's day and what changed, a pupil by their number on the
// class list, never by name; a document by its title and the period its file is
// named after, or a term by its name (#239); an erasure by the kinds it
// removed. Names come from the records the line follows, so a class that has
// gone shows as a dash.

import {
  parsePackId,
  type CountryProfile,
  type Day,
  type LogCategory,
  type LogItem,
  type LogLine,
  type SessionRef,
  type State,
} from '@minhajna/core';
import { listNumbers } from '../roll/roll-rules';
import { gradeName, localized } from '../setup/names';
import { documentKind } from '../documents/catalogue';
import type { Translate } from '../documents/document-data';
import { termWord } from '../marks/marks-rules';
import type { Language } from '../text/i18n';
import { shortDay } from '../today/outcome-rules';
import { isolate } from '../week/grid-labels';

/** What a line needs to name classes, pupils and months. */
export interface LogNames {
  readonly state: State;
  readonly profile: CountryProfile;
  readonly lang: Language;
}

/** A day as the log heads it, such as «04/10/2026». */
export function logDay(day: Day): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** The tab a line is listed under, or «لا يُتحقق منه» for an unchecked change. */
export function categoryLabel(t: Translate, category: LogCategory | null): string {
  return category === null ? t('log.unchecked') : t(`log.tabs.${category}`);
}

const KIND_GROUPS: Readonly<Record<string, string>> = {
  'session.recorded': 'session',
  'session.withdrawn': 'session',
  'session.noted': 'privateNote',
  'roll-call.taken': 'rollCall',
  'lesson-note.set': 'lessonNote',
  'pupil.set': 'pupil',
  'pupil.moved': 'pupil',
  'homework.counted': 'homework',
  'homework.uncounted': 'homework',
  'print.recorded': 'print',
  'output.recorded': 'print',
  'assessment.set': 'assessment',
};

/** A kind of record in words, such as «ملاحظة خاصة»; any other kind is «تغيير». */
export function kindLabel(t: Translate, kind: string): string {
  return t(`log.kinds.${KIND_GROUPS[kind] ?? 'other'}` as 'log.kinds.other');
}

function className(names: LogNames, classId: string | undefined): string {
  const name = classId === undefined ? undefined : names.state.classes.get(classId)?.name;
  return name === undefined ? '—' : isolate(name);
}

function sessionHead(t: Translate, names: LogNames, session: SessionRef): string {
  const classId = names.state.courses.get(session.courseId)?.classId;
  return [t('log.textsBook'), className(names, classId), shortDay(t, session.day)].join(' · ');
}

/** A period as a file is named after it: a day, a month in the profile's names, or a school year. */
export function periodLabel(names: LogNames, period: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return logDay(period as Day);
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const month = names.profile.months?.[Number(period.slice(5, 7)) - 1]?.[names.lang];
  return month === undefined ? period : `${month} ${period.slice(0, 4)}`;
}

const OWN_TITLES = {
  'book-fixes': 'bookFixes.title',
  'marks-justify': 'marks.justify.title',
  'mark-sheet': 'documents.markSheet.name',
  'sept-check': 'septCheck.title',
  'stale-question': 'staleQuestion.title',
} as const;

/** A document's title: the Documents tab's, a screen's own printed page, a re-pace draft, or «وثيقة». */
function documentTitle(t: Translate, id: string): string {
  const own = OWN_TITLES[id as keyof typeof OWN_TITLES];
  if (own !== undefined) return t(own);
  if (id.startsWith('repace:')) return t('repace.title');
  return documentKind(id)?.title(t) ?? t('log.document');
}

/** A list as the language writes it, each entry once: «،» in Arabic, a comma in the others. */
const list = (names: LogNames, entries: readonly string[]) =>
  [...new Set(entries)].join(names.lang === 'ar' ? '، ' : ', ');

/** A signed plan by its subject and year, as its ID names them; the ID itself when it names neither. */
function packName(names: LogNames, id: string): string {
  const parts = parsePackId(id);
  if (parts === null) return id;
  const subject = names.profile.subjects.find((one) => one.code === parts.subject);
  const named = subject === undefined ? parts.subject : localized(subject.name);
  return `${named} · ${gradeName(names.profile, parts.grade)}`;
}

/** One line in words. */
export function lineText(t: Translate, names: LogNames, line: LogLine): string {
  switch (line.kind) {
    case 'session-corrected': {
      const what =
        line.fields.length === 0
          ? t('log.recordedAgain')
          : list(
              names,
              line.fields.map((field) => t(`log.fields.${field}`)),
            );
      const reason = line.reason === undefined ? [] : [t('log.reason', { reason: t(`fix.reasons.${line.reason}`) })];
      return [sessionHead(t, names, line.session), what, ...reason].join(' · ');
    }
    case 'session-withdrawn':
      return [sessionHead(t, names, line.session), t('log.withdrawn')].join(' · ');
    case 'roll-call-corrected': {
      const numbers = listNumbers(names, line.classId);
      const changes = line.changes.map((change) => {
        const marks = { from: t(`log.marks.${change.from}`), to: t(`log.marks.${change.to}`) };
        const number = numbers.get(change.pupilId);
        return number === undefined ? t('log.pupilGone', marks) : t('log.pupil', { ...marks, number });
      });
      const reason = line.reason === undefined ? [] : [t('log.reason', { reason: t(`roll.reasons.${line.reason}`) })];
      return [t('log.rollCall'), className(names, line.classId), shortDay(t, line.day), ...changes, ...reason].join(
        ' · ',
      );
    }
    case 'printed':
      return t('log.printed', {
        documents: list(
          names,
          line.documents.map((id) => documentTitle(t, id)),
        ),
      });
    case 'output': {
      const { document, period, how, blank } = line.output;
      const made = how === 'print' ? t('log.print') : how.toUpperCase();
      const term = /^term-(\d)$/.exec(period);
      const when = term === null ? periodLabel(names, period) : termWord(t, Number(term[1]));
      return [documentTitle(t, document), when, made, ...(blank ? [t('log.blank')] : [])].join(' · ');
    }
    case 'calendar-update':
      return t('log.calendar', { release: line.release });
    case 'pack-added':
      return t('log.pack', { pack: packName(names, line.pack), release: line.release });
    case 'layer-added':
      return t('log.layer', { title: line.title });
    case 'erased':
      return t('log.erased', {
        what: list(
          names,
          line.kinds.map((kind) => kindLabel(t, kind)),
        ),
      });
    case 'unverified':
      return t('log.unverified', { what: kindLabel(t, line.entryKind) });
  }
}

/** Each item's tab and words, for a screen to list. */
export function itemText(t: Translate, names: LogNames, item: LogItem): { tag: string; text: string } {
  return { tag: categoryLabel(t, item.category), text: lineText(t, names, item.line) };
}
