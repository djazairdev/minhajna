// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes the insights stop for in a national world (#624, answer 695):
// for each school space this device joined, the classes of the seeded teacher
// whose assignment the code names, worked out as the director's device works
// it out (answer 597), in the order the world's school lists them, each in
// that school's space from the day the join's certificate was given. A join
// whose classes are not known, as no seeded teacher holds its assignment or
// the teacher has none, gives one row for the teacher's classes there, named
// by the world's school when another join showed the space is its own, or
// else by the space's ID shortened; so does every join when the working out
// fails (joinRows).

import { assignmentId, type Day, type DemoSchool, type SpaceJoin, type WorldMac } from '@minhajna/core';

/** A class the insights stop for: its name, or null for all the teacher's classes in a space, and where. */
export interface StoppedClass {
  readonly name: string | null;
  /** The world's school, or null for a space not known to be it. */
  readonly school: DemoSchool | null;
  readonly space: string;
  readonly assignment: string;
  readonly since: Day;
}

/** One row for each join, its classes not known, named by the world's school where the space is known to be it. */
export function joinRows(
  joins: readonly SpaceJoin[],
  school: DemoSchool | null = null,
  known: ReadonlySet<string> = new Set(),
): StoppedClass[] {
  return joins.map((join) => ({
    name: null,
    school: known.has(join.school) ? school : null,
    space: join.school,
    assignment: join.assignment,
    since: join.since,
  }));
}

/** The classes of every space joined, one row for a join whose classes are not known. */
export async function stoppedClasses(
  joins: readonly SpaceJoin[],
  school: DemoSchool | null,
  mac: WorldMac,
): Promise<StoppedClass[]> {
  if (school === null) return joinRows(joins);
  const found = await Promise.all(
    joins.map(async (join) => {
      const ids = await Promise.all(school.teachers.map((one) => assignmentId(join.school, one.id, mac)));
      const teacher = school.teachers[ids.indexOf(join.assignment)];
      return school.classes.filter((one) => teacher?.classIds.includes(one.id) === true);
    }),
  );
  const known = new Set(joins.filter((_, at) => found[at].length > 0).map((join) => join.school));
  return joins.flatMap((join, at) => {
    const classes = found[at];
    if (classes.length === 0) return joinRows([join], school, known);
    const base = { school, space: join.school, assignment: join.assignment, since: join.since };
    return classes.map((one) => ({ ...base, name: one.name }));
  });
}
