// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Roll-print's books (#217, answers 260 to 265): a book's key, its name on
// the class chips, and the book it opens on, from a course, as the Month
// screen, the Class page and the Roll screen give it, or from a class, as
// the seating setup screen does.

import { courseGrade, isJoint } from '@minhajna/core';
import { courseGroup } from '../classes/class-page-rules';
import type { DocumentData } from '../documents/document-data';
import type { RollBook } from '../documents/roll-spread-pages';

export const bookKey = (book: Pick<RollBook, 'classId' | 'groupId'>) => `${book.classId}/${book.groupId}`;

/** The class's name, with its year in a joint class. */
export function bookName(data: DocumentData, book: RollBook): string {
  const schoolClass = data.state.classes.get(book.classId);
  const group = schoolClass?.groups.find((each) => each.id === book.groupId);
  return group === undefined || group.kind === 'whole'
    ? (schoolClass?.name ?? '')
    : `${schoolClass?.name ?? ''} · ${group.name}`;
}

/** The key of the book of a course, or of a class's first book, or null for the first book of all. */
export function firstBook(
  data: DocumentData,
  books: readonly RollBook[],
  from: { readonly courseId?: string; readonly classId?: string },
): string | null {
  const course = from.courseId === undefined ? undefined : data.state.courses.get(from.courseId);
  const schoolClass = course === undefined ? undefined : data.state.classes.get(course.classId);
  if (course !== undefined && schoolClass !== undefined) {
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    return bookKey({
      classId: schoolClass.id,
      groupId: courseGroup({ schoolClass, ...(grade !== undefined && { grade }) }),
    });
  }
  const first = books.find((book) => book.classId === from.classId);
  return first === undefined ? null : bookKey(first);
}
