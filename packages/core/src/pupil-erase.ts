// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erasing the data of a pupil who left (#248, Pupil-erase, R-5.5-13, answer
// 473), once the director confirmed the departure. Every version of the
// pupil's own records goes: the pupil with their movements, marks and their
// corrections, what was tapped for them, observations and appreciations. The
// roll calls they were absent or late in and the seating plans with their
// seat are the class's, so each version is restated without them before the
// old ones are erased (restated.ts). The history keeps only the fact: the
// class and the entries erased. The pupil's place on the class list stays
// taken, so no other pupil's number changes.

import { compareDays } from './day.ts';
import { eventOf, type RecordEvent } from './events.ts';
import type { Entry } from './history.ts';
import { recordKey } from './record-keys.ts';
import type { Pupil } from './records.ts';
import type { Restatements } from './restated.ts';

/** What the history keeps of an erasure: the class, and every entry it erased. */
export interface PupilErasure {
  readonly classId: string;
  readonly entries: readonly string[];
}

/** Whether a pupil's data may be erased: their last movement is a departure the director confirmed. */
export function departed(pupil: Pupil): boolean {
  const last = [...pupil.movements].sort((a, b) => compareDays(a.day, b.day)).at(-1);
  return last?.kind === 'out' && last.confirmed === true;
}

/** Whether an event names the pupil, in a record of their own or in one shared with the class. */
function namesPupil(event: RecordEvent, pupilId: string): boolean {
  switch (event.kind) {
    case 'pupil.set':
      return event.pupil.id === pupilId;
    case 'pupil.moved':
      return event.pupilId === pupilId;
    case 'mark.set':
      return event.mark.pupilId === pupilId;
    case 'mark.corrected':
      return event.fix.mark.pupilId === pupilId;
    case 'capture.set':
      return event.capture.pupilId === pupilId;
    case 'observation.set':
      return event.observation.pupilId === pupilId;
    case 'appreciation.set':
      return event.appreciation.pupilId === pupilId;
    case 'roll-call.taken':
      return (
        event.rollCall.absent.some((absence) => absence.pupilId === pupilId) || event.rollCall.late.includes(pupilId)
      );
    case 'seating.set':
      return event.plan.seats.some((seat) => seat.pupilId === pupilId);
    default:
      return false;
  }
}

/**
 * The entries erasing the pupil's data takes: every version still counting of each record that names them. An
 * entry a restatement replaced no longer counts, and the erasure that replaced it erases it.
 */
export function pupilEntries(entries: readonly Entry[], restated: Restatements, pupilId: string): string[] {
  const counting = entries.flatMap((entry) => {
    const event = restated.replaced.has(entry.id) ? null : eventOf(entry);
    return event === null ? [] : [{ id: entry.id, event }];
  });
  const touched = new Set(counting.filter((one) => namesPupil(one.event, pupilId)).map((one) => recordKey(one.event)));
  return counting.filter((one) => touched.has(recordKey(one.event))).map((one) => one.id);
}

/** A version of a shared record without the pupil, standing for `stands`; null for a record of the pupil's own. */
export function withoutPupil(event: RecordEvent, pupilId: string, stands: string): RecordEvent | null {
  switch (event.kind) {
    case 'roll-call.taken': {
      const { rollCall } = event;
      return {
        ...event,
        rollCall: {
          ...rollCall,
          absent: rollCall.absent.filter((absence) => absence.pupilId !== pupilId),
          late: rollCall.late.filter((id) => id !== pupilId),
        },
        restates: stands,
      };
    }
    case 'seating.set':
      return {
        ...event,
        plan: { ...event.plan, seats: event.plan.seats.filter((seat) => seat.pupilId !== pupilId) },
        restates: stands,
      };
    default:
      return null;
  }
}
