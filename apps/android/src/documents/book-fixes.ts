// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيحات دفتر النصوص» (Book-fixes, #218, R-3.8-16, R-5.5-02, answer 266): a
// month's corrections to the texts book, for the director's check, class by
// class or all. Each names the class, the day and the time, then what changed,
// «كان» and «أصبح»: the session's result, written as the book writes it in the
// subject's language, and its homework apart, its due day alone when only that
// moved; or an extra session's kind, day and time, listed in both months when
// it moved from one to another, under the day it stood on in each, and checked
// against page 08, where every kind prints. A withdrawn confirmation or a
// removed session says so. Then the day of the change and its reason's kind, as
// «صُحّحت يوم 01/10/2026 · السبب: …»; a reason typed in words stays in the
// private note. A note says when the page was printed before the change, to
// correct it on paper too. A change the book does not show is left out. No
// scores and no colours (R-2.6-07).

import {
  bookCorrections,
  formatDay,
  printedBefore,
  recordPack,
  type Correction,
  type CorrectionReason,
  type ExtraSession,
  type SessionRecord,
} from '@minhajna/core';
import { bookClock, bookLines, bookSpan, type BookLine } from '../entry/book-lines';
import { shortDay } from '../today/outcome-rules';
import { coreContext } from '../storage/core-context';
import { i18n } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { span } from '../times/TimeTable';
import { isolate } from '../week/grid-labels';
import type { DocumentData, Translate } from './document-data';
import { subjectLanguage, wordsFor } from './texts-book-pages';

export interface FixChange {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export interface FixItem {
  readonly key: string;
  readonly entryDay: string;
  readonly classId: string;
  readonly className: string;
  /** «الأربعاء 30/09 · 08سا – 09سا». */
  readonly when: string;
  readonly changes: readonly FixChange[];
  /** «صُحّحت يوم 01/10/2026 · السبب: خطأ في الإدخال». */
  readonly foot: string;
  /** Printed with this day before the change, so the paper needs it too. */
  readonly paper: boolean;
}

const lines = (found: readonly BookLine[]) =>
  found.map((line) => (line.label === undefined ? line.text : `${line.label}: ${line.text}`)).join('\n');

function foot(t: Translate, correction: Correction<unknown>): string {
  const reason =
    correction.reason === undefined
      ? t('bookFixes.noReason')
      : t('bookFixes.reason', { reason: t(`fix.reasons.${correction.reason as CorrectionReason}`) });
  return `${t('bookFixes.corrected', { day: formatDay(correction.day) })} · ${reason}`;
}

function sessionChanges(
  t: Translate,
  st: Translate,
  write: (record: SessionRecord) => BookLine[],
  correction: Correction<SessionRecord>,
): FixChange[] {
  const { before, after } = correction;
  if (before === null || after === null) {
    const text = (record: SessionRecord | null) =>
      record === null ? t(before === null ? 'bookFixes.unconfirmed' : 'bookFixes.withdrawn') : lines(write(record));
    return [{ label: t('bookFixes.result'), before: text(before), after: text(after) }];
  }
  const changes: FixChange[] = [];
  const result = (record: SessionRecord) => lines(write(record).filter((line) => line.label !== st('entry.homework')));
  if (result(before) !== result(after)) {
    changes.push({ label: t('bookFixes.result'), before: result(before), after: result(after) });
  }
  const homework = (record: SessionRecord) =>
    record.homework === undefined
      ? t('bookFixes.noHomework')
      : st('entry.bookHomework', { text: isolate(record.homework.text), day: formatDay(record.homework.due) });
  const due = (record: SessionRecord) =>
    st('bookFixes.due', { day: formatDay(record.homework?.due ?? before.session.day) });
  if (before.homework !== undefined && after.homework !== undefined && before.homework.text === after.homework.text) {
    if (before.homework.due !== after.homework.due) {
      changes.push({
        label: `${t('bookFixes.homework')}: ${isolate(before.homework.text)}`,
        before: due(before),
        after: due(after),
      });
    }
  } else if (homework(before) !== homework(after)) {
    changes.push({ label: t('bookFixes.homework'), before: homework(before), after: homework(after) });
  }
  return changes;
}

function extraChange(data: DocumentData, t: Translate, correction: Correction<ExtraSession>): FixChange[] {
  const { before: was, after: now } = correction;
  const kinds = was !== null && now !== null && was.kind !== now.kind;
  const text = (extra: ExtraSession | null) =>
    extra === null
      ? t('bookFixes.removed')
      : [
          ...(kinds ? [t(`extra.kinds.${extra.kind}`)] : []),
          shortDay(t, extra.day),
          span(bookClock(extra.from, t), bookClock(extra.to, t), data.dir),
        ].join(' · ');
  const kind = (now ?? was)?.kind ?? 'support';
  const before = text(correction.before);
  const after = text(correction.after);
  return before === after ? [] : [{ label: t('bookFixes.extra', { kind: t(`extra.kinds.${kind}`) }), before, after }];
}

/** The corrections to entries of `month`, written YYYY-MM, for one class or every class. */
export function bookFixes(data: DocumentData, t: Translate, month: string, classId: string | null): FixItem[] {
  const context = coreContext(data);
  const from = `${month}-01` as SessionRecord['session']['day'];
  const to = `${month}-31` as SessionRecord['session']['day'];
  const found = bookCorrections(data.state, from, to);
  const classOf = (courseId: string) => {
    const course = data.state.courses.get(courseId);
    const schoolClass = course === undefined ? undefined : data.state.classes.get(course.classId);
    return course === undefined || schoolClass === undefined ? null : { course, schoolClass };
  };
  const items: FixItem[] = [];
  for (const correction of found.sessions) {
    const where = classOf(correction.courseId);
    if (where === null || (classId !== null && where.schoolClass.id !== classId)) continue;
    const st = i18n.getFixedT(wordsFor(subjectLanguage(data.profile, where.course.subject, data.lang), data.lang));
    const write = (record: SessionRecord) => bookLines(st, recordPack(context, record), record, formatDay);
    const changes = sessionChanges(t, st, write, correction);
    if (changes.length === 0) continue;
    const session = (correction.after ?? correction.before)?.session;
    if (session === undefined) continue;
    const school = data.state.schools.get(where.schoolClass.schoolId);
    const time = bookSpan(t, sessionTime(data, school, session.slot, session.day), data.dir);
    items.push({
      key: `${correction.key}/${correction.day}/${items.length}`,
      entryDay: correction.entryDay,
      classId: where.schoolClass.id,
      className: where.schoolClass.name,
      when: [shortDay(t, session.day), time].filter((part) => part !== null).join(' · '),
      changes,
      foot: foot(t, correction),
      paper: printedBefore(data.state, 'texts', correction.entryDay, correction.day),
    });
  }
  for (const correction of found.extras) {
    const where = classOf(correction.courseId);
    if (where === null || (classId !== null && where.schoolClass.id !== classId)) continue;
    const changes = extraChange(data, t, correction);
    if (changes.length === 0) continue;
    const left = correction.entryDay.startsWith(month) ? undefined : correction.movedFrom;
    items.push({
      key: `${correction.key}/${correction.day}/${items.length}`,
      entryDay: left ?? correction.entryDay,
      classId: where.schoolClass.id,
      className: where.schoolClass.name,
      when: shortDay(t, left ?? correction.entryDay),
      changes,
      foot: foot(t, correction),
      paper: [correction.entryDay, correction.movedFrom].some(
        (day) => day !== undefined && printedBefore(data.state, 'supervised', day, correction.day),
      ),
    });
  }
  return items.sort((a, b) => (a.entryDay < b.entryDay ? -1 : a.entryDay > b.entryDay ? 1 : 0));
}
