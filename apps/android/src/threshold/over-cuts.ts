// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which committee's room says the cut of each over exam on a teacher's list
// (#606, R-3.3-39, R-7.10-04, answer 640): for a grade and subject of the
// teacher's classes, the room of the national committee or of the school's
// directorate, with the plan that committee works from, as the seeded schools
// it covers pin it (committee-session.ts), so the cut's item is named as
// adopted; with no such plan no one could have voted, so the room is read on
// the teacher's own and holds none.

import { NATIONAL_COMMITTEE, type DemoSchool, type ExamChart, type PlanPack, type WorldExam } from '@minhajna/core';
import { committeeRooms, type CommitteeRoom } from './committee-session';
import type { OwnExam } from './own-exams';

/** An exam's chart on the teacher's list, the room that says its cut, and the plan that names it. */
export interface OverCut {
  readonly exam: WorldExam;
  readonly chart: OwnExam['charts'][number];
  readonly room: CommitteeRoom;
  readonly plan: Pick<ExamChart, 'pack' | 'items'>;
}

/** Each chart of the over exams with its committee's room. */
export function overCuts(
  world: string,
  over: readonly OwnExam[],
  directorate: string,
  seeded: readonly Pick<DemoSchool, 'classes' | 'directorateId'>[],
  packs: readonly PlanPack[],
): OverCut[] {
  return over.flatMap(({ exam, charts }) => {
    const national = exam.setBy === 'national';
    const scope = national ? NATIONAL_COMMITTEE : directorate;
    const schools = national ? seeded : seeded.filter((one) => one.directorateId === directorate);
    return charts.map((chart) => {
      const found = committeeRooms({ world, scope }, exam, chart.grade, schools, packs).find(
        (one) => one.subject === chart.subject,
      );
      if (found !== undefined) {
        return { exam, chart, room: found.room, plan: { pack: found.plan, items: found.room.items } };
      }
      const name = { world, scope, exam: exam.id, subject: chart.subject, grade: chart.grade };
      const days = { from: exam.figuresDay, to: exam.signBy };
      return { exam, chart, room: { name, items: chart.items, days, lastDay: exam.to }, plan: chart };
    });
  });
}
