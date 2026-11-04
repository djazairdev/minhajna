// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pages of the PC's workspaces in a demo world that have a body yet
// (world-pages.ts), each for the roles its board lists: the director's
// dashboard on the seeded school (#569), with who joined (#548) and each
// class's standing from its signed weeks (answer 627) and a way to the school's
// exam thresholds, those thresholds, where the director decides a cut that
// falls to them (#603, DirectorThresholds.tsx), the codes page that issues
// joining codes and security keys (#570), the keys page that maps who holds the
// school key (#571) and fills a taken seeded school's term from the bundled
// reference data, never the world's releases (answer 626), the exchange page
// that maps what enters and leaves the school (#592, SchoolExchange.tsx), the
// records page that reads the classes' signed weeks with the school key (#585,
// SchoolRecords.tsx), the director's cover page for the world's date (#586,
// SchoolCover.tsx), the school's term report against its calendar (#589,
// SchoolDelivery.tsx), the director's assignments and access page for
// substitutes (#587, SchoolSubstitute.tsx), the director's and the preparer's
// timetable page (#576, #577, #578), kept for the world it was read in, and
// their own log (#573); any other page has none, and the preparer never opens
// the records or the cover; the directorate's grants page requests inspectors'
// grants from its schools (#593, DirectorateGrant.tsx) and its totals page says
// what the system owes teachers on announced days, with the curriculum report
// (#598, DirectorateTotals.tsx); and the Ministry's totals page says it by
// wilaya (#599, MinistryTotals.tsx), and its calendar page keys a draft of the
// world's calendar (#607, MinistryCalendar.tsx), afresh over each release the
// world comes to hold, and publishes it with the world's keys (#608,
// MinistryCalendarPage.tsx); and the operators' system map draws the demo
// server from what it says of itself, with its version and health (#618,
// OpsConsole.tsx), and their admin and security logs and the world's problem
// reports read from it (#619, OpsAdminLog.tsx, OpsSecurity.tsx,
// OpsProblems.tsx); and the observatory's reports page, whose world has no
// school, reads a term's figures (#627, ObsReport.tsx). Only that page goes
// without a school; any other stays empty in such a world.
// The curator's pack list reads source releases only (#611, PackList.tsx).

import type { CalendarUpdate, Day, DemoSchool, SchoolYear, TrialTerm } from '@minhajna/core';
import type { ReactElement } from 'react';
import { DashboardPage } from '../director/DashboardPage';
import { DirectorThresholds } from '../director/DirectorThresholds';
import { IssueCodes } from '../director/IssueCodes';
import { OwnLog } from '../director/OwnLog';
import { SchoolCover } from '../director/SchoolCover';
import { SchoolDelivery } from '../director/SchoolDelivery';
import { SchoolExchange } from '../director/SchoolExchange';
import { SchoolKeys } from '../director/SchoolKeys';
import { SchoolRecords } from '../director/SchoolRecords';
import { SchoolSubstitute } from '../director/SchoolSubstitute';
import { DirectorateGrant } from '../directorate/DirectorateGrant';
import { DirectorateTotals } from '../directorate/DirectorateTotals';
import { PackList } from '../editor/PackList';
import { subjectName } from '../extra/extra-rules';
import type { ReferenceResult } from '../reference';
import { localized } from '../setup/names';
import { TimetableDesk } from '../timetable/TimetableDesk';
import { MinistryCalendarPage } from '../ministry/MinistryCalendarPage';
import { MinistryTotals } from '../ministry/MinistryTotals';
import { ObsReport } from '../observatory/ObsReport';
import { OpsAdminLog } from '../operators/OpsAdminLog';
import { OpsConsole } from '../operators/OpsConsole';
import { OpsProblems } from '../operators/OpsProblems';
import { OpsSecurity } from '../operators/OpsSecurity';
import { levelBells } from '../timetable/timetable-words';
import type { TimetableRead } from '../timetable/TimetableImport';
import type { MineCalendar } from '../week/school-mine-session';
import type { WorkspaceRole, WorldPage } from './world-pages';
import type { OpenWorld } from './world-mode';
import type { HeldWorld } from './world-calendar-read';
import type { Send, WorldKit } from './world-session';

export type WorkspacePagesProps = {
  readonly open: OpenWorld;
  /** The world's seeded school, which a teachers' world does not have. */
  readonly school: DemoSchool | null;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  /** The bundled reference data, without the world's releases, which a seeded school's term is worked out from. */
  readonly bundled: Extract<ReferenceResult, { ok: true }>;
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
  /** The world's keys and sealing key, held while it is open, which the Ministry publishes with. */
  readonly held: HeldWorld | null;
  /** Reads the world's calendar again, as after the Ministry publishes. */
  readonly onCalendar: () => void;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
};

/** A workspace page's body, or null when the page has none yet. */
export function workspacePage(
  workspace: WorkspaceRole,
  page: WorldPage,
  props: WorkspacePagesProps,
): ReactElement | null {
  const { open, school, reference, kit, send, dayText, trial, year, mine, timetable, onTimetable, onPage } = props;
  const { held, onCalendar, bundled } = props;
  if (workspace === 'observatory' && page === 'insights')
    return <ObsReport world={open} year={year} reference={reference} send={send} />;
  if (school === null) return null;
  if (workspace === 'ministry' && page === 'calendar')
    return (
      <MinistryCalendarPage
        world={open}
        held={held}
        reference={reference}
        kit={kit}
        send={send}
        dayText={dayText}
        onPublished={onCalendar}
      />
    );
  if (workspace === 'operator' && page === 'map') return <OpsConsole world={open} send={send} dayText={dayText} />;
  if (workspace === 'operator' && page === 'admin') return <OpsAdminLog world={open} send={send} dayText={dayText} />;
  if (workspace === 'operator' && page === 'problems')
    return <OpsProblems world={open} send={send} dayText={dayText} />;
  if (workspace === 'operator' && page === 'security')
    return <OpsSecurity world={open} send={send} dayText={dayText} />;
  if (workspace === 'directorate' && page === 'grants')
    return (
      <DirectorateGrant world={open} school={school} reference={reference} kit={kit} send={send} dayText={dayText} />
    );
  if (workspace === 'ministry' && page === 'totals')
    return (
      <MinistryTotals
        world={open}
        calendars={[reference.calendar, bundled.calendar]}
        send={send}
        dayText={dayText}
        subjectName={(code) => subjectName(reference.profile, code)}
        bundled={bundled}
      />
    );
  if (workspace === 'directorate' && page === 'totals')
    return (
      <DirectorateTotals
        world={open}
        school={school}
        wilaya={localized(reference.profile.zones?.find((one) => one.code === school.wilaya)?.name ?? {})}
        calendars={[reference.calendar, bundled.calendar]}
        send={send}
        dayText={dayText}
        subjectName={(code) => subjectName(reference.profile, code)}
        bundled={bundled}
      />
    );
  if (workspace === 'director' && page === 'dashboard')
    return (
      <DashboardPage
        world={open}
        school={school}
        reference={reference}
        trial={trial}
        kit={kit}
        send={send}
        dayText={dayText}
        {...(onPage === undefined ? {} : { onPage })}
      />
    );
  if (workspace === 'director' && page === 'thresholds')
    return (
      <DirectorThresholds
        world={open}
        school={school}
        reference={reference}
        kit={kit}
        send={send}
        dayText={dayText}
        updates={props.updates}
      />
    );
  if (workspace === 'director' && page === 'codes')
    return (
      <IssueCodes world={open} school={school} profile={reference.profile} kit={kit} send={send} dayText={dayText} />
    );
  if (workspace === 'director' && page === 'keys')
    return (
      <SchoolKeys
        world={open}
        school={school}
        held={held}
        reference={bundled}
        kit={kit}
        send={send}
        dayText={dayText}
      />
    );
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
  if (workspace === 'curator' && page === 'packs')
    return <PackList packs={reference.packs} profile={reference.profile} refusedPacks={reference.refusedPacks} />;
  return null;
}
