// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's dashboard in an open demo world (#569, #548, answers 625 and
// 627): the dashboard (DirectorDashboard.tsx) given which teachers have joined
// the school's space and each class's standing from its signed weeks, as this
// device reads them (use-joined-teachers.ts), with what is said of that
// reading, and reading it again after a problem; and the thresholds first
// (ThresholdCard.tsx, #603, answer 637), from the school exams' rooms the same
// reading opened and read, with a way to the thresholds page.

import type { Day, DemoSchool, TrialTerm } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import type { WorldPage } from '../demo/world-pages';
import type { Send, WorldKit } from '../demo/world-session';
import { DirectorDashboard } from './DirectorDashboard';
import type { TermReference } from './seeded-fill';
import { ThresholdCard } from './ThresholdCard';
import { useJoinedTeachers } from './use-joined-teachers';

export type DashboardPageProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  /** The reference data with the world's calendar, for the classes' packs, closures and exam days. */
  readonly reference: TermReference;
  readonly trial: TrialTerm | null;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Opens another page of the workspace. */
  readonly onPage?: (page: WorldPage) => void;
};

/** The director's dashboard, with the teachers this device reads as joined. */
export function DashboardPage(props: DashboardPageProps) {
  const { world, school, reference, trial, kit, send, dayText, onPage } = props;
  const read = useJoinedTeachers(world, school, reference, kit, send);
  return (
    <DirectorDashboard
      school={school}
      profile={reference.profile}
      when={{ trial, date: world.date }}
      dayText={dayText}
      joined={(id) => read.joined.has(id)}
      standing={read.standing}
      note={read.note}
      problem={read.problem}
      onAgain={read.again}
      threshold={
        <ThresholdCard
          date={world.date}
          school={school}
          reference={reference}
          rooms={read.rooms}
          dayText={dayText}
          {...(onPage === undefined ? {} : { onOpen: () => onPage('thresholds') })}
        />
      }
    />
  );
}
