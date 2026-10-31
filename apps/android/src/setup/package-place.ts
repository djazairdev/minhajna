// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school's timetable package against the teacher's week, from the app's data
// (#580, Setup-5b, Setup-5d, answer 608): the school it is for, the one of the
// package's name, else the only one, else the teacher picks; the week drawn so
// far, its slots and the school's bell times now, the subjects' names in every
// language and their label in the interface's, for placing it
// (timetable-accept.ts); and the clashes of its sessions with those drawn for
// the teacher's other schools, each at that school's times, which only a new
// version from either school settles.

import {
  bellTimes,
  drawnRows,
  packageRows,
  schoolsWeek,
  timetableNameKey,
  weekGrid,
  type PackagePlace,
  type School,
  type TimetablePart,
} from '@minhajna/core';
import type { AppData } from '../storage/AppData';
import { levelOf, shiftOf } from '../times/times-rules';
import { localized } from './names';

/** The teacher's school a package is for: the one of its name, else the only one, else null. */
export function schoolFor(schools: readonly School[], part: TimetablePart): School | null {
  const named = schools.filter((one) => timetableNameKey(one.name) === timetableNameKey(part.schoolName));
  if (named.length === 1) return named[0];
  return schools.length === 1 ? schools[0] : null;
}

/** What placing a package in a school of the teacher's week needs, from the app's data. */
export function placeFor(
  data: Pick<AppData, 'state' | 'profile' | 'bells'>,
  part: TimetablePart,
  school: School,
): PackagePlace {
  const drawn = data.state.timetables.at(-1)?.version ?? null;
  const subject = (code: string) => data.profile.subjects.find((one) => one.code === code);
  return {
    part,
    school,
    classes: [...data.state.classes.values()],
    courses: [...data.state.courses.values()],
    drawn,
    slots: weekGrid(data.profile, drawn?.options).slots,
    times: (slot) =>
      bellTimes(data.bells, school, levelOf(school) ?? '', shiftOf(data.state), 'usual', [slot])[0] ?? null,
    subjects: data.profile.subjects.map((one) => one.code),
    subjectNames: (code) => Object.values(subject(code)?.name ?? {}),
    subjectLabel: (code) => {
      const found = subject(code);
      return found === undefined ? code : localized(found.name);
    },
    sessionType: 'lesson',
  };
}

/** The package's sessions against the teacher's other schools' drawn ones, each at its own times: every clash. */
export function otherClashes(
  data: Pick<AppData, 'state' | 'profile' | 'bells'>,
  place: PackagePlace,
  schools: readonly School[],
) {
  const others = schools
    .filter((one) => one.id !== place.school.id)
    .map((one) => ({ school: one.name, rows: drawnRows(placeFor(data, place.part, one)) }));
  return schoolsWeek([{ school: place.school.name, rows: packageRows(place) }, ...others]).clashes;
}
