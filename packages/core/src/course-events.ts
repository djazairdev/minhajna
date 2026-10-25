// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's course and its moves to a newer release of its pack (#322,
// answer 487), in the lesson record. A move names the release it leaves, so
// it moves only a course still on it, and a class never moves without the
// teacher's tap. Apart from course-state.ts, which applies them, so the
// events module imports no module that imports it back.

import type { Course } from './records.ts';

/** A class moved from one release of its pack to a newer one. */
export interface CourseMove {
  readonly courseId: string;
  readonly from: string;
  readonly to: string;
}

export type CourseEvent =
  | { readonly kind: 'course.set'; readonly course: Course }
  /** A class moved to a newer release, the teacher's answers recorded after it (#322). */
  | { readonly kind: 'course.moved'; readonly move: CourseMove };

export const COURSE_KINDS = { 'course.set': true, 'course.moved': true } as const;
