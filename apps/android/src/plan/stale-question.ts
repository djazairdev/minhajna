// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سؤال المفتش» about a stale pack (#230, Plan-stale, answers 382 and 384):
// a sheet the teacher prints and shows the inspector, never sent. The
// school, the year and the date; the teacher and the subject; the classes
// of the teacher's at the same school pinned to the same release; the pack,
// its issuer and edition, its release, its status and where its file was
// found; the reason it is stale;
// the question, which plan to follow until a release in force comes out;
// and boxes for the teacher's signature and the inspector's answer and
// stamp, both by hand. It holds no pupils' data. The screen and the printed
// page read the same sheet.

import { courseGrade, courseSetup, formatDay, type Context, type Day } from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { localized } from '../setup/names';
import { isolate } from '../week/grid-labels';
import { groupName } from './pack-labels';

export interface StaleSheet {
  /** The school and the year, and the print day. */
  readonly school: string;
  readonly date: string;
  /** The teacher and the subject, then the classes on the pack. */
  readonly who: string;
  readonly classes: string;
  readonly pack: readonly string[];
  /** The pack's reason, or a line saying it gives none. */
  readonly reason: string;
}

/** The inspector's sheet for `courseId`'s stale pack, as of `day`; null when its pack is not stale. */
export function staleSheet(context: Context, t: Translate, courseId: string, day: Day): StaleSheet | null {
  const { state, ref } = context;
  const known = state.courses.get(courseId);
  if (known === undefined || !state.classes.has(known.classId)) return null;
  const setup = courseSetup(context, courseId);
  const { pack, course, schoolClass } = setup;
  const pin = course.pack;
  if (pack === null || pin === null || !setup.packStale) return null;
  const names = [...state.courses.values()]
    .filter((one) => one.year === course.year && one.pack?.id === pin.id && one.pack.release === pin.release)
    .flatMap((one) => {
      const own = state.classes.get(one.classId);
      return own === undefined || own.schoolId !== schoolClass.schoolId ? [] : [own.name];
    })
    .sort((a, b) => a.localeCompare(b, 'ar'));
  const school = state.schools.get(schoolClass.schoolId);
  const found = pack.provenance.foundAt?.trim();
  const year = isolate(`${ref.year.from.slice(0, 4)}-${ref.year.to.slice(0, 4)}`);
  return {
    school: t('septCheck.school', { school: isolate(school?.name ?? ''), year }),
    date: t('septCheck.date', { day: isolate(formatDay(day)) }),
    who: t('septCheck.who', {
      name: isolate(state.personal?.name?.trim() || '…………………'),
      subject: groupName(t, ref.country, { grade: courseGrade(course, schoolClass), subject: course.subject }),
    }),
    classes: t('staleQuestion.classes', {
      count: new Set(names).size,
      classes: [...new Set(names)].map((name) => isolate(name)).join(t('septCheck.and')),
    }),
    pack: [
      [pack.provenance.issuer, pack.provenance.edition]
        .filter((one) => one.trim() !== '')
        .map(isolate)
        .join(' · '),
      `${isolate(pack.id)} · ${t('plan.release', { release: isolate(pack.release) })}`,
      t('plan.status.stale'),
      found === undefined || found === '' ? '' : t('staleQuestion.foundAt', { place: isolate(found) }),
    ].filter((line) => line !== ''),
    reason: pack.staleReason === undefined ? t('staleQuestion.noReason') : localized(pack.staleReason),
  };
}
