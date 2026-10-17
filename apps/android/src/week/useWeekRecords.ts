// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The courses and classes a drawing needs (#28). A class's slots go to its
// course for the year and subject, made and saved the first time it is
// drawn, and a class gets its two half-groups the first time one is chosen.
// Both are kept here until the saved state has them, so the grid names them
// at once, and so two items saved together make one course or one pair.

import type { Course, SchoolClass } from '@minhajna/core';
import { useRef, useState } from 'react';
import { useAppData } from '../storage/AppData';
import { courseFor } from './week-rules';
import { withHalves } from './slot-rules';

/** Lookups that see what this drawing made, and the ways to make it. */
export function useWeekRecords() {
  const { state, year, record, newId } = useAppData();
  const [courses, setCourses] = useState<ReadonlyMap<string, Course>>(new Map());
  const [classes, setClasses] = useState<ReadonlyMap<string, SchoolClass>>(new Map());
  const madeCourses = useRef(new Map<string, Course>());
  const madeClasses = useRef(new Map<string, SchoolClass>());
  const course = (id: string) => state.courses.get(id) ?? courses.get(id);
  const schoolClass = (id: string) => classes.get(id) ?? state.classes.get(id);
  const classOf = (courseId: string) => {
    const found = course(courseId);
    return found && schoolClass(found.classId);
  };
  const courseOfClass = (classId: string, subject?: string) => {
    const target = madeClasses.current.get(classId) ?? state.classes.get(classId);
    if (target === undefined) return undefined;
    const kept = [...madeCourses.current.values()].find(
      (item) => item.classId === classId && (subject === undefined || item.subject === subject),
    );
    if (kept !== undefined) return kept;
    const { course: made, isNew } = courseFor(state, target, year, newId, subject);
    if (isNew) {
      record({ kind: 'course.set', course: made });
      madeCourses.current.set(made.id, made);
      setCourses(new Map(madeCourses.current));
    }
    return made;
  };
  const halves = (classId: string, names: readonly [string, string]) => {
    const target = madeClasses.current.get(classId) ?? state.classes.get(classId);
    if (target === undefined) return undefined;
    const { schoolClass: split, added } = withHalves(target, names, newId);
    if (added) {
      record({ kind: 'class.set', schoolClass: split });
      madeClasses.current.set(split.id, split);
      setClasses(new Map(madeClasses.current));
    }
    return split;
  };
  return { lookup: { course, schoolClass }, classOf, courseOfClass, halves };
}
