// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pages of the PC's workspaces in a demo world that have a body yet
// (world-pages.ts), each for the roles its board lists: the director's
// dashboard on the seeded school (#569), the codes page that issues joining
// codes and security keys (#570), the keys page that maps who holds the school
// key (#571), the exchange page that maps what enters and leaves the school
// (#592, SchoolExchange.tsx), the records page that reads the classes' signed
// weeks with the school key (#585, SchoolRecords.tsx), the director's cover
// page for the world's date (#586, SchoolCover.tsx), the school's term report
// against its calendar (#589, SchoolDelivery.tsx), the director's assignments
// and access page for substitutes (#587, SchoolSubstitute.tsx), the director's
// and the preparer's timetable page (#576, #577, #578), kept for the world it
// was read in, and their own log (#573); any other page has none, and the
// preparer never opens the records or the cover; the directorate's grants page
// requests inspectors' grants from its schools (#593, DirectorateGrant.tsx);
// and the Ministry's calendar page keys a draft of the world's calendar (#607,
// MinistryCalendar.tsx), afresh over each release the world comes to hold
// (#608).

import type { Day, DemoSchool, SchoolYear, TrialTerm } from '@minhajna/core';
import type { ReactElement } from 'react';
import { DirectorDashboard } from '../director/DirectorDashboard';
import { IssueCodes } from '../director/IssueCodes';
import { OwnLog } from '../director/OwnLog';
import { SchoolCover } from '../director/SchoolCover';
import { SchoolDelivery } from '../director/SchoolDelivery';
import { SchoolExchange } from '../director/SchoolExchange';
import { SchoolKeys } from '../director/SchoolKeys';
import { SchoolRecords } from '../director/SchoolRecords';
import { SchoolSubstitute } from '../director/SchoolSubstitute';
import { DirectorateGrant } from '../directorate/DirectorateGrant';
import { subjectName } from '../extra/extra-rules';
import type { ReferenceResult } from '../reference';
import { localized } from '../setup/names';
import { TimetableDesk } from '../timetable/TimetableDesk';
import { MinistryCalendar } from '../ministry/MinistryCalendar';
import { levelBells } from '../timetable/timetable-words';
import type { TimetableRead } from '../timetable/TimetableImport';
import type { MineCalendar } from '../week/school-mine-session';
import type { WorkspaceRole, WorldPage } from './world-pages';
import type { OpenWorld } from './world-mode';
import type { Send, WorldKit } from './world-session';

export type WorkspacePagesProps = {
  readonly open: OpenWorld;
  readonly school: DemoSchool;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The trial term's end in the world's year, which the dashboard reads. */
  readonly trial: TrialTerm | null;
  /** The world's school year, whose terms the cover log counts in. */
  readonly year: SchoolYear;
  /** The school's calendar, read for its zone and level, which the term report counts against. */
  readonly mine: MineCalendar;
  /** The timetable the director or preparer read last, kept for the world it was read in. */
  readonly timetable: { readonly world: string; readonly read: TimetableRead } | null;
  readonly onTimetable: (read: TimetableRead | null) => void;
  /** Opens another page of the same workspace. */
  readonly onPage?: (page: WorldPage) => void;
};

/** A workspace page's body, or null when the page has none yet. */
export function workspacePage(
  workspace: WorkspaceRole,
  page: WorldPage,
  props: WorkspacePagesProps,
): ReactElement | null {
  const { open, school, reference, kit, send, dayText, trial, year, mine, timetable, onTimetable, onPage } = props;
  if (workspace === 'ministry' && page === 'calendar')
    return (
      <MinistryCalendar
        key={`${open.world}@${reference.calendar.release}`}
        world={open}
        reference={reference}
        kit={kit}
        dayText={dayText}
      />
    );
  if (workspace === 'directorate' && page === 'grants')
    return (
      <DirectorateGrant world={open} school={school} reference={reference} kit={kit} send={send} dayText={dayText} />
    );
  if (workspace === 'director' && page === 'dashboard')
    return (
      <DirectorDashboard
        school={school}
        profile={reference.profile}
        when={{ trial, date: open.date }}
        dayText={dayText}
      />
    );
  if (workspace === 'director' && page === 'codes')
    return (
      <IssueCodes world={open} school={school} profile={reference.profile} kit={kit} send={send} dayText={dayText} />
    );
  if (workspace === 'director' && page === 'keys')
    return <SchoolKeys world={open} school={school} kit={kit} send={send} dayText={dayText} />;
  if (workspace === 'director' && page === 'exchange')
    return (
      <SchoolExchange
        world={open}
        school={school}
        send={send}
        dayText={dayText}
        {...(onPage === undefined ? {} : { onKeys: () => onPage('keys') })}
      />
    );
  if ((workspace === 'director' || workspace === 'preparer') && page === 'log')
    return <OwnLog world={open} school={school} role={workspace} kit={kit} dayText={dayText} />;
  if ((workspace === 'director' || workspace === 'preparer') && page === 'timetable')
    return (
      <TimetableDesk
        role={workspace}
        world={open}
        school={school}
        wilaya={localized(reference.profile.zones?.find((one) => one.code === school.wilaya)?.name ?? {})}
        bells={reference.bells}
        workingDays={reference.profile.workingDays}
        read={timetable?.world === open.world ? timetable.read : null}
        onRead={onTimetable}
        kit={kit}
        send={send}
        dayText={dayText}
      />
    );
  if (workspace === 'director' && page === 'records')
    return (
      <SchoolRecords
        world={open}
        school={school}
        kit={kit}
        send={send}
        dayText={dayText}
        workingDays={reference.profile.workingDays}
      />
    );
  if (workspace === 'director' && page === 'cover')
    return <SchoolCover world={open} school={school} year={year} kit={kit} send={send} dayText={dayText} />;
  if (workspace === 'director' && page === 'delivery')
    return (
      <SchoolDelivery
        world={open}
        school={school}
        year={year}
        mine={mine}
        bells={levelBells(reference.bells, school.level)}
        kit={kit}
        send={send}
        dayText={dayText}
      />
    );
  if (workspace === 'director' && page === 'access')
    return (
      <SchoolSubstitute
        world={open}
        school={school}
        bells={levelBells(reference.bells, school.level)}
        kit={kit}
        send={send}
        dayText={dayText}
        subjectName={(code) => subjectName(reference.profile, code)}
        workingDays={reference.profile.workingDays}
      />
    );
  return null;
}
