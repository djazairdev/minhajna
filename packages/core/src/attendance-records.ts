// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Day } from './day.ts';
import type { Half, Rotation } from './records.ts';

export interface PupilMovement {
  readonly day: Day;
  readonly kind: 'in' | 'out';
  readonly reason: string;
  /** For a pupil who left: the director's confirmation (PRD §3.2). */
  readonly confirmed?: boolean;
}

/** Only the existing pupil fields in PRD §5.6. */
export interface Pupil {
  readonly id: string;
  readonly classId: string;
  /** Optional official registration number, used for matching instead of names. */
  readonly registration?: string;
  readonly name: string;
  readonly latinName?: string;
  readonly sex: 'f' | 'm';
  /** Half-groups and option groups. Every pupil is in the whole-class group. */
  readonly groups: readonly string[];
  readonly movements: readonly PupilMovement[];
}

export interface Absence {
  readonly pupilId: string;
  /** Justified or unjustified. The cause is never typed (PRD §5.6). */
  readonly justified: boolean;
}

/** One roll call: everyone is present except those marked (PRD §3.4). */
export interface RollCall {
  readonly unit: string;
  readonly classId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly half: Half;
  readonly absent: readonly Absence[];
  readonly late: readonly string[];
  readonly rotation?: Rotation;
}
