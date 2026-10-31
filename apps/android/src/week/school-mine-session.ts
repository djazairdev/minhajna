// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What School-mine and its term report read (#584, answer 612): the joined
// school's calendar in a world, the reference's profile and bells with the
// world's calendar, for the world's school; the term that holds the world's
// date, from its first day to that date, or none between terms; the latest
// standing timetable in force, never a part for one day, for a week's figures;
// and how a course's delivery (course-delivery.ts) reads the country's calendar
// for the joined school, whose zone and level are those of the world's school
// (answer 591), with no teacher's layer: a session not held on a day the
// calendar closes the school is taken by that no-school entry, and on a school
// day by a closure or an exam window of its half of the day, every week of the
// term split by the bells of the timetable in force on the world's date, even a
// week signed under an earlier version; the afternoon starts at the first
// afternoon bell of the timetable, its morning counted by the level's bell
// template when no break splits the day, or else at the template's afternoon,
// or at noon without either; and the school's order of classes, as the
// timetable's grids read them, matched by name key.

import {
  appliesOn,
  CalendarView,
  clockMinutes,
  compareDays,
  packageSlots,
  templateFor,
  timetableNameKey,
  type BellData,
  type CountryProfile,
  type Day,
  type DeliveryReading,
  type SchoolCalendar,
  type SchoolYear,
  type SignedPart,
  type Term,
  type TimetablePart,
} from '@minhajna/core';

/** Minutes from midnight at which the afternoon starts when no bells say otherwise. */
const NOON = 12 * 60;

/** The joined school's calendar: the country's, read for the school's zone and level, with its bell data. */
export interface MineCalendar {
  readonly profile: CountryProfile;
  readonly calendar: SchoolCalendar;
  readonly bells?: BellData;
  readonly zone?: string;
  readonly level?: string;
}

/** The term holding a day, or null between terms. */
export const termOn = (year: SchoolYear, day: Day): Term | null =>
  year.terms.find((one) => compareDays(one.from, day) <= 0 && compareDays(day, one.to) <= 0) ?? null;

/** The latest standing part in force on a day, never a part for one day, or null. */
export const standingOn = (parts: readonly SignedPart[], day: Day): SignedPart | null =>
  [...parts].reverse().find((one) => !one.part.once && appliesOn(one.part, day)) ?? null;

/** Minutes from midnight at which the school's afternoon starts, by its bells and its level's template. */
export function afternoonFrom(mine: MineCalendar, bells: TimetablePart['bells']): number {
  const template = mine.bells === undefined ? null : templateFor(mine.bells, mine.level ?? '', 'single');
  const own = packageSlots(bells, template?.morning.length ?? 0);
  const first = own?.find((one) => one.half === 'afternoon');
  if (first !== undefined) return clockMinutes(first.from);
  if (own !== null) return Infinity;
  const usual = template?.afternoon[0];
  return usual === undefined ? NOON : clockMinutes(usual.from);
}

/** How a course's delivery reads the joined school's calendar, and its classes in the timetable's order. */
export function deliveryReading(
  mine: MineCalendar,
  classes: readonly string[],
  bells: TimetablePart['bells'],
): DeliveryReading {
  const reference = { country: mine.profile, year: mine.calendar.year, calendar: mine.calendar.entries };
  const view = new CalendarView({ ...reference, packs: new Map() }, []);
  const school = {
    id: 'joined-school',
    name: '',
    levels: mine.level === undefined ? [] : [mine.level],
    subjects: [],
    ...(mine.zone === undefined ? {} : { zone: mine.zone }),
  };
  const afternoon = afternoonFrom(mine, bells);
  return {
    takenBy: (day, session) => {
      const info = view.info(day, school, undefined, session.start < afternoon ? 'morning' : 'afternoon');
      if (!info.schoolDay)
        return info.entries.find((one) => one.effect === 'no-school' && one.layer !== 'teacher') ?? null;
      return info.closure ?? info.exam ?? null;
    },
    classOrder: classPlace(classes),
  };
}

/** A class's place among the timetable's classes, by name key, or undefined when it is not among them. */
export function classPlace(classes: readonly string[]): (name: string) => number | undefined {
  const keys = classes.map(timetableNameKey);
  return (name) => {
    const at = keys.indexOf(timetableNameKey(name));
    return at === -1 ? undefined : at;
  };
}

/** The joined school's calendar in a world: the reference's profile and bells, the world's calendar and school. */
export const mineOf = (
  reference: { readonly profile: CountryProfile; readonly bells: BellData },
  calendar: SchoolCalendar,
  school: { readonly wilaya?: string; readonly level?: string } | null,
): MineCalendar => ({
  profile: reference.profile,
  bells: reference.bells,
  calendar,
  zone: school?.wilaya,
  level: school?.level,
});
