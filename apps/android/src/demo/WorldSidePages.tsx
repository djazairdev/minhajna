// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pages a world's home opens over itself (DemoRoot.tsx): the teacher and
// the inspector open reader mode inside the world (#563), where reader mode's
// own back button leads back and Android's back is its own; the teacher of a
// national world opens School-join (#564), in its trial term end while the
// world's date falls in it (#565), with the country's calendar and bells read
// for the world's school (school-mine-session.ts), whose term and closures the
// teacher's classes count (#584), and signs in on a staffroom PC (#572): on the
// phone it approves a PC's code, and on the PC it is the staffroom PC itself.
// The teacher's insights page comes from use-world-insights.tsx, with each
// class's exact sending in a teachers' world (#622).

import type { CalendarUpdate, Day, SchoolCalendar, TrialTerm } from '@minhajna/core';
import type { ReactNode } from 'react';
import type { useDirectorSchool } from '../director/director-world';
import type { ReferenceResult } from '../reference';
import type { SchoolJoinProps } from '../school/school-join-props';
import { SchoolJoin } from '../school/SchoolJoin';
import { PcApprove } from '../staff/PcApprove';
import { StaffPc } from '../staff/StaffPc';
import { onPc } from '../text/device-text';
import { mineOf } from '../week/school-mine-session';
import type { OpenWorld, WorldRole } from './world-mode';
import type { Send, WorldKit } from './world-session';
import { WorldReader } from './WorldReader';

export type WorldSidePageProps = {
  readonly open: OpenWorld;
  readonly role: WorldRole | null;
  readonly joining: boolean;
  readonly staff: boolean;
  readonly reading: boolean;
  readonly insights: ReactNode;
  readonly school: ReturnType<typeof useDirectorSchool>;
  readonly reference: Extract<ReferenceResult, { ok: true }> | undefined;
  readonly calendar: SchoolCalendar;
  readonly updates: readonly CalendarUpdate[] | undefined;
  readonly committees: SchoolJoinProps['committees'];
  readonly trial: TrialTerm | null;
  readonly date: string;
  readonly dayText: (day: Day) => string;
  readonly kit: WorldKit;
  readonly send: Send | undefined;
  readonly onClose: () => void;
};

/** The page open over the world's home, or null on the home itself. */
export function worldSidePage(props: WorldSidePageProps): ReactNode {
  const { open, role, joining, staff, reading, insights, school, reference, calendar } = props;
  const { updates, committees, trial, date, dayText, kit, send, onClose } = props;
  if (joining && open.kind === 'national')
    return (
      <SchoolJoin
        world={open}
        date={date}
        dayText={dayText}
        kit={kit}
        send={send}
        trial={trial}
        year={calendar.year.id}
        workingDays={reference?.profile.workingDays}
        subjects={reference?.profile.subjects}
        mine={reference && mineOf(reference, calendar, school)}
        school={school}
        reference={reference}
        updates={updates}
        committees={committees}
        onClose={onClose}
      />
    );
  if (staff && open.kind === 'national' && school !== null && reference !== undefined)
    return onPc() ? (
      <StaffPc
        world={open}
        school={school}
        profile={reference.profile}
        date={date}
        dayText={dayText}
        kit={kit}
        send={send}
        onClose={onClose}
      />
    ) : (
      <PcApprove world={open} school={school} date={date} kit={kit} send={send} onClose={onClose} />
    );
  if (insights !== null && role === 'teacher') return insights;
  if (reading && reference !== undefined)
    return <WorldReader world={open} date={date} reference={reference} random={kit.random} onClose={onClose} />;
  return null;
}
