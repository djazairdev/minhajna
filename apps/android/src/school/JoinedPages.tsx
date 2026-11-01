// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joined card's own pages on School-join (join-view.ts): the teacher's
// devices and copies (DevicesMoved.tsx), who reads what in the national system
// (NationalHelp.tsx), the timetable the school sent (TeacherTimetable.tsx), the
// week to sign (WeekSign.tsx), on a course when one was chosen, the weekly
// digest (WeekDigest.tsx), which opens the week to sign on a course, the
// teacher's classes as the director sees them (SchoolMine.tsx), which opens the
// week to sign and the term report (SchoolMineReport.tsx), the classes handed
// over to the teacher as a substitute (HandoverSchool.tsx), those come back at
// the end of one (ReturnSchool.tsx), the term's marks to send to the state's
// stand-in (TermSend.tsx), and what stays and goes on leaving (Leave.tsx), when
// the year's dates read; each gets what School-join said as it opened, and goes
// back to School-join, but Week-sign opened from the digest or the classes, and
// the term report, which go back to the page that opened them; each opens
// another page through School-join's view.

import type { Day, DemoSchool, LeavingDates, Subject, Weekday } from '@minhajna/core';
import type { ReactElement } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { TeacherTimetable } from '../timetable/TeacherTimetable';
import type { MineCalendar } from '../week/school-mine-session';
import { SchoolMine } from '../week/SchoolMine';
import { SchoolMineReport } from '../week/SchoolMineReport';
import { WeekDigest } from '../week/WeekDigest';
import { WeekSign } from '../week/WeekSign';
import { DevicesMoved } from './DevicesMoved';
import { HandoverSchool } from './HandoverSchool';
import { Leave } from './Leave';
import { NationalHelp } from './NationalHelp';
import { ReturnSchool } from './ReturnSchool';
import { TermSend } from './TermSend';
import type { JoinedView, JoinPage } from './join-view';

export type JoinedPagesProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly date: string;
  readonly dayText: (day: Day) => string;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly year: string;
  readonly workingDays?: readonly Weekday[];
  readonly subjects?: readonly Subject[];
  /** What School-join said as the page opened. */
  readonly said: string;
  readonly dates: LeavingDates | null;
  /** Back to School-join. */
  readonly onClose: () => void;
  /** Back to School-join's code card, for the next school. */
  readonly onJoin: () => void;
  /** The joined school's calendar, for its term and closures. */
  readonly mine?: MineCalendar;
  /** The world's school, rebuilt from the world's ID, whose classes list their pupils. */
  readonly school?: DemoSchool | null;
  /** Opens another joined page, such as the week to sign on a course, going back to the page that opened it. */
  readonly onPage: (view: JoinedView) => void;
};

/** A joined card's page, or null when it has none to show. */
export function joinedPage(view: JoinedView, props: JoinedPagesProps): ReactElement | null {
  const { world, date, dayText, kit, send, year, workingDays, subjects, said, dates, onClose, onJoin } = props;
  const { join } = view;
  const shown = { date, join, dayText, onClose, said };
  const channel = { ...shown, world, kit, send, workingDays };
  if (view.page === 'devices') return <DevicesMoved {...shown} />;
  if (view.page === 'help') return <NationalHelp {...shown} />;
  if (view.page === 'timetable') return <TeacherTimetable {...channel} />;
  if (view.page === 'week') return <WeekSign {...channel} subjects={subjects} course={view.course} />;
  if (view.page === 'digest') {
    return (
      <WeekDigest
        {...channel}
        subjects={subjects}
        onSign={(course) => props.onPage({ page: 'week', join, course, back: 'digest' })}
      />
    );
  }
  if (view.page === 'mine') {
    const back = (page: JoinPage) => () => props.onPage({ page, join, back: 'mine' });
    return (
      <SchoolMine {...channel} subjects={subjects} mine={props.mine} onSign={back('week')} onReport={back('report')} />
    );
  }
  if (view.page === 'handover') return <HandoverSchool {...channel} />;
  if (view.page === 'return') return <ReturnSchool {...channel} />;
  if (view.page === 'report') return <SchoolMineReport {...channel} mine={props.mine} />;
  if (view.page === 'termSend') {
    return <TermSend {...channel} subjects={subjects} mine={props.mine} school={props.school} />;
  }
  return dates === null ? null : <Leave {...shown} year={year} dates={dates} onJoin={onJoin} />;
}
