// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What School-join takes (SchoolJoin.tsx): the world and its days, the kit and
// the way to the server, the trial term, the year, the way back, and what the
// joined card's pages need of the world: its school, its calendar, its keys and
// the bundled reference.

import type { CalendarUpdate, Day, DemoSchool, Subject, TrialTerm, Weekday } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import type { ExamThresholdsProps } from '../threshold/ExamThresholds';
import type { MineCalendar } from '../week/school-mine-session';

export type SchoolJoinProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The world's date, written out for the band. */
  readonly date: string;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The world's trial term end, inside which joining is voluntary (answer 587), or null. */
  readonly trial: TrialTerm | null;
  /** The world's school year, written as `2026-2027`. */
  readonly year: string;
  /** Back to the world's home. */
  readonly onClose: () => void;
  /** The school's days, in the week's order, offered for a timetable proposal. */
  readonly workingDays?: readonly Weekday[];
  /** The country's subjects, which give a week's subject its code. */
  readonly subjects?: readonly Subject[];
  /** The joined school's calendar, for the term School-mine counts. */
  readonly mine?: MineCalendar;
  /** The world's school, for the class lists the term's marks are sent for. */
  readonly school?: DemoSchool | null;
  /** The world's reference, which names the subjects, grades and plan items. */
  readonly reference?: TermReference;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
  /** The world's keys while it is open and the bundled reference, which read the committees' cuts of the over exams. */
  readonly committees?: ExamThresholdsProps['committees'];
};
