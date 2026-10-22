// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the reorientation screen works from (#231, Reorient, R-4.7-39,
// answer 391): the classes a lycée class is reshaped with, the plan the
// screen starts from, on the day it is applied, and each new class as it would
// be: how many pupils it gets and from where, and, for each of its subjects,
// where the plan and the TD list it takes stand. The old classes' plans are
// read as of the day before, since nothing is recorded on or after it.

import {
  addDays,
  planView,
  reorientedPupils,
  type Context,
  type Day,
  type PackItem,
  type Pupil,
  type Reorientation,
  type SchoolClass,
} from '@minhajna/core';

/** The classes reshaped with `classId`: the class, then the teacher's other classes of its school and grade. */
export function reshapedWith(context: Context, classId: string): SchoolClass[] {
  const { state, ref } = context;
  const one = state.classes.get(classId);
  if (one === undefined || one.level !== 'lycee' || one.archivedFrom !== undefined) return [];
  const taught = new Set(
    [...state.courses.values()].filter((course) => course.year === ref.year.id).map((course) => course.classId),
  );
  if (!taught.has(one.id)) return [];
  const others = [...state.classes.values()]
    .filter(
      (other) =>
        other.id !== one.id &&
        other.schoolId === one.schoolId &&
        other.grade === one.grade &&
        other.archivedFrom === undefined &&
        taught.has(other.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return [one, ...others];
}

/** The plan the screen starts from, today: each old class becomes a new class of its name that takes its history. */
export function startPlan(context: Context, classId: string, today: Day): Reorientation {
  const olds = reshapedWith(context, classId);
  return {
    day: today,
    olds: olds.map((one) => one.id),
    classes: olds.map((one) => ({ name: one.name, takes: one.id })),
    pupils: new Map(),
  };
}

/** The plan with one old class taken in or left out; a class taken in becomes a new class of its name. */
export function toggleOld(plan: Reorientation, schoolClass: SchoolClass): Reorientation {
  if (!plan.olds.includes(schoolClass.id)) {
    return {
      ...plan,
      olds: [...plan.olds, schoolClass.id],
      classes: [...plan.classes, { name: schoolClass.name, takes: schoolClass.id }],
    };
  }
  const gone = plan.classes.flatMap((one, index) => (one.takes === schoolClass.id ? [index] : []));
  return removeClasses({ ...plan, olds: plan.olds.filter((id) => id !== schoolClass.id) }, gone);
}

/** The plan without the new classes at `indexes`; their pupils go back to where they would go by default. */
export function removeClasses(plan: Reorientation, indexes: readonly number[]): Reorientation {
  const shift = (to: number) => to - indexes.filter((index) => index < to).length;
  const pupils = new Map(
    [...plan.pupils].flatMap(([id, to]): [string, number | null][] =>
      to !== null && indexes.includes(to) ? [] : [[id, to === null ? null : shift(to)]],
    ),
  );
  return { ...plan, classes: plan.classes.filter((_, index) => !indexes.includes(index)), pupils };
}

export interface SubjectPreview {
  readonly subject: string;
  /** The main item the old class goes on with, and its stages covered; null without a pack. */
  readonly main: { readonly item: PackItem; readonly covered: number; readonly stages: number } | null;
  /** The TD item it goes on with, if any. */
  readonly td: PackItem | null;
}

export interface NewClassPreview {
  readonly pupils: number;
  /** Its pupils by the old class they come from, in the old classes' order. */
  readonly from: readonly { readonly schoolClass: SchoolClass; readonly pupils: number }[];
  /** The first new class to take its history gets its sessions in the timetable; another starts with none. */
  readonly first: boolean;
  readonly subjects: readonly SubjectPreview[];
}

/** Each new class as the plan would make it. */
export function previews(context: Context, plan: Reorientation): NewClassPreview[] {
  const { state } = context;
  const moved = reorientedPupils(context, plan);
  const before = addDays(plan.day, -1);
  return plan.classes.map((one, index) => {
    const mine = moved.filter(({ to }) => to === index);
    const from = plan.olds.flatMap((id) => {
      const schoolClass = state.classes.get(id);
      const pupils = mine.filter(({ pupil }) => pupil.classId === id).length;
      return schoolClass === undefined || pupils === 0 ? [] : [{ schoolClass, pupils }];
    });
    const subjects = [...state.courses.values()]
      .filter((course) => course.classId === one.takes && course.year === context.ref.year.id)
      .map((course): SubjectPreview => {
        const view = planView(context, course.id, before);
        const main = view?.main.find((row) => row.position);
        return {
          subject: course.subject,
          main: main === undefined ? null : { item: main.item, covered: main.covered, stages: main.stages },
          td: view?.td.find((row) => row.position)?.item ?? null,
        };
      });
    const first = plan.classes.findIndex((other) => other.takes === one.takes) === index;
    return { pupils: mine.length, from, first, subjects };
  });
}

/** The pupils of each old class with where they go, and how many go to each new class or to none. */
export function pupilMoves(
  context: Context,
  plan: Reorientation,
): { schoolClass: SchoolClass; pupils: { pupil: Pupil; to: number | null }[]; counts: Map<number | null, number> }[] {
  const moved = reorientedPupils(context, plan);
  return plan.olds.flatMap((id) => {
    const schoolClass = context.state.classes.get(id);
    if (schoolClass === undefined) return [];
    const pupils = moved.filter(({ pupil }) => pupil.classId === id);
    const counts = new Map<number | null, number>();
    for (const { to } of pupils) counts.set(to, (counts.get(to) ?? 0) + 1);
    return [{ schoolClass, pupils, counts }];
  });
}
