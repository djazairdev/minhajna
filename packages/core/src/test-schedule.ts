// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's test schedule (#221, PRD §4.7, R-4.7-09, R-4.7-34, answer
// 268): each test has its date and its slot, chosen from the class's
// sessions, and takes that session. It becomes a fixed point of the plan:
// the session it takes proposes no lesson, so the lessons flow around it,
// skipping holidays as they always do. Tests come from the teacher, never
// from the pack. A test the teacher marks common is shared with other
// classes; the school's own calendar does not feed it yet.

import type { Day } from './day.ts';
import type { Slot } from './records.ts';

/** The session type a scheduled test gives its session, which proposes no lesson. */
export const TEST_SESSION_TYPE = 'test';

export interface ScheduledTest {
  readonly id: string;
  readonly courseId: string;
  readonly day: Day;
  readonly slot: Slot;
  /** The group whose session it takes, the whole class's for a whole-class test. */
  readonly groupId: string;
  /** The teacher's own name for it, such as «الفرض الأول». */
  readonly title: string;
  /** Shared with other classes, such as «الفرض المشترك». */
  readonly common?: boolean;
}
