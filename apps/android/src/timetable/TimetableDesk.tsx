// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable page of the director's and the preparer's workspaces in a demo
// world (#576 to #579): the timetable brought in and checked
// (TimetableImport.tsx); for the director, under the checks, the next version
// checked and published (TimetableSend.tsx), and below it, whether or not a
// timetable was read, the teachers' proposals waiting for a decision
// (TimetableProposals.tsx), which work from the standing version, and the
// teachers' receipts of the versions sent (TimetableReceipts.tsx).

import type { BellData, Day, DemoSchool, Weekday } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { levelBells } from './timetable-words';
import { TimetableImport, type TimetableRead } from './TimetableImport';
import { TimetableProposals } from './TimetableProposals';
import { TimetableReceipts } from './TimetableReceipts';
import { TimetableSend } from './TimetableSend';

export type TimetableDeskProps = {
  readonly role: 'director' | 'preparer';
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly bells: BellData;
  readonly workingDays: readonly Weekday[];
  /** The timetable read so far in this world, or null. */
  readonly read: TimetableRead | null;
  readonly onRead: (read: TimetableRead | null) => void;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

/** The timetable page: the timetable brought in, and for the director its versions and the proposals. */
export function TimetableDesk({
  role,
  world,
  school,
  bells,
  workingDays,
  read,
  onRead,
  kit,
  send,
  dayText,
}: TimetableDeskProps) {
  const times = levelBells(bells, school.level);
  return (
    <>
      <TimetableImport level={school.level} bells={bells} workingDays={workingDays} read={read} onRead={onRead}>
        {role === 'director' && read !== null && (
          <TimetableSend
            world={world}
            school={school}
            sessions={read.result.sessions}
            bells={times}
            workingDays={workingDays}
            kit={kit}
            send={send}
            dayText={dayText}
          />
        )}
      </TimetableImport>
      {role === 'director' && (
        <TimetableProposals world={world} school={school} bells={times} kit={kit} send={send} dayText={dayText} />
      )}
      {role === 'director' && (
        <TimetableReceipts world={world} school={school} kit={kit} send={send} dayText={dayText} />
      )}
    </>
  );
}
