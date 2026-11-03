// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far the classes of each grade got in a subject's plan on an announced
// day, added up from the schools' shares (#601, answers 628 and 631), never one
// share's: for each directorate and the nation, by subject and grade, the
// teachers, the classes and the schools that hold them, and by plan item how
// many classes reached it, with how many schools. A grade is a figure under the
// floors like the rest, in an exact check (floors.ts) of each subject's grades,
// apart from the other subjects' so it stays quick: the subject's figures, as
// the figures' check left them, a figure it hid going in as covering one school
// and no teacher so it stays hidden; its grades; and their sums, a figure's
// grades adding up to its classes, taken as equal though a class with no plan
// has no grade, which only hides more, the directorates' grades to the
// nation's, and the directorates' figures to the nation's. So no hidden grade
// is worked out by subtraction, even when that hides a subject's own figure, as
// when a directorate's one grade in it is under the floor, and the figures'
// check then runs again (share-sums.ts); and a grade shown is still hidden
// where it is shown under that view's floor. An item is hidden where its grade
// is hidden, or where some but fewer schools than the floor's reached it, an
// item no school reached showing as none, and another, the fewest schools'
// first, among those some school reached when there are any, when one alone of
// the nation's and the directorates' would be hidden, since the nation adds
// them up; the cells, items and groups are taken in order of their names, so
// the same shares always hide the same. A known limit: the subject's check
// takes a figure holding no grade as fixed at zero, which the figures' check
// does not see, so it may protect a figure with one whose classes only that
// structure gives; using it would take knowing which grades a hidden figure
// holds, which no view shows, while one check of every sum at once takes
// minutes at four dozen directorates. A hidden grade or item is null. The
// counts are added up in maps, so no name a share holds can reach an object's
// own properties.

import { FLOORS, hiddenCells, passesFloor, type FloorCell, type FloorScope } from './floors.js';
import type { Share } from './share-read.js';

/** A grade's teachers, classes and schools in a subject, and by item how many classes reached it, null when hidden. */
export interface GradeTotal {
  readonly teachers: number;
  readonly classes: number;
  readonly schools: number;
  readonly items: Record<string, number | null>;
}

interface Count {
  classes: number;
  schools: number;
}

interface Adding extends Count {
  teachers: number;
  readonly items: Map<string, Count>;
}

const NATION = '';
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const scopeOf = (id: string): FloorScope => (id === NATION ? 'national' : 'directorate');
const gradeKey = (id: string, subject: string, grade: string) => JSON.stringify([id, subject, grade]);

/** What a figure the figures' check hid covers in a subject's grades' check, so it stays hidden there. */
export const HIDDEN = { teachers: 0, schools: 1 } as const;

/** A day's reach added up, the floors' check of each subject's grades, and what each view shows of it. */
export interface SummedReach {
  /** The subjects that some share gives grades for, in order. */
  readonly subjects: readonly string[];
  /** What the check of a subject's grades hides, given the nation's and the directorates' figures for it. */
  hiddenFor(subject: string, figures: readonly FloorCell[], hidden: ReadonlySet<string>): ReadonlySet<string>;
  /** By grade, a directorate's or, for '', the nation's, with `hidden` the checks' answer; undefined when none. */
  grades(
    id: string,
    subject: string,
    scope: FloorScope,
    hidden: ReadonlySet<string>,
  ): Record<string, GradeTotal | null> | undefined;
}

/** Adds up the shares' grades, each figure's grades summing to its cell named by `figure`. */
export function sumReach(shares: readonly Share[], figure: (id: string, subject: string) => string): SummedReach {
  const figures = new Map<string, Map<string, Adding>>();
  const add = (
    id: string,
    subject: string,
    grade: string,
    count: Omit<Adding, 'items'>,
    items: Iterable<[string, Count]>,
  ) => {
    const key = JSON.stringify([id, subject]);
    const grades = figures.get(key) ?? figures.set(key, new Map()).get(key)!;
    const held =
      grades.get(grade) ?? grades.set(grade, { teachers: 0, classes: 0, schools: 0, items: new Map() }).get(grade)!;
    held.teachers += count.teachers;
    held.classes += count.classes;
    held.schools += count.schools;
    for (const [item, one] of items) {
      const sum = held.items.get(item) ?? { classes: 0, schools: 0 };
      held.items.set(item, { classes: sum.classes + one.classes, schools: sum.schools + one.schools });
    }
  };
  for (const share of shares) {
    for (const [subject, one] of Object.entries(share.subjects)) {
      for (const [grade, reach] of Object.entries(one.grades ?? {})) {
        const items = Object.entries(reach.items).map(([item, classes]): [string, Count] => [
          item,
          { classes, schools: classes > 0 ? 1 : 0 },
        ]);
        add(share.directorate, subject, grade, { teachers: reach.teachers, classes: reach.classes, schools: 1 }, items);
      }
    }
  }
  for (const [key, grades] of [...figures]) {
    const [id, subject] = JSON.parse(key) as [string, string];
    for (const [grade, one] of grades) if (id !== NATION) add(NATION, subject, grade, one, one.items);
  }
  const all = [...figures]
    .flatMap(([key, grades]) => {
      const [id, subject] = JSON.parse(key) as [string, string];
      return [...grades].map(([grade, one]) => ({ id, subject, grade, one, key: gradeKey(id, subject, grade) }));
    })
    .sort((a, b) => byName(a.key, b.key));
  type Cell = (typeof all)[number];
  const groupBy = (cells: readonly Cell[], by: (cell: Cell) => string) => {
    const held = new Map<string, Cell[]>();
    for (const cell of cells) {
      const list = held.get(by(cell)) ?? held.set(by(cell), []).get(by(cell))!;
      list.push(cell);
    }
    return [...held].sort(([a], [b]) => byName(a, b)).map(([, group]) => group);
  };
  const toCell = ({ id, one, key }: Cell): FloorCell => ({
    id: key,
    scope: scopeOf(id),
    teachers: one.teachers,
    schools: one.schools,
  });
  const ofSubject = (subject: string) => all.filter((cell) => cell.subject === subject);
  const hiddenFor = (subject: string, figures: readonly FloorCell[], hidden: ReadonlySet<string>) => {
    const own = ofSubject(subject);
    const cells = [...figures.map((one) => (hidden.has(one.id) ? { ...one, ...HIDDEN } : one)), ...own.map(toCell)];
    const rows = groupBy(own, (cell) => cell.id).map((group) => ({
      total: figure(group[0]!.id, subject),
      parts: group.map((cell) => cell.key),
    }));
    const columns = groupBy(own, (cell) => cell.grade).flatMap((group) => {
      const parts = group.filter((cell) => cell.id !== NATION).map((cell) => cell.key);
      const nation = group.find((cell) => cell.id === NATION);
      return nation === undefined || parts.length === 0 ? [] : [{ total: nation.key, parts }];
    });
    const [nation, ...directorates] = figures.map((one) => one.id);
    const column = directorates.length === 0 ? [] : [{ total: nation!, parts: directorates }];
    return hiddenCells(cells, [...rows, ...columns, ...column]);
  };
  const offItems = new Map<ReadonlySet<string>, Set<string>>();
  const itemsHidden = (hidden: ReadonlySet<string>) => {
    const done = offItems.get(hidden);
    if (done !== undefined) return done;
    const off = new Set<string>();
    for (const group of groupBy(all, (cell) => JSON.stringify([cell.subject, cell.grade]))) {
      for (const item of [...new Set(group.flatMap((cell) => [...cell.one.items.keys()]))].sort(byName)) {
        const holders = group.filter((cell) => cell.one.items.has(item));
        const schools = (cell: Cell) => cell.one.items.get(item)!.schools;
        const floor = (cell: Cell) => FLOORS[scopeOf(cell.id)].schools;
        const under = holders.filter(
          (cell) => hidden.has(cell.key) || (schools(cell) > 0 && schools(cell) < floor(cell)),
        );
        if (under.length === 1) {
          const others = holders
            .filter((cell) => cell !== under[0])
            .sort(
              (a, b) =>
                Number(schools(a) === 0) - Number(schools(b) === 0) || schools(a) - schools(b) || byName(a.key, b.key),
            );
          if (others.length > 0) under.push(others[0]!);
        }
        for (const cell of under) off.add(JSON.stringify([cell.key, item]));
      }
    }
    offItems.set(hidden, off);
    return off;
  };
  return {
    subjects: [...new Set(all.map((cell) => cell.subject))].sort(byName),
    hiddenFor,
    grades(id, subject, scope, hidden) {
      const grades = figures.get(JSON.stringify([id, subject]));
      if (grades === undefined) return undefined;
      const off = itemsHidden(hidden);
      const shown = [...grades].sort(([a], [b]) => byName(a, b));
      return Object.fromEntries(
        shown.map(([grade, one]): [string, GradeTotal | null] => {
          const key = gradeKey(id, subject, grade);
          const empty = one.teachers === 0 && one.schools === 0;
          if (hidden.has(key) || !(empty || passesFloor({ scope, ...one }))) return [grade, null];
          const items = [...one.items].sort(([a], [b]) => byName(a, b));
          const counts = items.map(([item, count]): [string, number | null] => [
            item,
            off.has(JSON.stringify([key, item])) ? null : count.classes,
          ]);
          const { teachers, classes, schools } = one;
          return [grade, { teachers, classes, schools, items: Object.fromEntries(counts) }];
        }),
      );
    },
  };
}
