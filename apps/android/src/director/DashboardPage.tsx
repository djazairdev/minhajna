// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's dashboard in an open demo world (#569, #548, answer 625): the
// dashboard (DirectorDashboard.tsx) given which teachers have joined the
// school's space, as this device reads it (use-joined-teachers.ts), with what
// is said of that reading, and reading it again after a problem.

import type { CountryProfile, Day, DemoSchool, TrialTerm } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { DirectorDashboard } from './DirectorDashboard';
import { useJoinedTeachers } from './use-joined-teachers';

export type DashboardPageProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly profile: CountryProfile;
  readonly trial: TrialTerm | null;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

/** The director's dashboard, with the teachers this device reads as joined. */
export function DashboardPage({ world, school, profile, trial, kit, send, dayText }: DashboardPageProps) {
  const read = useJoinedTeachers(world, school, kit, send);
  return (
    <DirectorDashboard
      school={school}
      profile={profile}
      when={{ trial, date: world.date }}
      dayText={dayText}
      joined={(id) => read.joined.has(id)}
      note={read.note}
      problem={read.problem}
      onAgain={read.again}
    />
  );
}
