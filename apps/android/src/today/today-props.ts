// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Day, HomeworkItem, Session } from '@minhajna/core';
import type { TodayExamsOpen } from '../exams/TodayExams';
import type { RamadanOpen } from './RamadanCards';

/**
 * Where the Today tab leads: `onHelp` opens Help, `onExtra` a session outside the timetable, `onDetails` a
 * session's details, `onRoll` its roll call, `onHomework` the homework that comes back, `onCalendarUpdate` what an
 * update changed, `onBackupSheet` the recovery sheet for a first backup, `onJournal` a primary day's journal, and
 * `onJoin` the joining of the school while no class has arrived.
 */
export interface TodayProps {
  onHelp: () => void;
  onSettings?: () => void;
  onExtra?: () => void;
  onDetails: (session: Session) => void;
  onRoll: (session: Session) => void;
  onHomework?: (item: HomeworkItem) => void;
  onExams?: TodayExamsOpen;
  onCalendarUpdate?: (release: string) => void;
  onBackupSheet?: () => void;
  onRamadan?: RamadanOpen;
  onJournal?: (day: Day) => void;
  onJoin?: () => void;
}
